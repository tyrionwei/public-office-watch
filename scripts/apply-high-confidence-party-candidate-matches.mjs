import { assertPartyCandidateRevision, partyCandidateBaseKey } from './party-candidate-revision.mjs';
import { assertLocalSupabase, insertOnce, patchExpected } from './party-candidate-review.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

function parseArgs(argv) {
  const supported = new Set(['--write', '--include-probable-context']);
  for (const arg of argv) {
    if (!supported.has(arg)) {
      throw new Error('Usage: node scripts/apply-high-confidence-party-candidate-matches.mjs [--include-probable-context] [--write]');
    }
  }
  return {
    write: argv.includes('--write'),
    includeProbableContext: argv.includes('--include-probable-context'),
  };
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function candidateForAutoMatch(source, includeProbableContext = false) {
  if (!source.source_person_key.startsWith('party-candidate:')) return { status: 'skip' };
  const payload = objectValue(source.source_payload);
  const identity = objectValue(payload?.identitySuggestion);
  const resolution = identity?.resolution;
  if (resolution !== 'high_confidence_match' && resolution !== 'probable_match') return { status: 'skip' };
  if (resolution === 'probable_match' && !includeProbableContext) return { status: 'skip' };

  const selectedPersonId = String(identity.selectedCanonicalPersonId ?? '').trim();
  const sourceCandidateKey = String(payload?.sourceCandidateKey ?? '').trim();
  const targetRace = objectValue(payload?.targetRace);
  const raceId = String(targetRace?.id ?? '').trim();
  const candidacyStatus = String(payload?.candidacyStatus ?? '').trim();
  const canonicalCandidates = Array.isArray(identity.canonicalCandidates) ? identity.canonicalCandidates : [];
  const selectedGroup = canonicalCandidates.find((candidate) => (
    objectValue(candidate)?.canonicalPersonId === selectedPersonId
  ));
  const evidence = Array.isArray(objectValue(selectedGroup)?.evidence)
    ? objectValue(selectedGroup).evidence.map(String)
    : [];
  const errors = [];

  if (!selectedPersonId) errors.push('selected canonical person is missing');
  if (!sourceCandidateKey) errors.push('source candidate key is missing');
  if (!raceId) errors.push('target race is missing');
  if (candidacyStatus !== 'party_nominee') errors.push('candidacy status is not party_nominee');
  if (!source.party) errors.push('party is missing');
  if (!selectedGroup) errors.push('selected canonical person is not in identity candidates');
  if (resolution === 'high_confidence_match' && (!evidence.includes('party') || !evidence.includes('geography'))) {
    errors.push('party and geography evidence are both required');
  }
  if (resolution === 'probable_match' && !evidence.includes('party') && !evidence.includes('geography')) {
    return { status: 'skip' };
  }

  if (errors.length > 0) return { status: 'blocked', errors };
  return {
    status: 'eligible',
    sourceCandidateKey,
    personId: selectedPersonId,
    raceId,
    resolution,
    evidence,
  };
}

function highConfidenceCandidate(source) {
  return candidateForAutoMatch(source, false);
}

function planHighConfidenceMatches({ sources, matches, claims, candidates }, options = {}) {
  const matchesBySource = new Map();
  for (const match of matches) {
    matchesBySource.set(match.source_person_id, [...(matchesBySource.get(match.source_person_id) ?? []), match]);
  }
  const claimsBySource = new Map();
  for (const claim of claims) {
    claimsBySource.set(claim.source_person_id, [...(claimsBySource.get(claim.source_person_id) ?? []), claim]);
  }
  const candidatesByExternalId = new Map(candidates.map((candidate) => [candidate.external_id, candidate]));
  const eligible = [];
  const alreadyConfirmed = [];
  const blocking = [];

  for (const source of sources) {
    const parsed = candidateForAutoMatch(source, options.includeProbableContext === true);
    if (parsed.status === 'skip') continue;
    if (parsed.status === 'blocked') {
      blocking.push({ sourcePersonKey: source.source_person_key, personName: source.raw_name, errors: parsed.errors });
      continue;
    }

    const sourceClaims = (claimsBySource.get(source.id) ?? []).filter(row => row.claim_type === 'candidacy');
    const sourceMatches = matchesBySource.get(source.id) ?? [];
    const errors = [];
    const claim = sourceClaims[0];
    if (sourceClaims.length !== 1) errors.push(`expected one staged claim, found ${sourceClaims.length}`);
    if (claim && !['pending', 'verified'].includes(claim.review_status)) errors.push('claim has a manual hold or terminal rejection');
    if (claim?.person_id && claim.person_id !== parsed.personId) errors.push('claim identifies another person');
    if (sourceMatches.length > 1) errors.push('multiple identity matches require manual review');
    const match = sourceMatches[0];
    if (match?.match_status === 'rejected_match') errors.push('identity match is rejected');
    if (match?.person_id && match.person_id !== parsed.personId) errors.push('identity match identifies another person');
    if (match?.reviewed_at && match.match_status !== 'auto_matched') errors.push('identity has a manual hold');
    let externalId;
    try { externalId = partyCandidateBaseKey(source); assertPartyCandidateRevision(source, claim); }
    catch (error) { errors.push(error.message); }
    const existingCandidate = candidatesByExternalId.get(externalId);
    if (existingCandidate && (existingCandidate.person_id !== parsed.personId || existingCandidate.race_id !== parsed.raceId || existingCandidate.party !== source.party)) errors.push('existing candidate conflicts with selected person, race, or party');
    if (existingCandidate && (existingCandidate.candidacy_status !== 'party_nominee' || existingCandidate.registration_status !== 'unknown' || existingCandidate.election_result !== 'pending')) errors.push('existing candidate status requires separate review');
    const complete = existingCandidate && match?.match_status === 'auto_matched' && claim?.review_status === 'verified' && claim.person_id === parsed.personId;
    if (source.source_payload?.requiresManualReview === true && (!complete || claim?.scoring_version !== 'party-candidate-manual-review-v2')) errors.push('changed source revision requires new manual review');
    if (errors.length) {
      blocking.push({ sourcePersonKey: source.source_person_key, personName: source.raw_name, errors });
    } else if (complete) {
      alreadyConfirmed.push({ source, claim, match, existingCandidate, externalId, ...parsed });
    } else {
      eligible.push({ source, claim, match, existingCandidate, externalId, ...parsed });
    }
  }

  return { eligible, alreadyConfirmed, blocking };
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

function headers(config, prefer) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
    ...(prefer ? { prefer } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, { headers: headers(config), signal: AbortSignal.timeout(30000) });
    const page = await responseJson(response, `Failed to fetch ${tableName}`);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchRowsByValues(config, tableName, select, column, values) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  const rows = [];
  for (let index = 0; index < unique.length; index += 80) {
    const chunk = unique.slice(index, index + 80);
    rows.push(...await fetchRows(config, tableName, select, {
      [column]: `in.(${chunk.map(quotePostgrestValue).join(',')})`,
    }));
  }
  return rows;
}

async function upsertRows(config, tableName, rows, conflictKey) {
  for (let index = 0; index < rows.length; index += 100) {
    const url = restUrl(config, tableName);
    url.searchParams.set('on_conflict', conflictKey);
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(config, 'resolution=ignore-duplicates,return=minimal'),
      body: JSON.stringify(rows.slice(index, index + 100)),
      signal: AbortSignal.timeout(30000),
    });
    await responseJson(response, `Failed to upsert ${tableName}`);
  }
}


function countByParty(items) {
  return Object.fromEntries(
    Array.from(items.reduce((counts, item) => {
      const party = item.source.party;
      counts.set(party, (counts.get(party) ?? 0) + 1);
      return counts;
    }, new Map()).entries()).sort(([left], [right]) => left.localeCompare(right, 'zh-Hant')),
  );
}

function countByEvidence(items) {
  return Object.fromEntries(
    Array.from(items.reduce((counts, item) => {
      const key = item.evidence.includes('party') && item.evidence.includes('geography')
        ? 'party_and_geography'
        : item.evidence.includes('party')
          ? 'party_only'
          : 'geography_only';
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map()).entries()).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function reviewMetadata(item) {
  if (item.resolution === 'high_confidence_match') {
    return {
      version: 'party-candidate-high-confidence-v1',
      reason: 'Exact name with matching party and geography; unique canonical person',
    };
  }
  const context = item.evidence.includes('party') ? 'party' : 'geography';
  return {
    version: 'party-candidate-probable-context-v1',
    reason: `Exact name with matching ${context}; unique canonical person`,
  };
}

async function currentItem(config, item) {
  const sources = await fetchRows(config, 'source_people', '*', { id: `eq.${item.source.id}` });
  const [matches, claims, candidates] = await Promise.all([
    fetchRows(config, 'person_identity_matches', '*', { source_person_id: `eq.${item.source.id}` }),
    fetchRows(config, 'person_claims', '*', { source_person_id: `eq.${item.source.id}`, claim_type: 'eq.candidacy' }),
    fetchRows(config, 'candidates', '*', { external_id: `eq.${item.externalId}` }),
  ]);
  if (sources.length !== 1 || JSON.stringify(sources[0].source_payload) !== JSON.stringify(item.source.source_payload)) throw new Error('Source changed since identity planning');
  const plan = planHighConfidenceMatches({ sources, matches, claims, candidates }, { includeProbableContext: true });
  if (plan.blocking.length || plan.eligible.length + plan.alreadyConfirmed.length !== 1) throw new Error(plan.blocking.flatMap(row => row.errors).join('; ') || 'Source is no longer eligible');
  return { item: plan.eligible[0] ?? plan.alreadyConfirmed[0], complete: plan.alreadyConfirmed.length === 1 };
}

async function applyPlan(config, plan, reviewedAt) {
  assertLocalSupabase(config);
  if (plan.blocking.length) throw new Error('Cannot apply blocked identity plan');
  const results = [];
  for (const planned of plan.eligible) {
    let changed = false, writeAttempted = false;
    try {
      const current = await currentItem(config, planned);
      if (current.complete) { results.push({ sourcePersonKey: planned.source.source_person_key, status: 'unchanged' }); continue; }
      const item = current.item;
      writeAttempted = true;
      const candidate = await insertOnce(config, 'candidates', {
        external_id: item.externalId, person_id: item.personId, race_id: item.raceId, party: item.source.party,
        registration_status: 'unknown', candidacy_status: 'party_nominee', election_result: 'pending',
        status_updated_at: reviewedAt, source_name: item.source.source_name, source_url: item.source.source_url,
        is_public: false, updated_at: reviewedAt,
      }, 'external_id');
      changed ||= candidate.created;
      if (candidate.row.person_id !== item.personId || candidate.row.race_id !== item.raceId || candidate.row.party !== item.source.party
        || candidate.row.candidacy_status !== 'party_nominee' || candidate.row.registration_status !== 'unknown' || candidate.row.election_result !== 'pending') throw new Error('Candidate changed concurrently; preserved');
      const metadata = reviewMetadata(item);
      const identity = {
        source_person_id: item.source.id, person_id: item.personId, match_status: 'auto_matched', score: 100,
        match_method: metadata.version.replaceAll('-', '_'), match_reason: metadata.reason,
        evidence_json: { version: metadata.version, sourceCandidateKey: item.sourceCandidateKey, evidence: item.evidence,
          contentRevision: item.source.source_payload?.revision ?? null },
        reviewed_by: metadata.version, reviewed_at: reviewedAt, updated_at: reviewedAt,
      };
      if (!item.match) {
        await upsertRows(config, 'person_identity_matches', [identity], 'source_person_id,person_id');
        changed = true;
      } else if (item.match.match_status !== 'auto_matched') {
        await patchExpected(config, 'person_identity_matches', item.match, identity, ['match_status', 'reviewed_at', 'person_id']);
        changed = true;
      }
      // Re-read all rows after the identity step. A manual rejection cannot be
      // erased to compensate for a partially completed private write.
      const resumed = await currentItem(config, planned);
      if (!resumed.complete) {
        if (resumed.item.match?.match_status !== 'auto_matched') throw new Error('Identity confirmation did not complete');
        await patchExpected(config, 'person_claims', resumed.item.claim, {
          person_id: item.personId, review_status: 'verified', visibility: 'review_only', is_public: false,
          scoring_version: metadata.version, scoring_reasons: [{ reason: metadata.reason, reviewedAt }], updated_at: reviewedAt,
        }, ['review_status', 'person_id', 'claim_json', 'visibility', 'is_public']);
        changed = true;
      }
      if (!(await currentItem(config, planned)).complete) throw new Error('Identity workflow remains incomplete');
      results.push({ sourcePersonKey: item.source.source_person_key, status: 'completed' });
    } catch (error) {
      results.push({ sourcePersonKey: planned.source.source_person_key, status: changed || writeAttempted ? 'incomplete' : 'conflict', error: error.message });
    }
  }
  return { results, completed: results.filter(row => row.status === 'completed').length,
    unchanged: results.filter(row => row.status === 'unchanged').length,
    incomplete: results.filter(row => ['incomplete', 'conflict'].includes(row.status)).length };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('High-confidence party candidate matching is local-only');
  }

  const sources = await fetchRows(config, 'source_people', '*', {
    source_person_key: 'like.party-candidate:*',
  });
  const [matches, claims, candidates] = await Promise.all([
    fetchRowsByValues(config, 'person_identity_matches', '*', 'source_person_id', sources.map((row) => row.id)),
    fetchRowsByValues(config, 'person_claims', '*', 'source_person_id', sources.map((row) => row.id)),
    fetchRows(config, 'candidates', '*', { external_id: 'like.party-candidate:*' }),
  ]);
  const plan = planHighConfidenceMatches(
    { sources, matches, claims, candidates },
    { includeProbableContext: options.includeProbableContext },
  );
  if (plan.blocking.length > 0) {
    console.log(JSON.stringify({ status: 'blocked', blocking: plan.blocking }, null, 2));
    process.exitCode = 1;
    return;
  }

  const reviewedAt = new Date().toISOString();
  const applied = options.write ? await applyPlan(config, plan, reviewedAt) : null;
  if (applied?.incomplete) process.exitCode = 1;
  console.log(JSON.stringify({
    status: applied?.incomplete ? 'needs_attention' : 'ok',
    applied,
    mode: options.write ? 'write' : 'dry-run',
    includeProbableContext: options.includeProbableContext,
    sourceCount: sources.length,
    eligibleCount: plan.eligible.length,
    alreadyConfirmedCount: plan.alreadyConfirmed.length,
    eligibleByParty: countByParty(plan.eligible),
    eligibleByEvidence: countByEvidence(plan.eligible),
    alreadyConfirmedByParty: countByParty(plan.alreadyConfirmed),
    reviewedAt: options.write ? reviewedAt : null,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { candidateForAutoMatch, highConfidenceCandidate, planHighConfidenceMatches, applyPlan };
