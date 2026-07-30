import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPreviewPath = path.join(repoRoot, 'local-data', 'historical-cec-core-preview.json');
const defaultPlanPath = path.join(repoRoot, 'local-data', 'historical-cec-candidate-plan.json');
const defaultSqlPath = path.join(repoRoot, 'local-data', 'historical-cec-candidate-dry-run.sql');
const tempTable = '_historical_cec_candidate_input_20260730';
const sourceType = 'official_election';
const sourceId = 'cec-2024-votedata';
const sourceName = '中央選舉委員會開放資料';

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

function hashId(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function normalizeParty(value) {
  if (value === '無') return '無黨籍';
  return value || null;
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

function assertUnique(rows, key, label) {
  if (new Set(rows.map((row) => row[key])).size !== rows.length) throw new Error(`Duplicate ${label}`);
}

function raceExternalId(plan) {
  if (plan.action === 'create_new') return `cec-historical-race-${hashId(plan.key)}`;
  if (plan.action === 'reuse_existing') {
    const externalId = plan.existingCandidates?.[0]?.externalId;
    if (!externalId) throw new Error(`Reusable race lacks external_id: ${plan.key}`);
    return externalId;
  }
  throw new Error(`Unsafe race action for candidate: ${plan.key}`);
}

export function buildHistoricalCecCandidatePlan(preview) {
  const racePlans = new Map((preview.comparisonPlan?.racePlans ?? []).map((plan) => [plan.key, plan]));
  const candidates = (preview.safeNewPeople ?? []).map((entry) => {
    const source = entry.source;
    const racePlan = racePlans.get(source.raceContextKey);
    if (!racePlan) throw new Error(`Missing reviewed race plan: ${source.raceContextKey}`);
    const candidateNo = source.candidateNo == null ? null : String(source.candidateNo).trim();
    if (!candidateNo) throw new Error(`Missing candidate number: ${source.sourcePersonKey}`);
    const voteCount = source.voteCount == null || source.voteCount === '' ? null : Number(source.voteCount);
    const voteRate = source.voteRate == null || source.voteRate === '' ? null : Number(source.voteRate);
    if (voteCount != null && (!Number.isInteger(voteCount) || voteCount < 0)) throw new Error(`Invalid vote count: ${source.sourcePersonKey}`);
    if (voteRate != null && (!Number.isFinite(voteRate) || voteRate < 0 || voteRate > 100)) throw new Error(`Invalid vote rate: ${source.sourcePersonKey}`);
    return {
      sourcePersonId: source.sourcePersonId,
      sourcePersonKey: source.sourcePersonKey,
      personExternalId: entry.proposedPerson.externalId,
      raceExternalId: raceExternalId(racePlan),
      candidateExternalId: `cec-historical-candidate-${hashId(source.sourcePersonKey)}`,
      party: normalizeParty(source.party),
      candidateNo,
      voteCount,
      voteRate,
      elected: source.elected === true,
      electionYear: source.electionYear,
      raceContextKey: source.raceContextKey,
    };
  });
  if (candidates.length !== preview.summary?.safeNewPersonCount) {
    throw new Error(`Candidate count mismatch: expected ${preview.summary?.safeNewPersonCount}, got ${candidates.length}`);
  }
  assertUnique(candidates, 'sourcePersonId', 'candidate source id');
  assertUnique(candidates, 'sourcePersonKey', 'candidate source key');
  assertUnique(candidates, 'candidateExternalId', 'candidate external id');
  assertUnique(candidates, 'personExternalId', 'candidate person external id');
  return {
    source: { sourceType, sourceId, sourceName },
    policy: {
      newCandidatesPublic: false,
      candidacyStatus: 'qualified',
      missingVoteValues: null,
      heldSourceRows: preview.summary?.heldNewPersonSourceRows ?? null,
    },
    summary: {
      createCandidates: candidates.length,
      withVoteCount: candidates.filter((row) => row.voteCount != null).length,
      withVoteRate: candidates.filter((row) => row.voteRate != null).length,
      elected: candidates.filter((row) => row.elected).length,
      notElected: candidates.filter((row) => !row.elected).length,
    },
    candidates,
  };
}

function preflightBlock(plan, label) {
  const expected = plan.candidates.length;
  return `DO \$verify\$
BEGIN
    IF (SELECT COUNT(*) FROM ${tempTable}) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate input count mismatch';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM ${tempTable} input
        JOIN source_people source
          ON source.id = input.source_person_id
         AND source.source_person_key = input.source_person_key
         AND source.source_type = '${sourceType}'
         AND source.source_id = '${sourceId}'
         AND (CASE WHEN source.party = '無' THEN '無黨籍' ELSE source.party END) IS NOT DISTINCT FROM input.party
         AND NULLIF(source.source_payload->>'candidateNo', '') = input.candidate_no
         AND NULLIF(source.source_payload->>'voteCount', '')::INT IS NOT DISTINCT FROM input.vote_count
         AND NULLIF(source.source_payload->>'voteRate', '')::NUMERIC IS NOT DISTINCT FROM input.vote_rate
         AND (source.source_payload->>'elected')::BOOLEAN = input.is_elected
         AND source.election_year = input.election_year
    ) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate source snapshot mismatch';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM ${tempTable} input
        JOIN people person ON person.external_id = input.person_external_id
        JOIN person_identity_matches match
          ON match.source_person_id = input.source_person_id
         AND match.person_id = person.id
         AND match.match_status = 'auto_matched'
        JOIN races race ON race.external_id = input.race_external_id
    ) <> ${expected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate identity or race mismatch';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM ${tempTable} input
        JOIN candidates candidate ON candidate.external_id = input.candidate_external_id
        JOIN people person ON person.id = candidate.person_id
        JOIN races race ON race.id = candidate.race_id
        WHERE person.external_id IS DISTINCT FROM input.person_external_id
           OR race.external_id IS DISTINCT FROM input.race_external_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate external id conflict';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM ${tempTable} input
        JOIN people person ON person.external_id = input.person_external_id
        JOIN races race ON race.external_id = input.race_external_id
        JOIN candidates candidate ON candidate.person_id = person.id AND candidate.race_id = race.id
        WHERE candidate.external_id IS DISTINCT FROM input.candidate_external_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC ${label} person and race already use another candidate';
    END IF;
END
\$verify\$;`;
}

function resultBlock(plan, label) {
  const summary = plan.summary;
  return `DO \$verify\$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM ${tempTable} input
        JOIN candidates candidate
          ON candidate.external_id = input.candidate_external_id
         AND candidate.candidate_no = input.candidate_no
         AND candidate.vote_count IS NOT DISTINCT FROM input.vote_count
         AND candidate.vote_rate IS NOT DISTINCT FROM input.vote_rate
         AND candidate.is_elected = input.is_elected
         AND candidate.candidacy_status = 'qualified'
         AND candidate.election_result = CASE WHEN input.is_elected THEN 'elected' ELSE 'not_elected' END
         AND candidate.is_public = FALSE
    ) <> ${summary.createCandidates} THEN
        RAISE EXCEPTION 'Historical CEC ${label} candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM ${tempTable} WHERE vote_count IS NOT NULL) <> ${summary.withVoteCount} THEN
        RAISE EXCEPTION 'Historical CEC ${label} vote count coverage mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM ${tempTable} WHERE vote_rate IS NOT NULL) <> ${summary.withVoteRate} THEN
        RAISE EXCEPTION 'Historical CEC ${label} vote rate coverage mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM ${tempTable} WHERE is_elected) <> ${summary.elected} THEN
        RAISE EXCEPTION 'Historical CEC ${label} elected count mismatch';
    END IF;
END
\$verify\$;`;
}

export function renderHistoricalCecCandidateSql(plan, { rollback = true } = {}) {
  const columns = [
    'sourcePersonId', 'sourcePersonKey', 'personExternalId', 'raceExternalId',
    'candidateExternalId', 'party', 'candidateNo', 'voteCount', 'voteRate',
    'elected', 'electionYear', 'raceContextKey',
  ];
  const sections = [rollback
    ? '-- Generated historical CEC candidate dry-run. This file always rolls back.'
    : '-- Generated historical CEC private candidate migration.'];
  if (rollback) sections.push('BEGIN;');
  sections.push(`CREATE TEMP TABLE ${tempTable} (
    source_person_id UUID PRIMARY KEY,
    source_person_key TEXT NOT NULL UNIQUE,
    person_external_id TEXT NOT NULL UNIQUE,
    race_external_id TEXT NOT NULL,
    candidate_external_id TEXT NOT NULL UNIQUE,
    party TEXT,
    candidate_no TEXT NOT NULL,
    vote_count INT,
    vote_rate NUMERIC,
    is_elected BOOLEAN NOT NULL,
    election_year INT NOT NULL,
    race_context_key TEXT NOT NULL
);`);
  sections.push(`INSERT INTO ${tempTable} (
    source_person_id, source_person_key, person_external_id, race_external_id,
    candidate_external_id, party, candidate_no, vote_count, vote_rate,
    is_elected, election_year, race_context_key
) VALUES
${valuesSql(plan.candidates, columns)};`);
  sections.push(preflightBlock(plan, rollback ? 'dry-run' : 'migration'));
  sections.push(`INSERT INTO candidates (
    person_id, race_id, party, candidate_no, registration_status,
    source_name, source_url, is_public, external_id, vote_count, vote_rate,
    is_elected, candidacy_status, election_result, status_updated_at, updated_at
)
SELECT
    person.id,
    race.id,
    input.party,
    input.candidate_no,
    CASE WHEN input.is_elected THEN 'elected' ELSE 'not_elected' END,
    '${sourceName}',
    source.source_url,
    FALSE,
    input.candidate_external_id,
    input.vote_count,
    input.vote_rate,
    input.is_elected,
    'qualified',
    CASE WHEN input.is_elected THEN 'elected' ELSE 'not_elected' END,
    NOW(),
    NOW()
FROM ${tempTable} input
JOIN source_people source ON source.id = input.source_person_id
JOIN people person ON person.external_id = input.person_external_id
JOIN races race ON race.external_id = input.race_external_id
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
  sections.push(resultBlock(plan, rollback ? 'dry-run' : 'migration'));
  sections.push(`SELECT
    ${plan.summary.createCandidates} AS planned_candidates,
    ${plan.summary.withVoteCount} AS candidates_with_vote_count,
    ${plan.summary.withVoteRate} AS candidates_with_vote_rate,
    ${plan.summary.elected} AS elected_candidates;`);
  if (rollback) sections.push('ROLLBACK;');
  else {
    sections.push('SELECT published.promote(NULL);');
    sections.push(`DO \$verify\$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ${tempTable} input
        JOIN candidates core ON core.external_id = input.candidate_external_id
        JOIN published.candidates public_candidate ON public_candidate.candidate_id = core.id
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration unexpectedly published a private candidate';
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
  const plan = buildHistoricalCecCandidatePlan(preview);
  if (options.write) {
    fs.mkdirSync(path.dirname(options.planPath), { recursive: true });
    fs.mkdirSync(path.dirname(options.sqlPath), { recursive: true });
    fs.writeFileSync(options.planPath, `${JSON.stringify(plan, null, 2)}\n`);
    fs.writeFileSync(options.sqlPath, renderHistoricalCecCandidateSql(plan));
  }
  if (options.migrationPath) {
    fs.mkdirSync(path.dirname(options.migrationPath), { recursive: true });
    fs.writeFileSync(options.migrationPath, renderHistoricalCecCandidateSql(plan, { rollback: false }));
  }
  console.log(JSON.stringify({
    outputPlan: options.write ? path.relative(repoRoot, options.planPath) : null,
    outputSql: options.write ? path.relative(repoRoot, options.sqlPath) : null,
    outputMigration: options.migrationPath ? path.relative(repoRoot, options.migrationPath) : null,
    ...plan.summary,
    heldSourceRows: plan.policy.heldSourceRows,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`historical CEC candidate migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
