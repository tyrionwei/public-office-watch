SET statement_timeout = 0;

BEGIN;

DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-6d0a0c3e493c2e47');
    race_count INTEGER;
    candidate_count INTEGER;
    taipei_race_count INTEGER;
    taipei_candidate_count INTEGER;
    kaohsiung_race_count INTEGER;
    kaohsiung_candidate_count INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND external_id = 'cec-historical-election-6d0a0c3e493c2e47'
          AND name = '1994年直轄市及縣市議員選舉'
          AND year = 1994
          AND election_type = 'councilor'
          AND voting_date IS NULL
          AND status = 'completed'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Expected private combined 1994 councilor election was not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM elections
        WHERE external_id = 'cec-historical-election-947547c42d36c8a0'
          AND id <> target_election_id
    ) THEN
        RAISE EXCEPTION 'Canonical 1994 metropolitan election external ID is already in use';
    END IF;

    SELECT COUNT(*)
    INTO race_count
    FROM races
    WHERE races.election_id = target_election_id;

    SELECT COUNT(*)
    INTO candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(DISTINCT race.id), COUNT(candidate.id)
    INTO taipei_race_count, taipei_candidate_count
    FROM races race
    LEFT JOIN candidates candidate ON candidate.race_id = race.id
    WHERE race.election_id = target_election_id
      AND race.region_id = 'b1d8ccd1-1efe-4f73-9261-7320ed715a9f';

    SELECT COUNT(DISTINCT race.id), COUNT(candidate.id)
    INTO kaohsiung_race_count, kaohsiung_candidate_count
    FROM races race
    LEFT JOIN candidates candidate ON candidate.race_id = race.id
    WHERE race.election_id = target_election_id
      AND race.region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77';

    IF race_count <> 14
       OR candidate_count <> 274
       OR taipei_race_count <> 7
       OR taipei_candidate_count <> 145
       OR kaohsiung_race_count <> 7
       OR kaohsiung_candidate_count <> 129 THEN
        RAISE EXCEPTION
            'Unexpected 1994 scope: races %, candidates %, Taipei races %, candidates %, Kaohsiung races %, candidates %',
            race_count,
            candidate_count,
            taipei_race_count,
            taipei_candidate_count,
            kaohsiung_race_count,
            kaohsiung_candidate_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_identity_matches match
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE match.source_person_id = (
                  SELECT id FROM source_people
                  WHERE source_person_key = 'cec-historical:6259249b01bd'
              )
          AND canonical.canonical_person_id = (
                  SELECT id FROM people
                  WHERE external_id = 'cec-2022-local-councilor-regional-person-55a780888828'
              )
          AND match.match_status NOT IN ('auto_matched', 'rejected_match')
    ) OR NOT EXISTS (
        SELECT 1
        FROM person_identity_matches match
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE match.source_person_id = (
                  SELECT id FROM source_people
                  WHERE source_person_key = 'cec-historical:6259249b01bd'
              )
          AND match.match_status = 'auto_matched'
          AND canonical.canonical_person_id = (
                  SELECT id FROM people
                  WHERE external_id = 'cec-historical-unresolved-person-b2eb0c3d0dcc'
              )
    ) THEN
        RAISE EXCEPTION 'Expected safe 1994 Taipei 陳淑華 identity state was not found';
    END IF;
END
$$;

UPDATE elections
SET external_id = 'cec-historical-election-947547c42d36c8a0',
    name = '1994年直轄市議員選舉',
    voting_date = DATE '1994-12-03',
    source_name = '中央選舉委員會開放資料',
    source_url = 'https://data.gov.tw/dataset/13119',
    status = 'completed',
    is_public = FALSE,
    updated_at = NOW()
WHERE id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-6d0a0c3e493c2e47');

UPDATE races
SET region_id = '797b1f94-cdab-4756-946e-2e100ab4965d',
    voting_date = DATE '1994-12-03',
    status = 'completed',
    is_public = FALSE,
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0')
  AND region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77';

UPDATE races
SET voting_date = DATE '1994-12-03',
    status = 'completed',
    is_public = FALSE,
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0');

UPDATE person_identity_matches
SET match_status = 'rejected_match',
    reviewed_by = 'codex:official-election-evidence',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE source_person_id = (
          SELECT id FROM source_people
          WHERE source_person_key = 'cec-historical:6259249b01bd'
      )
  AND person_id = (
          SELECT id FROM people
          WHERE external_id = 'cec-2022-local-councilor-regional-person-55a780888828'
      )
  AND match_status = 'auto_matched';

DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0');
    race_count INTEGER;
    candidate_count INTEGER;
    region_count INTEGER;
    invalid_race_count INTEGER;
    source_identity_conflict_count INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO race_count, region_count
    FROM races
    WHERE races.election_id = target_election_id;

    SELECT COUNT(*)
    INTO candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(*)
    INTO invalid_race_count
    FROM races race
    JOIN regions region ON region.id = race.region_id
    WHERE race.election_id = target_election_id
      AND (
          race.status <> 'completed'
          OR race.voting_date IS DISTINCT FROM DATE '1994-12-03'
          OR race.race_type <> 'city_councilor'
          OR region.region_type <> 'municipality'
          OR race.region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77'
      );

    SELECT COUNT(*)
    INTO source_identity_conflict_count
    FROM (
        SELECT match.source_person_id
        FROM person_identity_matches match
        JOIN source_people source ON source.id = match.source_person_id
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE source.election_year = 1994
          AND source.source_type = 'official_election'
          AND source.source_id = 'cec-2024-votedata'
          AND match.match_status = 'auto_matched'
        GROUP BY match.source_person_id
        HAVING COUNT(DISTINCT canonical.canonical_person_id) <> 1
    ) conflict;

    IF race_count <> 14
       OR candidate_count <> 274
       OR region_count <> 2
       OR invalid_race_count <> 0
       OR source_identity_conflict_count <> 0 THEN
        RAISE EXCEPTION
            '1994 repair checks failed: races %, candidates %, regions %, invalid races %, identity conflicts %',
            race_count,
            candidate_count,
            region_count,
            invalid_race_count,
            source_identity_conflict_count;
    END IF;
END
$$;

SELECT published.promote(NULL);

COMMIT;

RESET statement_timeout;
