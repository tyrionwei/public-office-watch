import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--apply-local'), 'Usage: node scripts/publish-cec-registration-name-placeholders-local.mjs [--apply-local]');
const apply = args.includes('--apply-local');
assert(fs.readFileSync('supabase/config.toml', 'utf8').includes('project_id = "public-office-watch"'));

const specs = [
  {
    id: '0aa44b9e-2c96-4f3b-8522-d329b82ad032',
    claimId: '609bafd4-0ab0-487c-904d-1f6c868281c5',
    sourcePersonId: '37bcb4d9-ec7a-444f-93c8-625a7f0f132b',
    candidateExternalId: 'pow-cec-registration-2026-3c7c480a7ea08121155629b2d63751ff',
    raceId: 'a7baa5a8-9ab0-4d5c-9d56-1cb8afe14a7d',
    originalName: '陳聰',
    displayName: '陳聰X',
    sourceFile: 'ttec-64641-06.pdf',
    sourceHash: '4760145a539d7f64dfff7d23e1d73fa32e05b986e2133bc083f92780c8402df4',
  },
  {
    id: 'f085d078-d50e-4f0b-b57e-88684411be56',
    claimId: 'e31e9863-8b42-4076-9b75-08e5ebdfb869',
    sourcePersonId: 'ee4727ee-4840-44fc-9fa6-21e84ff4e050',
    candidateExternalId: 'pow-cec-registration-2026-6968b8368be20b72af22b35c3b414634',
    raceId: 'f19d5a9a-97f0-46b7-b1ca-0cc4a1a90db1',
    originalName: '曾銪',
    displayName: '曾銪X',
    sourceFile: 'tcec-64645-01.pdf',
    sourceHash: 'ba65363d70dd2ab1d35ff48d04e3f281fd8ebd28846ae188a911f5c0fe6b637d',
  },
  {
    id: '57a92084-27d8-4d6f-80aa-044eec127d62',
    claimId: '340a73e0-4fc3-42fc-b34a-d58302c6c322',
    sourcePersonId: '319dac56-6359-4b6f-9132-7e6537863851',
    candidateExternalId: 'pow-cec-registration-2026-e29991cd768af725e2617965a978db65',
    raceId: '53c74d20-468f-473b-8662-8be99c24a50b',
    originalName: '洪銨',
    displayName: '洪銨X',
    sourceFile: 'ptec-64654-01.xlsx',
    sourceHash: 'ede9d13c65ddb86e1d9e90f59af857f18f4dd4c382d985af3761a738191afd87',
  },
];
const q = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const runSql = (sql) => execFileSync(
  'docker',
  ['exec', '-i', 'supabase_db_public-office-watch', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  { input: sql, encoding: 'utf8', maxBuffer: 30e6 },
).trim();
const sha = (path) => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const ids = (key) => specs.map((item) => "'" + item[key] + "'").join(',');

for (const spec of specs) {
  assert.equal(sha('tmp/cec-registration-final/' + spec.sourceFile), spec.sourceHash);
}
const context = JSON.parse(runSql(`
SELECT json_build_object(
  'claims', (
    SELECT json_agg(to_jsonb(c) ORDER BY c.id)
    FROM public.person_claims c
    WHERE c.id IN (${ids('claimId')})
  ),
  'sources', (
    SELECT json_agg(to_jsonb(s) ORDER BY s.id)
    FROM public.source_people s
    WHERE s.id IN (${ids('sourcePersonId')})
  ),
  'races', (
    SELECT json_agg(to_jsonb(r) ORDER BY r.id)
    FROM public.races r
    WHERE r.id IN (${ids('raceId')})
  ),
  'rosterCount', (SELECT count(*) FROM public.registration_name_roster),
  'peopleCount', (SELECT count(*) FROM public.people),
  'candidateCount', (SELECT count(*) FROM public.candidates)
);
`));
assert.equal(context.rosterCount, 913);
assert.equal(context.claims.length, 3);
assert.equal(context.sources.length, 3);
assert.equal(context.races.length, 3);

const reviewedAt = new Date().toISOString();
const claimById = new Map(context.claims.map((row) => [row.id, row]));
const sourceById = new Map(context.sources.map((row) => [row.id, row]));
const raceById = new Map(context.races.map((row) => [row.id, row]));
const inputs = specs.map((spec) => {
  const claim = claimById.get(spec.claimId);
  const source = sourceById.get(spec.sourcePersonId);
  const race = raceById.get(spec.raceId);
  assert(claim && source && race);
  assert.equal(claim.source_person_id, spec.sourcePersonId);
  assert.equal(claim.review_status, 'pending');
  assert.equal(claim.visibility, 'review_only');
  assert.equal(claim.is_public, false);
  assert.equal(claim.person_id, null);
  assert.equal(claim.candidate_id, null);
  assert.equal(claim.claim_json.registrationEvidence.name, spec.originalName);
  assert.equal(claim.claim_json.registrationEvidence.source.sha256, spec.sourceHash);
  assert.equal(claim.claim_json.targetRace.id, spec.raceId);
  assert.equal(source.raw_name, spec.originalName);
  assert.equal(source.source_payload.registrationEvidence.name, spec.originalName);
  assert.equal(race.id, spec.raceId);
  assert.equal(race.is_public, true);
  const evidence = claim.claim_json.registrationEvidence;
  const review = {
    decision: 'publish_name_with_placeholder',
    reasonCode: 'source_name_encoding_placeholder',
    reason: '依使用者決定，官方姓名末字無法解碼時以 X 代替，只顯示登記姓名，不建立人物或身分連結。',
    originalName: spec.originalName,
    displayName: spec.displayName,
    placeholder: 'X',
    unresolvedCodePoint: 'U+' + spec.originalName.codePointAt(spec.originalName.length - 1).toString(16).toUpperCase().padStart(4, '0'),
    reviewedAt,
    reviewedBy: 'Codex user-approved missing-glyph placeholder review',
    officialEvidence: {
      url: evidence.source.url,
      file: evidence.source.file,
      sha256: evidence.source.sha256,
      page: evidence.source.page,
      row: evidence.source.row,
    },
  };
  const record = {
    id: spec.id,
    source_claim_id: spec.claimId,
    candidate_external_id: spec.candidateExternalId,
    race_id: spec.raceId,
    display_name: spec.displayName,
    party: evidence.party_recommendation === '無' ? '無黨籍' : evidence.party_recommendation,
    registered_on: evidence.registration_date,
    source_name: claim.source_name,
    source_url: evidence.source.url,
    source_hash: evidence.source.sha256,
    is_public: true,
    reviewed_at: reviewedAt,
  };
  return {
    claim_id: spec.claimId,
    source_person_id: spec.sourcePersonId,
    race_id: spec.raceId,
    expected_claim: claim,
    expected_source: source,
    expected_race: race,
    review,
    record,
  };
});
fs.mkdirSync('tmp/cec-registration-names', { recursive: true });
fs.writeFileSync(
  'tmp/cec-registration-names/name-placeholders.json',
  JSON.stringify({ environment: 'full-local', records: inputs.map((item) => item.record), reviews: inputs.map((item) => item.review) }, null, 2),
);

const batchClaimIds = JSON.parse(fs.readFileSync('tmp/cec-registration-final/import-manifest.json', 'utf8')).map((item) => item.claimId);
const sql = `
BEGIN;
SET LOCAL application_name = 'cec-registration-name-placeholders-20260905';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:cec-registration-publication', 0));
CREATE TEMP TABLE input AS
SELECT * FROM jsonb_to_recordset(${q(inputs)}) AS x(
  claim_id uuid,
  source_person_id uuid,
  race_id uuid,
  expected_claim jsonb,
  expected_source jsonb,
  expected_race jsonb,
  review jsonb,
  record jsonb
);
CREATE UNIQUE INDEX ON input(claim_id);
CREATE TEMP TABLE counts_before AS
SELECT
  (SELECT count(*) FROM public.people) people,
  (SELECT count(*) FROM public.candidates) candidates,
  (SELECT count(*) FROM public.registration_name_roster) roster;
DO $check$
BEGIN
  IF (SELECT count(*) FROM input) <> 3 THEN RAISE EXCEPTION 'Placeholder input count'; END IF;
  IF EXISTS (
    SELECT 1 FROM input i
    LEFT JOIN public.person_claims c ON c.id = i.claim_id
    LEFT JOIN public.source_people s ON s.id = i.source_person_id
    LEFT JOIN public.races r ON r.id = i.race_id
    WHERE c.id IS NULL OR s.id IS NULL OR r.id IS NULL
      OR to_jsonb(c) IS DISTINCT FROM i.expected_claim
      OR to_jsonb(s) IS DISTINCT FROM i.expected_source
      OR to_jsonb(r) IS DISTINCT FROM i.expected_race
      OR c.review_status <> 'pending'
      OR c.visibility <> 'review_only'
      OR c.is_public
      OR c.person_id IS NOT NULL
      OR c.candidate_id IS NOT NULL
      OR c.claim_json->'registrationEvidence'->>'name' IS DISTINCT FROM s.raw_name
      OR c.claim_json->'targetRace'->>'id' IS DISTINCT FROM i.race_id::text
      OR NOT r.is_public
  ) THEN RAISE EXCEPTION 'Placeholder source baseline changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM input i
    JOIN public.registration_name_roster n
      ON n.source_claim_id = i.claim_id
      OR n.candidate_external_id = i.record->>'candidate_external_id'
      OR (n.race_id = i.race_id AND n.display_name = i.record->>'display_name')
  ) THEN RAISE EXCEPTION 'Placeholder roster row already exists'; END IF;
  IF EXISTS (
    SELECT 1 FROM input i
    JOIN public.candidates c ON c.external_id = i.record->>'candidate_external_id'
  ) THEN RAISE EXCEPTION 'Placeholder already has a candidate'; END IF;
END;
$check$;
UPDATE public.person_claims c
SET claim_json = c.claim_json || jsonb_build_object('registrationNameRosterReview', i.review),
    updated_at = now()
FROM input i
WHERE c.id = i.claim_id;
UPDATE public.source_people s
SET source_payload = s.source_payload || jsonb_build_object('registrationNameRosterReview', i.review),
    updated_at = now()
FROM input i
WHERE s.id = i.source_person_id;
INSERT INTO public.registration_name_roster (
  id, source_claim_id, candidate_external_id, race_id, display_name, party,
  registered_on, source_name, source_url, source_hash, is_public, reviewed_at
)
SELECT r.id, r.source_claim_id, r.candidate_external_id, r.race_id, r.display_name,
       r.party, r.registered_on, r.source_name, r.source_url, r.source_hash,
       r.is_public, r.reviewed_at
FROM input i
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.registration_name_roster, i.record) r;
DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.registration_name_roster) <> 916 THEN
    RAISE EXCEPTION 'Roster count is not 916';
  END IF;
  IF (
    SELECT count(*)
    FROM input i
    JOIN public.person_claims c ON c.id = i.claim_id
    JOIN public.source_people s ON s.id = i.source_person_id
    JOIN public.registration_name_roster n ON n.source_claim_id = i.claim_id
    WHERE c.review_status = 'pending'
      AND c.visibility = 'review_only'
      AND NOT c.is_public
      AND c.person_id IS NULL
      AND c.candidate_id IS NULL
      AND c.claim_json->'registrationEvidence' = i.expected_claim->'claim_json'->'registrationEvidence'
      AND c.claim_json->'registrationNameRosterReview' = i.review
      AND s.raw_name = i.expected_source->>'raw_name'
      AND s.source_payload->'registrationEvidence' = i.expected_source->'source_payload'->'registrationEvidence'
      AND s.source_payload->'registrationNameRosterReview' = i.review
      AND n.display_name = i.record->>'display_name'
      AND n.race_id = i.race_id
      AND n.is_public
  ) <> 3 THEN RAISE EXCEPTION 'Placeholder audit or roster verification failed'; END IF;
  IF (
    SELECT count(*)
    FROM input i
    CROSS JOIN LATERAL published.registration_names_for(ARRAY[i.race_id]) row
    WHERE row->>'candidate_id' = i.record->>'id'
      AND row->>'person_id' = ''
      AND row->>'person_name' = i.record->>'display_name'
      AND row->>'race_id' = i.race_id::text
  ) <> 3 THEN RAISE EXCEPTION 'Published placeholder rows verification failed'; END IF;
  IF EXISTS (
    SELECT 1 FROM counts_before b
    WHERE b.people <> (SELECT count(*) FROM public.people)
       OR b.candidates <> (SELECT count(*) FROM public.candidates)
       OR b.roster + 3 <> (SELECT count(*) FROM public.registration_name_roster)
  ) THEN RAISE EXCEPTION 'People, candidates, or roster count changed unexpectedly'; END IF;
  IF (
    SELECT count(*) FROM public.person_claims
    WHERE review_status = 'pending'
      AND id IN (
        SELECT value::uuid FROM jsonb_array_elements_text(${q(batchClaimIds)})
      )
  ) <> 916 THEN RAISE EXCEPTION 'Pending count changed'; END IF;
END;
$verify$;
SELECT json_build_object(
  'mode', '${apply ? 'apply-local' : 'dry-run-rollback'}',
  'placeholder_names', 3,
  'plain_names', (SELECT count(*) FROM public.registration_name_roster),
  'withheld', 0,
  'identity_pending', 916,
  'new_people', 0,
  'new_candidates', 0
);
${apply ? 'COMMIT;' : 'ROLLBACK;'}
`;
const output = runSql(sql);
const result = JSON.parse(output.split('\n').findLast((line) => line.startsWith('{')));
fs.writeFileSync(
  'tmp/cec-registration-names/name-placeholders-' + (apply ? 'apply' : 'dry-run') + '.json',
  JSON.stringify({ ...result, reviewedAt }, null, 2),
);
console.log(result);
