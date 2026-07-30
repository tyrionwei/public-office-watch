import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPreviewPath = path.join(repoRoot, 'local-data', 'historical-cec-core-preview.json');
const defaultPlanPath = path.join(repoRoot, 'local-data', 'historical-cec-person-plan.json');
const defaultSqlPath = path.join(repoRoot, 'local-data', 'historical-cec-person-dry-run.sql');
const tempTable = '_historical_cec_person_input_20260730';
const sourceType = 'official_election';
const sourceId = 'cec-2024-votedata';

function parseArgs(argv) {
  const options = {
    previewPath: defaultPreviewPath,
    planPath: defaultPlanPath,
    sqlPath: defaultSqlPath,
    migrationPath: null,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--preview') options.previewPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--plan') options.planPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--sql') options.sqlPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--migration') options.migrationPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function normalizeParty(value) {
  if (value === '無') return '無黨籍';
  return value || null;
}

function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function valuesSql(rows, columns) {
  return rows.map((row) => `    (${columns.map((column) => sqlValue(row[column])).join(', ')})`).join(',\n');
}

function assertUnique(rows, key, label) {
  if (new Set(rows.map((row) => row[key])).size !== rows.length) {
    throw new Error(`Duplicate ${label}`);
  }
}

export function buildHistoricalCecPersonPlan(preview) {
  const people = (preview.safeNewPeople ?? []).map((entry) => ({
    identityContextKey: entry.identityContextKey,
    sourcePersonId: entry.source.sourcePersonId,
    sourcePersonKey: entry.source.sourcePersonKey,
    externalId: entry.proposedPerson.externalId,
    name: entry.proposedPerson.name,
    gender: entry.proposedPerson.gender,
    party: normalizeParty(entry.proposedPerson.party),
    position: entry.proposedPerson.position,
    district: entry.proposedPerson.district,
    electionYear: entry.proposedPerson.electionYear,
  }));
  if (people.length !== preview.summary?.safeNewPersonCount) {
    throw new Error(`Safe new person count mismatch: expected ${preview.summary?.safeNewPersonCount}, got ${people.length}`);
  }
  for (const row of people) {
    for (const field of ['identityContextKey', 'sourcePersonId', 'sourcePersonKey', 'externalId', 'name', 'gender', 'position', 'district', 'electionYear']) {
      if (row[field] == null || row[field] === '') throw new Error(`Missing ${field} for ${row.sourcePersonKey ?? row.name}`);
    }
    if (!['male', 'female'].includes(row.gender)) throw new Error(`Unsupported gender for ${row.sourcePersonKey}`);
  }
  assertUnique(people, 'identityContextKey', 'identity context');
  assertUnique(people, 'sourcePersonId', 'source person id');
  assertUnique(people, 'sourcePersonKey', 'source person key');
  assertUnique(people, 'externalId', 'person external id');
  return {
    source: { sourceType, sourceId },
    policy: {
      newPeoplePublic: false,
      matchStatus: 'auto_matched',
      matchScore: 100,
      heldSourceRows: preview.summary?.heldNewPersonSourceRows ?? null,
      heldGroups: preview.summary?.heldNewPersonGroupCount ?? null,
    },
    summary: { createPeople: people.length, createMatches: people.length },
    people,
  };
}

function verificationBlock(plan, label) {
  const expected = plan.people.length;
  return `DO \$verify\$
BEGIN
    IF (SELECT COUNT(*) FROM ${tempTable}) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} input count mismatch';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM ${tempTable} input
        JOIN source_people source
          ON source.id = input.source_person_id
         AND source.source_person_key = input.source_person_key
         AND source.raw_name = input.name
         AND source.gender = input.gender
         AND (CASE WHEN source.party = '無' THEN '無黨籍' ELSE source.party END) IS NOT DISTINCT FROM input.party
         AND source.position = input.position
         AND source.district = input.district
         AND source.election_year = input.election_year
         AND source.source_type = '${sourceType}'
         AND source.source_id = '${sourceId}'
    ) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} source snapshot mismatch';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM ${tempTable} input
        JOIN people person ON person.external_id = input.external_id
        WHERE person.name IS DISTINCT FROM input.name
           OR person.gender IS DISTINCT FROM input.gender
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} external id identity conflict';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM ${tempTable} input
        JOIN person_identity_matches match ON match.source_person_id = input.source_person_id
        JOIN people person ON person.id = match.person_id
        WHERE match.match_status = 'auto_matched'
          AND person.external_id IS DISTINCT FROM input.external_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} source already matches another person';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM ${tempTable} input
        WHERE EXISTS (
            SELECT 1
            FROM person_identity_review_queue review
            WHERE review.source_person_id = input.source_person_id
              AND review.review_status = 'needs_new_person_review'
        ) OR EXISTS (
            SELECT 1
            FROM person_identity_matches match
            JOIN people person ON person.id = match.person_id
            WHERE match.source_person_id = input.source_person_id
              AND match.match_status = 'auto_matched'
              AND person.external_id = input.external_id
        )
    ) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} source eligibility changed';
    END IF;
END
\$verify\$;`;
}

function resultVerificationBlock(plan, label) {
  const expected = plan.people.length;
  return `DO \$verify\$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM ${tempTable} input
        JOIN people person
          ON person.external_id = input.external_id
         AND person.name = input.name
         AND person.gender = input.gender
         AND person.is_public = FALSE
    ) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} people result mismatch';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM ${tempTable} input
        JOIN people person ON person.external_id = input.external_id
        JOIN person_identity_matches match
          ON match.source_person_id = input.source_person_id
         AND match.person_id = person.id
         AND match.match_status = 'auto_matched'
         AND match.score = 100
    ) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} identity match result mismatch';
    END IF;
END
\$verify\$;`;
}

export function renderHistoricalCecPersonSql(plan, { rollback = true } = {}) {
  const columns = [
    'identityContextKey', 'sourcePersonId', 'sourcePersonKey', 'externalId',
    'name', 'gender', 'party', 'position', 'district', 'electionYear',
  ];
  const sections = [rollback
    ? '-- Generated historical CEC person dry-run. This file always rolls back.'
    : '-- Generated historical CEC private person migration.'];
  if (rollback) sections.push('BEGIN;');
  sections.push(`CREATE TEMP TABLE ${tempTable} (
    identity_context_key TEXT NOT NULL UNIQUE,
    source_person_id UUID PRIMARY KEY,
    source_person_key TEXT NOT NULL UNIQUE,
    external_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    party TEXT,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    election_year INT NOT NULL
);`);
  sections.push(`INSERT INTO ${tempTable} (
    identity_context_key, source_person_id, source_person_key, external_id,
    name, gender, party, position, district, election_year
) VALUES
${valuesSql(plan.people, columns)};`);
  sections.push(verificationBlock(plan, rollback ? 'dry-run' : 'migration'));
  sections.push(`INSERT INTO people (
    name, party, position, election_year, district, source_url,
    is_public, external_id, gender, updated_at
)
SELECT
    input.name, input.party, input.position, input.election_year, input.district, source.source_url,
    FALSE, input.external_id, input.gender, NOW()
FROM ${tempTable} input
JOIN source_people source ON source.id = input.source_person_id
ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    party = EXCLUDED.party,
    position = EXCLUDED.position,
    election_year = EXCLUDED.election_year,
    district = EXCLUDED.district,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    gender = EXCLUDED.gender,
    updated_at = NOW();`);
  sections.push(`INSERT INTO person_identity_matches (
    source_person_id, person_id, match_status, score, match_method,
    match_reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    input.source_person_id,
    person.id,
    'auto_matched',
    100,
    'official_historical_source_scoped_new_person_v1',
    'single official CEC source with no existing same-name public person',
    jsonb_build_object(
        'version', 'official-historical-source-scoped-new-person-v1',
        'identityContextKey', input.identity_context_key,
        'sourcePersonKey', input.source_person_key,
        'electionYear', input.election_year,
        'district', input.district
    ),
    'system:official-historical-source-scoped-new-person-v1',
    NOW(),
    NOW()
FROM ${tempTable} input
JOIN people person ON person.external_id = input.external_id
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = NOW();`);
  sections.push(resultVerificationBlock(plan, rollback ? 'dry-run' : 'migration'));
  sections.push(`SELECT
    ${plan.people.length} AS planned_people,
    ${plan.people.length} AS planned_identity_matches;`);
  if (rollback) sections.push('ROLLBACK;');
  else {
    sections.push('SELECT published.promote(NULL);');
    sections.push(`DO \$verify\$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ${tempTable} input
        JOIN people core ON core.external_id = input.external_id
        JOIN published.people public_person ON public_person.person_id = core.id
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration unexpectedly published a private person';
    END IF;
END
\$verify\$;`);
    sections.push(`DROP TABLE ${tempTable};`);
  }
  return `${sections.join('\n\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.previewPath)) throw new Error('Run preview:historical-cec-core -- --write first.');
  const preview = JSON.parse(fs.readFileSync(options.previewPath, 'utf8'));
  const plan = buildHistoricalCecPersonPlan(preview);
  if (options.write) {
    fs.mkdirSync(path.dirname(options.planPath), { recursive: true });
    fs.mkdirSync(path.dirname(options.sqlPath), { recursive: true });
    fs.writeFileSync(options.planPath, `${JSON.stringify(plan, null, 2)}\n`);
    fs.writeFileSync(options.sqlPath, renderHistoricalCecPersonSql(plan));
  }
  if (options.migrationPath) {
    fs.mkdirSync(path.dirname(options.migrationPath), { recursive: true });
    fs.writeFileSync(options.migrationPath, renderHistoricalCecPersonSql(plan, { rollback: false }));
  }
  console.log(JSON.stringify({
    outputPlan: options.write ? path.relative(repoRoot, options.planPath) : null,
    outputSql: options.write ? path.relative(repoRoot, options.sqlPath) : null,
    outputMigration: options.migrationPath ? path.relative(repoRoot, options.migrationPath) : null,
    ...plan.summary,
    heldSourceRows: plan.policy.heldSourceRows,
    heldGroups: plan.policy.heldGroups,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`historical CEC person migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
