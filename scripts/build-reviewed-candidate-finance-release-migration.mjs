import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(
  repoRoot,
  'data-sources',
  'cy',
  '2022-election',
  'reviewed-mayor-finance-summaries-2026-08-24.json',
);
const expectedMatchedCount = 71;

const releaseColumns = [
  ['claim_key', 'text'],
  ['person_id', 'uuid'],
  ['candidate_id', 'uuid'],
  ['claim_type', 'text'],
  ['claim_value', 'text'],
  ['claim_json', 'jsonb'],
  ['confidence_level', 'text'],
  ['review_status', 'text'],
  ['visibility', 'text'],
  ['source_name', 'text'],
  ['source_url', 'text'],
  ['observed_at', 'timestamptz'],
  ['is_public', 'boolean'],
  ['review_score', 'numeric'],
  ['scoring_version', 'text'],
  ['scoring_reasons', 'jsonb'],
  ['auto_reviewed_at', 'timestamptz'],
];

function parseArgs(argv) {
  let inputPath = defaultInputPath;
  let outputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error('Unsupported argument: ' + arg);
  }
  if (!outputPath) {
    throw new Error('Usage: node scripts/build-reviewed-candidate-finance-release-migration.mjs --output <migration.sql>');
  }
  if (!fs.existsSync(inputPath)) throw new Error('Reviewed candidate finance snapshot not found: ' + inputPath);
  return { inputPath, outputPath };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value ?? ''));
}

function validateReviewedSnapshot(snapshot, expectedCount = expectedMatchedCount) {
  if (snapshot?.schemaVersion !== 1 || !Array.isArray(snapshot?.rows)) {
    throw new Error('Expected a schema version 1 reviewed candidate finance snapshot');
  }
  if (
    snapshot.matchedCount !== expectedCount
    || snapshot.rows.length !== expectedCount
    || snapshot.ambiguousCount !== 0
    || snapshot.ambiguous?.length !== 0
  ) {
    throw new Error('Reviewed candidate finance snapshot count or ambiguity drift');
  }

  const claimKeys = new Set();
  for (const row of snapshot.rows) {
    if (
      !row.claim_key?.startsWith('cy-candidate-finance:2022:')
      || claimKeys.has(row.claim_key)
      || !isUuid(row.person_id)
      || !isUuid(row.candidate_id)
    ) {
      throw new Error('Invalid or duplicate reviewed candidate finance identity');
    }
    claimKeys.add(row.claim_key);
    if (
      row.claim_type !== 'finance_summary'
      || row.confidence_level !== 'A'
      || row.review_status !== 'verified'
      || row.visibility !== 'public'
      || row.is_public !== true
      || row.review_score !== 100
    ) {
      throw new Error('Reviewed candidate finance row is not public-ready: ' + row.claim_key);
    }
    const sourceUrl = new URL(row.source_url);
    if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'ardata.cy.gov.tw') {
      throw new Error('Reviewed candidate finance row has a non-official source URL');
    }
    if (
      row.claim_json?.privacyBoundary !== 'candidate_aggregate_only_no_donor_payee_or_transaction_details'
      || row.claim_json?.identityEvidence?.candidateId !== row.candidate_id
      || row.claim_json?.identityEvidence?.personId !== row.person_id
      || !/^[a-f0-9]{64}$/u.test(row.claim_json?.sourceArchiveSha256 ?? '')
      || !/^[a-f0-9]{64}$/u.test(row.claim_json?.sourceSummarySha256 ?? '')
    ) {
      throw new Error('Reviewed candidate finance evidence is incomplete: ' + row.claim_key);
    }
  }
  return snapshot;
}

function releaseRows(snapshot) {
  return snapshot.rows.map((row) => Object.fromEntries(
    releaseColumns.map(([column]) => [column, row[column]]),
  ));
}

function buildMigration(snapshot, expectedCount = expectedMatchedCount) {
  validateReviewedSnapshot(snapshot, expectedCount);
  const rowsJson = JSON.stringify(releaseRows(snapshot));
  if (rowsJson.includes('$candidate_finance$')) throw new Error('Candidate finance payload conflicts with SQL dollar tag');
  const recordColumns = releaseColumns.map(([name, type]) => '    ' + name + ' ' + type).join(',\n');
  const insertColumns = releaseColumns.map(([name]) => name).join(', ');
  const updateColumns = releaseColumns
    .filter(([name]) => name !== 'claim_key')
    .map(([name]) => '    ' + name + ' = EXCLUDED.' + name)
    .join(',\n');

  return [
    'BEGIN;',
    '',
    '-- Generated from the reviewed Control Yuan candidate-level aggregate snapshot.',
    '-- Transaction detail files and donor/payee personal data are intentionally excluded.',
    'CREATE TEMP TABLE _candidate_finance_release ON COMMIT DROP AS',
    'SELECT *',
    'FROM jsonb_to_recordset($candidate_finance$' + rowsJson + '$candidate_finance$::jsonb) AS release(',
    recordColumns,
    ');',
    '',
    'DO $checks$',
    'BEGIN',
    '    IF (SELECT COUNT(*) FROM _candidate_finance_release) <> ' + expectedCount + ' THEN',
    "        RAISE EXCEPTION 'Candidate finance release count drift';",
    '    END IF;',
    '',
    '    IF EXISTS (',
    '        SELECT 1',
    '        FROM _candidate_finance_release release',
    '        LEFT JOIN public.candidates candidate ON candidate.id = release.candidate_id',
    '        WHERE candidate.id IS NULL',
    '           OR candidate.person_id <> release.person_id',
    "           OR release.claim_type <> 'finance_summary'",
    "           OR release.review_status <> 'verified'",
    "           OR release.visibility <> 'public'",
    '           OR release.is_public IS DISTINCT FROM TRUE',
    "           OR release.claim_json ->> 'privacyBoundary' <> 'candidate_aggregate_only_no_donor_payee_or_transaction_details'",
    '    ) THEN',
    "        RAISE EXCEPTION 'Candidate finance release identity or publication boundary is invalid';",
    '    END IF;',
    'END',
    '$checks$;',
    '',
    'INSERT INTO public.person_claims (' + insertColumns + ')',
    'SELECT ' + insertColumns,
    'FROM _candidate_finance_release',
    'ON CONFLICT (claim_key) DO UPDATE SET',
    updateColumns + ',',
    '    updated_at = NOW();',
    '',
    'DO $verify$',
    'BEGIN',
    '    IF (',
    '        SELECT COUNT(*)',
    '        FROM public.person_claims claim',
    '        JOIN _candidate_finance_release release USING (claim_key)',
    '        WHERE claim.review_status = ' + "'verified'",
    '          AND claim.visibility = ' + "'public'",
    '          AND claim.is_public = TRUE',
    '    ) <> ' + expectedCount + ' THEN',
    "        RAISE EXCEPTION 'Candidate finance claims were not fully published';",
    '    END IF;',
    '',
    '    IF (',
    '        SELECT COUNT(*)',
    '        FROM published.person_claims claim',
    '        JOIN public.person_claims stored ON stored.id = claim.claim_id',
    '        JOIN _candidate_finance_release release ON release.claim_key = stored.claim_key',
    '        WHERE claim.claim_type = ' + "'finance_summary'",
    '    ) <> ' + expectedCount + ' THEN',
    "        RAISE EXCEPTION 'Candidate finance claims are missing from the published read layer';",
    '    END IF;',
    'END',
    '$verify$;',
    '',
    "NOTIFY pgrst, 'reload schema';",
    '',
    'COMMIT;',
    '',
  ].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = validateReviewedSnapshot(JSON.parse(fs.readFileSync(options.inputPath, 'utf8')));
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, buildMigration(snapshot));
  console.log(JSON.stringify({
    inputPath: options.inputPath,
    outputPath: options.outputPath,
    claimCount: snapshot.rows.length,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export {
  buildMigration,
  parseArgs,
  releaseRows,
  validateReviewedSnapshot,
};
