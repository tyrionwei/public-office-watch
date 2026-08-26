import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawPath = path.join(root, 'local-data/raw/national/legislator/2024/cec-candidates-l4-party-list.json');
const outputPath = process.argv[2];
if (!outputPath) throw new Error('Pass the migration output path.');

const quote = (value) => value == null || value === '' ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const rocDate = (value) => {
  const match = String(value ?? '').match(/^(\d{2,3})(\d{2})(\d{2})$/);
  return match ? `${Number(match[1]) + 1911}-${match[2]}-${match[3]}` : null;
};
const payload = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rows = payload.L4.flatMap((party) => party.cands.map((candidate) => {
  const normalizedParty = party.partyName.replaceAll('臺', '台');
  const externalId = [
    'cec-2024-candidate-json', 'L4', '全國不分區', normalizedParty,
    candidate.candNo, 'L4', candidate.name, candidate.birth,
  ].join(':');
  return {
    externalId,
    personExternalId: `cec-2024-party-list-person-${crypto.createHash('sha1').update(externalId).digest('hex').slice(0, 16)}`,
    party: normalizedParty,
    partyNo: Number(party.partyNo),
    candidateNo: Number(candidate.candNo),
    name: candidate.name.trim(),
    gender: candidate.gender === '男' ? 'male' : candidate.gender === '女' ? 'female' : 'unknown',
    birthDate: rocDate(candidate.birth),
    birthRaw: candidate.birth,
    home: candidate.home,
    elected:
      (normalizedParty === '中國國民黨' && candidate.candNo <= 13) ||
      (normalizedParty === '民主進步黨' && candidate.candNo <= 13) ||
      (normalizedParty === '台灣民眾黨' && candidate.candNo <= 8),
  };
}));
if (rows.length !== 177) throw new Error(`Expected 177 candidates, found ${rows.length}`);
if (new Set(rows.map((row) => row.party)).size !== 16) throw new Error('Expected 16 parties');
if (rows.filter((row) => row.elected).length !== 34) throw new Error('Expected 34 elected');

const values = rows.map((row) => `    (${[
  quote(row.externalId), quote(row.personExternalId), quote(row.party), row.partyNo,
  row.candidateNo, quote(row.name), quote(row.gender), quote(row.birthDate),
  quote(row.birthRaw), quote(row.home), row.elected ? 'TRUE' : 'FALSE',
].join(', ')})`).join(',\n');

const migration = `-- Restore all 177 qualified 2024 party-list candidates from the archived
-- official CEC L4 JSON. Historical winners and the current roster stay separate.
BEGIN;

CREATE TEMP TABLE _party_list_roster (
  external_id TEXT PRIMARY KEY,
  person_external_id TEXT NOT NULL UNIQUE,
  party TEXT NOT NULL,
  party_no INTEGER NOT NULL,
  candidate_no INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birth_date DATE,
  birth_raw TEXT,
  home TEXT,
  elected BOOLEAN NOT NULL,
  UNIQUE (party, candidate_no)
) ON COMMIT DROP;

INSERT INTO _party_list_roster VALUES
${values};

DO $$
DECLARE roster_count INTEGER; party_count INTEGER; elected_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT party), COUNT(*) FILTER (WHERE elected)
  INTO roster_count, party_count, elected_count FROM _party_list_roster;
  IF roster_count <> 177 OR party_count <> 16 OR elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected CEC roster: candidates %, parties %, elected %',
      roster_count, party_count, elected_count;
  END IF;
END;
$$;

CREATE TEMP TABLE _party_list_people (
  external_id TEXT PRIMARY KEY,
  person_id UUID NOT NULL
) ON COMMIT DROP;

WITH matches AS (
  SELECT roster.external_id, person_map.canonical_person_id AS person_id, 1 AS priority
  FROM _party_list_roster roster
  JOIN public.candidates candidate ON candidate.external_id = roster.external_id
  JOIN public.person_canonical_map person_map ON person_map.person_id = candidate.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 2
  FROM _party_list_roster roster
  JOIN public.person_claims claim
    ON claim.claim_type = 'external_id'
   AND COALESCE(claim.claim_value, claim.claim_json->>'officialExternalId') = roster.external_id
   AND claim.review_status = 'verified'
  JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 3
  FROM _party_list_roster roster
  JOIN public.people person
    ON REGEXP_REPLACE(REPLACE(person.name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
     = REGEXP_REPLACE(REPLACE(roster.person_name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
   AND REPLACE(COALESCE(person.party, ''), '臺', '台') = roster.party
  JOIN public.person_canonical_map person_map ON person_map.person_id = person.id
), deduplicated AS (
  SELECT DISTINCT external_id, person_id, priority FROM matches
), ranked AS (
  SELECT match.*, MIN(priority) OVER (PARTITION BY external_id) AS best_priority
  FROM deduplicated match
)
INSERT INTO _party_list_people
SELECT external_id, MIN(person_id::TEXT)::UUID
FROM ranked
WHERE priority = best_priority
GROUP BY external_id
HAVING COUNT(DISTINCT person_id) = 1;

INSERT INTO public.people (
  name, party, position, election_year, district, source_url,
  is_public, external_id, gender, updated_at
)
SELECT
  roster.person_name, roster.party, '2024年第11屆不分區立法委員候選人',
  2024, '全國不分區及僑居國外國民',
  'https://2024.cec.gov.tw/data/json/cand/L4/00000.json',
  TRUE, roster.person_external_id, roster.gender, NOW()
FROM _party_list_roster roster
LEFT JOIN _party_list_people resolved USING (external_id)
WHERE resolved.external_id IS NULL
ON CONFLICT (external_id) DO UPDATE SET
  name = EXCLUDED.name,
  party = EXCLUDED.party,
  election_year = EXCLUDED.election_year,
  district = EXCLUDED.district,
  source_url = EXCLUDED.source_url,
  is_public = TRUE,
  gender = CASE WHEN public.people.gender = 'unknown' THEN EXCLUDED.gender ELSE public.people.gender END,
  updated_at = NOW();

INSERT INTO _party_list_people
SELECT roster.external_id, person.id
FROM _party_list_roster roster
JOIN public.people person ON person.external_id = roster.person_external_id
ON CONFLICT (external_id) DO NOTHING;

DO $$
DECLARE resolved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO resolved_count FROM _party_list_people;
  IF resolved_count <> 177 THEN
    RAISE EXCEPTION 'Expected 177 resolved identities, found %', resolved_count;
  END IF;
END;
$$;

UPDATE public.people person SET
  is_public = TRUE,
  gender = CASE WHEN person.gender = 'unknown' THEN roster.gender ELSE person.gender END,
  source_url = COALESCE(person.source_url, 'https://2024.cec.gov.tw/data/json/cand/L4/00000.json'),
  updated_at = NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
WHERE person.id = resolved.person_id;

UPDATE public.candidates candidate SET
  party = roster.party,
  candidate_no = roster.candidate_no::TEXT,
  registration_status = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  source_name = '中央選舉委員會 2024 選舉專區：候選人 JSON',
  source_url = 'https://2024.cec.gov.tw/data/json/cand/L4/00000.json',
  is_public = TRUE,
  external_id = roster.external_id,
  is_elected = roster.elected,
  candidacy_status = 'qualified',
  election_result = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  status_updated_at = NOW(),
  updated_at = NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2024-legislative-party-list'
WHERE candidate.race_id = race.id AND candidate.person_id = resolved.person_id;

INSERT INTO public.candidates (
  person_id, race_id, party, candidate_no, registration_status,
  source_name, source_url, is_public, external_id, is_elected,
  candidacy_status, election_result, status_updated_at
)
SELECT
  resolved.person_id, race.id, roster.party, roster.candidate_no::TEXT,
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  '中央選舉委員會 2024 選舉專區：候選人 JSON',
  'https://2024.cec.gov.tw/data/json/cand/L4/00000.json',
  TRUE, roster.external_id, roster.elected, 'qualified',
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END, NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2024-legislative-party-list'
WHERE NOT EXISTS (
  SELECT 1 FROM public.candidates existing
  WHERE existing.race_id = race.id AND existing.person_id = resolved.person_id
)
ON CONFLICT (external_id) DO UPDATE SET
  person_id = EXCLUDED.person_id,
  race_id = EXCLUDED.race_id,
  party = EXCLUDED.party,
  candidate_no = EXCLUDED.candidate_no,
  registration_status = EXCLUDED.registration_status,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_public = TRUE,
  is_elected = EXCLUDED.is_elected,
  candidacy_status = EXCLUDED.candidacy_status,
  election_result = EXCLUDED.election_result,
  status_updated_at = NOW(),
  updated_at = NOW();

INSERT INTO public.current_office_exclusions (
  person_id, election_year, race_type, end_reason, ended_at,
  source_name, source_url, source_observed_at, source_payload, updated_at
)
SELECT
  resolved.person_id, 2024, 'party_list_legislator', 'other', NULL,

  '立法院第11屆現任立法委員名冊',
  'https://www.ly.gov.tw/Pages/List.aspx?nodeid=109',
  COALESCE((SELECT MAX(observed_at) FROM public.current_office_assignments WHERE role_key = 'legislator'), DATE '2026-08-12'),
  jsonb_build_object(
    'note', '2024年原始當選者未列於最新現任立法委員名冊；歷史選舉結果仍保留為當選',
    'officialExternalId', roster.external_id
  ),
  NOW()
FROM _party_list_roster roster
JOIN _party_list_people resolved USING (external_id)
WHERE roster.elected
  AND NOT EXISTS (
    SELECT 1
    FROM public.current_office_assignments assignment
    JOIN public.person_canonical_map assignment_map ON assignment_map.person_id = assignment.person_id
    WHERE assignment.role_key = 'legislator'
      AND assignment.is_current
      AND assignment_map.canonical_person_id = resolved.person_id
  )
ON CONFLICT (person_id, election_year, race_type) DO UPDATE SET
  end_reason = EXCLUDED.end_reason,
  ended_at = EXCLUDED.ended_at,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  source_observed_at = EXCLUDED.source_observed_at,
  source_payload = EXCLUDED.source_payload,
  updated_at = NOW();

DO $$
DECLARE candidate_count INTEGER; elected_count INTEGER; current_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE candidate.is_elected)
  INTO candidate_count, elected_count
  FROM public.candidates candidate
  JOIN public.races race ON race.id = candidate.race_id
  WHERE race.external_id = 'cec-2024-legislative-party-list' AND candidate.is_public;
  SELECT COUNT(*) INTO current_count
  FROM public.current_office_assignments
  WHERE role_key = 'legislator' AND is_current;
  IF candidate_count <> 177 OR elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected party-list result: candidates %, elected %', candidate_count, elected_count;
  END IF;
  IF current_count <> 113 THEN
    RAISE EXCEPTION 'Current legislator roster changed unexpectedly: %', current_count;
  END IF;
END;
$$;

SELECT published.promote(NULL);

DO $$
DECLARE published_count INTEGER; published_elected_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_elected)
  INTO published_count, published_elected_count
  FROM published.candidates
  WHERE election_year = 2024
    AND race_title = '全國不分區及僑居國外國民立法委員選舉';
  IF published_count <> 177 OR published_elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected published party-list result: candidates %, elected %',
      published_count, published_elected_count;
  END IF;
END;
$$;

COMMIT;
`;

fs.writeFileSync(path.resolve(root, outputPath), migration);
console.log(JSON.stringify({ outputPath, candidates: 177, parties: 16, elected: 34 }, null, 2));
