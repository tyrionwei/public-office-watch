BEGIN;

-- The CEC archive groups both 2002 councilor cycles under the same year, but
-- county/city councils voted on January 26 while Taipei and Kaohsiung voted on
-- December 7. Keep the existing event for the larger county/city batch and move
-- the two direct municipalities to a separate canonical event.
DO $$
DECLARE
    combined_election_id CONSTANT UUID := '01759619-59f6-450c-8e37-f67a071af5d4';
    metropolitan_election_id CONSTANT UUID := 'ba3d366d-b4c7-4e95-931a-93a82e693915';
    total_races INTEGER;
    total_candidates INTEGER;
    metropolitan_races INTEGER;
    metropolitan_candidates INTEGER;
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

    SELECT COUNT(*)
    INTO metropolitan_races
    FROM races
    WHERE election_id = combined_election_id
      AND region_id IN (
          'b1d8ccd1-1efe-4f73-9261-7320ed715a9f',
          '7b181cb2-9e4f-4334-984b-fd5430555c77'
      );

    SELECT COUNT(*)
    INTO metropolitan_candidates
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = combined_election_id
      AND race.region_id IN (
          'b1d8ccd1-1efe-4f73-9261-7320ed715a9f',
          '7b181cb2-9e4f-4334-984b-fd5430555c77'
      );

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = combined_election_id
          AND external_id = 'cec-historical-election-64eb47f415a89d1f'
          AND name = '2002年直轄市及縣市議員選舉'
          AND year = 2002
          AND election_type = 'councilor'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Expected private combined 2002 councilor event was not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM elections
        WHERE id = metropolitan_election_id
           OR external_id = 'cec-historical-election-2de835db0c8749b5'
    ) THEN
        RAISE EXCEPTION '2002 metropolitan councilor event already exists before split';
    END IF;

    IF total_races <> 208
       OR total_candidates <> 2286
       OR metropolitan_races <> 13
       OR metropolitan_candidates <> 228 THEN
        RAISE EXCEPTION
            'Unexpected 2002 pre-split scope: races %, candidates %, metropolitan races %, metropolitan candidates %',
            total_races,
            total_candidates,
            metropolitan_races,
            metropolitan_candidates;
    END IF;
END
$$;

INSERT INTO elections (
    id, external_id, name, year, election_type, voting_date, status,
    source_name, source_url, is_public, created_at, updated_at
)
VALUES (
    'ba3d366d-b4c7-4e95-931a-93a82e693915',
    'cec-historical-election-2de835db0c8749b5',
    '2002年直轄市議員選舉',
    2002,
    'councilor',
    DATE '2002-12-07',
    'completed',
    '中央選舉委員會開放資料',
    'https://data.gov.tw/dataset/13119',
    FALSE,
    NOW(),
    NOW()
);

UPDATE elections
SET name = '2002年縣市議員選舉',
    voting_date = DATE '2002-01-26',
    source_name = '中央選舉委員會開放資料',
    source_url = 'https://data.gov.tw/dataset/13119',
    status = 'completed',
    is_public = FALSE,
    updated_at = NOW()
WHERE id = '01759619-59f6-450c-8e37-f67a071af5d4';

-- Keep pre-2010 event names aligned with the same direct-municipality versus
-- county/city scope used by the importer.
UPDATE elections
SET name = CASE id
        WHEN 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac'::UUID THEN '2005年縣市議員選舉'
        WHEN '0851f811-2db9-4e67-ad2b-ea326cbc3157'::UUID THEN '2006年直轄市議員選舉'
        WHEN 'fe57e556-081d-44e9-aaf6-27eae68542dc'::UUID THEN '2009年縣市議員選舉'
    END,
    updated_at = NOW()
WHERE id IN (
    'e7d17ada-fbf6-42db-850b-79f6b9cf72ac',
    '0851f811-2db9-4e67-ad2b-ea326cbc3157',
    'fe57e556-081d-44e9-aaf6-27eae68542dc'
);

UPDATE races
SET region_id = '5b727075-9acc-4a74-b551-5560ff53694b',
    race_type = 'county_councilor',
    title = REGEXP_REPLACE(title, '^桃園市', '桃園縣'),
    updated_at = NOW()
WHERE election_id = '01759619-59f6-450c-8e37-f67a071af5d4'
  AND region_id = '47528594-2fd7-494e-9a25-93aeb8f98169'
  AND title LIKE '桃園市%';

UPDATE races
SET region_id = 'ecc3a0c7-1a30-486b-b75e-911b8cfabd2f',
    updated_at = NOW()
WHERE election_id = '01759619-59f6-450c-8e37-f67a071af5d4'
  AND region_id = 'c65dffcd-df64-4b19-90db-b28bd8c9317c'
  AND title LIKE '臺中市%';

UPDATE races
SET region_id = '1f381fd2-403f-4327-be83-6caa6dff32f7',
    updated_at = NOW()
WHERE election_id = '01759619-59f6-450c-8e37-f67a071af5d4'
  AND region_id = '042cf107-62f0-426b-bcdc-44900eb1e6ca'
  AND title LIKE '臺南市%';

UPDATE races
SET region_id = '797b1f94-cdab-4756-946e-2e100ab4965d',
    updated_at = NOW()
WHERE election_id = '01759619-59f6-450c-8e37-f67a071af5d4'
  AND region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77'
  AND title LIKE '高雄市%';

UPDATE races
SET election_id = 'ba3d366d-b4c7-4e95-931a-93a82e693915',
    voting_date = DATE '2002-12-07',
    is_public = FALSE,
    updated_at = NOW()
WHERE election_id = '01759619-59f6-450c-8e37-f67a071af5d4'
  AND region_id IN (
      'b1d8ccd1-1efe-4f73-9261-7320ed715a9f',
      '797b1f94-cdab-4756-946e-2e100ab4965d'
  );

UPDATE races
SET voting_date = DATE '2002-01-26',
    is_public = FALSE,
    updated_at = NOW()
WHERE election_id = '01759619-59f6-450c-8e37-f67a071af5d4';

DO $$
DECLARE
    county_races INTEGER;
    county_candidates INTEGER;
    county_regions INTEGER;
    metropolitan_races INTEGER;
    metropolitan_candidates INTEGER;
    metropolitan_regions INTEGER;
    invalid_boundary_races INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO county_races, county_regions
    FROM races
    WHERE election_id = '01759619-59f6-450c-8e37-f67a071af5d4';

    SELECT COUNT(*)
    INTO county_candidates
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = '01759619-59f6-450c-8e37-f67a071af5d4';

    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO metropolitan_races, metropolitan_regions
    FROM races
    WHERE election_id = 'ba3d366d-b4c7-4e95-931a-93a82e693915';

    SELECT COUNT(*)
    INTO metropolitan_candidates
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = 'ba3d366d-b4c7-4e95-931a-93a82e693915';

    SELECT COUNT(*)
    INTO invalid_boundary_races
    FROM races
    WHERE election_id IN (
        '01759619-59f6-450c-8e37-f67a071af5d4',
        'ba3d366d-b4c7-4e95-931a-93a82e693915'
    )
      AND region_id IN (
          '47528594-2fd7-494e-9a25-93aeb8f98169',
          'c65dffcd-df64-4b19-90db-b28bd8c9317c',
          '042cf107-62f0-426b-bcdc-44900eb1e6ca',
          '7b181cb2-9e4f-4334-984b-fd5430555c77'
      );

    IF county_races <> 195
       OR county_candidates <> 2058
       OR county_regions <> 23
       OR metropolitan_races <> 13
       OR metropolitan_candidates <> 228
       OR metropolitan_regions <> 2
       OR invalid_boundary_races <> 0 THEN
        RAISE EXCEPTION
            'Unexpected 2002 split result: county races %, candidates %, regions %; metropolitan races %, candidates %, regions %; invalid boundaries %',
            county_races,
            county_candidates,
            county_regions,
            metropolitan_races,
            metropolitan_candidates,
            metropolitan_regions,
            invalid_boundary_races;
    END IF;
END
$$;

SELECT published.promote(NULL);

COMMIT;
