import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(
  repoRoot,
  'supabase/migrations/20260820152016_publish_production_profile_and_finance_delta.sql',
);
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const releaseClaimPrefixes = [
  'cec-2022-',
  'cec-platform:2022:',
  'cec-platform:2024:',
  'official-profile:cec-2024-',
];
const retainedClaimTypes = ['birth_date', 'gender', 'education', 'experience', 'platform'];
const releaseBatchSize = 200;
const retiredClaimKeys = [
  'cec-platform:2022:votetw-candidate-2dc25cd451b5d2ac',
  'cec-platform:2022:votetw-candidate-597a55452c5fe998',
  'cec-platform:2022:votetw-candidate-0c213f5efb13e949',
  'cec-platform:2022:votetw-candidate-de3eb31e853ca5af',
  'cec-platform:2022:votetw-candidate-345fbbea6f58b0e4',
];

const columns = {
  people: [
    ['id', 'uuid'],
    ['external_id', 'text'],
    ['gender', 'text'],
    ['education', 'text'],
    ['experience', 'text'],
  ],
  candidates: [
    ['id', 'uuid'], ['person_id', 'uuid'], ['race_id', 'uuid'], ['party', 'text'],
    ['candidate_no', 'text'], ['registration_status', 'text'], ['source_name', 'text'],
    ['source_url', 'text'], ['is_public', 'boolean'], ['created_at', 'timestamptz'],
    ['updated_at', 'timestamptz'], ['external_id', 'text'], ['vote_count', 'integer'],
    ['vote_rate', 'numeric'], ['is_elected', 'boolean'], ['is_incumbent', 'boolean'],
    ['candidacy_status', 'text'], ['election_result', 'text'], ['status_updated_at', 'timestamptz'],
  ],
  claims: [
    ['id', 'uuid'], ['claim_key', 'text'], ['person_id', 'uuid'], ['source_person_id', 'uuid'],
    ['claim_type', 'text'], ['claim_value', 'text'], ['claim_json', 'jsonb'],
    ['confidence_level', 'text'], ['review_status', 'text'], ['visibility', 'text'],
    ['source_name', 'text'], ['source_url', 'text'], ['observed_at', 'timestamptz'],
    ['is_public', 'boolean'], ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'],
    ['review_score', 'numeric'], ['scoring_version', 'text'], ['scoring_reasons', 'jsonb'],
    ['auto_reviewed_at', 'timestamptz'], ['candidate_id', 'uuid'],
  ],
  affiliations: [
    ['id', 'uuid'], ['affiliation_key', 'text'], ['person_id', 'uuid'],
    ['source_person_id', 'uuid'], ['source_claim_key', 'text'], ['party_name', 'text'],
    ['normalized_party', 'text'], ['role_context', 'text'], ['observed_year', 'integer'],
    ['observed_date', 'date'], ['start_date', 'date'], ['end_date', 'date'],
    ['is_current', 'boolean'], ['confidence_level', 'text'], ['review_status', 'text'],
    ['source_name', 'text'], ['source_url', 'text'], ['source_payload', 'jsonb'],
    ['is_public', 'boolean'], ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'],
    ['role_title', 'text'], ['organization_unit', 'text'], ['display_order', 'integer'],
    ['role_tier', 'text'],
  ],
  finance: [
    ['id', 'uuid'], ['party_id', 'uuid'], ['report_year', 'integer'],
    ['filing_status', 'text'], ['ratification_status', 'text'],
    ['assembly_approval_status', 'text'], ['detail_url', 'text'],
    ['report_pdf_url', 'text'], ['source_name', 'text'], ['source_url', 'text'],
    ['is_public', 'boolean'], ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'],
  ],
};

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator),
          line.slice(separator + 1).trim().replace(/^["']|["']$/gu, ''),
        ];
      }),
  );
}

function config() {
  const localEnv = readLocalEnv();
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
    || localEnv.SUPABASE_URL
    || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!localHosts.has(new URL(supabaseUrl).hostname)) {
    throw new Error('Production release snapshot generation is local-only.');
  }
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  return { supabaseUrl, serviceRoleKey };
}

function selectList(group) {
  return columns[group].map(([name]) => name).join(',');
}

async function fetchRows(configValue, table, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(`${configValue.supabaseUrl.replace(/\/$/u, '')}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('order', 'id.asc');
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: {
        apikey: configValue.serviceRoleKey,
        authorization: `Bearer ${configValue.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${table}: ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function postgrestValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function fetchByValues(configValue, table, select, column, values, filters = {}) {
  const rows = [];
  const unique = [...new Set(values)].filter(Boolean);
  for (let offset = 0; offset < unique.length; offset += 60) {
    const chunk = unique.slice(offset, offset + 60);
    rows.push(...await fetchRows(configValue, table, select, {
      ...filters,
      [column]: `in.(${chunk.map(postgrestValue).join(',')})`,
    }));
  }
  return rows;
}

function dedupe(rows, key) {
  return [...new Map(rows.map((row) => [row[key], row])).values()];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sqlJson(value, delimiter) {
  const json = JSON.stringify(value);
  if (json.includes(delimiter)) throw new Error(`Payload contains ${delimiter}`);
  return `${delimiter}${json}${delimiter}::jsonb`;
}

function tempTable(name, group, rows, delimiter) {
  const declaration = columns[group]
    .map(([column, type]) => `${column} ${type}`)
    .join(', ');
  const inserts = [];
  for (let offset = 0; offset < rows.length; offset += releaseBatchSize) {
    inserts.push(`INSERT INTO ${name}
SELECT *
FROM jsonb_to_recordset(${sqlJson(rows.slice(offset, offset + releaseBatchSize), delimiter)})
AS row(${declaration});`);
  }
  return `CREATE TEMP TABLE ${name} (${declaration}) ON COMMIT DROP;

${inserts.join('\n\n')}`;
}

function keyTable(name, rows, declaration, delimiter) {
  return `CREATE TEMP TABLE ${name} ON COMMIT DROP AS
SELECT *
FROM jsonb_to_recordset(${sqlJson(rows, delimiter)})
AS row(${declaration});`;
}

function upsert(target, temp, group, conflictTarget, immutable = ['id', 'created_at']) {
  const names = columns[group].map(([name]) => name);
  const updates = names.filter((name) => !immutable.includes(name));
  return `INSERT INTO public.${target} (${names.join(', ')})
SELECT ${names.join(', ')} FROM ${temp}
ON CONFLICT (${conflictTarget}) DO UPDATE SET
    ${updates.map((name) => `${name} = EXCLUDED.${name}`).join(',\n    ')};`;
}

async function main() {
  const configValue = config();
  const claimPages = await Promise.all(releaseClaimPrefixes.map((prefix) => fetchRows(
    configValue,
    'person_claims',
    selectList('claims'),
    {
      claim_key: `like.${prefix}*`,
      claim_type: `in.(${retainedClaimTypes.join(',')})`,
      review_status: 'eq.verified',
      visibility: 'eq.public',
      is_public: 'eq.true',
    },
  )));
  const claims = dedupe(claimPages.flat(), 'claim_key')
    .filter((row) => !retiredClaimKeys.includes(row.claim_key))
    .map((row) => ({ ...row, source_person_id: null }))
    .sort((left, right) => left.claim_key.localeCompare(right.claim_key));

  const candidates = (await fetchRows(
    configValue,
    'candidates',
    selectList('candidates'),
    {
      external_id: 'like.cec-2024-candidate-json:L4:全國不分區:*',
      is_public: 'eq.true',
      is_elected: 'eq.true',
    },
  )).sort((left, right) => left.external_id.localeCompare(right.external_id));

  const personIds = [...new Set([
    ...claims.map((row) => row.person_id),
    ...candidates.map((row) => row.person_id),
  ])];
  const people = (await fetchByValues(
    configValue,
    'people',
    selectList('people'),
    'id',
    personIds,
  )).sort((left, right) => left.external_id.localeCompare(right.external_id));

  const affiliations = (await fetchByValues(
    configValue,
    'person_party_affiliations',
    selectList('affiliations'),
    'person_id',
    personIds,
    { review_status: 'eq.verified', is_public: 'eq.true' },
  )).map((row) => ({ ...row, source_person_id: null }))
    .sort((left, right) => left.affiliation_key.localeCompare(right.affiliation_key));

  const finance = (await fetchRows(
    configValue,
    'party_annual_finance_filings',
    selectList('finance'),
    { is_public: 'eq.true' },
  )).sort((left, right) => (
    left.party_id.localeCompare(right.party_id) || left.report_year - right.report_year
  ));

  const candidateIds = claims.map((row) => row.candidate_id).filter(Boolean);
  const candidateKeys = dedupe(await fetchByValues(
    configValue,
    'candidates',
    'id,external_id',
    'id',
    candidateIds,
  ), 'id').map((row) => ({ local_id: row.id, external_id: row.external_id }));

  const raceKeys = dedupe(await fetchByValues(
    configValue,
    'races',
    'id,external_id',
    'id',
    candidates.map((row) => row.race_id),
  ), 'id').map((row) => ({ local_id: row.id, external_id: row.external_id }));

  const partyKeys = dedupe(await fetchByValues(
    configValue,
    'parties',
    'id,external_id',
    'id',
    finance.map((row) => row.party_id),
  ), 'id').map((row) => ({ local_id: row.id, external_id: row.external_id }));

  assert(claims.length > 3000, `expected more than 3000 release claims, found ${claims.length}`);
  assert(candidates.length === 34, `expected 34 elected party-list candidates, found ${candidates.length}`);
  assert(people.length === personIds.length, 'one or more release people are missing');
  assert(people.every((row) => row.external_id), 'release people require external IDs');
  assert(candidateKeys.length === new Set(candidateIds).size, 'one or more claim candidates are missing');
  assert(candidateKeys.every((row) => row.external_id), 'claim candidates require external IDs');
  assert(raceKeys.length === new Set(candidates.map((row) => row.race_id)).size, 'release race is missing');
  assert(raceKeys.every((row) => row.external_id), 'release races require external IDs');
  assert(finance.length === 55, `expected 55 annual finance rows, found ${finance.length}`);
  assert(partyKeys.length === new Set(finance.map((row) => row.party_id)).size, 'finance parties are missing');
  assert(partyKeys.every((row) => row.external_id), 'finance parties require external IDs');

  const delimiter = '$profile_finance_release$';
  const peopleKeys = people.map((row) => ({
    local_id: row.id,
    external_id: row.external_id,
  }));

  const sql = `-- Generated by scripts/build-production-profile-finance-release.mjs
-- from final reviewed rows in the full local Supabase database.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

${tempTable('_release_people', 'people', people, delimiter)}

${tempTable('_release_candidates', 'candidates', candidates, delimiter)}

${tempTable('_release_claims', 'claims', claims, delimiter)}

${tempTable('_release_affiliations', 'affiliations', affiliations, delimiter)}

${tempTable('_release_finance', 'finance', finance, delimiter)}

${keyTable('_release_people_keys', peopleKeys, 'local_id uuid, external_id text', delimiter)}

${keyTable('_release_candidate_keys', candidateKeys, 'local_id uuid, external_id text', delimiter)}

${keyTable('_release_race_keys', raceKeys, 'local_id uuid, external_id text', delimiter)}

${keyTable('_release_party_keys', partyKeys, 'local_id uuid, external_id text', delimiter)}

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _release_people) <> ${people.length}
       OR (SELECT COUNT(*) FROM _release_candidates) <> ${candidates.length}
       OR (SELECT COUNT(*) FROM _release_claims) <> ${claims.length}
       OR (SELECT COUNT(*) FROM _release_affiliations) <> ${affiliations.length}
       OR (SELECT COUNT(*) FROM _release_finance) <> ${finance.length} THEN
        RAISE EXCEPTION 'Production profile and finance payload count drift';
    END IF;
END
$$;

CREATE TEMP TABLE _release_people_ids ON COMMIT DROP AS
SELECT incoming.local_id, existing.id AS target_id
FROM _release_people_keys incoming
LEFT JOIN public.people existing ON existing.external_id = incoming.external_id;

CREATE TEMP TABLE _release_race_ids ON COMMIT DROP AS
SELECT incoming.local_id, existing.id AS target_id
FROM _release_race_keys incoming
LEFT JOIN public.races existing ON existing.external_id = incoming.external_id;

CREATE TEMP TABLE _release_party_ids ON COMMIT DROP AS
SELECT incoming.local_id, existing.id AS target_id
FROM _release_party_keys incoming
LEFT JOIN public.parties existing ON existing.external_id = incoming.external_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM _release_people_ids WHERE target_id IS NULL)
       OR EXISTS (SELECT 1 FROM _release_race_ids WHERE target_id IS NULL)
       OR EXISTS (SELECT 1 FROM _release_party_ids WHERE target_id IS NULL) THEN
        RAISE EXCEPTION 'Production profile and finance payload is missing a core mapping';
    END IF;
END
$$;

UPDATE _release_candidates incoming
SET person_id = mapping.target_id
FROM _release_people_ids mapping
WHERE incoming.person_id = mapping.local_id;

UPDATE _release_candidates incoming
SET race_id = mapping.target_id
FROM _release_race_ids mapping
WHERE incoming.race_id = mapping.local_id;

UPDATE _release_claims incoming
SET person_id = mapping.target_id
FROM _release_people_ids mapping
WHERE incoming.person_id = mapping.local_id;

UPDATE _release_affiliations incoming
SET person_id = mapping.target_id
FROM _release_people_ids mapping
WHERE incoming.person_id = mapping.local_id;

UPDATE _release_finance incoming
SET party_id = mapping.target_id
FROM _release_party_ids mapping
WHERE incoming.party_id = mapping.local_id;

UPDATE _release_candidates incoming
SET id = existing.id
FROM public.candidates existing
WHERE existing.external_id = incoming.external_id;

UPDATE _release_candidates incoming
SET id = gen_random_uuid()
WHERE EXISTS (
    SELECT 1 FROM public.candidates existing
    WHERE existing.id = incoming.id
      AND existing.external_id IS DISTINCT FROM incoming.external_id
);

UPDATE _release_claims incoming
SET id = existing.id
FROM public.person_claims existing
WHERE existing.claim_key = incoming.claim_key;

UPDATE _release_claims incoming
SET id = gen_random_uuid()
WHERE EXISTS (
    SELECT 1 FROM public.person_claims existing
    WHERE existing.id = incoming.id
      AND existing.claim_key IS DISTINCT FROM incoming.claim_key
);

UPDATE _release_affiliations incoming
SET id = existing.id
FROM public.person_party_affiliations existing
WHERE existing.affiliation_key = incoming.affiliation_key;

UPDATE _release_affiliations incoming
SET id = gen_random_uuid()
WHERE EXISTS (
    SELECT 1 FROM public.person_party_affiliations existing
    WHERE existing.id = incoming.id
      AND existing.affiliation_key IS DISTINCT FROM incoming.affiliation_key
);

UPDATE _release_finance incoming
SET id = existing.id
FROM public.party_annual_finance_filings existing
WHERE existing.party_id = incoming.party_id
  AND existing.report_year = incoming.report_year;

UPDATE _release_finance incoming
SET id = gen_random_uuid()
WHERE EXISTS (
    SELECT 1 FROM public.party_annual_finance_filings existing
    WHERE existing.id = incoming.id
      AND (existing.party_id, existing.report_year)
          IS DISTINCT FROM (incoming.party_id, incoming.report_year)
);

UPDATE public.people target
SET
    gender = incoming.gender,
    education = incoming.education,
    experience = incoming.experience,
    updated_at = NOW()
FROM _release_people incoming
WHERE target.external_id = incoming.external_id;

${upsert('candidates', '_release_candidates', 'candidates', 'external_id')}

CREATE TEMP TABLE _release_candidate_ids ON COMMIT DROP AS
SELECT incoming.local_id, existing.id AS target_id
FROM _release_candidate_keys incoming
LEFT JOIN public.candidates existing ON existing.external_id = incoming.external_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM _release_candidate_ids WHERE target_id IS NULL) THEN
        RAISE EXCEPTION 'Production release claim candidate mapping is incomplete';
    END IF;
END
$$;

UPDATE _release_claims incoming
SET candidate_id = mapping.target_id
FROM _release_candidate_ids mapping
WHERE incoming.candidate_id = mapping.local_id;

${upsert('person_claims', '_release_claims', 'claims', 'claim_key')}

${upsert('person_party_affiliations', '_release_affiliations', 'affiliations', 'affiliation_key')}

${upsert(
    'party_annual_finance_filings',
    '_release_finance',
    'finance',
    'party_id, report_year',
  )}

DO $$
DECLARE
    retired_count INTEGER;
BEGIN
    DELETE FROM public.person_claims
    WHERE claim_key = ANY (ARRAY[${retiredClaimKeys.map((key) => `'${key}'`).join(', ')}]);
    GET DIAGNOSTICS retired_count = ROW_COUNT;
    IF EXISTS (
        SELECT 1 FROM public.person_claims
        WHERE claim_key = ANY (ARRAY[${retiredClaimKeys.map((key) => `'${key}'`).join(', ')}])
    ) THEN
        RAISE EXCEPTION 'One or more invalid platform claims remain after retirement';
    END IF;
    RAISE NOTICE 'Retired % invalid platform claims', retired_count;
END
$$;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM public.person_claims claim
        JOIN _release_claims release ON release.claim_key = claim.claim_key
        WHERE claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE) <> ${claims.length} THEN
        RAISE EXCEPTION 'Production release claims were not fully published';
    END IF;
    IF (SELECT COUNT(*) FROM published.candidates candidate
        JOIN _release_candidates release ON release.id = candidate.candidate_id) <> ${candidates.length} THEN
        RAISE EXCEPTION 'Production release candidates were not fully published';
    END IF;
    IF (SELECT COUNT(*) FROM published.party_annual_finance_filings) <> ${finance.length} THEN
        RAISE EXCEPTION 'Production annual finance filings were not fully published';
    END IF;
END
$$;

COMMIT;
`;

  fs.writeFileSync(outputPath, sql);
  console.log(JSON.stringify({
    outputPath,
    people: people.length,
    candidates: candidates.length,
    claims: claims.length,
    affiliations: affiliations.length,
    finance: finance.length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
