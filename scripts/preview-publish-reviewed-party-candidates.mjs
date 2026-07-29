import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const expectedCandidateCount = 317;
const expectedExcludedSourceCount = 1;

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
  for (const arg of argv) {
    if (arg !== '--write') {
      throw new Error('Usage: node scripts/preview-publish-reviewed-party-candidates.mjs [--write]');
    }
  }
  return { write: argv.includes('--write') };
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
  const blocking = [];

  for (const source of dataset.sources) {
    const candidate = candidatesByExternalId.get(source.source_person_key);
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

    const errors = [];
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

  return { eligible, excluded, blocking };
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

async function applyPublication(config, plan, publishedAt) {
  await patchRowsByIds(config, 'source_people', plan.eligible.map((item) => item.source.id), {
    is_public: true,
    updated_at: publishedAt,
  });
  await patchRowsByIds(config, 'person_claims', plan.eligible.map((item) => item.claim.id), {
    visibility: 'public',
    is_public: true,
    updated_at: publishedAt,
  });
  await patchRowsByIds(config, 'candidates', plan.eligible.map((item) => item.candidate.id), {
    is_public: true,
    updated_at: publishedAt,
  });
  await patchRowsByIds(config, 'people', plan.eligible.map((item) => item.person.id), {
    is_public: true,
    updated_at: publishedAt,
  });
  await refreshPublicPeopleList(config);
  return promotePublishedLayer(config);
}

async function loadDataset(config) {
  const sources = await fetchRows(
    config,
    'source_people',
    'id,source_person_key,raw_name,party,is_public,source_payload',
    { source_person_key: 'like.party-candidate:*' },
  );
  const sourceIds = sources.map((row) => row.id);
  const [matches, claims, candidates] = await Promise.all([
    fetchRowsByValues(config, 'person_identity_matches', 'id,source_person_id,person_id,match_status', 'source_person_id', sourceIds),
    fetchRowsByValues(config, 'person_claims', 'id,source_person_id,person_id,claim_type,review_status,visibility,is_public', 'source_person_id', sourceIds),
    fetchRows(config, 'candidates', 'id,external_id,person_id,race_id,party,registration_status,candidacy_status,election_result,is_public', {
      external_id: 'like.party-candidate:*',
    }),
  ]);
  const personIds = candidates.map((row) => row.person_id);
  const raceIds = candidates.map((row) => row.race_id);
  const [canonicalMap, people, races] = await Promise.all([
    fetchRowsByValues(config, 'person_canonical_map', 'person_id,canonical_person_id', 'person_id', personIds),
    fetchRowsByValues(config, 'people', 'id,is_public', 'id', personIds),
    fetchRowsByValues(config, 'races', 'id,is_public', 'id', raceIds),
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

  const dataset = await loadDataset(config);
  const plan = planReviewedPartyCandidatePublication(dataset);
  if (plan.blocking.length > 0) {
    console.log(JSON.stringify({ status: 'blocked', blocking: plan.blocking }, null, 2));
    process.exitCode = 1;
    return;
  }

  const publishedAt = new Date().toISOString();
  const releaseId = options.write ? await applyPublication(config, plan, publishedAt) : null;
  const publishedCandidateCount = options.write ? await verifyPublishedCandidates(config, plan) : null;
  console.log(JSON.stringify({
    status: 'ok',
    mode: options.write ? 'write' : 'dry-run',
    eligibleCandidateCount: plan.eligible.length,
    excludedSourceCount: plan.excluded.length,
    candidatesByParty: countByParty(plan.eligible),
    releaseId,
    publishedCandidateCount,
    publishedAt: options.write ? publishedAt : null,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { planReviewedPartyCandidatePublication };
