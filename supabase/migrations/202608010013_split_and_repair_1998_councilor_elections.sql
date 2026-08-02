SET statement_timeout = 0;

BEGIN;

-- The 1998 CEC source year contains two councilor cycles: county/city councils
-- voted on January 24, while Taipei and Kaohsiung voted on December 5.
DO $$
DECLARE
    combined_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f');
    metropolitan_election_id CONSTANT UUID := '9b9c5fd0-9c92-4814-8696-c64329eeed11';
    total_races INTEGER;
    total_candidates INTEGER;
    metropolitan_races INTEGER;
    metropolitan_candidates INTEGER;
    taoyuan_races INTEGER;
    taoyuan_candidates INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO total_races
    FROM races
    WHERE election_id = combined_election_id;

    SELECT COUNT(*)
    INTO total_candidates
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = combined_election_id;

    SELECT COUNT(*), COALESCE(SUM(candidate_count), 0)
    INTO metropolitan_races, metropolitan_candidates
    FROM (
        SELECT race.id, COUNT(candidate.id) AS candidate_count
        FROM races race
        LEFT JOIN candidates candidate ON candidate.race_id = race.id
        WHERE race.election_id = combined_election_id
          AND race.region_id IN (
              'b1d8ccd1-1efe-4f73-9261-7320ed715a9f',
              '7b181cb2-9e4f-4334-984b-fd5430555c77'
          )
        GROUP BY race.id
    ) metropolitan;

    SELECT COUNT(*), COALESCE(SUM(candidate_count), 0)
    INTO taoyuan_races, taoyuan_candidates
    FROM (
        SELECT race.id, COUNT(candidate.id) AS candidate_count
        FROM races race
        LEFT JOIN candidates candidate ON candidate.race_id = race.id
        WHERE race.election_id = combined_election_id
          AND race.region_id = '47528594-2fd7-494e-9a25-93aeb8f98169'
          AND race.title LIKE '桃園市%'
        GROUP BY race.id
    ) taoyuan;

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = combined_election_id
          AND external_id = 'cec-historical-election-a275bfcd53f64b5f'
          AND name = '1998年直轄市及縣市議員選舉'
          AND year = 1998
          AND election_type = 'councilor'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Expected private combined 1998 councilor event was not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM elections
        WHERE id = metropolitan_election_id
           OR external_id = 'cec-historical-election-c900709a73a7da9f'
    ) THEN
        RAISE EXCEPTION '1998 metropolitan councilor event already exists before split';
    END IF;

    IF total_races <> 207
       OR total_candidates <> 2167
       OR metropolitan_races <> 13
       OR metropolitan_candidates <> 215
       OR taoyuan_races <> 14
       OR taoyuan_candidates <> 168 THEN
        RAISE EXCEPTION
            'Unexpected 1998 pre-split scope: races %, candidates %, metropolitan races %, candidates %, Taoyuan races %, candidates %',
            total_races,
            total_candidates,
            metropolitan_races,
            metropolitan_candidates,
            taoyuan_races,
            taoyuan_candidates;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_identity_matches match
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE match.source_person_id = (
                  SELECT id FROM source_people
                  WHERE source_person_key = 'cec-historical:033fed9cc604'
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
                  WHERE source_person_key = 'cec-historical:033fed9cc604'
              )
          AND match.match_status = 'auto_matched'
          AND canonical.canonical_person_id = (
                  SELECT id FROM people
                  WHERE external_id = 'cec-historical-unresolved-person-b2eb0c3d0dcc'
              )
    ) THEN
        RAISE EXCEPTION 'Expected safe 1998 Taipei 陳淑華 identity state was not found';
    END IF;
END
$$;

INSERT INTO elections (
    id, external_id, name, year, election_type, voting_date, status,
    source_name, source_url, is_public, created_at, updated_at
)
VALUES (
    '9b9c5fd0-9c92-4814-8696-c64329eeed11',
    'cec-historical-election-c900709a73a7da9f',
    '1998年直轄市議員選舉',
    1998,
    'councilor',
    DATE '1998-12-05',
    'completed',
    '中央選舉委員會開放資料',
    'https://data.gov.tw/dataset/13119',
    FALSE,
    NOW(),
    NOW()
);

UPDATE elections
SET name = '1998年縣市議員選舉',
    voting_date = DATE '1998-01-24',
    source_name = '中央選舉委員會開放資料',
    source_url = 'https://data.gov.tw/dataset/13119',
    status = 'completed',
    is_public = FALSE,
    updated_at = NOW()
WHERE id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f');

UPDATE races
SET region_id = '5b727075-9acc-4a74-b551-5560ff53694b',
    race_type = 'county_councilor',
    title = REGEXP_REPLACE(title, '^桃園市', '桃園縣'),
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f')
  AND region_id = '47528594-2fd7-494e-9a25-93aeb8f98169'
  AND title LIKE '桃園市%';

UPDATE races
SET region_id = 'ecc3a0c7-1a30-486b-b75e-911b8cfabd2f',
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f')
  AND region_id = 'c65dffcd-df64-4b19-90db-b28bd8c9317c'
  AND title LIKE '臺中市%';

UPDATE races
SET region_id = '1f381fd2-403f-4327-be83-6caa6dff32f7',
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f')
  AND region_id = '042cf107-62f0-426b-bcdc-44900eb1e6ca'
  AND title LIKE '臺南市%';

UPDATE races
SET region_id = '797b1f94-cdab-4756-946e-2e100ab4965d',
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f')
  AND region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77'
  AND title LIKE '高雄市%';

UPDATE races
SET election_id = '9b9c5fd0-9c92-4814-8696-c64329eeed11',
    voting_date = DATE '1998-12-05',
    is_public = FALSE,
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f')
  AND region_id IN (
      'b1d8ccd1-1efe-4f73-9261-7320ed715a9f',
      '797b1f94-cdab-4756-946e-2e100ab4965d'
  );

UPDATE races
SET voting_date = DATE '1998-01-24',
    is_public = FALSE,
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f');

UPDATE person_identity_matches
SET match_status = 'rejected_match',
    reviewed_by = 'codex:official-election-evidence',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE source_person_id = (
          SELECT id FROM source_people
          WHERE source_person_key = 'cec-historical:033fed9cc604'
      )
  AND person_id = (
          SELECT id FROM people
          WHERE external_id = 'cec-2022-local-councilor-regional-person-55a780888828'
      )
  AND match_status = 'auto_matched';

DO $$
DECLARE
    county_races INTEGER;
    county_candidates INTEGER;
    county_regions INTEGER;
    metropolitan_races INTEGER;
    metropolitan_candidates INTEGER;
    metropolitan_regions INTEGER;
    invalid_boundary_races INTEGER;
    source_identity_conflicts INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO county_races, county_regions
    FROM races
    WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f');

    SELECT COUNT(*)
    INTO county_candidates
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f');

    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO metropolitan_races, metropolitan_regions
    FROM races
    WHERE election_id = '9b9c5fd0-9c92-4814-8696-c64329eeed11';

    SELECT COUNT(*)
    INTO metropolitan_candidates
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = '9b9c5fd0-9c92-4814-8696-c64329eeed11';

    SELECT COUNT(*)
    INTO invalid_boundary_races
    FROM races
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        '9b9c5fd0-9c92-4814-8696-c64329eeed11'
    )
      AND region_id IN (
          '47528594-2fd7-494e-9a25-93aeb8f98169',
          'c65dffcd-df64-4b19-90db-b28bd8c9317c',
          '042cf107-62f0-426b-bcdc-44900eb1e6ca',
          '7b181cb2-9e4f-4334-984b-fd5430555c77'
      );

    SELECT COUNT(*)
    INTO source_identity_conflicts
    FROM (
        SELECT match.source_person_id
        FROM person_identity_matches match
        JOIN source_people source ON source.id = match.source_person_id
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE source.election_year = 1998
          AND source.source_type = 'official_election'
          AND source.source_id = 'cec-2024-votedata'
          AND match.match_status = 'auto_matched'
        GROUP BY match.source_person_id
        HAVING COUNT(DISTINCT canonical.canonical_person_id) <> 1
    ) conflict;

    IF county_races <> 194
       OR county_candidates <> 1952
       OR county_regions <> 23
       OR metropolitan_races <> 13
       OR metropolitan_candidates <> 215
       OR metropolitan_regions <> 2
       OR invalid_boundary_races <> 0
       OR source_identity_conflicts <> 0 THEN
        RAISE EXCEPTION
            'Unexpected 1998 repair result: county races %, candidates %, regions %; metropolitan races %, candidates %, regions %; invalid boundaries %; identity conflicts %',
            county_races,
            county_candidates,
            county_regions,
            metropolitan_races,
            metropolitan_candidates,
            metropolitan_regions,
            invalid_boundary_races,
            source_identity_conflicts;
    END IF;
END
$$;

SELECT published.promote(NULL);

COMMIT;

RESET statement_timeout;
