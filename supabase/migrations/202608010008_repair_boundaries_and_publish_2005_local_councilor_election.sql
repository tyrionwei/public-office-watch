BEGIN;

-- Repair pre-merger jurisdictions with names that overlap modern regions, then
-- publish only the reconciled 2005 county/city councilor batch. The migration
-- intentionally does not widen publication to 2002 or earlier elections.
DO $$
DECLARE
    target_election_id CONSTANT UUID := 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac';
    target_race_count INTEGER;
    target_candidate_count INTEGER;
    target_canonical_person_count INTEGER;
    modern_taoyuan_race_count INTEGER;
    modern_taichung_race_count INTEGER;
    modern_tainan_race_count INTEGER;
    modern_kaohsiung_2006_race_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO target_race_count
    FROM races
    WHERE election_id = target_election_id;

    SELECT COUNT(*)
    INTO target_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO target_canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(*)
    INTO modern_taoyuan_race_count
    FROM races
    WHERE election_id = target_election_id
      AND region_id = '47528594-2fd7-494e-9a25-93aeb8f98169'
      AND race_type = 'city_councilor'
      AND title LIKE '桃園市%';

    SELECT COUNT(*)
    INTO modern_taichung_race_count
    FROM races
    WHERE election_id = target_election_id
      AND region_id = 'c65dffcd-df64-4b19-90db-b28bd8c9317c'
      AND race_type = 'city_councilor'
      AND title LIKE '臺中市%';

    SELECT COUNT(*)
    INTO modern_tainan_race_count
    FROM races
    WHERE election_id = target_election_id
      AND region_id = '042cf107-62f0-426b-bcdc-44900eb1e6ca'
      AND race_type = 'city_councilor'
      AND title LIKE '臺南市%';

    SELECT COUNT(*)
    INTO modern_kaohsiung_2006_race_count
    FROM races
    WHERE election_id = '0851f811-2db9-4e67-ad2b-ea326cbc3157'
      AND region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77'
      AND race_type = 'city_councilor'
      AND title LIKE '高雄市%';

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND year = 2005
          AND election_type = 'councilor'
          AND name = '2005年直轄市及縣市議員選舉'
          AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Expected canonical 2005 councilor election was not found';
    END IF;

    IF target_race_count <> 196
       OR target_candidate_count <> 1689
       OR target_canonical_person_count <> 1689
       OR modern_taoyuan_race_count <> 14
       OR modern_taichung_race_count <> 7
       OR modern_tainan_race_count <> 6
       OR modern_kaohsiung_2006_race_count <> 6 THEN
        RAISE EXCEPTION
            'Unexpected pre-repair scope: 2005 races %, candidates %, canonical people %, modern Taoyuan %, Taichung %, Tainan %, 2006 Kaohsiung %',
            target_race_count,
            target_candidate_count,
            target_canonical_person_count,
            modern_taoyuan_race_count,
            modern_taichung_race_count,
            modern_tainan_race_count,
            modern_kaohsiung_2006_race_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.id = '2919f7d2-32e3-4762-b786-f7a5a3be03c7'
          AND candidate.person_id = '30e565a0-eec6-4561-bc45-de541fc57ed4'
          AND race.title = '嘉義縣第1選舉區議員選舉'
          AND candidate.candidate_no = '2'
          AND candidate.vote_count = 7680
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.id = '4aa4c23c-f6f7-433b-a77d-ea04e345035e'
          AND candidate.person_id = '362fd43a-5384-432f-9f88-1f45c15e9848'
          AND race.title = '基隆市第7選舉區議員選舉'
          AND candidate.candidate_no = '10'
          AND candidate.vote_count = 2071
    ) THEN
        RAISE EXCEPTION 'Expected same-name 2005 楊秀玉 candidates were not found';
    END IF;
END
$$;

INSERT INTO regions (
    id, external_id, name, slug, region_type, parent_region_id,
    official_code, map_code, is_public, updated_at
)
VALUES
    (
        'ecc3a0c7-1a30-486b-b75e-911b8cfabd2f',
        'cec-historical-city-taichung',
        '臺中市',
        'historical-taichung-city',
        'city',
        NULL,
        NULL,
        NULL,
        TRUE,
        NOW()
    ),
    (
        '1f381fd2-403f-4327-be83-6caa6dff32f7',
        'cec-historical-city-tainan',
        '臺南市',
        'historical-tainan-city',
        'city',
        NULL,
        NULL,
        NULL,
        TRUE,
        NOW()
    ),
    (
        '797b1f94-cdab-4756-946e-2e100ab4965d',
        'cec-historical-municipality-kaohsiung',
        '高雄市',
        'historical-kaohsiung-city',
        'municipality',
        NULL,
        NULL,
        NULL,
        TRUE,
        NOW()
    )
ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    region_type = EXCLUDED.region_type,
    parent_region_id = EXCLUDED.parent_region_id,
    official_code = EXCLUDED.official_code,
    map_code = EXCLUDED.map_code,
    is_public = TRUE,
    updated_at = NOW();

UPDATE races
SET
    region_id = '5b727075-9acc-4a74-b551-5560ff53694b',
    race_type = 'county_councilor',
    title = REGEXP_REPLACE(title, '^桃園市', '桃園縣'),
    updated_at = NOW()
WHERE election_id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac'
  AND region_id = '47528594-2fd7-494e-9a25-93aeb8f98169'
  AND title LIKE '桃園市%';

UPDATE races
SET
    region_id = 'ecc3a0c7-1a30-486b-b75e-911b8cfabd2f',
    updated_at = NOW()
WHERE election_id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac'
  AND region_id = 'c65dffcd-df64-4b19-90db-b28bd8c9317c'
  AND title LIKE '臺中市%';

UPDATE races
SET
    region_id = '1f381fd2-403f-4327-be83-6caa6dff32f7',
    updated_at = NOW()
WHERE election_id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac'
  AND region_id = '042cf107-62f0-426b-bcdc-44900eb1e6ca'
  AND title LIKE '臺南市%';

UPDATE races
SET
    region_id = '797b1f94-cdab-4756-946e-2e100ab4965d',
    updated_at = NOW()
WHERE election_id = '0851f811-2db9-4e67-ad2b-ea326cbc3157'
  AND region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77'
  AND title LIKE '高雄市%';

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    '362fd43a-5384-432f-9f88-1f45c15e9848',
    '30e565a0-eec6-4561-bc45-de541fc57ed4',
    'rejected',
    'A',
    'The two 2005 candidates named 楊秀玉 registered in different jurisdictions in the same election and are different people.',
    jsonb_build_object(
        'rule', 'same_election_different_jurisdiction_identity',
        'chiayiCandidateId', '2919f7d2-32e3-4762-b786-f7a5a3be03c7',
        'keelungCandidateId', '4aa4c23c-f6f7-433b-a77d-ea04e345035e',
        'chiayiDistrict', '嘉義縣第1選舉區',
        'keelungDistrict', '基隆市第7選舉區',
        'officialSource', 'https://data.gov.tw/dataset/13119',
        'reviewedDate', '2026-08-01'
    ),
    'codex:official-election-evidence',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.status IN ('verified', 'rejected', 'archived')
      AND (
          (
              existing.duplicate_person_id = '362fd43a-5384-432f-9f88-1f45c15e9848'
              AND existing.canonical_person_id = '30e565a0-eec6-4561-bc45-de541fc57ed4'
          )
          OR (
              existing.duplicate_person_id = '30e565a0-eec6-4561-bc45-de541fc57ed4'
              AND existing.canonical_person_id = '362fd43a-5384-432f-9f88-1f45c15e9848'
          )
      )
);

DO $$
DECLARE
    target_election_id CONSTANT UUID := 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac';
    target_race_count INTEGER;
    target_candidate_count INTEGER;
    target_canonical_person_count INTEGER;
    target_region_count INTEGER;
    invalid_race_count INTEGER;
    same_race_collision_count INTEGER;
    same_name_group_count INTEGER;
    leading_zero_title_count INTEGER;
    incomplete_candidate_count INTEGER;
    missing_vote_count INTEGER;
    non_indigenous_missing_vote_count INTEGER;
    unresolved_review_count INTEGER;
    historical_boundary_race_count INTEGER;
    historical_kaohsiung_2006_race_count INTEGER;
BEGIN
    SELECT
        COUNT(*),
        COUNT(DISTINCT race.region_id),
        COUNT(*) FILTER (
            WHERE race.status <> 'completed'
               OR (
                   region.name LIKE '%縣'
                   AND (
                       region.region_type <> 'county'
                       OR race.race_type <> 'county_councilor'
                   )
               )
               OR (
                   region.name LIKE '%市'
                   AND (
                       region.region_type <> 'city'
                       OR race.race_type <> 'city_councilor'
                   )
               )
        )
    INTO target_race_count, target_region_count, invalid_race_count
    FROM races race
    JOIN regions region ON region.id = race.region_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(*)
    INTO target_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO target_canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(*)
    INTO same_race_collision_count
    FROM (
        SELECT
            race.id,
            canonical.canonical_person_id,
            COALESCE(candidate.candidate_no, '') AS candidate_no
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id = target_election_id
        GROUP BY race.id, canonical.canonical_person_id, COALESCE(candidate.candidate_no, '')
        HAVING COUNT(*) > 1
    ) collision;

    SELECT COUNT(*)
    INTO same_name_group_count
    FROM (
        SELECT person.name
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN people person ON person.id = candidate.person_id
        WHERE race.election_id = target_election_id
        GROUP BY person.name
        HAVING COUNT(*) > 1
    ) duplicate_name;

    SELECT COUNT(*)
    INTO leading_zero_title_count
    FROM races
    WHERE election_id = target_election_id
      AND title ~ '第0[0-9]';

    SELECT
        COUNT(*) FILTER (
            WHERE candidate.candidate_no IS NULL
               OR BTRIM(candidate.candidate_no) = ''
               OR candidate.party IS NULL
               OR BTRIM(candidate.party) = ''
               OR candidate.is_elected IS NULL
               OR candidate.candidacy_status IS NULL
               OR candidate.election_result IS NULL
               OR candidate.registration_status IS NULL
        ),
        COUNT(*) FILTER (WHERE candidate.vote_count IS NULL),
        COUNT(*) FILTER (
            WHERE candidate.vote_count IS NULL
              AND race.title NOT LIKE '%原住民%'
        )
    INTO incomplete_candidate_count, missing_vote_count, non_indigenous_missing_vote_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(*)
    INTO unresolved_review_count
    FROM person_duplicate_review_queue review
    WHERE review.duplicate_person_id IN (
        SELECT candidate.person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE race.election_id = target_election_id
    )
       OR review.canonical_person_id IN (
        SELECT canonical.canonical_person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id = target_election_id
    );

    SELECT COUNT(*)
    INTO historical_boundary_race_count
    FROM races
    WHERE election_id = target_election_id
      AND region_id IN (
          '5b727075-9acc-4a74-b551-5560ff53694b',
          'ecc3a0c7-1a30-486b-b75e-911b8cfabd2f',
          '1f381fd2-403f-4327-be83-6caa6dff32f7'
      );

    SELECT COUNT(*)
    INTO historical_kaohsiung_2006_race_count
    FROM races
    WHERE election_id = '0851f811-2db9-4e67-ad2b-ea326cbc3157'
      AND region_id = '797b1f94-cdab-4756-946e-2e100ab4965d';

    IF target_race_count <> 196
       OR target_candidate_count <> 1689
       OR target_canonical_person_count <> 1689
       OR target_region_count <> 23
       OR invalid_race_count <> 0
       OR historical_boundary_race_count <> 27
       OR historical_kaohsiung_2006_race_count <> 6 THEN
        RAISE EXCEPTION
            'Unexpected repaired scope: races %, candidates %, canonical people %, regions %, invalid %, 2005 historical boundaries %, 2006 historical Kaohsiung %',
            target_race_count,
            target_candidate_count,
            target_canonical_person_count,
            target_region_count,
            invalid_race_count,
            historical_boundary_race_count,
            historical_kaohsiung_2006_race_count;
    END IF;

    IF same_race_collision_count <> 0
       OR same_name_group_count <> 1
       OR leading_zero_title_count <> 0
       OR unresolved_review_count <> 0 THEN
        RAISE EXCEPTION
            '2005 identity or normalization check failed: collisions %, same-name groups %, leading-zero titles %, unresolved reviews %',
            same_race_collision_count,
            same_name_group_count,
            leading_zero_title_count,
            unresolved_review_count;
    END IF;

    IF incomplete_candidate_count <> 0
       OR missing_vote_count <> 131
       OR non_indigenous_missing_vote_count <> 0 THEN
        RAISE EXCEPTION
            'Unexpected 2005 candidate coverage: incomplete %, missing votes %, non-indigenous missing votes %',
            incomplete_candidate_count,
            missing_vote_count,
            non_indigenous_missing_vote_count;
    END IF;
END
$$;

UPDATE regions region
SET
    is_public = TRUE,
    updated_at = NOW()
WHERE region.is_public IS DISTINCT FROM TRUE
  AND region.id IN (
      SELECT DISTINCT race.region_id
      FROM races race
      WHERE race.election_id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac'
  );

UPDATE elections
SET
    voting_date = DATE '2005-12-03',
    is_public = TRUE,
    updated_at = NOW()
WHERE id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac';

UPDATE races
SET
    voting_date = DATE '2005-12-03',
    is_public = TRUE,
    updated_at = NOW()
WHERE election_id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac';

UPDATE people person
SET
    is_public = TRUE,
    updated_at = NOW()
WHERE person.is_public IS DISTINCT FROM TRUE
  AND person.id IN (
      SELECT DISTINCT canonical.canonical_person_id
      FROM candidates candidate
      JOIN races race ON race.id = candidate.race_id
      JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
      WHERE race.election_id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac'
  );

UPDATE candidates candidate
SET
    is_public = TRUE,
    updated_at = NOW()
FROM races race
WHERE race.id = candidate.race_id
  AND race.election_id = 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac';

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

DO $$
DECLARE
    target_election_id CONSTANT UUID := 'e7d17ada-fbf6-42db-850b-79f6b9cf72ac';
    public_race_count INTEGER;
    public_candidate_count INTEGER;
    published_candidate_count INTEGER;
    public_canonical_person_count INTEGER;
    published_kaohsiung_2006_race_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO public_race_count
    FROM races
    WHERE election_id = target_election_id
      AND is_public = TRUE
      AND voting_date = DATE '2005-12-03';

    SELECT COUNT(*)
    INTO public_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id
      AND candidate.is_public = TRUE;

    SELECT COUNT(*)
    INTO published_candidate_count
    FROM published.candidate_facts
    WHERE election_id = target_election_id;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO public_canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    JOIN people person ON person.id = canonical.canonical_person_id
    WHERE race.election_id = target_election_id
      AND person.is_public = TRUE;

    SELECT COUNT(*)
    INTO published_kaohsiung_2006_race_count
    FROM published.races
    WHERE election_id = '0851f811-2db9-4e67-ad2b-ea326cbc3157'
      AND region_id = '797b1f94-cdab-4756-946e-2e100ab4965d';

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND is_public = TRUE
          AND voting_date = DATE '2005-12-03'
    ) THEN
        RAISE EXCEPTION '2005 election was not published with the expected date';
    END IF;

    IF public_race_count <> 196
       OR public_candidate_count <> 1689
       OR published_candidate_count <> 1689
       OR public_canonical_person_count <> 1689
       OR published_kaohsiung_2006_race_count <> 6 THEN
        RAISE EXCEPTION
            '2005 publication validation failed: races %, candidates %, snapshot %, people %, corrected 2006 Kaohsiung %',
            public_race_count,
            public_candidate_count,
            published_candidate_count,
            public_canonical_person_count,
            published_kaohsiung_2006_race_count;
    END IF;
END
$$;

COMMIT;
