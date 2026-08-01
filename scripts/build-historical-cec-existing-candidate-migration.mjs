import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultReportPath = path.join(repoRoot, 'local-data', 'historical-cec-existing-candidate-coverage.json');
const defaultPlanPath = path.join(repoRoot, 'local-data', 'historical-cec-existing-candidate-plan.json');
const defaultSqlPath = path.join(repoRoot, 'local-data', 'historical-cec-existing-candidate-dry-run.sql');
const tempTable = '_historical_cec_existing_candidate_input_20260730';
const sourceType = 'official_election';
const sourceId = 'cec-2024-votedata';
const sourceName = '中央選舉委員會開放資料';
const allowedMismatchFields = new Set([
  'party', 'candidate_no', 'vote_count', 'vote_rate', 'is_elected',
  'candidacy_status', 'election_result', 'registration_status',
]);

function parseArgs(argv) {
  const options = {
    reportPath: defaultReportPath,
    planPath: defaultPlanPath,
    sqlPath: defaultSqlPath,
    migrationPath: null,
    electionYear: null,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--report') options.reportPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--plan') options.planPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--sql') options.sqlPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--migration') options.migrationPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--year') options.electionYear = Number.parseInt(argv[++index] ?? '', 10);
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (options.electionYear != null && !Number.isInteger(options.electionYear)) {
    throw new Error('Invalid election year');
  }
  return options;
}

function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function valuesSql(rows, columns) {
  return rows.map((row) => `    (${columns.map((column) => sqlValue(row[column])).join(', ')})`).join(',\n');
}

function candidateExternalId(sourcePersonKey) {
  const suffix = crypto.createHash('sha256').update(sourcePersonKey).digest('hex').slice(0, 16);
  return `cec-historical-candidate-${suffix}`;
}

function assertUnique(rows, keyFor, label) {
  if (new Set(rows.map(keyFor)).size !== rows.length) throw new Error(`Duplicate ${label}`);
}

function officialFields(row, mismatchFields = null) {
  const expected = row.expected ?? {};
  const fields = mismatchFields ?? [...allowedMismatchFields];
  for (const field of fields) {
    if (!Object.hasOwn(expected, field) && mismatchFields) {
      throw new Error(`Missing expected update value for ${field}: ${row.sourcePersonKey}`);
    }
  }
  if (expected.vote_count != null && (!Number.isInteger(expected.vote_count) || expected.vote_count < 0)) {
    throw new Error(`Invalid vote count: ${row.sourcePersonKey}`);
  }
  if (expected.vote_rate != null && (!Number.isFinite(expected.vote_rate) || expected.vote_rate < 0 || expected.vote_rate > 100)) {
    throw new Error(`Invalid vote rate: ${row.sourcePersonKey}`);
  }
  if (!mismatchFields && typeof expected.is_elected !== 'boolean') {
    throw new Error(`Invalid elected status: ${row.sourcePersonKey}`);
  }
  const sets = new Set(fields);
  return {
    party: expected.party ?? null,
    candidateNo: expected.candidate_no ?? null,
    voteCount: expected.vote_count ?? null,
    voteRate: expected.vote_rate ?? null,
    elected: expected.is_elected ?? null,
    candidacyStatus: expected.candidacy_status ?? null,
    electionResult: expected.election_result ?? null,
    registrationStatus: expected.registration_status ?? null,
    setParty: sets.has('party'),
    setCandidateNo: sets.has('candidate_no'),
    setVoteCount: sets.has('vote_count'),
    setVoteRate: sets.has('vote_rate'),
    setIsElected: sets.has('is_elected'),
    setCandidacyStatus: sets.has('candidacy_status'),
    setElectionResult: sets.has('election_result'),
    setRegistrationStatus: sets.has('registration_status'),
  };
}

export function buildHistoricalCecExistingCandidatePlan(report, { electionYear = null } = {}) {
  const includesYear = (row) => electionYear == null || row.electionYear === electionYear;
  const creates = (report.safeCreates ?? []).filter(includesYear).map((row) => ({
    operation: 'create',
    sourcePersonId: row.sourcePersonId,
    sourcePersonKey: row.sourcePersonKey,
    personId: row.personId,
    raceId: row.expectedRaceId,
    candidateId: null,
    candidateExternalId: candidateExternalId(row.sourcePersonKey),
    originalIsPublic: null,
    electionYear: row.electionYear,
    raceContextKey: row.raceContextKey,
    ...officialFields(row),
  }));
  const updates = (report.safeUpdates ?? []).filter(includesYear).map((row) => {
    if (!row.candidateId) throw new Error(`Missing update candidate id: ${row.sourcePersonKey}`);
    if (!Array.isArray(row.mismatchFields) || row.mismatchFields.length === 0) {
      throw new Error(`Missing update mismatch fields: ${row.sourcePersonKey}`);
    }
    if (row.mismatchFields.some((field) => !allowedMismatchFields.has(field))) {
      throw new Error(`Unsafe update field: ${row.sourcePersonKey}`);
    }
    if (typeof row.candidateIsPublic !== 'boolean') {
      throw new Error(`Missing original publication state: ${row.sourcePersonKey}`);
    }
    return {
      operation: 'update',
      sourcePersonId: row.sourcePersonId,
      sourcePersonKey: row.sourcePersonKey,
      personId: row.personId,
      raceId: row.expectedRaceId,
      candidateId: row.candidateId,
      candidateExternalId: row.candidateExternalId ?? null,
      originalIsPublic: row.candidateIsPublic,
      electionYear: row.electionYear,
      raceContextKey: row.raceContextKey,
      mismatchFields: row.mismatchFields,
      ...officialFields(row, row.mismatchFields),
    };
  });
  if (electionYear == null) {
    if (creates.length !== Number(report.categoryCounts?.safe_create_candidate ?? 0)) {
      throw new Error('Safe create count mismatch');
    }
    if (updates.length !== Number(report.categoryCounts?.safe_update_candidate ?? 0)) {
      throw new Error('Safe update count mismatch');
    }
  } else if (creates.length + updates.length !== Number(report.actionableByYear?.[electionYear] ?? 0)) {
    throw new Error(`Safe candidate count mismatch for ${electionYear}`);
  }
  const rows = [...creates, ...updates];
  assertUnique(rows, (row) => row.sourcePersonId, 'candidate source id');
  assertUnique(rows, (row) => row.sourcePersonKey, 'candidate source key');
  assertUnique(rows, (row) => `${row.personId}|${row.raceId}`, 'candidate person/race assignment');
  assertUnique(creates, (row) => row.candidateExternalId, 'created candidate external id');
  assertUnique(updates, (row) => row.candidateId, 'updated candidate id');
  return {
    source: { sourceType, sourceId, sourceName },
    policy: {
      databaseWrites: false,
      transaction: 'ROLLBACK',
      createsPublic: false,
      updatesPreservePublicationState: true,
      updateFields: [...allowedMismatchFields],
      electionYear,
    },
    summary: {
      createCandidates: creates.length,
      updateCandidates: updates.length,
      totalCandidates: rows.length,
      withVoteCount: rows.filter((row) => row.voteCount != null).length,
      withVoteRate: rows.filter((row) => row.voteRate != null).length,
      elected: rows.filter((row) => row.elected).length,
      publicUpdates: updates.filter((row) => row.originalIsPublic).length,
    },
    rows,
  };
}

function preflightBlock(plan, label) {
  const summary = plan.summary;
  return `DO \$verify\$
BEGIN
    IF (SELECT COUNT(*) FROM ${tempTable}) <> ${summary.totalCandidates}
       OR (SELECT COUNT(*) FROM ${tempTable} WHERE operation = 'create') <> ${summary.createCandidates}
       OR (SELECT COUNT(*) FROM ${tempTable} WHERE operation = 'update') <> ${summary.updateCandidates} THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate input count mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM ${tempTable} input
        WHERE NOT EXISTS (
            SELECT 1 FROM source_people source
            WHERE source.id = input.source_person_id
              AND source.source_person_key = input.source_person_key
              AND source.source_type = '${sourceType}'
              AND source.source_id = '${sourceId}'
              AND (CASE WHEN source.party = '無' THEN '無黨籍' ELSE NULLIF(BTRIM(source.party), '') END)
                    IS NOT DISTINCT FROM input.party
              AND (NOT input.set_candidate_no OR NULLIF(source.source_payload->>'candidateNo', '') IS NOT DISTINCT FROM input.candidate_no)
              AND (NOT input.set_vote_count OR COALESCE(NULLIF(source.source_payload->>'voteCount', ''), NULLIF(source.source_payload->>'votes', ''))::INT
                    IS NOT DISTINCT FROM input.vote_count)
              AND (NOT input.set_vote_rate OR NULLIF(source.source_payload->>'voteRate', '')::NUMERIC IS NOT DISTINCT FROM input.vote_rate)
              AND (NOT (input.set_is_elected OR input.set_candidacy_status OR input.set_election_result OR input.set_registration_status)
                   OR (source.source_payload->>'elected')::BOOLEAN IS NOT DISTINCT FROM input.is_elected)
              AND source.election_year = input.election_year
        )
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate source snapshot mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM ${tempTable} input
        WHERE NOT EXISTS (SELECT 1 FROM people person WHERE person.id = input.person_id)
           OR NOT EXISTS (SELECT 1 FROM races race WHERE race.id = input.race_id)
           OR (
                input.operation = 'create'
                AND NOT EXISTS (
                    SELECT 1 FROM person_identity_matches match
                    WHERE match.source_person_id = input.source_person_id
                      AND match.person_id = input.person_id
                      AND match.match_status = 'auto_matched'
                )
           )
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate identity or race mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM ${tempTable} input
        JOIN candidates candidate ON candidate.external_id = input.candidate_external_id
        WHERE input.operation = 'create'
          AND (candidate.person_id IS DISTINCT FROM input.person_id OR candidate.race_id IS DISTINCT FROM input.race_id)
    ) OR EXISTS (
        SELECT 1 FROM ${tempTable} input
        JOIN candidates candidate ON candidate.person_id = input.person_id AND candidate.race_id = input.race_id
        WHERE input.operation = 'create'
          AND candidate.external_id IS DISTINCT FROM input.candidate_external_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} create candidate conflict';
    END IF;
    IF EXISTS (
        SELECT 1 FROM ${tempTable} input
        WHERE input.operation = 'update'
          AND NOT EXISTS (
              SELECT 1 FROM candidates candidate
              JOIN person_canonical_map person_map ON person_map.person_id = candidate.person_id
              JOIN race_canonical_map race_map ON race_map.race_id = candidate.race_id
              WHERE candidate.id = input.candidate_id
                AND person_map.canonical_person_id = input.person_id
                AND race_map.canonical_race_id = input.race_id
                AND candidate.external_id IS NOT DISTINCT FROM input.candidate_external_id
                AND candidate.is_public = input.original_is_public
          )
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} update candidate target changed';
    END IF;
END
\$verify\$;`;
}

function resultBlock(plan, label) {
  const summary = plan.summary;
  return `DO \$verify\$
BEGIN
    IF (
        SELECT COUNT(*) FROM ${tempTable} input
        JOIN candidates candidate
          ON input.operation = 'create'
         AND candidate.external_id = input.candidate_external_id
         AND candidate.person_id = input.person_id
         AND candidate.race_id = input.race_id
         AND candidate.party IS NOT DISTINCT FROM input.party
         AND candidate.candidate_no IS NOT DISTINCT FROM input.candidate_no
         AND candidate.vote_count IS NOT DISTINCT FROM input.vote_count
         AND candidate.vote_rate IS NOT DISTINCT FROM input.vote_rate
         AND candidate.is_elected = input.is_elected
         AND candidate.candidacy_status = input.candidacy_status
         AND candidate.election_result = input.election_result
         AND candidate.registration_status = input.registration_status
         AND candidate.is_public = FALSE
    ) <> ${summary.createCandidates} THEN
        RAISE EXCEPTION 'Historical CEC ${label} created candidate result mismatch';
    END IF;
    IF (
        SELECT COUNT(*) FROM ${tempTable} input
        JOIN candidates candidate
          ON input.operation = 'update'
         AND candidate.id = input.candidate_id
         AND (NOT input.set_party OR candidate.party IS NOT DISTINCT FROM input.party)
         AND (NOT input.set_candidate_no OR candidate.candidate_no IS NOT DISTINCT FROM input.candidate_no)
         AND (NOT input.set_vote_count OR candidate.vote_count IS NOT DISTINCT FROM input.vote_count)
         AND (NOT input.set_vote_rate OR candidate.vote_rate IS NOT DISTINCT FROM input.vote_rate)
         AND (NOT input.set_is_elected OR candidate.is_elected IS NOT DISTINCT FROM input.is_elected)
         AND (NOT input.set_candidacy_status OR candidate.candidacy_status IS NOT DISTINCT FROM input.candidacy_status)
         AND (NOT input.set_election_result OR candidate.election_result IS NOT DISTINCT FROM input.election_result)
         AND (NOT input.set_registration_status OR candidate.registration_status IS NOT DISTINCT FROM input.registration_status)
         AND candidate.is_public = input.original_is_public
    ) <> ${summary.updateCandidates} THEN
        RAISE EXCEPTION 'Historical CEC ${label} updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM ${tempTable} WHERE vote_count IS NOT NULL) <> ${summary.withVoteCount}
       OR (SELECT COUNT(*) FROM ${tempTable} WHERE vote_rate IS NOT NULL) <> ${summary.withVoteRate}
       OR (SELECT COUNT(*) FROM ${tempTable} WHERE is_elected) <> ${summary.elected}
       OR (SELECT COUNT(*) FROM ${tempTable} WHERE operation = 'update' AND original_is_public) <> ${summary.publicUpdates} THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate summary mismatch';
    END IF;
END
\$verify\$;`;
}

export function renderHistoricalCecExistingCandidateSql(plan, { rollback = true } = {}) {
  const columns = [
    'operation', 'sourcePersonId', 'sourcePersonKey', 'personId', 'raceId',
    'candidateId', 'candidateExternalId', 'originalIsPublic', 'party', 'candidateNo',
    'voteCount', 'voteRate', 'elected', 'candidacyStatus', 'electionResult',
    'registrationStatus', 'electionYear', 'raceContextKey',
    'setParty', 'setCandidateNo', 'setVoteCount', 'setVoteRate',
    'setIsElected', 'setCandidacyStatus', 'setElectionResult', 'setRegistrationStatus',
  ];
  const sections = [rollback
    ? '-- Generated existing-person historical CEC candidate dry-run. This file always rolls back.'
    : '-- Generated existing-person historical CEC candidate migration.'];
  if (rollback) sections.push('BEGIN;');
  sections.push(`CREATE TEMP TABLE ${tempTable} (
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update')),
    source_person_id UUID PRIMARY KEY,
    source_person_key TEXT NOT NULL UNIQUE,
    person_id UUID NOT NULL,
    race_id UUID NOT NULL,
    candidate_id UUID,
    candidate_external_id TEXT,
    original_is_public BOOLEAN,
    party TEXT,
    candidate_no TEXT,
    vote_count INT,
    vote_rate NUMERIC,
    is_elected BOOLEAN,
    candidacy_status TEXT,
    election_result TEXT,
    registration_status TEXT,
    election_year INT NOT NULL,
    race_context_key TEXT NOT NULL,
    set_party BOOLEAN NOT NULL,
    set_candidate_no BOOLEAN NOT NULL,
    set_vote_count BOOLEAN NOT NULL,
    set_vote_rate BOOLEAN NOT NULL,
    set_is_elected BOOLEAN NOT NULL,
    set_candidacy_status BOOLEAN NOT NULL,
    set_election_result BOOLEAN NOT NULL,
    set_registration_status BOOLEAN NOT NULL,
    CHECK (
      (operation = 'create' AND candidate_id IS NULL AND candidate_external_id IS NOT NULL
       AND original_is_public IS NULL AND is_elected IS NOT NULL
       AND candidacy_status IS NOT NULL AND election_result IS NOT NULL AND registration_status IS NOT NULL)
      OR
      (operation = 'update' AND candidate_id IS NOT NULL AND original_is_public IS NOT NULL)
    )
);`);
  sections.push(`INSERT INTO ${tempTable} (
    operation, source_person_id, source_person_key, person_id, race_id,
    candidate_id, candidate_external_id, original_is_public, party, candidate_no,
    vote_count, vote_rate, is_elected, candidacy_status, election_result,
    registration_status, election_year, race_context_key,
    set_party, set_candidate_no, set_vote_count, set_vote_rate,
    set_is_elected, set_candidacy_status, set_election_result, set_registration_status
) VALUES
${valuesSql(plan.rows, columns)};`);
  sections.push(`UPDATE source_people source
SET source_payload = source.source_payload
        || CASE WHEN input.set_candidate_no THEN jsonb_build_object('candidateNo', input.candidate_no) ELSE '{}'::JSONB END
        || CASE WHEN input.set_vote_count THEN jsonb_build_object('voteCount', input.vote_count) ELSE '{}'::JSONB END
        || CASE WHEN input.set_vote_rate THEN jsonb_build_object('voteRate', input.vote_rate) ELSE '{}'::JSONB END
        || CASE WHEN input.set_is_elected THEN jsonb_build_object('elected', input.is_elected) ELSE '{}'::JSONB END,
    updated_at = NOW()
FROM ${tempTable} input
WHERE source.id = input.source_person_id
  AND source.source_person_key = input.source_person_key
  AND source.source_type = '${sourceType}'
  AND source.source_id = '${sourceId}'
  AND source.election_year = input.election_year
  AND (input.set_candidate_no OR input.set_vote_count OR input.set_vote_rate OR input.set_is_elected);`);
  sections.push(preflightBlock(plan, rollback ? 'dry-run' : 'migration'));
  sections.push(`INSERT INTO candidates (
    person_id, race_id, party, candidate_no, registration_status,
    source_name, source_url, is_public, external_id, vote_count, vote_rate,
    is_elected, candidacy_status, election_result, status_updated_at, updated_at
)
SELECT
    input.person_id, input.race_id, input.party, input.candidate_no, input.registration_status,
    '${sourceName}', source.source_url, FALSE, input.candidate_external_id,
    input.vote_count, input.vote_rate, input.is_elected, input.candidacy_status,
    input.election_result, NOW(), NOW()
FROM ${tempTable} input
JOIN source_people source ON source.id = input.source_person_id
WHERE input.operation = 'create'
ON CONFLICT (external_id) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    race_id = EXCLUDED.race_id,
    party = EXCLUDED.party,
    candidate_no = EXCLUDED.candidate_no,
    registration_status = EXCLUDED.registration_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    vote_count = EXCLUDED.vote_count,
    vote_rate = EXCLUDED.vote_rate,
    is_elected = EXCLUDED.is_elected,
    candidacy_status = EXCLUDED.candidacy_status,
    election_result = EXCLUDED.election_result,
    status_updated_at = NOW(),
    updated_at = NOW();`);
  sections.push(`UPDATE candidates candidate
SET party = CASE WHEN input.set_party THEN input.party ELSE candidate.party END,
    candidate_no = CASE WHEN input.set_candidate_no THEN input.candidate_no ELSE candidate.candidate_no END,
    registration_status = CASE WHEN input.set_registration_status THEN input.registration_status ELSE candidate.registration_status END,
    vote_count = CASE WHEN input.set_vote_count THEN input.vote_count ELSE candidate.vote_count END,
    vote_rate = CASE WHEN input.set_vote_rate THEN input.vote_rate ELSE candidate.vote_rate END,
    is_elected = CASE WHEN input.set_is_elected THEN input.is_elected ELSE candidate.is_elected END,
    candidacy_status = CASE WHEN input.set_candidacy_status THEN input.candidacy_status ELSE candidate.candidacy_status END,
    election_result = CASE WHEN input.set_election_result THEN input.election_result ELSE candidate.election_result END,
    status_updated_at = NOW(),
    updated_at = NOW()
FROM ${tempTable} input
WHERE input.operation = 'update'
  AND candidate.id = input.candidate_id;`);
  sections.push(resultBlock(plan, rollback ? 'dry-run' : 'migration'));
  sections.push(`SELECT
    ${plan.summary.createCandidates} AS planned_creates,
    ${plan.summary.updateCandidates} AS planned_updates,
    ${plan.summary.totalCandidates} AS planned_total,
    ${plan.summary.publicUpdates} AS publication_states_preserved;`);
  if (rollback) {
    sections.push('ROLLBACK;');
  } else {
    sections.push('SELECT published.promote(NULL);');
    sections.push(`DO \$verify\$
BEGIN
    IF EXISTS (
        SELECT 1 FROM ${tempTable} input
        JOIN candidates core ON input.operation = 'create' AND core.external_id = input.candidate_external_id
        JOIN published.candidates public_candidate ON public_candidate.candidate_id = core.id
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration unexpectedly published a newly created private candidate';
    END IF;
END
\$verify\$;`);
    sections.push(`DROP TABLE ${tempTable};`);
  }
  return `${sections.join('\n\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.reportPath)) {
    throw new Error('Run report:historical-cec-candidate-coverage -- --write first.');
  }
  const report = JSON.parse(fs.readFileSync(options.reportPath, 'utf8'));
  const plan = buildHistoricalCecExistingCandidatePlan(report, { electionYear: options.electionYear });
  if (options.write) {
    fs.mkdirSync(path.dirname(options.planPath), { recursive: true });
    fs.mkdirSync(path.dirname(options.sqlPath), { recursive: true });
    fs.writeFileSync(options.planPath, `${JSON.stringify(plan, null, 2)}\n`);
    fs.writeFileSync(options.sqlPath, renderHistoricalCecExistingCandidateSql(plan));
  }
  if (options.migrationPath) {
    fs.mkdirSync(path.dirname(options.migrationPath), { recursive: true });
    fs.writeFileSync(options.migrationPath, renderHistoricalCecExistingCandidateSql(plan, { rollback: false }));
  }
  console.log(JSON.stringify({
    outputPlan: options.write ? path.relative(repoRoot, options.planPath) : null,
    outputSql: options.write ? path.relative(repoRoot, options.sqlPath) : null,
    outputMigration: options.migrationPath ? path.relative(repoRoot, options.migrationPath) : null,
    ...plan.summary,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`historical CEC existing candidate migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
