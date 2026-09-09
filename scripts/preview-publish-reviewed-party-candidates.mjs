import { patchExpected } from './party-candidate-review.mjs';
import { partyCandidateBaseKey, assertPartyCandidateRevision, selectPartyCandidateSources } from './party-candidate-revision.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const expectedCandidateCount = 317;
const expectedExcludedSourceCount = 1;
const partyPublicationExpectations = new Map([
  ['台灣民眾黨', { candidates: 105, excludedSources: 0 }],
]);
const profileFields = ['education', 'experience', 'platform'];

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator),
          line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  let write = false;
  let party = null;
  let revisionSelectionPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--write') {
      write = true;
      continue;
    }
    if (argv[index] === '--revisions' && argv[index + 1]) { revisionSelectionPath = path.resolve(argv[++index]); continue; }
    if (argv[index] === '--party' && argv[index + 1]) {
      party = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error('Usage: node scripts/preview-publish-reviewed-party-candidates.mjs [--write] [--party <name>] [--revisions <json-path>]');
  }
  if (party && !partyPublicationExpectations.has(party)) {
    throw new Error(`No reviewed publication expectations are configured for party: ${party}`);
  }
  return { write, party, revisionSelectionPath };
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key];
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}

function scopeDatasetToParty(dataset, party) {
  if (!party) return dataset;
  return {
    ...dataset,
    sources: dataset.sources.filter((source) => source.party === party),
  };
}

function countByParty(items) {
  return Object.fromEntries(
    Array.from(items.reduce((counts, item) => {
      counts.set(item.source.party, (counts.get(item.source.party) ?? 0) + 1);
      return counts;
    }, new Map()).entries()).sort(([left], [right]) => left.localeCompare(right, 'zh-Hant')),
  );
}

function planReviewedPartyCandidatePublication(dataset, options = {}) {
  const expectedCount = options.expectedCount ?? expectedCandidateCount;
  const expectedExcludedCount = options.expectedExcludedCount ?? expectedExcludedSourceCount;
  const candidatesByExternalId = new Map(dataset.candidates.map((row) => [row.external_id, row]));
  const matchesBySource = groupBy(dataset.matches, 'source_person_id');
  const claimsBySource = groupBy(dataset.claims, 'source_person_id');
  const canonicalByPerson = new Map(dataset.canonicalMap.map((row) => [row.person_id, row]));
  const peopleById = new Map(dataset.people.map((row) => [row.id, row]));
  const racesById = new Map(dataset.races.map((row) => [row.id, row]));
  const eligible = [];
  const excluded = [];
  let selection;
  try { selection = selectPartyCandidateSources(dataset.sources, options.revisionSelections); }
  catch (error) { return { eligible, excluded, blocking: [{ errors: [error.message] }] }; }
  const blocking = [...selection.blocking];

  for (const source of selection.selected) {
    const candidate = candidatesByExternalId.get(partyCandidateBaseKey(source));
    const sourceMatches = matchesBySource.get(source.id) ?? [];
    const sourceClaims = claimsBySource.get(source.id) ?? [];
    const candidacyClaims = sourceClaims.filter((claim) => claim.claim_type === 'candidacy');
    const rejectedClaim = candidacyClaims.length === 1
      && candidacyClaims[0].review_status === 'rejected'
      && candidacyClaims[0].visibility === 'private'
      && candidacyClaims[0].is_public === false;
    const rejectedMatch = sourceMatches.length > 0
      && sourceMatches.every((match) => match.match_status === 'rejected_match');

    if (!candidate && rejectedClaim && rejectedMatch && source.is_public === false) {
      excluded.push({ source, reason: 'reviewed source was rejected before publication' });
      continue;
    }

    const publicationReview = objectValue(objectValue(source.source_payload)?.publicationReview);
    const pendingCecClaim = candidacyClaims.length === 1
      && candidacyClaims[0].review_status === 'needs_more_evidence'
      && candidacyClaims[0].visibility === 'private'
      && candidacyClaims[0].is_public === false;
    const pendingCecMatch = sourceMatches.length === 1
      && sourceMatches[0].match_status === 'auto_matched'
      && sourceMatches[0].person_id === candidate?.person_id;
    if (
      publicationReview?.status === 'awaiting_cec_confirmation'
      && source.is_public === false
      && candidate?.is_public === false
      && candidate?.candidacy_status === 'potential'
      && candidate?.registration_status === 'unknown'
      && candidate?.election_result === 'pending'
      && pendingCecClaim
      && pendingCecMatch
    ) {
      excluded.push({ source, reason: 'private identity is awaiting CEC candidacy confirmation' });
      continue;
    }

    const errors = [];
    try { assertPartyCandidateRevision(source, candidacyClaims[0]); } catch (error) { errors.push(error.message); }
    if (source.source_payload?.requiresManualReview === true && candidacyClaims[0]?.scoring_version !== 'party-candidate-manual-review-v2') errors.push('changed revision has no new manual content review');
    const targetRace = objectValue(objectValue(source.source_payload)?.targetRace);
    const confirmedMatches = sourceMatches.filter((match) => match.match_status === 'auto_matched');
    const claim = candidacyClaims[0];
    const canonical = candidate ? canonicalByPerson.get(candidate.person_id) : null;
    const person = candidate ? peopleById.get(candidate.person_id) : null;
    const race = candidate ? racesById.get(candidate.race_id) : null;

    if (!candidate) errors.push('candidate row is missing');
    if (confirmedMatches.length !== 1) errors.push(`expected one confirmed identity match, found ${confirmedMatches.length}`);
    if (candidacyClaims.length !== 1) errors.push(`expected one candidacy claim, found ${candidacyClaims.length}`);
    if (candidate && confirmedMatches[0]?.person_id !== candidate.person_id) errors.push('identity match and candidate person differ');
    if (candidate && claim?.person_id !== candidate.person_id) errors.push('claim and candidate person differ');
    if (claim?.review_status !== 'verified') errors.push('candidacy claim is not verified');
    if (claim && !['review_only', 'public'].includes(claim.visibility)) errors.push('candidacy claim visibility is invalid');
    if (candidate?.candidacy_status !== 'party_nominee') errors.push('candidate is not a party nominee');
    if (candidate?.registration_status !== 'unknown') errors.push('candidate incorrectly implies election registration');
    if (candidate?.election_result !== 'pending') errors.push('candidate election result is not pending');
    if (candidate && candidate.party !== source.party) errors.push('candidate and source party differ');
    if (!targetRace?.id || candidate?.race_id !== targetRace.id) errors.push('candidate and source target race differ');
    if (!person) errors.push('person row is missing');
    if (candidate && canonical?.canonical_person_id !== candidate.person_id) errors.push('candidate is not linked to its canonical person');
    if (!race || race.is_public !== true) errors.push('target race is not public');

    if (errors.length > 0) {
      blocking.push({ sourcePersonKey: source.source_person_key, personName: source.raw_name, errors });
      continue;
    }
    eligible.push({ source, candidate, claim, match: confirmedMatches[0], person, race });
  }

  const peopleSeen = new Map();
  for (const item of eligible) {
    peopleSeen.set(item.candidate.person_id, [...(peopleSeen.get(item.candidate.person_id) ?? []), item]);
  }
  for (const [personId, items] of peopleSeen.entries()) {
    if (items.length > 1) {
      blocking.push({
        personId,
        errors: [`same person is linked to ${items.length} reviewed 2026 candidacies`],
        sourcePersonKeys: items.map((item) => item.source.source_person_key),
      });
    }
  }

  if (eligible.length !== expectedCount) {
    blocking.push({ errors: [`expected ${expectedCount} eligible candidates, found ${eligible.length}`] });
  }
  if (excluded.length !== expectedExcludedCount) {
    blocking.push({ errors: [`expected ${expectedExcludedCount} reviewed exclusion, found ${excluded.length}`] });
  }

  const chosen = new Map(eligible.map(item => [partyCandidateBaseKey(item.source), item.source.id]));
  const superseded = dataset.sources.filter(source => chosen.has(partyCandidateBaseKey(source)) && chosen.get(partyCandidateBaseKey(source)) !== source.id)
    .map(source => ({ source, claims: (claimsBySource.get(source.id) ?? []).filter(claim => claim.claim_type === 'candidacy') }));
  return { eligible, excluded, blocking, superseded };
}

function profileItems(sourcePayload, field) {
  const values = objectValue(sourcePayload)?.[field];
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)));
}

function buildProfileClaimRows(plan, publishedAt) {
  return plan.eligible.flatMap((item) => profileFields.flatMap((field) => {
    const items = profileItems(item.source.source_payload, field);
    if (items.length === 0) return [];
    const claimValue = items.join('；');
    return [{
      claim_key: `${partyCandidateBaseKey(item.source)}:${field}`,
      person_id: item.candidate.person_id,
      source_person_id: item.source.id,
      candidate_id: field === 'platform' ? item.candidate.id : null,
      claim_type: field,
      claim_value: claimValue,
      claim_json: {
        schemaVersion: 1,
        sourcePersonKey: item.source.source_person_key,
        contentRevision: item.source.source_payload?.revision ?? null,
        sourceCandidateKey: objectValue(item.source.source_payload)?.sourceCandidateKey ?? null,
        field,
        items,
        ...(field === 'platform' ? {
          platformText: claimValue,
          electionContext: {
            candidateId: item.candidate.id,
            raceId: item.race.id,
            electionId: item.race.election_id,
          },
        } : {}),
      },
      confidence_level: 'A',
      review_status: 'verified',
      visibility: 'public',
      source_name: item.claim.source_name,
      source_url: item.claim.source_url,
      observed_at: item.claim.observed_at ?? publishedAt,
      is_public: true,
      review_score: 100,
      scoring_version: 'party-candidate-official-profile-v1',
      scoring_reasons: ['Official party profile field linked after manual candidate identity review.'],
      auto_reviewed_at: publishedAt,
      updated_at: publishedAt,
    }];
  }));
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

function headers(config, options = {}) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
    ...(options.prefer ? { prefer: options.prefer } : {}),
    ...(options.schema ? {
      'accept-profile': options.schema,
      'content-profile': options.schema,
    } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

async function fetchRows(config, tableName, select, filters = {}, schema = 'public') {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: headers(config, { schema }),
      signal: AbortSignal.timeout(30000),
    });
    const page = await responseJson(response, `Failed to fetch ${schema}.${tableName}`);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function quotePostgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchRowsByValues(config, tableName, select, column, values, schema = 'public') {
  const unique = Array.from(new Set(values.filter(Boolean)));
  const rows = [];
  for (let index = 0; index < unique.length; index += 80) {
    const chunk = unique.slice(index, index + 80);
    rows.push(...await fetchRows(config, tableName, select, {
      [column]: `in.(${chunk.map(quotePostgrestValue).join(',')})`,
    }, schema));
  }
  return rows;
}

async function patchRowsByIds(config, tableName, ids, row) {
  for (let index = 0; index < ids.length; index += 80) {
    const url = restUrl(config, tableName);
    url.searchParams.set('id', `in.(${ids.slice(index, index + 80).join(',')})`);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: headers(config, { prefer: 'return=minimal' }),
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(30000),
    });
    await responseJson(response, `Failed to update ${tableName}`);
  }
}

async function upsertRows(config, tableName, rows, conflictKey) {
  if (rows.length === 0) return [];
  const written = [];
  for (let index = 0; index < rows.length; index += 80) {
    const url = restUrl(config, tableName);
    url.searchParams.set('on_conflict', conflictKey);
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(config, { prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(rows.slice(index, index + 80)),
      signal: AbortSignal.timeout(30000),
    });
    written.push(...await responseJson(response, `Failed to upsert ${tableName}`));
  }
  return written;
}

async function promotePublishedLayer(config) {
  const url = restUrl(config, 'rpc/promote');
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(config, { schema: 'published' }),
    body: JSON.stringify({ p_source_sync_run_id: null }),
    signal: AbortSignal.timeout(120000),
  });
  return responseJson(response, 'Failed to refresh published layer');
}

async function refreshPublicPeopleList(config) {
  const url = restUrl(config, 'rpc/refresh_public_people_list_cached');
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(120000),
  });
  return responseJson(response, 'Failed to refresh public people list');
}

function obsoleteProfileClaims(plan, existingClaims) {
  const desired = new Set(buildProfileClaimRows(plan, '').map(row => row.claim_key));
  const candidates = new Map(plan.eligible.flatMap(item => profileFields.map(field => [`${partyCandidateBaseKey(item.source)}:${field}`, item.candidate])));
  return existingClaims.filter(claim => {
    const candidate = candidates.get(claim.claim_key);
    if (!candidate || desired.has(claim.claim_key) || claim.is_public !== true) return false;
    if (claim.person_id !== candidate.person_id) throw new Error('Prior profile claim belongs to another person');
    return true;
  });
}

async function applyPublication(config, plan, publishedAt) {
  if (plan.blocking.length) throw new Error('Cannot publish blocked party plan');
  const profileClaims = buildProfileClaimRows(plan, publishedAt);
  const profileKeys = plan.eligible.flatMap(item => profileFields.map(field => `${partyCandidateBaseKey(item.source)}:${field}`));
  const previousProfiles = await fetchRowsByValues(config, 'person_claims', '*', 'claim_key', profileKeys);
  for (const claim of obsoleteProfileClaims(plan, previousProfiles)) {
    await patchExpected(config, 'person_claims', claim, { is_public: false, visibility: 'review_only', updated_at: publishedAt }, ['review_status', 'person_id', 'claim_json', 'visibility', 'is_public']);
  }
  for (const previous of plan.superseded ?? []) {
    for (const claim of previous.claims) {
      if (!claim.is_public) continue;
      await patchExpected(config, 'person_claims', claim, { is_public: false, visibility: 'review_only', updated_at: publishedAt }, ['review_status', 'person_id', 'claim_json', 'visibility', 'is_public']);
    }
    if (previous.source.is_public) await patchExpected(config, 'source_people', previous.source, { is_public: false, updated_at: publishedAt }, ['source_payload', 'is_public']);
  }
  const writtenProfileClaims = await upsertRows(config, 'person_claims', profileClaims, 'claim_key');
  for (const item of plan.eligible) {
    if (!item.source.is_public) await patchExpected(config, 'source_people', item.source, { is_public: true, updated_at: publishedAt }, ['source_payload', 'is_public']);
    if (!item.claim.is_public || item.claim.visibility !== 'public') await patchExpected(config, 'person_claims', item.claim, { visibility: 'public', is_public: true, updated_at: publishedAt }, ['review_status', 'person_id', 'claim_json', 'visibility', 'is_public']);
    if (!item.candidate.is_public) await patchExpected(config, 'candidates', item.candidate, { is_public: true, updated_at: publishedAt }, ['person_id', 'race_id', 'candidacy_status', 'registration_status', 'election_result', 'is_public']);
  }
  await patchRowsByIds(config, 'people', plan.eligible.map((item) => item.person.id), { is_public: true, updated_at: publishedAt });
  await refreshPublicPeopleList(config);
  const releaseId = await promotePublishedLayer(config);
  return { releaseId, profileClaimCount: writtenProfileClaims.length };
}

async function loadDataset(config) {
  const sources = await fetchRows(
    config,
    'source_people',
    'id,source_person_key,raw_name,party,election_year,source_name,source_url,is_public,source_payload,updated_at',
    { source_person_key: 'like.party-candidate:*' },
  );
  const sourceIds = sources.map((row) => row.id);
  const [matches, claims, candidates] = await Promise.all([
    fetchRowsByValues(config, 'person_identity_matches', 'id,source_person_id,person_id,match_status', 'source_person_id', sourceIds),
    fetchRowsByValues(config, 'person_claims', 'id,claim_key,claim_json,source_person_id,person_id,claim_type,review_status,visibility,is_public,scoring_version,source_name,source_url,observed_at,updated_at', 'source_person_id', sourceIds),
    fetchRows(config, 'candidates', 'id,external_id,person_id,race_id,party,registration_status,candidacy_status,election_result,is_public,updated_at', {
      external_id: 'like.party-candidate:*',
    }),
  ]);
  const personIds = candidates.map((row) => row.person_id);
  const raceIds = candidates.map((row) => row.race_id);
  const [canonicalMap, people, races] = await Promise.all([
    fetchRowsByValues(config, 'person_canonical_map', 'person_id,canonical_person_id', 'person_id', personIds),
    fetchRowsByValues(config, 'people', 'id,is_public', 'id', personIds),
    fetchRowsByValues(config, 'races', 'id,election_id,is_public', 'id', raceIds),
  ]);
  return { sources, matches, claims, candidates, canonicalMap, people, races };
}

async function verifyPublishedCandidates(config, plan) {
  const published = await fetchRowsByValues(
    config,
    'candidate_facts',
    'candidate_id,person_id,race_id,candidacy_status,registration_status,election_result',
    'candidate_id',
    plan.eligible.map((item) => item.candidate.id),
    'published',
  );
  if (published.length !== plan.eligible.length) {
    throw new Error(`Published candidate verification expected ${plan.eligible.length}, found ${published.length}`);
  }
  const invalid = published.filter((candidate) => (
    candidate.candidacy_status !== 'party_nominee'
    || candidate.registration_status !== 'unknown'
    || candidate.election_result !== 'pending'
  ));
  if (invalid.length > 0) throw new Error(`Published candidate status verification failed for ${invalid.length} rows`);
  return published.length;
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
    throw new Error('Reviewed party candidate preview publication is local-only');
  }

  const expectations = options.party
    ? partyPublicationExpectations.get(options.party)
    : { candidates: expectedCandidateCount, excludedSources: expectedExcludedSourceCount };
  const dataset = scopeDatasetToParty(await loadDataset(config), options.party);
  const plan = planReviewedPartyCandidatePublication(dataset, {
    revisionSelections: options.revisionSelectionPath ? JSON.parse(fs.readFileSync(options.revisionSelectionPath, 'utf8')) : [],
    expectedCount: expectations.candidates,
    expectedExcludedCount: expectations.excludedSources,
  });
  if (plan.blocking.length > 0) {
    console.log(JSON.stringify({ status: 'blocked', blocking: plan.blocking }, null, 2));
    process.exitCode = 1;
    return;
  }

  const publishedAt = new Date().toISOString();
  const profileClaimPlan = buildProfileClaimRows(plan, publishedAt);
  const publication = options.write ? await applyPublication(config, plan, publishedAt) : null;
  const publishedCandidateCount = options.write ? await verifyPublishedCandidates(config, plan) : null;
  console.log(JSON.stringify({
    status: 'ok',
    mode: options.write ? 'write' : 'dry-run',
    party: options.party,
    eligibleCandidateCount: plan.eligible.length,
    excludedSourceCount: plan.excluded.length,
    candidatesByParty: countByParty(plan.eligible),
    releaseId: publication?.releaseId ?? null,
    publishedCandidateCount,
    profileClaimCount: options.write ? publication.profileClaimCount : profileClaimPlan.length,
    profileClaimsByType: Object.fromEntries(profileFields.map((field) => [
      field,
      profileClaimPlan.filter((claim) => claim.claim_type === field).length,
    ])),
    publishedAt: options.write ? publishedAt : null,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  buildProfileClaimRows,
  obsoleteProfileClaims,
  partyPublicationExpectations,
  planReviewedPartyCandidatePublication,
  scopeDatasetToParty,
};
