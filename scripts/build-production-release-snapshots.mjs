import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const seedPath = path.join(repoRoot, 'data-sources', 'cec-elected-executive-election-history-1994-2014.seed.json');
const executiveOutput = path.join(repoRoot, 'supabase', 'migrations', '202608110012_publish_production_elected_executive_history.sql');
const legalOutput = path.join(repoRoot, 'supabase', 'migrations', '202608110013_publish_production_reviewed_legal_claims.sql');
const publicDeltaOutput = path.join(repoRoot, 'supabase', 'migrations', '202608110014_publish_production_public_identity_delta.sql');

const publicDeltaPersonExternalIds = [
  'cec-2022-local-councilor-plain-indigenous-person-8b00b1d19cb5',
  'official-current:chiayi-city-council-current-councilors:current-councilor-0fd5a0fb75cc',
];

const publicDeltaCandidateExternalIds = [
  'cec-2018-local-councilor-candidate-regional-10009-03-22936',
  'cec-2018-local-councilor-candidate-regional-10018-02-23372',
  'cec-2018-local-councilor-candidate-regional-10018-04-23398',
  'cec-2018-local-councilor-candidate-regional-67000-07-19939',
  'cec-2018-local-village-chief-candidate-64000-020-0016-87727',
  'votetw-candidate-2b5f2607253dd753',
  'votetw-candidate-2e8afe5431095754',
  'votetw-candidate-ad66b702258f7e04',
  'votetw-candidate-ca62620eb2d44756',
  'votetw-candidate-cc967b59b649ac2d',
  'votetw-candidate-d52046c70062fcf7',
  'votetw-candidate-d21b9339a762b14e',
  'votetw-candidate-e0f3cac9e4e9395d',
  'votetw-candidate-ec810578f75fdb6b',
  'votetw-candidate-fbd57dfab7b14c1b',
];

const legalSourceIds = new Set([
  'independent-2018-legal-outcome-research',
  'independent-legal-research-batch-2',
  'remaining-independent-legal-source-research',
  'supported-relative-and-campaign-worker-research',
  'supported-third-party-election-event-research',
  'tnl-dark-guide-independent-legal-research',
  'user-reviewed-independent-legal-research',
]);

const columns = {
  people: [
    ['id', 'uuid'], ['name', 'text'], ['alias', 'text'], ['party', 'text'], ['position', 'text'],
    ['election_year', 'integer'], ['district', 'text'], ['source_url', 'text'], ['is_public', 'boolean'],
    ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'], ['external_id', 'text'],
    ['gender', 'text'], ['education', 'text'], ['experience', 'text'],
  ],
  elections: [
    ['id', 'uuid'], ['name', 'text'], ['year', 'integer'], ['election_type', 'text'],
    ['voting_date', 'date'], ['status', 'text'], ['source_name', 'text'], ['source_url', 'text'],
    ['is_public', 'boolean'], ['created_at', 'timestamptz'], ['updated_at', 'timestamptz'],
    ['external_id', 'text'],
  ],
  races: [
    ['id', 'uuid'], ['election_id', 'uuid'], ['region_id', 'uuid'], ['race_type', 'text'],
    ['title', 'text'], ['voting_date', 'date'], ['status', 'text'], ['source_name', 'text'],
    ['source_url', 'text'], ['is_public', 'boolean'], ['created_at', 'timestamptz'],
    ['updated_at', 'timestamptz'], ['external_id', 'text'],
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
};

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')];
    }));
}

function config() {
  const localEnv = readLocalEnv();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!localHosts.has(new URL(supabaseUrl).hostname)) throw new Error('Production snapshot generation is local-only.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  return { supabaseUrl, serviceRoleKey };
}

function selectList(group) {
  return columns[group].map(([name]) => name).join(',');
}

async function fetchRows(configValue, table, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(`${configValue.supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
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

async function fetchByExternalIds(configValue, table, group, values) {
  const rows = [];
  const unique = [...new Set(values)];
  for (let offset = 0; offset < unique.length; offset += 60) {
    const chunk = unique.slice(offset, offset + 60);
    rows.push(...await fetchRows(configValue, table, selectList(group), {
      external_id: `in.(${chunk.map(postgrestValue).join(',')})`,
    }));
  }
  return rows.sort((left, right) => String(left.external_id).localeCompare(String(right.external_id)));
}

async function fetchByIds(configValue, table, group, values) {
  const rows = [];
  const unique = [...new Set(values)];
  for (let offset = 0; offset < unique.length; offset += 60) {
    const chunk = unique.slice(offset, offset + 60);
    rows.push(...await fetchRows(configValue, table, selectList(group), {
      id: `in.(${chunk.map(postgrestValue).join(',')})`,
    }));
  }
  return rows.sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

async function fetchRowsByValues(configValue, table, select, column, values) {
  const rows = [];
  const unique = [...new Set(values)];
  for (let offset = 0; offset < unique.length; offset += 60) {
    const chunk = unique.slice(offset, offset + 60);
    rows.push(...await fetchRows(configValue, table, select, {
      [column]: `in.(${chunk.map(postgrestValue).join(',')})`,
    }));
  }
  return rows;
}

function canonicalPersonLinks(people, canonicalMap, canonicalPeople) {
  const canonicalIdByPersonId = new Map(canonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const canonicalById = new Map(canonicalPeople.map((row) => [row.id, row]));
  return people.map((person) => {
    const canonicalId = canonicalIdByPersonId.get(person.id);
    const canonical = canonicalById.get(canonicalId);
    if (!canonical?.external_id) throw new Error(`Missing canonical external_id for person ${person.id}`);
    return { local_id: person.id, target_id: canonical.id, external_id: canonical.external_id };
  });
}

function sqlJson(value, delimiter) {
  const json = JSON.stringify(value);
  if (json.includes(delimiter)) throw new Error(`Payload contains ${delimiter}`);
  return `${delimiter}${json}${delimiter}::jsonb`;
}

function tempTable(name, group, rows, delimiter) {
  const declaration = columns[group].map(([column, type]) => `${column} ${type}`).join(', ');
  return `CREATE TEMP TABLE ${name} ON COMMIT DROP AS\nSELECT * FROM jsonb_to_recordset(${sqlJson(rows, delimiter)}) AS row(${declaration});`;
}

function upsert(target, temp, group, conflictTarget) {
  const names = columns[group].map(([name]) => name);
  const updates = names.filter((name) => !['id', 'created_at'].includes(name));
  return `INSERT INTO public.${target} (${names.join(', ')})\nSELECT ${names.join(', ')} FROM ${temp}\nON CONFLICT (${conflictTarget}) DO UPDATE SET\n    ${updates.map((name) => `${name} = EXCLUDED.${name}`).join(',\n    ')};`;
}

function assertCount(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, found ${actual}`);
}

function buildExecutiveMigrationBase(dataset) {
  const delimiter = '$executive_release$';
  return `-- Generated by scripts/build-production-release-snapshots.mjs from reviewed Local Supabase rows.\nBEGIN;\n\n${tempTable('_executive_people', 'people', dataset.people, delimiter)}\n\n${tempTable('_executive_elections', 'elections', dataset.elections, delimiter)}\n\n${tempTable('_executive_races', 'races', dataset.races, delimiter)}\n\n${tempTable('_executive_candidates', 'candidates', dataset.candidates, delimiter)}\n\nCREATE TEMP TABLE _executive_person_ids ON COMMIT DROP AS\nSELECT incoming.id AS local_id, COALESCE(existing.id, incoming.id) AS target_id\nFROM _executive_people incoming\nLEFT JOIN public.people existing ON existing.external_id = incoming.external_id;\n\nCREATE TEMP TABLE _executive_election_ids ON COMMIT DROP AS\nSELECT incoming.id AS local_id, COALESCE(existing.id, incoming.id) AS target_id\nFROM _executive_elections incoming\nLEFT JOIN public.elections existing ON existing.external_id = incoming.external_id;\n\nCREATE TEMP TABLE _executive_race_ids ON COMMIT DROP AS\nSELECT incoming.id AS local_id, COALESCE(existing.id, incoming.id) AS target_id\nFROM _executive_races incoming\nLEFT JOIN public.races existing ON existing.external_id = incoming.external_id;\n\nCREATE TEMP TABLE _executive_candidate_ids ON COMMIT DROP AS\nSELECT incoming.id AS local_id, COALESCE(existing.id, incoming.id) AS target_id\nFROM _executive_candidates incoming\nLEFT JOIN public.candidates existing ON existing.external_id = incoming.external_id;\n\nUPDATE _executive_candidates incoming\nSET person_id = ids.target_id\nFROM _executive_person_ids ids\nWHERE incoming.person_id = ids.local_id;\n\nUPDATE _executive_candidates incoming\nSET race_id = ids.target_id\nFROM _executive_race_ids ids\nWHERE incoming.race_id = ids.local_id;\n\nUPDATE _executive_races incoming\nSET election_id = ids.target_id\nFROM _executive_election_ids ids\nWHERE incoming.election_id = ids.local_id;\n\nUPDATE _executive_people incoming SET id = ids.target_id FROM _executive_person_ids ids WHERE incoming.id = ids.local_id;\nUPDATE _executive_elections incoming SET id = ids.target_id FROM _executive_election_ids ids WHERE incoming.id = ids.local_id;\nUPDATE _executive_races incoming SET id = ids.target_id FROM _executive_race_ids ids WHERE incoming.id = ids.local_id;\nUPDATE _executive_candidates incoming SET id = ids.target_id FROM _executive_candidate_ids ids WHERE incoming.id = ids.local_id;\n\nDO $$\nBEGIN\n    IF (SELECT COUNT(*) FROM _executive_people) <> 85\n       OR (SELECT COUNT(*) FROM _executive_elections) <> 15\n       OR (SELECT COUNT(*) FROM _executive_races) <> 126\n       OR (SELECT COUNT(*) FROM _executive_candidates) <> 131 THEN\n        RAISE EXCEPTION 'Elected executive production payload count drift';\n    END IF;\n\n    IF EXISTS (SELECT 1 FROM public.people existing JOIN _executive_people incoming ON existing.id = incoming.id WHERE existing.external_id IS DISTINCT FROM incoming.external_id)\n       OR EXISTS (SELECT 1 FROM public.elections existing JOIN _executive_elections incoming ON existing.id = incoming.id WHERE existing.external_id IS DISTINCT FROM incoming.external_id)\n       OR EXISTS (SELECT 1 FROM public.races existing JOIN _executive_races incoming ON existing.id = incoming.id WHERE existing.external_id IS DISTINCT FROM incoming.external_id)\n       OR EXISTS (SELECT 1 FROM public.candidates existing JOIN _executive_candidates incoming ON existing.id = incoming.id WHERE existing.external_id IS DISTINCT FROM incoming.external_id) THEN\n        RAISE EXCEPTION 'Elected executive production identifier conflict';\n    END IF;\nEND\n$$;\n\n${upsert('people', '_executive_people', 'people', 'id')}\n\n${upsert('elections', '_executive_elections', 'elections', 'id')}\n\n${upsert('races', '_executive_races', 'races', 'id')}\n\n${upsert('candidates', '_executive_candidates', 'candidates', 'id')}\n\nSELECT public.refresh_public_people_list_cached();\nSELECT published.promote(NULL);\n\nDO $$\nBEGIN\n    IF (SELECT COUNT(*) FROM published.people item JOIN _executive_people release ON release.id = item.person_id) <> 85\n       OR (SELECT COUNT(*) FROM published.elections item JOIN _executive_elections release ON release.id = item.election_id) <> 15\n       OR (SELECT COUNT(*) FROM published.races item JOIN _executive_races release ON release.id = item.race_id) <> 126\n       OR (SELECT COUNT(*) FROM published.candidates item JOIN _executive_candidates release ON release.id = item.candidate_id) <> 131 THEN\n        RAISE EXCEPTION 'Elected executive production publication verification failed';\n    END IF;\nEND\n$$;\n\nCOMMIT;\n`;
}

function buildExecutiveMigration(dataset) {
  const delimiter = '$executive_release$';
  const personKeyTable = `CREATE TEMP TABLE _executive_person_keys ON COMMIT DROP AS\nSELECT * FROM jsonb_to_recordset(${sqlJson(dataset.personKeys, delimiter)}) AS row(local_id uuid, target_id uuid, external_id text);`;
  const oldMap = `CREATE TEMP TABLE _executive_person_ids ON COMMIT DROP AS
SELECT incoming.id AS local_id, COALESCE(existing.id, incoming.id) AS target_id
FROM _executive_people incoming
LEFT JOIN public.people existing ON existing.external_id = incoming.external_id;`;
  const newMap = `${personKeyTable}

CREATE TEMP TABLE _executive_person_ids ON COMMIT DROP AS
SELECT person_key.local_id, COALESCE(existing.id, incoming.id, person_key.target_id) AS target_id
FROM _executive_person_keys person_key
LEFT JOIN public.people existing ON existing.external_id = person_key.external_id
LEFT JOIN _executive_people incoming ON incoming.external_id = person_key.external_id;`;
  return buildExecutiveMigrationBase(dataset).replace(oldMap, newMap);
}

function buildLegalMigrationBase(claims, personKeys) {
  const delimiter = '$legal_release$';
  const personKeyTable = `CREATE TEMP TABLE _legal_person_keys ON COMMIT DROP AS\nSELECT * FROM jsonb_to_recordset(${sqlJson(personKeys, delimiter)}) AS row(local_id uuid, target_id uuid, external_id text);`;
  return `-- Generated by scripts/build-production-release-snapshots.mjs from reviewed Local Supabase rows.\nBEGIN;\n\n${tempTable('_legal_claims', 'claims', claims, delimiter)}\n\n${personKeyTable}\n\nUPDATE _legal_claims incoming\nSET person_id = existing.id\nFROM _legal_person_keys person_key\nJOIN public.people existing ON existing.external_id = person_key.external_id\nWHERE incoming.person_id = person_key.local_id;\n\nDO $$\nBEGIN\n    IF (SELECT COUNT(*) FROM _legal_claims) <> 136\n       OR (SELECT COUNT(*) FROM _legal_person_keys) <> 107\n       OR EXISTS (SELECT 1 FROM _legal_claims WHERE source_person_id IS NOT NULL OR candidate_id IS NOT NULL)\n       OR EXISTS (SELECT 1 FROM _legal_claims WHERE claim_type <> 'legal_case' OR review_status <> 'verified' OR visibility <> 'public' OR is_public IS DISTINCT FROM TRUE) THEN\n        RAISE EXCEPTION 'Reviewed legal production payload drift';\n    END IF;\n    IF EXISTS (SELECT 1 FROM _legal_claims incoming LEFT JOIN public.people person ON person.id = incoming.person_id WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE) THEN\n        RAISE EXCEPTION 'Reviewed legal production payload references a missing public person';\n    END IF;\n    IF EXISTS (SELECT 1 FROM public.person_claims existing JOIN _legal_claims incoming ON existing.claim_key = incoming.claim_key WHERE existing.id <> incoming.id)\n       OR EXISTS (SELECT 1 FROM public.person_claims existing JOIN _legal_claims incoming ON existing.id = incoming.id WHERE existing.claim_key <> incoming.claim_key) THEN\n        RAISE EXCEPTION 'Reviewed legal production claim identifier conflict';\n    END IF;\nEND\n$$;\n\n${upsert('person_claims', '_legal_claims', 'claims', 'id')}\n\nSELECT public.refresh_public_people_list_cached();\nSELECT published.promote(NULL);\n\nDO $$\nBEGIN\n    IF (SELECT COUNT(*) FROM public.person_claims claim JOIN _legal_claims release ON release.id = claim.id WHERE claim.review_status = 'verified' AND claim.visibility = 'public' AND claim.is_public = TRUE) <> 136 THEN\n        RAISE EXCEPTION 'Reviewed legal production publication verification failed';\n    END IF;\nEND\n$$;\n\nCOMMIT;\n`;
}

function buildLegalMigration(claims, personKeys) {
  return buildLegalMigrationBase(claims, personKeys).replace(
    `SET person_id = existing.id
FROM _legal_person_keys person_key
JOIN public.people existing ON existing.external_id = person_key.external_id`,
    `SET person_id = COALESCE(existing.id, person_key.target_id)
FROM _legal_person_keys person_key
LEFT JOIN public.people existing ON existing.external_id = person_key.external_id`,
  );
}

function buildPublicDeltaMigrationBase(dataset) {
  const delimiter = '$public_delta$';
  const personKeys = dataset.candidatePersonKeys;
  const raceKeys = dataset.candidateRaces.map((race) => ({ local_id: race.id, external_id: race.external_id }));
  const personKeyTable = `CREATE TEMP TABLE _delta_person_keys ON COMMIT DROP AS\nSELECT * FROM jsonb_to_recordset(${sqlJson(personKeys, delimiter)}) AS row(local_id uuid, target_id uuid, external_id text);`;
  const raceKeyTable = `CREATE TEMP TABLE _delta_race_keys ON COMMIT DROP AS\nSELECT * FROM jsonb_to_recordset(${sqlJson(raceKeys, delimiter)}) AS row(local_id uuid, external_id text);`;
  return `-- Generated by scripts/build-production-release-snapshots.mjs from the final reviewed public-set delta.\nBEGIN;\n\n${tempTable('_delta_people', 'people', dataset.people, delimiter)}\n\n${tempTable('_delta_candidates', 'candidates', dataset.candidates, delimiter)}\n\n${tempTable('_delta_claims', 'claims', dataset.claims, delimiter)}\n\n${personKeyTable}\n\n${raceKeyTable}\n\nCREATE TEMP TABLE _delta_people_ids ON COMMIT DROP AS\nSELECT incoming.id AS local_id, COALESCE(existing.id, incoming.id) AS target_id\nFROM _delta_people incoming\nLEFT JOIN public.people existing ON existing.external_id = incoming.external_id;\n\nCREATE TEMP TABLE _delta_candidate_ids ON COMMIT DROP AS\nSELECT incoming.id AS local_id, COALESCE(existing.id, incoming.id) AS target_id\nFROM _delta_candidates incoming\nLEFT JOIN public.candidates existing ON existing.external_id = incoming.external_id;\n\nUPDATE _delta_candidates incoming\nSET person_id = existing.id\nFROM _delta_person_keys person_key\nJOIN public.people existing ON existing.external_id = person_key.external_id\nWHERE incoming.person_id = person_key.local_id;\n\nUPDATE _delta_candidates incoming\nSET race_id = existing.id\nFROM _delta_race_keys race_key\nJOIN public.races existing ON existing.external_id = race_key.external_id\nWHERE incoming.race_id = race_key.local_id;\n\nUPDATE _delta_claims incoming\nSET person_id = existing.id\nFROM _delta_person_keys person_key\nJOIN public.people existing ON existing.external_id = person_key.external_id\nWHERE incoming.person_id = person_key.local_id;\n\nUPDATE _delta_people incoming SET id = ids.target_id FROM _delta_people_ids ids WHERE incoming.id = ids.local_id;\nUPDATE _delta_candidates incoming SET id = ids.target_id FROM _delta_candidate_ids ids WHERE incoming.id = ids.local_id;\n\nDO $$\nBEGIN\n    IF (SELECT COUNT(*) FROM _delta_people) <> 2 OR (SELECT COUNT(*) FROM _delta_candidates) <> 14 OR (SELECT COUNT(*) FROM _delta_claims) <> 2 THEN\n        RAISE EXCEPTION 'Production public identity delta count drift';\n    END IF;\n    IF EXISTS (SELECT 1 FROM _delta_candidates candidate LEFT JOIN public.people person ON person.id = candidate.person_id WHERE person.id IS NULL)\n       OR EXISTS (SELECT 1 FROM _delta_candidates candidate LEFT JOIN public.races race ON race.id = candidate.race_id WHERE race.id IS NULL)\n       OR EXISTS (SELECT 1 FROM _delta_claims claim LEFT JOIN public.people person ON person.id = claim.person_id WHERE person.id IS NULL) THEN\n        RAISE EXCEPTION 'Production public identity delta is missing a prerequisite person or race';\n    END IF;\n    IF EXISTS (SELECT 1 FROM public.people existing JOIN _delta_people incoming ON existing.id = incoming.id WHERE existing.external_id IS DISTINCT FROM incoming.external_id)\n       OR EXISTS (SELECT 1 FROM public.candidates existing JOIN _delta_candidates incoming ON existing.id = incoming.id WHERE existing.external_id IS DISTINCT FROM incoming.external_id)\n       OR EXISTS (SELECT 1 FROM public.person_claims existing JOIN _delta_claims incoming ON existing.claim_key = incoming.claim_key WHERE existing.id <> incoming.id) THEN\n        RAISE EXCEPTION 'Production public identity delta identifier conflict';\n    END IF;\nEND\n$$;\n\n${upsert('people', '_delta_people', 'people', 'id')}\n\n${upsert('candidates', '_delta_candidates', 'candidates', 'id')}\n\n${upsert('person_claims', '_delta_claims', 'claims', 'id')}\n\nSELECT public.refresh_public_people_list_cached();\nSELECT published.promote(NULL);\n\nDO $$\nDECLARE\n    published_people_count INTEGER;\n    published_candidate_count INTEGER;\n    published_fact_count INTEGER;\nBEGIN\n    SELECT COUNT(*) INTO published_people_count FROM published.people item JOIN _delta_people release ON release.id = item.person_id;\n    SELECT COUNT(*) INTO published_candidate_count FROM published.candidates item JOIN _delta_candidates release ON release.id = item.candidate_id;\n    SELECT COUNT(*) INTO published_fact_count FROM published.candidate_facts item JOIN _delta_candidates release ON release.id = item.candidate_id;\n    IF published_people_count <> 2 OR published_candidate_count <> 14 OR published_fact_count <> 14 THEN\n        RAISE EXCEPTION 'Production public identity delta publication verification failed: people %, candidates %, facts %', published_people_count, published_candidate_count, published_fact_count;\n    END IF;\nEND\n$$;\n\nCOMMIT;\n`;
}

function buildPublicDeltaMigration(dataset) {
  return buildPublicDeltaMigrationBase(dataset).replaceAll(
    `SET person_id = existing.id
FROM _delta_person_keys person_key
JOIN public.people existing ON existing.external_id = person_key.external_id`,
    `SET person_id = COALESCE(existing.id, person_key.target_id)
FROM _delta_person_keys person_key
LEFT JOIN public.people existing ON existing.external_id = person_key.external_id`,
  ).replace(
    'WHERE person.id IS NULL)\n       OR EXISTS (SELECT 1 FROM _delta_candidates candidate LEFT JOIN public.races',
    'WHERE person.id IS NULL AND NOT EXISTS (SELECT 1 FROM _delta_people incoming_person WHERE incoming_person.id = candidate.person_id))\n       OR EXISTS (SELECT 1 FROM _delta_candidates candidate LEFT JOIN public.races',
  ).replace(
    'WHERE person.id IS NULL) THEN\n        RAISE EXCEPTION',
    'WHERE person.id IS NULL AND NOT EXISTS (SELECT 1 FROM _delta_people incoming_person WHERE incoming_person.id = claim.person_id)) THEN\n        RAISE EXCEPTION',
  ).replaceAll('<> 14', '<> 15').replace(
    'UPDATE _delta_candidates incoming SET id = ids.target_id FROM _delta_candidate_ids ids WHERE incoming.id = ids.local_id;\n\nDO $$',
    () => 'UPDATE _delta_candidates incoming SET id = ids.target_id FROM _delta_candidate_ids ids WHERE incoming.id = ids.local_id;\nUPDATE _delta_candidates SET updated_at = NOW();\n\nDO $$',
  );
}

async function main() {
  const configValue = config();
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const [people, elections, races, candidates, allLegalClaims] = await Promise.all([
    fetchByExternalIds(configValue, 'people', 'people', seed.people.map((row) => row.externalId)),
    fetchByExternalIds(configValue, 'elections', 'elections', seed.elections.map((row) => row.externalId)),
    fetchByExternalIds(configValue, 'races', 'races', seed.races.map((row) => row.externalId)),
    fetchByExternalIds(configValue, 'candidates', 'candidates', seed.candidates.map((row) => row.externalId)),
    fetchRows(configValue, 'person_claims', selectList('claims'), {
      claim_type: 'eq.legal_case', review_status: 'eq.verified', visibility: 'eq.public', is_public: 'eq.true',
    }),
  ]);
  assertCount(people.length, 85, 'elected executive people');
  assertCount(elections.length, 15, 'elected executive elections');
  assertCount(races.length, 126, 'elected executive races');
  assertCount(candidates.length, 131, 'elected executive candidates');

  const claims = allLegalClaims
    .filter((row) => legalSourceIds.has(row.claim_json?.sourceId))
    .map((row) => ({ ...row, source_person_id: null, candidate_id: null }))
    .sort((left, right) => left.claim_key.localeCompare(right.claim_key));
  assertCount(claims.length, 136, 'reviewed legal claims');
  const legalPeople = await fetchByIds(configValue, 'people', 'people', claims.map((row) => row.person_id));
  assertCount(legalPeople.length, 107, 'reviewed legal people');

  const [deltaPeople, deltaCandidates] = await Promise.all([
    fetchByExternalIds(configValue, 'people', 'people', publicDeltaPersonExternalIds),
    fetchByExternalIds(configValue, 'candidates', 'candidates', publicDeltaCandidateExternalIds),
  ]);
  assertCount(deltaPeople.length, 2, 'public delta people');
  assertCount(deltaCandidates.length, 15, 'public delta candidates');
  const [deltaCandidatePeople, deltaCandidateRaces] = await Promise.all([
    fetchByIds(configValue, 'people', 'people', deltaCandidates.map((row) => row.person_id)),
    fetchByIds(configValue, 'races', 'races', deltaCandidates.map((row) => row.race_id)),
  ]);
  assertCount(deltaCandidatePeople.length, new Set(deltaCandidates.map((row) => row.person_id)).size, 'public delta candidate people');
  assertCount(deltaCandidateRaces.length, new Set(deltaCandidates.map((row) => row.race_id)).size, 'public delta candidate races');

  const mappingPeople = [...new Map(
    [...people, ...legalPeople, ...deltaCandidatePeople].map((person) => [person.id, person]),
  ).values()];
  const canonicalMap = await fetchRowsByValues(
    configValue,
    'person_canonical_map',
    'person_id,canonical_person_id',
    'person_id',
    mappingPeople.map((person) => person.id),
  );
  assertCount(canonicalMap.length, mappingPeople.length, 'canonical person map');
  const canonicalPeople = await fetchByIds(
    configValue,
    'people',
    'people',
    canonicalMap.map((row) => row.canonical_person_id),
  );
  const executivePersonKeys = canonicalPersonLinks(people, canonicalMap, canonicalPeople);
  const legalPersonKeys = canonicalPersonLinks(legalPeople, canonicalMap, canonicalPeople);
  const deltaCandidatePersonKeys = deltaCandidatePeople.map((person) => ({
    local_id: person.id,
    target_id: person.id,
    external_id: person.external_id,
  }));
  const executiveCanonicalExternalIds = new Set(executivePersonKeys.map((row) => row.external_id));
  const executiveCanonicalPeople = canonicalPeople.filter((person) => executiveCanonicalExternalIds.has(person.external_id));
  assertCount(executiveCanonicalPeople.length, executiveCanonicalExternalIds.size, 'elected executive canonical people');
  const chiayiPerson = deltaPeople.find((row) => row.external_id.startsWith('official-current:chiayi-city-council'));
  const deltaClaims = (await fetchRows(configValue, 'person_claims', selectList('claims'), {
    person_id: `eq.${chiayiPerson.id}`,
  }))
    .filter((row) => ['education', 'experience'].includes(row.claim_type))
    .map((row) => ({ ...row, source_person_id: null, candidate_id: null }))
    .sort((left, right) => left.claim_key.localeCompare(right.claim_key));
  assertCount(deltaClaims.length, 2, 'public delta profile claims');


  fs.writeFileSync(executiveOutput, buildExecutiveMigration({
    people: executiveCanonicalPeople,
    personKeys: executivePersonKeys,
    elections,
    races,
    candidates,
  }));
  fs.writeFileSync(legalOutput, buildLegalMigration(claims, legalPersonKeys));
  fs.writeFileSync(publicDeltaOutput, buildPublicDeltaMigration({
    people: deltaPeople,
    candidates: deltaCandidates,
    claims: deltaClaims,
    candidatePersonKeys: deltaCandidatePersonKeys,
    candidateRaces: deltaCandidateRaces,
  }));
  console.log(JSON.stringify({
    executiveOutput: path.relative(repoRoot, executiveOutput),
    legalOutput: path.relative(repoRoot, legalOutput),
    publicDeltaOutput: path.relative(repoRoot, publicDeltaOutput),
    counts: { people: executiveCanonicalPeople.length, elections: elections.length, races: races.length, candidates: candidates.length, legalClaims: claims.length, deltaPeople: deltaPeople.length, deltaCandidates: deltaCandidates.length },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
