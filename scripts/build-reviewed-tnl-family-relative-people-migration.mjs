import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const defaultOutputPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '202608010035_publish_reviewed_tnl_family_relative_people.sql',
);
const expectedApprovedPeople = 56;
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const evidenceRank = [
  'official',
  'institutional',
  'candidate_official',
  'trusted_media',
  'first_party',
  'reliable_secondary',
  'secondary',
];

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
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = { outputPath: defaultOutputPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

export function normalizedName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/羣/g, '群')
    .replace(/黄/g, '黃')
    .replace(/[^㐀-鿿a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function deterministicUuid(seed) {
  const bytes = crypto.createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uniqueBy(rows, keyFor) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFor(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceSources(row) {
  return uniqueBy([
    ...(row.externalResearch?.sources ?? []).map((source) => ({
      tier: source.tier,
      name: source.name,
      url: source.url,
      supports: source.supports ?? null,
    })),
    ...(row.localEvidence ?? []).map((source) => ({
      tier: source.tier,
      name: source.sourceName,
      url: source.sourceUrl,
      supports: source.claimValue ?? null,
    })),
  ].filter((source) => evidenceRank.includes(source.tier) && /^https:\/\//.test(source.url ?? '')),
  (source) => source.url).sort((left, right) => (
    evidenceRank.indexOf(left.tier) - evidenceRank.indexOf(right.tier)
    || left.url.localeCompare(right.url)
  ));
}

function reviewedResearchIds(entry, familyPeopleReport) {
  if (entry.researchIds?.length) return [...new Set(entry.researchIds)].sort();
  const targetName = normalizedName(entry.name);
  return [...new Set([
    ...(familyPeopleReport.found ?? []),
    ...(familyPeopleReport.ambiguousSameName ?? []),
    ...(familyPeopleReport.notFound ?? []),
  ]
    .filter((row) => normalizedName(row.mentionedName) === targetName)
    .flatMap((row) => (row.occurrences ?? []).map((occurrence) => (
      String(occurrence.id).replace(/-family-(\d+)$/u, '-政治家族-$1')
    ))))].sort();
}

export function buildReviewedRelativePeopleRows({
  reviewedConfig,
  sourceResearchReport,
  familyPeopleReport,
  people = [],
  personCanonicalMap = [],
}) {
  const approved = (reviewedConfig.people ?? []).filter((entry) => entry.reviewStatus === 'approved');
  const duplicateNames = approved
    .map((entry) => normalizedName(entry.name))
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateNames.length > 0) throw new Error(`Duplicate reviewed relative names: ${duplicateNames.join(', ')}`);

  const canonicalIds = new Map(personCanonicalMap.map((row) => [row.person_id, row.canonical_person_id]));
  const canonicalPersonId = (personId) => canonicalIds.get(personId) ?? personId;
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const peopleByName = new Map();
  for (const person of people) {
    const key = normalizedName(person.name);
    const rows = peopleByName.get(key) ?? [];
    rows.push(person);
    peopleByName.set(key, rows);
  }
  const researchById = new Map((sourceResearchReport.claims ?? [])
    .map((row) => [row.researchId, row]));

  return approved.map((entry) => {
    if (!entry.name?.trim() || !entry.position?.trim()) {
      throw new Error('Every approved relative person requires a name and position');
    }
    const researchIds = reviewedResearchIds(entry, familyPeopleReport)
      .filter((researchId) => researchById.has(researchId));
    if (researchIds.length === 0) throw new Error(`No reviewed research rows for relative person: ${entry.name}`);
    const researchRows = researchIds.map((researchId) => {
      const row = researchById.get(researchId);
      if (!row) throw new Error(`Missing source research row: ${researchId}`);
      return row;
    });
    const nameKey = normalizedName(entry.name);
    const evidence = uniqueBy(researchRows.flatMap(evidenceSources)
      .filter((source) => normalizedName(source.supports).includes(nameKey)),
    (source) => source.url).sort((left, right) => (
      evidenceRank.indexOf(left.tier) - evidenceRank.indexOf(right.tier)
      || left.url.localeCompare(right.url)
    ));
    if (evidence.length === 0) {
      throw new Error(`Independent evidence does not identify relative person: ${entry.name}`);
    }

    const canonicalMatches = uniqueBy((peopleByName.get(nameKey) ?? []).map((person) => ({
      personId: canonicalPersonId(person.id),
      person,
    })), (match) => match.personId);
    if (canonicalMatches.length > 1) {
      throw new Error(`Reviewed relative person still has multiple canonical matches: ${entry.name}`);
    }
    const existingPersonId = canonicalMatches[0]?.personId ?? null;
    const existingPerson = existingPersonId == null
      ? null
      : peopleById.get(existingPersonId) ?? canonicalMatches[0].person;
    const primaryEvidence = evidence[0];
    const sourceKeyHash = crypto.createHash('sha256').update(nameKey).digest('hex').slice(0, 16);
    const sourcePersonKey = `reviewed-family-relative:${sourceKeyHash}`;
    const releasePersonId = deterministicUuid(`tnl-family-relative-person:${nameKey}`);
    const reusesExistingPerson = existingPersonId != null && existingPersonId !== releasePersonId;
    return {
      personId: existingPersonId ?? releasePersonId,
      sourcePersonId: deterministicUuid(`tnl-family-relative-source:${nameKey}`),
      sourcePersonKey,
      name: entry.name,
      normalizedName: nameKey,
      position: entry.position,
      sourceType: primaryEvidence.tier === 'official' ? 'official_officeholder' : 'public_reference',
      sourceName: primaryEvidence.name,
      sourceUrl: primaryEvidence.url,
      confidenceLevel: primaryEvidence.tier === 'official' ? 'A' : 'B',
      researchIds,
      evidenceSources: evidence,
      createPerson: !reusesExistingPerson,
      existingPersonWasPublic: reusesExistingPerson && existingPerson?.is_public === true,
    };
  }).sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::JSONB`;
}

export function buildMigration(rows) {
  const migrationRows = rows.map((row) => ({
    person_id: row.personId,
    source_person_id: row.sourcePersonId,
    source_person_key: row.sourcePersonKey,
    name: row.name,
    normalized_name: row.normalizedName,
    position: row.position,
    source_type: row.sourceType,
    source_name: row.sourceName,
    source_url: row.sourceUrl,
    confidence_level: row.confidenceLevel,
    research_ids: row.researchIds,
    evidence_sources: row.evidenceSources,
    create_person: row.createPerson,
    existing_person_was_public: row.existingPersonWasPublic,
  }));
  const confidenceA = rows.filter((row) => row.confidenceLevel === 'A').length;
  const confidenceB = rows.filter((row) => row.confidenceLevel === 'B').length;
  const createPeople = rows.filter((row) => row.createPerson).length;
  return `-- Generated by scripts/build-reviewed-tnl-family-relative-people-migration.mjs.
-- Publishes only independently sourced public-role relatives approved for the family-claim release.
BEGIN;

CREATE TEMP TABLE _reviewed_tnl_family_relative_people (
    person_id UUID PRIMARY KEY,
    source_person_id UUID NOT NULL UNIQUE,
    source_person_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    position TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    confidence_level TEXT NOT NULL,
    research_ids JSONB NOT NULL,
    evidence_sources JSONB NOT NULL,
    create_person BOOLEAN NOT NULL,
    existing_person_was_public BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_tnl_family_relative_people
SELECT *
FROM jsonb_to_recordset(${sqlJson(migrationRows)}) AS item(
    person_id UUID,
    source_person_id UUID,
    source_person_key TEXT,
    name TEXT,
    normalized_name TEXT,
    position TEXT,
    source_type TEXT,
    source_name TEXT,
    source_url TEXT,
    confidence_level TEXT,
    research_ids JSONB,
    evidence_sources JSONB,
    create_person BOOLEAN,
    existing_person_was_public BOOLEAN
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_tnl_family_relative_people) <> ${rows.length}
       OR (SELECT COUNT(*) FROM _reviewed_tnl_family_relative_people WHERE confidence_level = 'A') <> ${confidenceA}
       OR (SELECT COUNT(*) FROM _reviewed_tnl_family_relative_people WHERE confidence_level = 'B') <> ${confidenceB}
       OR (SELECT COUNT(*) FROM _reviewed_tnl_family_relative_people WHERE create_person = TRUE) <> ${createPeople} THEN
        RAISE EXCEPTION 'Reviewed TNL family-relative people count drift';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _reviewed_tnl_family_relative_people
        WHERE confidence_level NOT IN ('A', 'B')
           OR source_url !~ '^https://'
           OR jsonb_array_length(research_ids) = 0
           OR jsonb_array_length(evidence_sources) = 0
    ) THEN
        RAISE EXCEPTION 'Reviewed TNL family-relative people contain invalid evidence';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM people existing
        JOIN _reviewed_tnl_family_relative_people incoming ON incoming.person_id = existing.id
        WHERE translate(regexp_replace(trim(existing.name), '\\s+', '', 'g'), '臺羣黄', '台群黃')
              <> incoming.normalized_name
    ) THEN
        RAISE EXCEPTION 'Reviewed TNL family-relative person id conflicts with an existing identity';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM people existing
        JOIN _reviewed_tnl_family_relative_people incoming
          ON translate(regexp_replace(trim(existing.name), '\\s+', '', 'g'), '臺羣黄', '台群黃')
             = incoming.normalized_name
         AND existing.id <> incoming.person_id
        WHERE COALESCE(
            (SELECT canonical_person_id FROM person_canonical_map map WHERE map.person_id = existing.id),
            existing.id
        ) <> incoming.person_id
    ) THEN
        RAISE EXCEPTION 'Reviewed TNL family-relative person name now has another canonical identity';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM source_people existing
        JOIN _reviewed_tnl_family_relative_people incoming ON incoming.source_person_id = existing.id
        WHERE existing.source_person_key <> incoming.source_person_key
    ) OR EXISTS (
        SELECT 1
        FROM source_people existing
        JOIN _reviewed_tnl_family_relative_people incoming USING (source_person_key)
        WHERE existing.id <> incoming.source_person_id
    ) THEN
        RAISE EXCEPTION 'Reviewed TNL family-relative source identity conflict';
    END IF;
END
$$;

INSERT INTO people (
    id, name, position, source_url, external_id, is_public, created_at, updated_at
)
SELECT
    person_id,
    name,
    position,
    source_url,
    source_person_key,
    TRUE,
    NOW(),
    NOW()
FROM _reviewed_tnl_family_relative_people
ON CONFLICT (id) DO UPDATE SET
    position = COALESCE(people.position, EXCLUDED.position),
    source_url = COALESCE(people.source_url, EXCLUDED.source_url),
    external_id = COALESCE(people.external_id, EXCLUDED.external_id),
    is_public = TRUE,
    updated_at = NOW();

INSERT INTO source_people (
    id, source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, source_payload,
    confidence_suggestion, ingest_batch_key, is_public, created_at, updated_at
)
SELECT
    source_person_id,
    source_person_key,
    source_type,
    replace(source_person_key, 'reviewed-family-relative:', ''),
    source_name,
    source_url,
    name,
    normalized_name,
    position,
    jsonb_build_object(
        'schemaVersion', 1,
        'researchIds', research_ids,
        'evidenceSources', evidence_sources,
        'reviewedAt', '2026-08-02',
        'publicationPurpose', 'tnl_dark_guide_family_relative_identity'
    ),
    confidence_level,
    'tnl-dark-guide-reviewed-family-relative-people-20260802',
    TRUE,
    NOW(),
    NOW()
FROM _reviewed_tnl_family_relative_people
ON CONFLICT (source_person_key) DO UPDATE SET
    source_type = EXCLUDED.source_type,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    position = EXCLUDED.position,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = TRUE,
    updated_at = NOW();

INSERT INTO person_identity_matches (
    source_person_id, person_id, match_status, score, match_method, match_reason,
    evidence_json, reviewed_by, reviewed_at, created_at, updated_at
)
SELECT
    source_person_id,
    person_id,
    'auto_matched',
    100,
    'manual_family_relative_public_role_review',
    'Independent evidence identifies the named public-role relative; existing identities were reused only when the normalized name resolved to one canonical person.',
    jsonb_build_object(
        'schemaVersion', 1,
        'researchIds', research_ids,
        'evidenceSources', evidence_sources,
        'createPerson', create_person
    ),
    'system:tnl-dark-guide-family-relative-review',
    NOW(),
    NOW(),
    NOW()
FROM _reviewed_tnl_family_relative_people
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = NOW();

REFRESH MATERIALIZED VIEW public.public_people_list_cached;

COMMIT;
`;
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(config, tableName, select) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < 1000) return rows;
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
    throw new Error('This migration generator only reads local Supabase');
  }
  const reviewedConfig = JSON.parse(fs.readFileSync(
    path.join(dataDir, 'reviewed-family-relative-people.json'), 'utf8',
  ));
  const sourceResearchReport = JSON.parse(fs.readFileSync(
    path.join(dataDir, 'source-research-report.json'), 'utf8',
  ));
  const familyPeopleReport = JSON.parse(fs.readFileSync(
    path.join(dataDir, 'family-people-report.json'), 'utf8',
  ));
  const [people, personCanonicalMap] = await Promise.all([
    fetchRows(config, 'people', 'id,name,is_public,position,source_url'),
    fetchRows(config, 'person_canonical_map', 'person_id,canonical_person_id'),
  ]);
  const rows = buildReviewedRelativePeopleRows({
    reviewedConfig,
    sourceResearchReport,
    familyPeopleReport,
    people,
    personCanonicalMap,
  });
  if (rows.length !== expectedApprovedPeople) {
    throw new Error(`Expected ${expectedApprovedPeople} approved relative people, received ${rows.length}`);
  }
  fs.writeFileSync(options.outputPath, buildMigration(rows), 'utf8');
  console.log(JSON.stringify({
    output: path.relative(repoRoot, options.outputPath),
    approvedPeople: rows.length,
    reusedPeople: rows.filter((row) => !row.createPerson).length,
    createdPeople: rows.filter((row) => row.createPerson).length,
    confidenceA: rows.filter((row) => row.confidenceLevel === 'A').length,
    confidenceB: rows.filter((row) => row.confidenceLevel === 'B').length,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
