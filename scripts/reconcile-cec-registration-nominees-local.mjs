import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--apply-local'), 'Usage: node scripts/reconcile-cec-registration-nominees-local.mjs [--apply-local]');
const apply = args.includes('--apply-local');
assert(fs.readFileSync('supabase/config.toml', 'utf8').includes('project_id = "public-office-watch"'));

const runSql = (sql) => execFileSync(
  'docker',
  ['exec', '-i', 'supabase_db_public-office-watch', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  { input: sql, encoding: 'utf8', maxBuffer: 30e6 },
).trim();

const before = JSON.parse(runSql(`
SELECT json_build_object(
  'partyNominees2026', (
    SELECT count(*)
    FROM public.candidates c
    JOIN public.races r ON r.id = c.race_id
    JOIN public.elections e ON e.id = r.election_id
    WHERE e.year = 2026 AND c.candidacy_status = 'party_nominee'
  ),
  'tainanIncompleteNominees', (
    SELECT count(*)
    FROM public.candidates c
    JOIN public.races r ON r.id = c.race_id
    JOIN public.elections e ON e.id = r.election_id
    WHERE e.year = 2026
      AND c.candidacy_status = 'party_nominee'
      AND r.title LIKE '臺南市%'
      AND r.race_type IN ('city_councilor', 'village_chief')
  ),
  'officialRegistrations', (
    SELECT count(*)
    FROM public.candidates c
    JOIN public.races r ON r.id = c.race_id
    JOIN public.elections e ON e.id = r.election_id
    WHERE e.year = 2026
      AND c.candidacy_status = 'registered'
      AND c.registration_status = 'registered'
  ),
  'nameOnlyRegistrations', (SELECT count(*) FROM public.registration_name_roster WHERE is_public),
  'candidateCount', (SELECT count(*) FROM public.candidates),
  'personCount', (SELECT count(*) FROM public.people)
);
`));

assert.deepEqual(before, {
  partyNominees2026: 44,
  tainanIncompleteNominees: 38,
  officialRegistrations: 17500,
  nameOnlyRegistrations: 916,
  candidateCount: before.candidateCount,
  personCount: before.personCount,
});

const sql = `
BEGIN;
SET LOCAL application_name = 'cec-registration-nominee-reconciliation-20260905';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:cec-registration-publication', 0));

CREATE TEMP TABLE registration_identity_pairs(
  old_candidate_id uuid PRIMARY KEY,
  old_person_id uuid NOT NULL,
  official_candidate_id uuid UNIQUE NOT NULL,
  official_person_id uuid UNIQUE NOT NULL,
  preferred_name text NOT NULL,
  alternate_name text,
  expected_party text NOT NULL,
  reason text NOT NULL
);
INSERT INTO registration_identity_pairs VALUES
  ('8d6e9b0a-e134-4015-b4af-220399dbccd1','320c38ea-48a7-4cfb-a77b-5842abcda5ac','94fa3737-3aa4-4b5b-996a-1f1d6161e198','d230fb3d-2814-4219-9084-7eaed8820a61','謝龍介',NULL,'中國國民黨','Official Tainan HTML text was parsed into the candidate name; the source sentence explicitly names 謝龍介 in the same mayoral race.'),
  ('0678c69d-7319-48af-94e6-f162d99e8f4b','2ec71727-7227-4ee6-a5dc-b16493f0ad27','a8377582-049c-433f-89f2-003fb1e892b4','1eef7a03-5e9b-4498-8862-4ca53121993f','徐尚裕','徐尙裕','台灣民眾黨','Same 2026 Puxin representative district and party; 尙/尚 is an orthographic variant between the party and official registration sources.'),
  ('b4104e37-ca7b-4e18-81af-bd385e21e870','c1a80678-c645-4bfb-8d93-73423c5f7aaa','c9439923-9ec0-48cb-bf61-e76cbdc33817','c5d78074-a8d5-44c4-8f8c-713cdd344ff6','布落‧馬信','布落.馬信','民主進步黨','Same 2026 New Taipei mountain indigenous council district and party; punctuation differs between sources.'),
  ('ae1867e6-2a46-4407-a74f-024a39f3eb77','147c1321-53d1-4dd3-89de-7823697c7098','d482cbd5-2a24-430c-8937-91efc37c749f','00533bcc-2617-4e9e-9928-ccd6a3799f7c','蘇錦雄Paylang ‧Caya','蘇錦雄Paylang．Caya','民主進步黨','Same 2026 New Taipei plains indigenous council district and party; spacing and punctuation differ between sources.');

CREATE TEMP TABLE confirmed_nonregistrants(candidate_id uuid PRIMARY KEY, final_source_url text NOT NULL);
INSERT INTO confirmed_nonregistrants VALUES
  ('8c8a29b9-a188-47c2-b2c3-d7a35e62a2a1','https://web.cec.gov.tw/api/file/25ad87b9-7d01-4b97-82c5-005b5f89c591.pdf'),
  ('3c44c33e-301a-4186-8b46-40018977f31f','https://info.cec.gov.tw/vote2026/news/?id=NEWS');

CREATE TEMP TABLE incomplete_tainan_nominees AS
SELECT c.id AS candidate_id
FROM public.candidates c
JOIN public.races r ON r.id = c.race_id
JOIN public.elections e ON e.id = r.election_id
WHERE e.year = 2026
  AND c.candidacy_status = 'party_nominee'
  AND r.title LIKE '臺南市%'
  AND r.race_type IN ('city_councilor', 'village_chief');

DO $check$
BEGIN
  IF (SELECT count(*) FROM registration_identity_pairs) <> 4 THEN
    RAISE EXCEPTION 'Registration identity pair count changed';
  END IF;
  IF (SELECT count(*) FROM confirmed_nonregistrants) <> 2 THEN
    RAISE EXCEPTION 'Confirmed nonregistrant count changed';
  END IF;
  IF (SELECT count(*) FROM incomplete_tainan_nominees) <> 38 THEN
    RAISE EXCEPTION 'Incomplete Tainan nominee count changed';
  END IF;
  IF (
    SELECT count(*)
    FROM registration_identity_pairs pair
    JOIN public.candidates old_candidate ON old_candidate.id = pair.old_candidate_id
    JOIN public.candidates official_candidate ON official_candidate.id = pair.official_candidate_id
    JOIN public.people old_person ON old_person.id = pair.old_person_id
    JOIN public.people official_person ON official_person.id = pair.official_person_id
    WHERE old_candidate.person_id = pair.old_person_id
      AND official_candidate.person_id = pair.official_person_id
      AND old_candidate.race_id = official_candidate.race_id
      AND old_candidate.candidacy_status = 'party_nominee'
      AND old_candidate.registration_status = 'unknown'
      AND official_candidate.candidacy_status = 'registered'
      AND official_candidate.registration_status = 'registered'
      AND official_candidate.external_id LIKE 'pow-cec-registration-2026-%'
      AND old_person.is_public
      AND official_person.is_public
  ) <> 4 THEN RAISE EXCEPTION 'Registration identity baseline changed'; END IF;
  IF EXISTS (
    SELECT 1
    FROM registration_identity_pairs pair
    JOIN public.person_merge_decisions decision
      ON decision.duplicate_person_id = pair.official_person_id
     AND decision.status IN ('suggested', 'verified')
  ) THEN RAISE EXCEPTION 'Registration person already has an active merge decision'; END IF;
  IF (
    SELECT count(*)
    FROM confirmed_nonregistrants target
    JOIN public.candidates candidate ON candidate.id = target.candidate_id
    WHERE candidate.candidacy_status = 'party_nominee'
      AND candidate.registration_status = 'unknown'
  ) <> 2 THEN RAISE EXCEPTION 'Confirmed nonregistrant baseline changed'; END IF;
  IF (
    SELECT count(*)
    FROM public.candidates c
    JOIN public.races r ON r.id = c.race_id
    JOIN public.elections e ON e.id = r.election_id
    WHERE e.year = 2026 AND c.candidacy_status = 'party_nominee'
  ) <> 44 THEN RAISE EXCEPTION 'Expected 44 remaining 2026 party nominees'; END IF;
END;
$check$;

INSERT INTO public.person_merge_decisions(
  duplicate_person_id,
  canonical_person_id,
  status,
  confidence_level,
  reason,
  evidence_json,
  reviewed_by,
  reviewed_at,
  updated_at
)
SELECT
  pair.official_person_id,
  pair.old_person_id,
  'verified',
  'A',
  pair.reason,
  jsonb_build_object(
    'reviewType', '2026_registration_nominee_reconciliation',
    'oldCandidateId', pair.old_candidate_id,
    'officialCandidateId', pair.official_candidate_id,
    'preferredName', pair.preferred_name,
    'alternateName', pair.alternate_name,
    'sameRace', true,
    'party', pair.expected_party,
    'reviewedAt', '2026-09-05T00:00:00+08:00'
  ),
  'Codex CEC registration audit',
  now(),
  now()
FROM registration_identity_pairs pair;

UPDATE public.people person
SET
  name = pair.preferred_name,
  alias = CASE
    WHEN pair.alternate_name IS NULL THEN person.alias
    WHEN NULLIF(btrim(person.alias), '') IS NULL THEN pair.alternate_name
    WHEN person.alias = pair.alternate_name THEN person.alias
    ELSE person.alias || '、' || pair.alternate_name
  END,
  party = CASE WHEN pair.preferred_name = '布落‧馬信' THEN pair.expected_party ELSE person.party END,
  updated_at = now()
FROM registration_identity_pairs pair
WHERE person.id = pair.old_person_id;

UPDATE public.people person
SET is_public = false, updated_at = now()
FROM registration_identity_pairs pair
WHERE person.id = pair.official_person_id;

UPDATE public.candidates candidate
SET party = pair.expected_party
FROM registration_identity_pairs pair
WHERE candidate.id = pair.official_candidate_id;

UPDATE public.candidates candidate
SET candidacy_status = 'unknown',
    registration_status = 'unknown',
    is_public = false
FROM registration_identity_pairs pair
WHERE candidate.id = pair.old_candidate_id;

UPDATE public.candidate_status_history history
SET change_reason = 'Superseded by the separately imported official registration record after verified person reconciliation.',
    source_name = official.source_name,
    source_url = official.source_url
FROM registration_identity_pairs pair
JOIN public.candidates official ON official.id = pair.official_candidate_id
WHERE history.candidate_id = pair.old_candidate_id
  AND history.created_at = (
    SELECT max(latest.created_at)
    FROM public.candidate_status_history latest
    WHERE latest.candidate_id = pair.old_candidate_id
  );

UPDATE public.candidates candidate
SET candidacy_status = 'did_not_register',
    registration_status = 'not_registered',
    is_public = false
FROM confirmed_nonregistrants target
WHERE candidate.id = target.candidate_id;

UPDATE public.candidate_status_history history
SET change_reason = 'Party nominee is absent from the complete official registration lists published after the 2026-09-04 filing deadline.',
    source_name = '中央選舉委員會｜115年地方公職人員選舉候選人登記概況',
    source_url = target.final_source_url
FROM confirmed_nonregistrants target
WHERE history.candidate_id = target.candidate_id
  AND history.created_at = (
    SELECT max(latest.created_at)
    FROM public.candidate_status_history latest
    WHERE latest.candidate_id = target.candidate_id
  );

UPDATE public.candidates candidate
SET candidacy_status = 'unknown',
    registration_status = 'unknown',
    is_public = false
FROM incomplete_tainan_nominees target
WHERE candidate.id = target.candidate_id;

UPDATE public.candidate_status_history history
SET change_reason = 'Registration cannot yet be matched because the Tainan deadline announcement reports aggregate councilor and village-chief counts without a complete named roster.',
    source_name = '臺南市選舉委員會｜臺南市第5屆市長、市議員及里長登記情形',
    source_url = 'https://web.cec.gov.tw/tnec/article/64661'
FROM incomplete_tainan_nominees target
WHERE history.candidate_id = target.candidate_id
  AND history.created_at = (
    SELECT max(latest.created_at)
    FROM public.candidate_status_history latest
    WHERE latest.candidate_id = target.candidate_id
  );

SELECT published.promote(NULL);

DO $verify$
BEGIN
  IF (
    SELECT count(*)
    FROM registration_identity_pairs pair
    JOIN public.person_canonical_map map
      ON map.person_id = pair.official_person_id
     AND map.canonical_person_id = pair.old_person_id
     AND map.merge_status = 'verified'
  ) <> 4 THEN RAISE EXCEPTION 'Verified registration person mappings failed'; END IF;
  IF (
    SELECT count(*)
    FROM registration_identity_pairs pair
    JOIN published.candidates candidate
      ON candidate.candidate_id = pair.official_candidate_id
     AND candidate.person_id = pair.old_person_id
     AND candidate.person_name = pair.preferred_name
     AND candidate.party = pair.expected_party
     AND candidate.candidacy_status = 'registered'
     AND candidate.registration_status = 'registered'
  ) <> 4 THEN RAISE EXCEPTION 'Published registered candidates were not reconciled'; END IF;
  IF EXISTS (
    SELECT 1
    FROM registration_identity_pairs pair
    JOIN public.candidates candidate ON candidate.id = pair.old_candidate_id
    WHERE candidate.is_public
       OR candidate.candidacy_status <> 'unknown'
       OR candidate.registration_status <> 'unknown'
  ) THEN RAISE EXCEPTION 'Superseded party candidate remains active'; END IF;
  IF (
    SELECT count(*)
    FROM confirmed_nonregistrants target
    JOIN public.candidates candidate ON candidate.id = target.candidate_id
    WHERE NOT candidate.is_public
      AND candidate.candidacy_status = 'did_not_register'
      AND candidate.registration_status = 'not_registered'
  ) <> 2 THEN RAISE EXCEPTION 'Confirmed nonregistrants were not retired'; END IF;
  IF (
    SELECT count(*)
    FROM incomplete_tainan_nominees target
    JOIN public.candidates candidate ON candidate.id = target.candidate_id
    WHERE NOT candidate.is_public
      AND candidate.candidacy_status = 'unknown'
      AND candidate.registration_status = 'unknown'
  ) <> 38 THEN RAISE EXCEPTION 'Incomplete Tainan nominees were not held back'; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.candidates candidate
    JOIN public.races race ON race.id = candidate.race_id
    JOIN public.elections election ON election.id = race.election_id
    WHERE election.year = 2026 AND candidate.candidacy_status = 'party_nominee'
  ) THEN RAISE EXCEPTION 'A stale 2026 party nominee remains'; END IF;
  IF (SELECT count(*) FROM public.candidates c JOIN public.races r ON r.id = c.race_id JOIN public.elections e ON e.id = r.election_id WHERE e.year = 2026 AND c.candidacy_status = 'registered' AND c.registration_status = 'registered') <> 17500
  THEN RAISE EXCEPTION 'Official registration count changed'; END IF;
  IF (SELECT count(*) FROM public.registration_name_roster WHERE is_public) <> 916
  THEN RAISE EXCEPTION 'Name-only registration count changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM published.candidates
    WHERE election_year = 2026
      AND (person_name LIKE '%</span>%' OR person_name LIKE '%style=%' OR length(person_name) > 80)
  ) THEN RAISE EXCEPTION 'Malformed registered person name remains public'; END IF;
END;
$verify$;

SELECT json_build_object(
  'mode', '${apply ? 'apply-local' : 'dry-run'}',
  'identityMerges', (SELECT count(*) FROM registration_identity_pairs),
  'confirmedDidNotRegister', (SELECT count(*) FROM confirmed_nonregistrants),
  'registrationPendingNamedRoster', (SELECT count(*) FROM incomplete_tainan_nominees),
  'officialRegistrations', (SELECT count(*) FROM public.candidates c JOIN public.races r ON r.id = c.race_id JOIN public.elections e ON e.id = r.election_id WHERE e.year = 2026 AND c.candidacy_status = 'registered' AND c.registration_status = 'registered'),
  'nameOnlyRegistrations', (SELECT count(*) FROM public.registration_name_roster WHERE is_public),
  'remainingPartyNominees2026', (
    SELECT count(*) FROM public.candidates c
    JOIN public.races r ON r.id = c.race_id
    JOIN public.elections e ON e.id = r.election_id
    WHERE e.year = 2026 AND c.candidacy_status = 'party_nominee'
  )
);
${apply ? 'COMMIT;' : 'ROLLBACK;'}
`;

const output = runSql(sql).split(/\r?\n/).filter(Boolean);
const result = JSON.parse(output.at(-1));
fs.mkdirSync('tmp/cec-registration-final', { recursive: true });
fs.writeFileSync(
  'tmp/cec-registration-final/nominee-reconciliation-' + (apply ? 'local' : 'dry-run') + '.json',
  JSON.stringify({ before, result }, null, 2),
);
console.log(JSON.stringify({ before, result }, null, 2));
