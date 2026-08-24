import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  planReviewedPartyCandidatePublication,
  scopeDatasetToParty,
} from './preview-publish-reviewed-party-candidates.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const expected = {
  sources: 318,
  candidates: 317,
  excludedSources: 1,
  newPeople: 86,
  requiredExistingPeople: 241,
  identityMatches: 328,
  candidacyClaims: 318,
  profileClaims: 204,
  profileClaimsByType: { education: 65, experience: 69, platform: 70 },
};
const partyReleaseExpectations = new Map([
  ['台灣民眾黨', {
    sources: 105,
    candidates: 105,
    excludedSources: 0,
    newPeople: 52,
    requiredExistingPeople: 58,
    identityMatches: 110,
    candidacyClaims: 105,
    profileClaims: 124,
    profileClaimsByType: { education: 39, experience: 48, platform: 37 },
  }],
]);
const defaultOutput = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '202607290015_publish_reviewed_party_candidates.sql',
);

const columns = {
  people: [
    ['id', 'uuid'], ['name', 'text'], ['alias', 'text'], ['party', 'text'], ['position', 'text'],
    ['election_year', 'integer'], ['district', 'text'], ['source_url', 'text'], ['is_public', 'boolean'],
    ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'], ['external_id', 'text'],
    ['gender', 'text'], ['education', 'text'], ['experience', 'text'],
  ],
  sourcePeople: [
    ['id', 'uuid'], ['source_person_key', 'text'], ['source_type', 'text'], ['source_id', 'text'],
    ['source_name', 'text'], ['source_url', 'text'], ['raw_name', 'text'], ['normalized_name', 'text'],
    ['alias', 'text'], ['gender', 'text'], ['party', 'text'], ['normalized_party', 'text'],
    ['position', 'text'], ['normalized_role', 'text'], ['district', 'text'], ['normalized_region', 'text'],
    ['election_year', 'integer'], ['birth_date', 'date'], ['birth_date_text', 'text'],
    ['external_person_id', 'text'], ['external_record_id', 'text'], ['source_payload', 'jsonb'],
    ['confidence_suggestion', 'text'], ['ingest_batch_key', 'text'], ['is_public', 'boolean'],
    ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'],
  ],
  matches: [
    ['id', 'uuid'], ['source_person_id', 'uuid'], ['person_id', 'uuid'], ['match_status', 'text'],
    ['score', 'numeric'], ['match_method', 'text'], ['match_reason', 'text'], ['evidence_json', 'jsonb'],
    ['reviewed_by', 'text'], ['reviewed_at', 'timestamptz'], ['created_at', 'timestamptz'],
    ['updated_at', 'timestamptz'],
  ],
  claims: [
    ['id', 'uuid'], ['claim_key', 'text'], ['person_id', 'uuid'], ['source_person_id', 'uuid'],
    ['claim_type', 'text'], ['claim_value', 'text'], ['claim_json', 'jsonb'], ['confidence_level', 'text'],
    ['review_status', 'text'], ['visibility', 'text'], ['source_name', 'text'], ['source_url', 'text'],
    ['observed_at', 'timestamptz'], ['is_public', 'boolean'], ['created_at', 'timestamptz'],
    ['updated_at', 'timestamptz'], ['review_score', 'numeric'], ['scoring_version', 'text'],
    ['scoring_reasons', 'jsonb'], ['auto_reviewed_at', 'timestamptz'], ['candidate_id', 'uuid'],
  ],
  candidates: [
    ['id', 'uuid'], ['person_id', 'uuid'], ['race_id', 'uuid'], ['party', 'text'], ['candidate_no', 'text'],
    ['registration_status', 'text'], ['source_name', 'text'], ['source_url', 'text'], ['is_public', 'boolean'],
    ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'], ['external_id', 'text'],
    ['vote_count', 'integer'], ['vote_rate', 'numeric'], ['is_elected', 'boolean'], ['is_incumbent', 'boolean'],
    ['candidacy_status', 'text'], ['election_result', 'text'], ['status_updated_at', 'timestamptz'],
  ],
};

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
  let output = defaultOutput;
  let party = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output' && argv[index + 1]) {
      output = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
      continue;
    }
    if (argv[index] === '--party' && argv[index + 1]) {
      party = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error('Usage: node scripts/build-reviewed-party-candidate-release-migration.mjs [--output <path>] [--party <name>]');
  }
  if (party && !partyReleaseExpectations.has(party)) {
    throw new Error(`No reviewed release expectations are configured for party: ${party}`);
  }
  return { output, party };
}

function assertLocalSupabase(url) {
  const hostname = new URL(url).hostname;
  if (!localHostnames.has(hostname)) {
    throw new Error(`Party candidate release migration generation is local-only; received Supabase host ${hostname}`);
  }
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

function headers(config) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
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
    const response = await fetch(url, {
      headers: headers(config),
      signal: AbortSignal.timeout(30000),
    });
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

function selectList(group) {
  return columns[group].map(([name]) => name).join(',');
}

async function loadDataset(config) {
  const sources = await fetchRows(config, 'source_people', selectList('sourcePeople'), {
    source_person_key: 'like.party-candidate:*',
  });
  const sourceIds = sources.map((row) => row.id);
  const [matches, claims, candidates] = await Promise.all([
    fetchRowsByValues(config, 'person_identity_matches', selectList('matches'), 'source_person_id', sourceIds),
    fetchRowsByValues(config, 'person_claims', selectList('claims'), 'source_person_id', sourceIds),
    fetchRows(config, 'candidates', selectList('candidates'), { external_id: 'like.party-candidate:*' }),
  ]);
  const personIds = Array.from(new Set([
    ...candidates.map((row) => row.person_id),
    ...matches.map((row) => row.person_id).filter(Boolean),
  ]));
  const raceIds = candidates.map((row) => row.race_id);
  const [canonicalMap, people, races] = await Promise.all([
    fetchRowsByValues(config, 'person_canonical_map', 'person_id,canonical_person_id', 'person_id', personIds),
    fetchRowsByValues(config, 'people', selectList('people'), 'id', personIds),
    fetchRowsByValues(config, 'races', 'id,is_public', 'id', raceIds),
  ]);
  return { sources, matches, claims, candidates, canonicalMap, people, races };
}

function sorted(rows, fields) {
  return [...rows].sort((left, right) => {
    for (const field of fields) {
      const compared = String(left[field] ?? '').localeCompare(String(right[field] ?? ''));
      if (compared !== 0) return compared;
    }
    return 0;
  });
}

function countBy(rows, field) {
  const result = {};
  for (const row of rows) result[row[field]] = (result[row[field]] ?? 0) + 1;
  return result;
}

function assertEqual(actual, wanted, label) {
  if (actual !== wanted) throw new Error(`${label}: expected ${wanted}, found ${actual}`);
}

function isSourceScopedPerson(person, source) {
  const partyCandidatePersonId = source.source_person_key.startsWith('party-candidate:')
    ? `party-candidate-person:${source.source_person_key.slice('party-candidate:'.length)}`
    : null;
  return person?.external_id === `internal-review-source-${source.id}`
    || (partyCandidatePersonId && person?.external_id === partyCandidatePersonId);
}

function buildReleaseDataset(dataset, options = {}) {
  const expectedCounts = options.expected ?? expected;
  const plan = planReviewedPartyCandidatePublication(dataset, {
    expectedCount: expectedCounts.candidates,
    expectedExcludedCount: expectedCounts.excludedSources,
  });
  if (plan.blocking.length > 0) {
    throw new Error(`Party candidate publication plan is blocked:\n${JSON.stringify(plan.blocking, null, 2)}`);
  }

  const sourceIds = new Set(dataset.sources.map((row) => row.id));
  const peopleById = new Map(dataset.people.map((row) => [row.id, row]));
  const sourceById = new Map(dataset.sources.map((row) => [row.id, row]));
  const newPeople = plan.eligible.flatMap((item) => {
    const person = peopleById.get(item.candidate.person_id);
    return isSourceScopedPerson(person, item.source) ? [person] : [];
  });
  const newPersonIds = new Set(newPeople.map((row) => row.id));
  const referencedPersonIds = new Set([
    ...plan.eligible.map((item) => item.candidate.person_id),
    ...dataset.matches
      .filter((row) => sourceIds.has(row.source_person_id))
      .map((row) => row.person_id)
      .filter(Boolean),
  ]);
  const requiredExistingPersonIds = [...referencedPersonIds]
    .filter((id) => !newPersonIds.has(id))
    .sort();
  const candidacyClaims = dataset.claims.filter((row) => (
    sourceIds.has(row.source_person_id) && row.claim_type === 'candidacy'
  ));
  const profileClaims = dataset.claims.filter((row) => (
    sourceIds.has(row.source_person_id)
    && ['education', 'experience', 'platform'].includes(row.claim_type)
  ));
  const matches = dataset.matches.filter((row) => sourceIds.has(row.source_person_id));

  assertEqual(dataset.sources.length, expectedCounts.sources, 'source rows');
  assertEqual(plan.eligible.length, expectedCounts.candidates, 'eligible candidates');
  assertEqual(newPeople.length, expectedCounts.newPeople, 'new people');
  assertEqual(new Set(newPeople.map((row) => row.id)).size, newPeople.length, 'unique new people');
  assertEqual(requiredExistingPersonIds.length, expectedCounts.requiredExistingPeople, 'required existing people');
  assertEqual(matches.length, expectedCounts.identityMatches, 'identity matches');
  assertEqual(candidacyClaims.length, expectedCounts.candidacyClaims, 'candidacy claims');
  assertEqual(profileClaims.length, expectedCounts.profileClaims, 'profile claims');
  const profileCounts = countBy(profileClaims, 'claim_type');
  for (const [type, wanted] of Object.entries(expectedCounts.profileClaimsByType)) {
    assertEqual(profileCounts[type] ?? 0, wanted, `${type} profile claims`);
  }
  const invalidProfiles = profileClaims.filter((claim) => (
    claim.review_status !== 'verified'
    || claim.visibility !== 'public'
    || claim.is_public !== true
    || claim.claim_key !== `${sourceById.get(claim.source_person_id)?.source_person_key ?? ''}:${claim.claim_type}`
  ));
  if (invalidProfiles.length > 0) {
    throw new Error(`Found ${invalidProfiles.length} invalid public profile claims`);
  }

  return {
    sources: sorted(dataset.sources, ['source_person_key']),
    newPeople: sorted(newPeople, ['id']),
    requiredExistingPersonIds,
    matches: sorted(matches, ['source_person_id', 'person_id', 'id']),
    claims: sorted([...candidacyClaims, ...profileClaims], ['claim_key']),
    candidates: sorted(plan.eligible.map((item) => item.candidate), ['external_id']),
    raceIds: Array.from(new Set(plan.eligible.map((item) => item.candidate.race_id))).sort(),
    excludedSourceKeys: plan.excluded.map((item) => item.source.source_person_key).sort(),
    profileCounts,
  };
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  if (json.includes('$party_release$')) {
    throw new Error('Release data contains the SQL dollar-quote delimiter');
  }
  return `$party_release$${json}$party_release$::jsonb`;
}

function tempTableSql(name, group, rows) {
  const declaration = columns[group]
    .map(([column, type]) => `${column} ${type}`)
    .join(', ');
  return `CREATE TEMP TABLE ${name} ON COMMIT DROP AS
SELECT *
FROM jsonb_to_recordset(${sqlJson(rows)}) AS row(${declaration});`;
}

function insertSql(target, temp, group, conflictTarget, updates) {
  const names = columns[group].map(([name]) => name);
  const updateSql = updates.map((name) => `${name} = EXCLUDED.${name}`).join(',\n    ');
  return `INSERT INTO ${target} (${names.join(', ')})
SELECT ${names.join(', ')} FROM ${temp}
ON CONFLICT (${conflictTarget}) DO UPDATE SET
    ${updateSql};`;
}

function buildMigration(release, expectedCounts = expected) {
  const sourceUpdates = columns.sourcePeople.map(([name]) => name)
    .filter((name) => !['id', 'source_person_key', 'created_at'].includes(name));
  const matchUpdates = columns.matches.map(([name]) => name)
    .filter((name) => !['id', 'created_at'].includes(name));
  const claimUpdates = columns.claims.map(([name]) => name)
    .filter((name) => !['id', 'claim_key', 'created_at'].includes(name));
  const candidateUpdates = columns.candidates.map(([name]) => name)
    .filter((name) => !['id', 'external_id', 'created_at'].includes(name));
  const expectedProfileSql = Object.entries(expectedCounts.profileClaimsByType)
    .map(([type, count]) => `('${type}', ${count})`)
    .join(', ');

  return `-- Generated by scripts/build-reviewed-party-candidate-release-migration.mjs.
-- Source: reviewed Local Supabase state after the 2026 party-candidate identity audit.
-- Published read models are refreshed once by the final migration in the release batch.
BEGIN;

${tempTableSql('_party_release_people', 'people', release.newPeople)}

${tempTableSql('_party_release_sources', 'sourcePeople', release.sources)}

${tempTableSql('_party_release_matches', 'matches', release.matches)}

${tempTableSql('_party_release_claims', 'claims', release.claims)}

${tempTableSql('_party_release_candidates', 'candidates', release.candidates)}

CREATE TEMP TABLE _party_release_required_people (id UUID PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _party_release_required_people (id)
SELECT value::UUID FROM jsonb_array_elements_text(${sqlJson(release.requiredExistingPersonIds)});

CREATE TEMP TABLE _party_release_races (id UUID PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _party_release_races (id)
SELECT value::UUID FROM jsonb_array_elements_text(${sqlJson(release.raceIds)});

DO $$
DECLARE
    missing_people INTEGER;
    missing_races INTEGER;
BEGIN
    IF (SELECT COUNT(*) FROM _party_release_sources) <> ${expectedCounts.sources}
       OR (SELECT COUNT(*) FROM _party_release_people) <> ${expectedCounts.newPeople}
       OR (SELECT COUNT(*) FROM _party_release_matches) <> ${expectedCounts.identityMatches}
       OR (SELECT COUNT(*) FROM _party_release_claims WHERE claim_type = 'candidacy') <> ${expectedCounts.candidacyClaims}
       OR (SELECT COUNT(*) FROM _party_release_claims WHERE claim_type IN ('education', 'experience', 'platform')) <> ${expectedCounts.profileClaims}
       OR (SELECT COUNT(*) FROM _party_release_candidates) <> ${expectedCounts.candidates}
       OR (SELECT COUNT(*) FROM _party_release_required_people) <> ${expectedCounts.requiredExistingPeople} THEN
        RAISE EXCEPTION 'Reviewed party candidate release payload count drift';
    END IF;

    IF EXISTS (
        SELECT 1 FROM (VALUES ${expectedProfileSql}) expected_profile(claim_type, expected_count)
        WHERE (SELECT COUNT(*) FROM _party_release_claims claim WHERE claim.claim_type = expected_profile.claim_type) <> expected_profile.expected_count
    ) THEN
        RAISE EXCEPTION 'Reviewed party candidate profile claim count drift';
    END IF;

    SELECT COUNT(*) INTO missing_people
    FROM _party_release_required_people required
    WHERE NOT EXISTS (SELECT 1 FROM people person WHERE person.id = required.id);
    IF missing_people > 0 THEN
        RAISE EXCEPTION 'Reviewed party candidate release is missing % prerequisite people', missing_people;
    END IF;

    SELECT COUNT(*) INTO missing_races
    FROM _party_release_races required
    WHERE NOT EXISTS (SELECT 1 FROM races race WHERE race.id = required.id AND race.is_public = TRUE);
    IF missing_races > 0 THEN
        RAISE EXCEPTION 'Reviewed party candidate release is missing % public prerequisite races', missing_races;
    END IF;

    IF EXISTS (SELECT 1 FROM people existing JOIN _party_release_people incoming ON existing.id = incoming.id WHERE existing.external_id IS DISTINCT FROM incoming.external_id)
       OR EXISTS (SELECT 1 FROM people existing JOIN _party_release_people incoming ON existing.external_id = incoming.external_id WHERE existing.id <> incoming.id) THEN
        RAISE EXCEPTION 'Reviewed party candidate new-person identifier conflict';
    END IF;

    IF EXISTS (SELECT 1 FROM source_people existing JOIN _party_release_sources incoming ON existing.id = incoming.id WHERE existing.source_person_key <> incoming.source_person_key)
       OR EXISTS (SELECT 1 FROM source_people existing JOIN _party_release_sources incoming ON existing.source_person_key = incoming.source_person_key WHERE existing.id <> incoming.id) THEN
        RAISE EXCEPTION 'Reviewed party candidate source identifier conflict';
    END IF;

    IF EXISTS (SELECT 1 FROM person_identity_matches existing JOIN _party_release_matches incoming ON existing.source_person_id = incoming.source_person_id AND existing.person_id = incoming.person_id WHERE existing.id <> incoming.id) THEN
        RAISE EXCEPTION 'Reviewed party candidate identity-match identifier conflict';
    END IF;

    IF EXISTS (SELECT 1 FROM person_claims existing JOIN _party_release_claims incoming ON existing.claim_key = incoming.claim_key WHERE existing.id <> incoming.id) THEN
        RAISE EXCEPTION 'Reviewed party candidate claim identifier conflict';
    END IF;

    IF EXISTS (SELECT 1 FROM candidates existing JOIN _party_release_candidates incoming ON existing.external_id = incoming.external_id WHERE existing.id <> incoming.id)
       OR EXISTS (SELECT 1 FROM candidates existing JOIN _party_release_candidates incoming ON existing.person_id = incoming.person_id AND existing.race_id = incoming.race_id WHERE existing.id <> incoming.id) THEN
        RAISE EXCEPTION 'Reviewed party candidate identifier conflict';
    END IF;
END
$$;

INSERT INTO people (${columns.people.map(([name]) => name).join(', ')})
SELECT ${columns.people.map(([name]) => name).join(', ')} FROM _party_release_people
ON CONFLICT (id) DO NOTHING;

${insertSql('source_people', '_party_release_sources', 'sourcePeople', 'id', sourceUpdates)}

${insertSql('person_identity_matches', '_party_release_matches', 'matches', 'id', matchUpdates)}

${insertSql('person_claims', '_party_release_claims', 'claims', 'id', claimUpdates)}

${insertSql('candidates', '_party_release_candidates', 'candidates', 'id', candidateUpdates)}

UPDATE people
SET is_public = TRUE
WHERE id IN (SELECT person_id FROM _party_release_candidates);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM candidates candidate JOIN _party_release_candidates release ON release.id = candidate.id
        WHERE candidate.is_public = TRUE AND candidate.candidacy_status = 'party_nominee'
          AND candidate.registration_status = 'unknown' AND candidate.election_result = 'pending') <> ${expectedCounts.candidates} THEN
        RAISE EXCEPTION 'Reviewed party candidate final candidate verification failed';
    END IF;

    IF (SELECT COUNT(*) FROM source_people source JOIN _party_release_sources release ON release.id = source.id WHERE source.is_public = TRUE) <> ${expectedCounts.candidates}
       OR (SELECT COUNT(*) FROM source_people source JOIN _party_release_sources release ON release.id = source.id WHERE source.is_public = FALSE) <> ${expectedCounts.excludedSources} THEN
        RAISE EXCEPTION 'Reviewed party candidate final source visibility verification failed';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _party_release_sources source
        WHERE source.is_public = FALSE
          AND EXISTS (SELECT 1 FROM candidates candidate WHERE candidate.external_id = source.source_person_key)
    ) THEN
        RAISE EXCEPTION 'Rejected party candidate source still has a candidate row';
    END IF;
END
$$;

COMMIT;
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim()
      || localEnv.SUPABASE_URL
      || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  assertLocalSupabase(config.supabaseUrl);
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  const expectedCounts = options.party ? partyReleaseExpectations.get(options.party) : expected;
  const dataset = scopeDatasetToParty(await loadDataset(config), options.party);
  const release = buildReleaseDataset(dataset, { expected: expectedCounts });
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, buildMigration(release, expectedCounts));
  console.log(JSON.stringify({
    status: 'ok',
    party: options.party,
    output: path.relative(repoRoot, options.output),
    sourceCount: release.sources.length,
    candidateCount: release.candidates.length,
    newPersonCount: release.newPeople.length,
    requiredExistingPersonCount: release.requiredExistingPersonIds.length,
    matchCount: release.matches.length,
    claimCount: release.claims.length,
    profileClaimsByType: release.profileCounts,
    excludedSourceKeys: release.excludedSourceKeys,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  assertLocalSupabase,
  buildMigration,
  buildReleaseDataset,
  expected,
  isSourceScopedPerson,
  partyReleaseExpectations,
};
