import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--apply-local'), 'Usage: node scripts/resolve-cec-ni-jinwen-duplicate-local.mjs [--apply-local]');
const apply = args.includes('--apply-local');
assert(fs.readFileSync('supabase/config.toml', 'utf8').includes('project_id = "public-office-watch"'));

const duplicateClaimId = '436fd0c7-6b71-4194-828a-c5288b3ccb09';
const duplicateSourcePersonId = 'bc9d064d-4bf8-4215-bda5-a2ff706cfa12';
const canonicalClaimId = '1a925474-ff0a-48f6-98b9-7e42e04211d9';
const canonicalSourcePersonId = 'be0fbb02-5d40-4ac5-8f58-2e3413e44bb9';
const canonicalCandidateExternalId = 'pow-cec-registration-2026-a8c90ccdcbffa54ef35ec6e9c73f3064';
const raceId = 'e76bc705-bca4-4c12-961e-4dc9a63802e4';
const raceTitle = '屏東縣屏東市第1選舉區市民代表選舉';
const sourceUrl = 'https://web.cec.gov.tw/api/file/c6988c7b-6593-43e1-a986-d1e995a39666.xlsx';
const sourceHash = 'ede9d13c65ddb86e1d9e90f59af857f18f4dd4c382d985af3761a738191afd87';
const sourceFile = 'tmp/cec-registration-final/ptec-64654-01.xlsx';
const q = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const runSql = (sql) => execFileSync(
  'docker',
  ['exec', '-i', 'supabase_db_public-office-watch', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  { input: sql, encoding: 'utf8', maxBuffer: 20e6 },
).trim();

assert.equal(createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'), sourceHash);
const before = JSON.parse(runSql(`
SELECT json_build_object(
  'duplicateClaim', to_jsonb(duplicate_claim),
  'duplicateSource', to_jsonb(duplicate_source),
  'canonicalClaim', to_jsonb(canonical_claim),
  'canonicalSource', to_jsonb(canonical_source),
  'canonicalRoster', to_jsonb(roster),
  'rosterCount', (SELECT count(*) FROM public.registration_name_roster),
  'globalPendingCount', (SELECT count(*) FROM public.person_claims WHERE review_status = 'pending')
)
FROM public.person_claims duplicate_claim
JOIN public.source_people duplicate_source ON duplicate_source.id = duplicate_claim.source_person_id
CROSS JOIN public.person_claims canonical_claim
JOIN public.source_people canonical_source ON canonical_source.id = canonical_claim.source_person_id
JOIN public.registration_name_roster roster ON roster.source_claim_id = canonical_claim.id
WHERE duplicate_claim.id = '${duplicateClaimId}'::uuid
  AND canonical_claim.id = '${canonicalClaimId}'::uuid;
`));
const duplicateClaim = before.duplicateClaim;
const duplicateSource = before.duplicateSource;
const canonicalClaim = before.canonicalClaim;
const canonicalSource = before.canonicalSource;
const canonicalRoster = before.canonicalRoster;
assert.equal(before.rosterCount, 913);
assert.equal(duplicateClaim.source_person_id, duplicateSourcePersonId);
assert.equal(duplicateClaim.review_status, 'pending');
assert.equal(duplicateClaim.visibility, 'review_only');
assert.equal(duplicateClaim.is_public, false);
assert.equal(duplicateClaim.person_id, null);
assert.equal(duplicateClaim.candidate_id, null);
assert.equal(duplicateClaim.claim_json.registrationEvidence.office, 'township_mayor');
assert.equal(duplicateClaim.claim_json.registrationEvidence.source.row, 104);
assert.equal(duplicateClaim.claim_json.registrationEvidence.source.sha256, sourceHash);
assert.equal(canonicalClaim.source_person_id, canonicalSourcePersonId);
assert.equal(canonicalClaim.review_status, 'pending');
assert.equal(canonicalClaim.visibility, 'review_only');
assert.equal(canonicalClaim.is_public, false);
assert.equal(canonicalClaim.claim_json.registrationEvidence.office, 'township_representative');
assert.equal(canonicalClaim.claim_json.registrationEvidence.source.row, 190);
assert.equal(canonicalClaim.claim_json.targetRace.id, raceId);
assert.equal(canonicalClaim.claim_json.targetRace.title, raceTitle);
assert.deepEqual(duplicateClaim.claim_json.registrationEvidence.raw, canonicalClaim.claim_json.registrationEvidence.raw);
assert.equal(canonicalRoster.source_claim_id, canonicalClaimId);
assert.equal(canonicalRoster.candidate_external_id, canonicalCandidateExternalId);
assert.equal(canonicalRoster.race_id, raceId);
assert.equal(canonicalRoster.display_name, '倪進文');
assert.equal(canonicalRoster.is_public, true);

const reviewedAt = new Date().toISOString();
const review = {
  name: '倪進文',
  decision: 'reject_duplicate_source_row',
  reasonCode: 'duplicate_official_source_row_wrong_office',
  reason: '官方 Excel 第104列誤放在鄉鎮市長區段；同檔第190列已在代表區段提供完全相同的登記資料，且使用者提供的候選人 Facebook 標示為屏東市中區市民代表候選人。',
  reviewedAt,
  reviewedBy: 'Codex user-confirmed source deduplication review',
  officialEvidence: {
    url: sourceUrl,
    file: 'ptec-64654-01.xlsx',
    sha256: sourceHash,
    duplicateRow: 104,
    canonicalRow: 190,
  },
  userEvidence: {
    providedBy: 'user',
    observedAt: reviewedAt,
    statement: '倪進文的 Facebook 標示為屏東市中區市民代表候選人。',
  },
  duplicateOf: {
    claimId: canonicalClaimId,
    sourcePersonId: canonicalSourcePersonId,
    candidateExternalId: canonicalCandidateExternalId,
    raceId,
    raceTitle,
  },
};
fs.mkdirSync('tmp/cec-registration-names', { recursive: true });
fs.writeFileSync(
  'tmp/cec-registration-names/ni-jinwen-duplicate-review.json',
  JSON.stringify({ environment: 'full-local', review }, null, 2),
);

const sql = `
BEGIN;
SET LOCAL application_name = 'cec-ni-jinwen-source-dedup-20260905';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:cec-registration-publication', 0));
CREATE TEMP TABLE expected_duplicate_claim AS
  SELECT * FROM jsonb_populate_record(NULL::public.person_claims, ${q(duplicateClaim)});
CREATE TEMP TABLE expected_duplicate_source AS
  SELECT * FROM jsonb_populate_record(NULL::public.source_people, ${q(duplicateSource)});
CREATE TEMP TABLE expected_canonical_claim AS
  SELECT * FROM jsonb_populate_record(NULL::public.person_claims, ${q(canonicalClaim)});
CREATE TEMP TABLE expected_canonical_source AS
  SELECT * FROM jsonb_populate_record(NULL::public.source_people, ${q(canonicalSource)});
CREATE TEMP TABLE expected_canonical_roster AS
  SELECT * FROM jsonb_populate_record(NULL::public.registration_name_roster, ${q(canonicalRoster)});
CREATE TEMP TABLE counts_before AS
  SELECT
    (SELECT count(*) FROM public.people) people,
    (SELECT count(*) FROM public.candidates) candidates,
    (SELECT count(*) FROM public.registration_name_roster) roster;
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM expected_duplicate_claim b
    JOIN public.person_claims c ON c.id = b.id
    WHERE to_jsonb(c) = to_jsonb(b)
      AND c.review_status = 'pending'
      AND c.visibility = 'review_only'
      AND NOT c.is_public
      AND c.person_id IS NULL
      AND c.candidate_id IS NULL
      AND c.claim_json->'registrationEvidence'->>'office' = 'township_mayor'
      AND c.claim_json->'registrationEvidence'->'source'->>'row' = '104'
  ) THEN RAISE EXCEPTION 'Duplicate source claim baseline changed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM expected_duplicate_source b
    JOIN public.source_people s ON s.id = b.id
    WHERE to_jsonb(s) = to_jsonb(b)
  ) THEN RAISE EXCEPTION 'Duplicate source person baseline changed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM expected_canonical_claim b
    JOIN public.person_claims c ON c.id = b.id
    WHERE to_jsonb(c) = to_jsonb(b)
      AND c.review_status = 'pending'
      AND c.visibility = 'review_only'
      AND NOT c.is_public
      AND c.claim_json->'registrationEvidence'->>'office' = 'township_representative'
      AND c.claim_json->'registrationEvidence'->'source'->>'row' = '190'
      AND c.claim_json->'targetRace'->>'id' = '${raceId}'
  ) THEN RAISE EXCEPTION 'Canonical representative claim baseline changed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM expected_canonical_source b
    JOIN public.source_people s ON s.id = b.id
    WHERE to_jsonb(s) = to_jsonb(b)
  ) THEN RAISE EXCEPTION 'Canonical representative source baseline changed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM expected_canonical_roster b
    JOIN public.registration_name_roster n ON n.id = b.id
    WHERE to_jsonb(n) = to_jsonb(b)
      AND n.source_claim_id = '${canonicalClaimId}'::uuid
      AND n.race_id = '${raceId}'::uuid
      AND n.display_name = '倪進文'
      AND n.is_public
  ) THEN RAISE EXCEPTION 'Canonical published name baseline changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.registration_name_roster
    WHERE source_claim_id = '${duplicateClaimId}'::uuid
  ) THEN RAISE EXCEPTION 'Duplicate source claim is unexpectedly published'; END IF;
END;
$check$;
UPDATE public.person_claims
SET review_status = 'rejected',
    visibility = 'private',
    is_public = false,
    claim_json = claim_json || jsonb_build_object('registrationDuplicateReview', ${q(review)}),
    scoring_version = 'cec-registration-source-dedup-v1',
    scoring_reasons = coalesce(scoring_reasons, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'reason', ${q(review)}->>'reason',
        'reasonCode', ${q(review)}->>'reasonCode',
        'reviewedAt', ${q(review)}->>'reviewedAt'
      )
    ),
    updated_at = now()
WHERE id = '${duplicateClaimId}'::uuid;
UPDATE public.source_people
SET source_payload = source_payload || jsonb_build_object('registrationDuplicateReview', ${q(review)}),
    updated_at = now()
WHERE id = '${duplicateSourcePersonId}'::uuid;
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.person_claims c
    WHERE c.id = '${duplicateClaimId}'::uuid
      AND c.review_status = 'rejected'
      AND c.visibility = 'private'
      AND NOT c.is_public
      AND c.person_id IS NULL
      AND c.candidate_id IS NULL
      AND c.claim_json->'registrationEvidence' = ${q(duplicateClaim.claim_json.registrationEvidence)}
      AND c.claim_json->'registrationDuplicateReview' = ${q(review)}
  ) THEN RAISE EXCEPTION 'Duplicate source rejection verification failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.source_people s
    WHERE s.id = '${duplicateSourcePersonId}'::uuid
      AND s.source_payload->'registrationEvidence' = ${q(duplicateSource.source_payload.registrationEvidence)}
      AND s.source_payload->'registrationDuplicateReview' = ${q(review)}
  ) THEN RAISE EXCEPTION 'Duplicate source audit verification failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM expected_canonical_claim b
    JOIN public.person_claims c ON c.id = b.id
    WHERE to_jsonb(c) = to_jsonb(b)
  ) OR NOT EXISTS (
    SELECT 1 FROM expected_canonical_source b
    JOIN public.source_people s ON s.id = b.id
    WHERE to_jsonb(s) = to_jsonb(b)
  ) OR NOT EXISTS (
    SELECT 1 FROM expected_canonical_roster b
    JOIN public.registration_name_roster n ON n.id = b.id
    WHERE to_jsonb(n) = to_jsonb(b)
  ) THEN RAISE EXCEPTION 'Canonical representative record changed'; END IF;
  IF (SELECT count(*) FROM published.registration_names_for(ARRAY['${raceId}'::uuid]) row WHERE row->>'person_name' = '倪進文') <> 1
  THEN RAISE EXCEPTION '倪進文 is not published exactly once'; END IF;
  IF EXISTS (
    SELECT 1 FROM counts_before b
    WHERE b.people <> (SELECT count(*) FROM public.people)
       OR b.candidates <> (SELECT count(*) FROM public.candidates)
       OR b.roster <> (SELECT count(*) FROM public.registration_name_roster)
  ) THEN RAISE EXCEPTION 'People, candidates, or roster changed'; END IF;
END;
$verify$;
SELECT json_build_object(
  'mode', '${apply ? 'apply-local' : 'dry-run-rollback'}',
  'name', '倪進文',
  'decision', 'rejected_duplicate_source_row',
  'published_names', (SELECT count(*) FROM public.registration_name_roster),
  'published_occurrences', (SELECT count(*) FROM published.registration_names_for(ARRAY['${raceId}'::uuid]) row WHERE row->>'person_name' = '倪進文'),
  'batch_pending', (
    SELECT count(*) FROM public.person_claims
    WHERE review_status = 'pending'
      AND id IN (
        SELECT (item->>'claimId')::uuid
        FROM jsonb_array_elements(
          ${q(JSON.parse(fs.readFileSync('tmp/cec-registration-final/import-manifest.json', 'utf8')))}
        ) item
      )
  ),
  'new_people', 0,
  'new_candidates', 0
);
${apply ? 'COMMIT;' : 'ROLLBACK;'}
`;
const output = runSql(sql);
const result = JSON.parse(output.split('\n').findLast((line) => line.startsWith('{')));
fs.writeFileSync(
  'tmp/cec-registration-names/ni-jinwen-' + (apply ? 'apply' : 'dry-run') + '.json',
  JSON.stringify({ ...result, reviewedAt, sourceHash }, null, 2),
);
console.log(result);
