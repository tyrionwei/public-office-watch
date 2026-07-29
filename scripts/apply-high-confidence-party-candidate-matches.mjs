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
  if (argv.length === 0) return { write: false };
  if (argv.length === 1 && argv[0] === '--write') return { write: true };
  throw new Error('Usage: node scripts/apply-high-confidence-party-candidate-matches.mjs [--write]');
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function highConfidenceCandidate(source) {
  if (!source.source_person_key.startsWith('party-candidate:')) return { status: 'skip' };
  const payload = objectValue(source.source_payload);
  const identity = objectValue(payload?.identitySuggestion);
  if (identity?.resolution !== 'high_confidence_match') return { status: 'skip' };

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
  if (!evidence.includes('party') || !evidence.includes('geography')) {
    errors.push('party and geography evidence are both required');
  }

  if (errors.length > 0) return { status: 'blocked', errors };
  return {
    status: 'eligible',
    sourceCandidateKey,
    personId: selectedPersonId,
    raceId,
  };
}

function planHighConfidenceMatches({ sources, matches, claims, candidates }) {
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
    const parsed = highConfidenceCandidate(source);
    if (parsed.status === 'skip') continue;
    if (parsed.status === 'blocked') {
      blocking.push({ sourcePersonKey: source.source_person_key, personName: source.raw_name, errors: parsed.errors });
      continue;
    }

    const confirmedMatch = (matchesBySource.get(source.id) ?? []).find((match) => match.match_status === 'auto_matched');
    if (confirmedMatch) {
      if (confirmedMatch.person_id !== parsed.personId) {
        blocking.push({
          sourcePersonKey: source.source_person_key,
          personName: source.raw_name,
          errors: ['confirmed identity differs from the high-confidence candidate'],
        });
      } else {
        alreadyConfirmed.push({ source, ...parsed });
      }
      continue;
    }

    const sourceClaims = claimsBySource.get(source.id) ?? [];
    if (sourceClaims.length !== 1) {
      blocking.push({
        sourcePersonKey: source.source_person_key,
        personName: source.raw_name,
        errors: [`expected one staged claim, found ${sourceClaims.length}`],
      });
      continue;
    }

    const externalId = `party-candidate:${parsed.sourceCandidateKey}`;
    const existingCandidate = candidatesByExternalId.get(externalId);
    if (existingCandidate && (
      existingCandidate.person_id !== parsed.personId || existingCandidate.race_id !== parsed.raceId
    )) {
      blocking.push({
        sourcePersonKey: source.source_person_key,
        personName: source.raw_name,
        errors: ['existing candidate conflicts with selected person or race'],
      });
      continue;
    }

    eligible.push({ source, claim: sourceClaims[0], externalId, ...parsed });
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
      headers: headers(config, 'resolution=merge-duplicates,return=minimal'),
      body: JSON.stringify(rows.slice(index, index + 100)),
      signal: AbortSignal.timeout(30000),
    });
    await responseJson(response, `Failed to upsert ${tableName}`);
  }
}

async function patchRows(config, tableName, filters, row) {
  const url = restUrl(config, tableName);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: headers(config, 'return=minimal'),
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(30000),
  });
  await responseJson(response, `Failed to update ${tableName}`);
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

async function applyPlan(config, plan, reviewedAt) {
  await upsertRows(config, 'candidates', plan.eligible.map((item) => ({
    external_id: item.externalId,
    person_id: item.personId,
    race_id: item.raceId,
    party: item.source.party,
    registration_status: 'unknown',
    candidacy_status: 'party_nominee',
    election_result: 'pending',
    status_updated_at: reviewedAt,
    source_name: item.source.source_name,
    source_url: item.source.source_url,
    is_public: false,
    updated_at: reviewedAt,
  })), 'external_id');

  await upsertRows(config, 'person_identity_matches', plan.eligible.map((item) => ({
    source_person_id: item.source.id,
    person_id: item.personId,
    match_status: 'auto_matched',
    score: 100,
    match_method: 'party_candidate_high_confidence_v1',
    match_reason: 'Exact name with matching party and geography; unique canonical person',
    evidence_json: {
      version: 'party-candidate-high-confidence-v1',
      sourceCandidateKey: item.sourceCandidateKey,
      evidence: ['party', 'geography'],
    },
    reviewed_by: 'party-candidate-high-confidence-v1',
    reviewed_at: reviewedAt,
    updated_at: reviewedAt,
  })), 'source_person_id,person_id');

  for (let index = 0; index < plan.eligible.length; index += 20) {
    await Promise.all(plan.eligible.slice(index, index + 20).flatMap((item) => [
      patchRows(config, 'source_people', { id: `eq.${item.source.id}` }, {
        is_public: false,
        updated_at: reviewedAt,
      }),
      patchRows(config, 'person_claims', { id: `eq.${item.claim.id}` }, {
        person_id: item.personId,
        review_status: 'verified',
        visibility: 'review_only',
        is_public: false,
        scoring_version: 'party-candidate-high-confidence-v1',
        scoring_reasons: [{
          reason: 'Exact name with matching party and geography; unique canonical person',
          reviewedAt,
        }],
        updated_at: reviewedAt,
      }),
    ]));
  }
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

  const sources = await fetchRows(config, 'source_people', 'id,source_person_key,raw_name,party,source_name,source_url,source_payload', {
    source_person_key: 'like.party-candidate:*',
  });
  const [matches, claims, candidates] = await Promise.all([
    fetchRowsByValues(config, 'person_identity_matches', 'source_person_id,person_id,match_status', 'source_person_id', sources.map((row) => row.id)),
    fetchRowsByValues(config, 'person_claims', 'id,source_person_id,review_status,visibility,is_public', 'source_person_id', sources.map((row) => row.id)),
    fetchRows(config, 'candidates', 'external_id,person_id,race_id,is_public', { external_id: 'like.party-candidate:*' }),
  ]);
  const plan = planHighConfidenceMatches({ sources, matches, claims, candidates });
  if (plan.blocking.length > 0) {
    console.log(JSON.stringify({ status: 'blocked', blocking: plan.blocking }, null, 2));
    process.exitCode = 1;
    return;
  }

  const reviewedAt = new Date().toISOString();
  if (options.write) await applyPlan(config, plan, reviewedAt);
  console.log(JSON.stringify({
    status: 'ok',
    mode: options.write ? 'write' : 'dry-run',
    sourceCount: sources.length,
    eligibleCount: plan.eligible.length,
    alreadyConfirmedCount: plan.alreadyConfirmed.length,
    eligibleByParty: countByParty(plan.eligible),
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

export { highConfidenceCandidate, planHighConfidenceMatches };
