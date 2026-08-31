import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rosterPath = path.join(root, 'local-data/raw/national/legislator/2020/cec-candidates-l4-party-list.json');
const resultsPath = path.join(root, 'local-data/raw/national/legislator/2020/cec-party-list-results.json');
const electedPath = path.join(root, 'local-data/raw/national/legislator/2020/cec-party-list-elected.json');
const outputPath = process.argv[2];
if (!outputPath) throw new Error('Pass the migration output path.');

const resultSourceUrl = 'https://db.cec.gov.tw/ElecTable/Election/ElecTickets?areaCode=00&cityCode=000&dataLevel=N&dataType=tickets&deptCode=000&legisId=L4&liCode=0000&prvCode=00&subjectId=L0&themeId=e002307160cbb898376da0c9cbb9ba16&typeId=ELC';
const bulletinUrl = 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/109%E5%B9%B4%E7%AC%AC10%E5%B1%86/03%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/%E5%85%A8%E5%9C%8B%E4%B8%8D%E5%88%86%E5%8D%80%E5%8F%8A%E5%83%91%E5%B1%85%E5%9C%8B%E5%A4%96%E5%9C%8B%E6%B0%91%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1%E9%81%B8%E8%88%89%20.pdf';

const quote = (value) => value == null || value === '' ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const canonicalParty = (party) => ({
  綠黨: '台灣綠黨',
  台灣團結聯盟: '台聯黨',
})[party] ?? party;
const rocDate = (value) => {
  const match = String(value ?? '').match(/^(\d{2,3})(\d{2})(\d{2})$/);
  return match ? `${Number(match[1]) + 1911}-${match[2]}-${match[3]}` : null;
};
const deterministicUuid = (key) => {
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32).split('');
  hash[12] = '5';
  hash[16] = ['8', '9', 'a', 'b'][Number.parseInt(hash[16], 16) % 4];
  const value = hash.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

const rosterPayload = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
const resultsPayload = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const electedPayload = JSON.parse(fs.readFileSync(electedPath, 'utf8'));
const officialResults = resultsPayload['00_000_00_000_0000'];
if (!Array.isArray(officialResults)) throw new Error('CEC result payload is missing the national result array.');

const resultRows = officialResults.map((result) => ({
  partyNo: Number(result.cand_no),
  party: String(result.party_name).replaceAll('臺', '台'),
  canonicalParty: canonicalParty(String(result.party_name).replaceAll('臺', '台')),
  voteCount: Number(result.ticket_num),
  allocatedSeats: Number(result.elected_num),
}));
const resultByParty = new Map(resultRows.map((row) => [row.party, row]));
const electedKeys = new Set(electedPayload.map((row) => [
  String(row.party).replaceAll('臺', '台').replaceAll(/\s+/gu, ''),
  String(row.name).replaceAll(/\s+/gu, ''),
].join(':')));
const rosterRows = rosterPayload.L4.flatMap((party) => party.cands.map((candidate) => {
  const normalizedParty = party.partyName.replaceAll('臺', '台');
  const result = resultByParty.get(normalizedParty);
  if (!result) throw new Error(`Missing result row for ${normalizedParty}`);
  const externalId = [
    'cec-2020-bulletin', 'L4', '全國不分區', normalizedParty,
    candidate.candNo, candidate.name, candidate.birth,
  ].join(':');
  return {
    externalId,
    personExternalId: `cec-2020-party-list-person-${crypto.createHash('sha1').update(externalId).digest('hex').slice(0, 16)}`,
    party: normalizedParty,
    canonicalParty: canonicalParty(normalizedParty),
    partyNo: Number(party.partyNo),
    candidateNo: Number(candidate.candNo),
    name: candidate.name.trim(),
    gender: candidate.gender === '男' ? 'male' : candidate.gender === '女' ? 'female' : 'unknown',
    birthDate: rocDate(candidate.birth),
    birthRaw: candidate.birth,
    elected: electedKeys.has(`${normalizedParty.replaceAll(/\s+/gu, '')}:${candidate.name.replaceAll(/\s+/gu, '')}`),
  };
}));

const raceId = deterministicUuid('cec-2020-legislative-party-list');
const voteTotal = resultRows.reduce((sum, row) => sum + row.voteCount, 0);
const seatTotal = resultRows.reduce((sum, row) => sum + row.allocatedSeats, 0);
const femaleCount = rosterRows.filter((row) => row.gender === 'female').length;
const maleCount = rosterRows.filter((row) => row.gender === 'male').length;
const electedFemaleCount = rosterRows.filter((row) => row.elected && row.gender === 'female').length;
const electedMaleCount = rosterRows.filter((row) => row.elected && row.gender === 'male').length;
const matchedElectedKeys = new Set(rosterRows.filter((row) => row.elected).map((row) => `${row.party.replaceAll(/\s+/gu, '')}:${row.name.replaceAll(/\s+/gu, '')}`));

if (resultRows.length !== 19) throw new Error(`Expected 19 parties, found ${resultRows.length}`);
if (rosterRows.length !== 216) throw new Error(`Expected 216 candidates, found ${rosterRows.length}`);
if (voteTotal !== 14160138) throw new Error(`Expected 14,160,138 valid votes, found ${voteTotal}`);
if (seatTotal !== 34) throw new Error(`Expected 34 seats, found ${seatTotal}`);
if (femaleCount !== 109 || maleCount !== 107) throw new Error(`Unexpected roster genders: female ${femaleCount}, male ${maleCount}`);
if (electedFemaleCount !== 19 || electedMaleCount !== 15) throw new Error(`Unexpected elected genders: female ${electedFemaleCount}, male ${electedMaleCount}`);
if (electedKeys.size !== 34 || matchedElectedKeys.size !== 34) throw new Error(`Expected 34 matched official elected rows, found ${matchedElectedKeys.size}`);
for (const result of resultRows) {
  const electedForParty = rosterRows.filter((row) => row.party === result.party && row.elected).length;
  if (electedForParty !== result.allocatedSeats) {
    throw new Error(`Expected ${result.allocatedSeats} elected candidates for ${result.party}, found ${electedForParty}`);
  }
}

const rosterValues = rosterRows.map((row) => `    (${[
  quote(row.externalId), quote(row.personExternalId), quote(row.party), quote(row.canonicalParty),
  row.partyNo, row.candidateNo, quote(row.name), quote(row.gender), quote(row.birthDate),
  quote(row.birthRaw), row.elected ? 'TRUE' : 'FALSE',
].join(', ')})`).join(',\n');
const resultValues = resultRows.map((row) => `    (${[
  row.partyNo, quote(row.party), quote(row.canonicalParty), row.voteCount, row.allocatedSeats,
].join(', ')})`).join(',\n');

const migration = `-- Add the complete 2020 party-list race from the official CEC result data,
-- elected report, and election bulletin. Historical results do not imply current office.
BEGIN;

CREATE TEMP TABLE _party_list_2020_results (
  party_no INTEGER PRIMARY KEY,
  party TEXT NOT NULL UNIQUE,
  canonical_party TEXT NOT NULL UNIQUE,
  vote_count BIGINT NOT NULL,
  allocated_seats INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO _party_list_2020_results VALUES
${resultValues};

CREATE TEMP TABLE _party_list_2020_roster (
  external_id TEXT PRIMARY KEY,
  person_external_id TEXT NOT NULL UNIQUE,
  party TEXT NOT NULL,
  canonical_party TEXT NOT NULL,
  party_no INTEGER NOT NULL,
  candidate_no INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  birth_date DATE,
  birth_raw TEXT,
  elected BOOLEAN NOT NULL,
  UNIQUE (party, candidate_no)
) ON COMMIT DROP;

INSERT INTO _party_list_2020_roster VALUES
${rosterValues};

DO $$
DECLARE
  result_count INTEGER; roster_count INTEGER; party_count INTEGER;
  vote_total BIGINT; seat_total INTEGER; elected_count INTEGER;
  female_count INTEGER; male_count INTEGER;
  elected_female_count INTEGER; elected_male_count INTEGER;
BEGIN
  SELECT COUNT(*), SUM(vote_count), SUM(allocated_seats)
  INTO result_count, vote_total, seat_total FROM _party_list_2020_results;
  SELECT COUNT(*), COUNT(DISTINCT party), COUNT(*) FILTER (WHERE elected),
         COUNT(*) FILTER (WHERE gender = 'female'), COUNT(*) FILTER (WHERE gender = 'male'),
         COUNT(*) FILTER (WHERE elected AND gender = 'female'),
         COUNT(*) FILTER (WHERE elected AND gender = 'male')
  INTO roster_count, party_count, elected_count, female_count, male_count,
       elected_female_count, elected_male_count
  FROM _party_list_2020_roster;
  IF result_count <> 19 OR roster_count <> 216 OR party_count <> 19
     OR vote_total <> 14160138 OR seat_total <> 34 OR elected_count <> 34
     OR female_count <> 109 OR male_count <> 107
     OR elected_female_count <> 19 OR elected_male_count <> 15 THEN
    RAISE EXCEPTION 'Unexpected CEC 2020 party-list data: results %, roster %, parties %, votes %, seats %, elected %, female %, male %, elected female %, elected male %',
      result_count, roster_count, party_count, vote_total, seat_total, elected_count,
      female_count, male_count, elected_female_count, elected_male_count;
  END IF;
END;
$$;

DO $$
DECLARE missing_parties TEXT;
BEGIN
  SELECT STRING_AGG(result.canonical_party, ', ' ORDER BY result.party_no)
  INTO missing_parties
  FROM _party_list_2020_results result
  LEFT JOIN public.parties party
    ON REPLACE(party.name, '臺', '台') = result.canonical_party
  WHERE party.id IS NULL;
  IF missing_parties IS NOT NULL THEN
    RAISE EXCEPTION 'Missing canonical party rows: %', missing_parties;
  END IF;
END;
$$;

INSERT INTO public.races (
  id, election_id, region_id, race_type, title, voting_date, status,
  source_name, source_url, is_public, external_id, district_scope, seat_count
)
SELECT
  '${raceId}'::UUID,
  election.id,
  region.id,
  'party_list_legislator',
  '全國不分區及僑居國外國民立法委員選舉',
  DATE '2020-01-11',
  'completed',
  '中央選舉委員會：第10屆全國不分區及僑居國外國民立法委員選舉公報',
  '${bulletinUrl}',
  TRUE,
  'cec-2020-legislative-party-list',
  '全國不分區及僑居國外國民',
  34
FROM public.elections election
CROSS JOIN public.regions region
WHERE election.external_id = 'votetw-election-2020-1654535a43'
  AND region.external_id = 'tw'
ON CONFLICT (external_id) DO UPDATE SET
  election_id = EXCLUDED.election_id,
  region_id = EXCLUDED.region_id,
  race_type = EXCLUDED.race_type,
  title = EXCLUDED.title,
  voting_date = EXCLUDED.voting_date,
  status = EXCLUDED.status,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  is_public = TRUE,
  district_scope = EXCLUDED.district_scope,
  seat_count = EXCLUDED.seat_count,
  updated_at = NOW();

CREATE TEMP TABLE _party_list_2020_people (
  external_id TEXT PRIMARY KEY,
  person_id UUID NOT NULL
) ON COMMIT DROP;

WITH matches AS (
  SELECT roster.external_id, person_map.canonical_person_id AS person_id, 1 AS priority
  FROM _party_list_2020_roster roster
  JOIN public.candidates candidate ON candidate.external_id = roster.external_id
  JOIN public.person_canonical_map person_map ON person_map.person_id = candidate.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 2
  FROM _party_list_2020_roster roster
  JOIN public.person_claims claim
    ON claim.claim_type = 'external_id'
   AND COALESCE(claim.claim_value, claim.claim_json->>'officialExternalId') = roster.external_id
   AND claim.review_status = 'verified'
  JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
  UNION
  SELECT roster.external_id, person_map.canonical_person_id, 3
  FROM _party_list_2020_roster roster
  JOIN public.people person
    ON REGEXP_REPLACE(REPLACE(person.name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
     = REGEXP_REPLACE(REPLACE(roster.person_name, '臺', '台'), '[[:space:]．・‧·]', '', 'g')
   AND REPLACE(COALESCE(person.party, ''), '臺', '台') IN (roster.party, roster.canonical_party)
  JOIN public.person_canonical_map person_map ON person_map.person_id = person.id
), deduplicated AS (
  SELECT DISTINCT external_id, person_id, priority FROM matches
), ranked AS (
  SELECT match.*, MIN(priority) OVER (PARTITION BY external_id) AS best_priority
  FROM deduplicated match
)
INSERT INTO _party_list_2020_people
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
  roster.person_name, roster.party, '2020年第10屆不分區立法委員候選人',
  2020, '全國不分區及僑居國外國民', '${bulletinUrl}',
  TRUE, roster.person_external_id, roster.gender, NOW()
FROM _party_list_2020_roster roster
LEFT JOIN _party_list_2020_people resolved USING (external_id)
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

INSERT INTO _party_list_2020_people
SELECT roster.external_id, person.id
FROM _party_list_2020_roster roster
JOIN public.people person ON person.external_id = roster.person_external_id
ON CONFLICT (external_id) DO NOTHING;

DO $$
DECLARE resolved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO resolved_count FROM _party_list_2020_people;
  IF resolved_count <> 216 THEN
    RAISE EXCEPTION 'Expected 216 resolved identities, found %', resolved_count;
  END IF;
END;
$$;

UPDATE public.people person SET
  is_public = TRUE,
  gender = CASE WHEN person.gender = 'unknown' THEN roster.gender ELSE person.gender END,
  source_url = COALESCE(person.source_url, '${bulletinUrl}'),
  updated_at = NOW()
FROM _party_list_2020_roster roster
JOIN _party_list_2020_people resolved USING (external_id)
WHERE person.id = resolved.person_id;

UPDATE public.candidates candidate SET
  party = roster.party,
  candidate_no = roster.candidate_no::TEXT,
  registration_status = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  source_name = '中央選舉委員會：第10屆全國不分區及僑居國外國民立法委員選舉公報',
  source_url = '${bulletinUrl}',
  is_public = TRUE,
  external_id = roster.external_id,
  is_elected = roster.elected,
  candidacy_status = 'qualified',
  election_result = CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  status_updated_at = NOW(),
  updated_at = NOW()
FROM _party_list_2020_roster roster
JOIN _party_list_2020_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2020-legislative-party-list'
WHERE candidate.race_id = race.id AND candidate.person_id = resolved.person_id;

INSERT INTO public.candidates (
  person_id, race_id, party, candidate_no, registration_status,
  source_name, source_url, is_public, external_id, is_elected,
  candidacy_status, election_result, status_updated_at
)
SELECT
  resolved.person_id, race.id, roster.party, roster.candidate_no::TEXT,
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END,
  '中央選舉委員會：第10屆全國不分區及僑居國外國民立法委員選舉公報',
  '${bulletinUrl}', TRUE, roster.external_id, roster.elected, 'qualified',
  CASE WHEN roster.elected THEN 'elected' ELSE 'not_elected' END, NOW()
FROM _party_list_2020_roster roster
JOIN _party_list_2020_people resolved USING (external_id)
JOIN public.races race ON race.external_id = 'cec-2020-legislative-party-list'
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

INSERT INTO public.party_list_race_results (
  race_id, party_id, party_ballot_number, party_name_at_election,
  candidate_party_name, vote_count, allocated_seats, source_name,
  source_url, platform_source_url, is_public
)
SELECT
  race.id, party.id, result.party_no, result.party, result.canonical_party,
  result.vote_count, result.allocated_seats, '中央選舉委員會選舉資料庫',
  '${resultSourceUrl}', '${bulletinUrl}', TRUE
FROM _party_list_2020_results result
JOIN public.races race ON race.external_id = 'cec-2020-legislative-party-list'
JOIN public.parties party ON REPLACE(party.name, '臺', '台') = result.canonical_party
ON CONFLICT (race_id, party_id) DO UPDATE SET
  party_ballot_number = EXCLUDED.party_ballot_number,
  party_name_at_election = EXCLUDED.party_name_at_election,
  candidate_party_name = EXCLUDED.candidate_party_name,
  vote_count = EXCLUDED.vote_count,
  allocated_seats = EXCLUDED.allocated_seats,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  platform_source_url = EXCLUDED.platform_source_url,
  is_public = TRUE,
  updated_at = NOW();

DO $$
DECLARE candidate_count INTEGER; elected_count INTEGER;
  result_count INTEGER; vote_total BIGINT; seat_total INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE candidate.is_elected)
  INTO candidate_count, elected_count
  FROM public.candidates candidate
  JOIN public.races race ON race.id = candidate.race_id
  WHERE race.external_id = 'cec-2020-legislative-party-list' AND candidate.is_public;
  SELECT COUNT(*), SUM(result.vote_count), SUM(result.allocated_seats)
  INTO result_count, vote_total, seat_total
  FROM public.party_list_race_results result
  JOIN public.races race ON race.id = result.race_id
  WHERE race.external_id = 'cec-2020-legislative-party-list' AND result.is_public;
  IF candidate_count <> 216 OR elected_count <> 34 OR result_count <> 19
     OR vote_total <> 14160138 OR seat_total <> 34 THEN
    RAISE EXCEPTION 'Unexpected stored 2020 party-list result: candidates %, elected %, parties %, votes %, seats %',
      candidate_count, elected_count, result_count, vote_total, seat_total;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM _party_list_2020_results source
    LEFT JOIN public.candidates candidate
      ON candidate.race_id = (
        SELECT race.id FROM public.races race
        WHERE race.external_id = 'cec-2020-legislative-party-list'
      )
     AND candidate.party = source.canonical_party
     AND candidate.is_public
    GROUP BY source.party, source.canonical_party
    HAVING COUNT(candidate.id) <> (
      SELECT COUNT(*) FROM _party_list_2020_roster roster
      WHERE roster.party = source.party
    )
  ) THEN
    RAISE EXCEPTION 'At least one 2020 party-list result is not linked to its complete roster';
  END IF;
END;
$$;

SELECT published.promote(NULL);

DO $$
DECLARE published_count INTEGER; published_elected_count INTEGER;
  payload JSONB;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE candidate.is_elected)
  INTO published_count, published_elected_count
  FROM published.candidates candidate
  WHERE candidate.race_id = '${raceId}'::UUID;
  SELECT page.payload INTO payload
  FROM published.party_list_race_page_for('${raceId}'::UUID) page;
  IF published_count <> 216 OR published_elected_count <> 34 THEN
    RAISE EXCEPTION 'Unexpected published 2020 party-list candidates: candidates %, elected %',
      published_count, published_elected_count;
  END IF;
  IF JSONB_ARRAY_LENGTH(COALESCE(payload->'party_list_result_rows', '[]'::JSONB)) <> 19
     OR JSONB_ARRAY_LENGTH(COALESCE(payload->'candidate_rows', '[]'::JSONB)) <> 216 THEN
    RAISE EXCEPTION 'Unexpected 2020 party-list page payload counts';
  END IF;
END;
$$;

COMMIT;
`;

fs.writeFileSync(path.resolve(root, outputPath), migration);
console.log(JSON.stringify({
  outputPath,
  raceId,
  parties: resultRows.length,
  candidates: rosterRows.length,
  votes: voteTotal,
  seats: seatTotal,
  femaleCandidates: femaleCount,
  maleCandidates: maleCount,
  electedFemale: electedFemaleCount,
  electedMale: electedMaleCount,
}, null, 2));
