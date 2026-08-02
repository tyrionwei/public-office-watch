BEGIN;

-- Repair two verified 2009 identity/geography issues before publishing this
-- batch. The migration intentionally does not widen publication to 2006 or
-- earlier elections.
DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b');
    target_race_count INTEGER;
    target_candidate_count INTEGER;
    target_canonical_person_count INTEGER;
    taoyuan_modern_race_count INTEGER;
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
    INTO taoyuan_modern_race_count
    FROM races race
    WHERE race.election_id = target_election_id
      AND race.region_id = '47528594-2fd7-494e-9a25-93aeb8f98169'
      AND race.race_type = 'city_councilor'
      AND race.title LIKE '桃園市%';

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND year = 2009
          AND election_type = 'councilor'
          AND name = '2009年直轄市及縣市議員選舉'
          AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Expected canonical 2009 councilor election was not found';
    END IF;

    IF target_race_count <> 144
       OR target_candidate_count <> 935
       OR target_canonical_person_count <> 934
       OR taoyuan_modern_race_count <> 14 THEN
        RAISE EXCEPTION
            'Unexpected pre-repair 2009 scope: races %, candidates %, canonical people %, modern Taoyuan races %',
            target_race_count,
            target_candidate_count,
            target_canonical_person_count,
            taoyuan_modern_race_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.external_id = 'cec-historical-candidate-af0b114381467bdc'
          AND race.title = '屏東縣第3選舉區議員選舉'
          AND candidate.candidate_no = '2'
          AND candidate.vote_count = 463
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.external_id = 'cec-historical-candidate-cf4b16a5fe5506b2'
          AND race.title = '屏東縣第11選舉區山地原住民議員選舉'
          AND candidate.candidate_no = '1'
          AND candidate.is_elected = TRUE
    ) THEN
        RAISE EXCEPTION 'Expected same-name 2009 潘政治 collision was not found';
    END IF;
END
$$;

INSERT INTO regions (
    id, external_id, name, slug, region_type, parent_region_id,
    official_code, map_code, is_public, updated_at
)
VALUES (
    '5b727075-9acc-4a74-b551-5560ff53694b',
    'cec-historical-county-taoyuan',
    '桃園縣',
    'historical-taoyuan-county',
    'county',
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
    region_id = (
        SELECT id
        FROM regions
        WHERE external_id = 'cec-historical-county-taoyuan'
    ),
    race_type = 'county_councilor',
    title = REGEXP_REPLACE(title, '^桃園市', '桃園縣'),
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b')
  AND region_id = '47528594-2fd7-494e-9a25-93aeb8f98169'
  AND title LIKE '桃園市%';

INSERT INTO people (
    id, name, party, position, election_year, district, source_url,
    is_public, external_id, gender, updated_at
)
VALUES (
    'd76944cb-9674-45e4-a4d3-97033d5ae82f',
    '潘政治',
    '民主進步黨',
    '屏東縣議員候選人',
    2009,
    '屏東縣第3選舉區',
    'https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg015243/ch02/type3/gov15/num4/OEg.pdf',
    TRUE,
    'cec-historical-person-pan-cheng-chih-pingtung-2009-d3',
    'male',
    NOW()
)
ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    party = EXCLUDED.party,
    position = EXCLUDED.position,
    election_year = EXCLUDED.election_year,
    district = EXCLUDED.district,
    source_url = EXCLUDED.source_url,
    is_public = TRUE,
    gender = EXCLUDED.gender,
    updated_at = NOW();

UPDATE candidates
SET
    person_id = (
        SELECT id
        FROM people
        WHERE external_id = 'cec-historical-person-pan-cheng-chih-pingtung-2009-d3'
    ),
    party = '民主進步黨',
    source_name = '中央選舉委員會公告',
    source_url = 'https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg015243/ch02/type3/gov15/num4/OEg.pdf',
    updated_at = NOW()
WHERE external_id = 'cec-historical-candidate-af0b114381467bdc';

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    (SELECT id FROM people WHERE external_id = 'cec-historical-person-pan-cheng-chih-pingtung-2009-d3'),
    (SELECT person_id FROM candidates WHERE external_id = 'cec-historical-candidate-cf4b16a5fe5506b2'),
    'rejected',
    'A',
    'The two 2009 Pingtung candidates named 潘政治 registered in different constituencies in the same election and are different people.',
    jsonb_build_object(
        'rule', 'same_election_different_candidate_identity',
        'regionalCandidateId', '87f1d222-099e-429b-9ee7-fcd082dfeea3',
        'indigenousCandidateId', '8ce5f865-db13-4199-9d61-0ebc51a8de99',
        'regionalDistrict', '屏東縣第3選舉區',
        'indigenousDistrict', '屏東縣第11選舉區山地原住民',
        'regionalParty', '民主進步黨',
        'indigenousParty', '無黨籍',
        'officialEvidence', 'https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg015243/ch02/type3/gov15/num4/OEg.pdf',
        'reviewedDate', '2026-08-01'
    ),
    'codex:official-election-evidence',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-person-pan-cheng-chih-pingtung-2009-d3')
      AND existing.canonical_person_id = (SELECT person_id FROM candidates WHERE external_id = 'cec-historical-candidate-cf4b16a5fe5506b2')
      AND existing.status = 'rejected'
);

DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b');
    target_race_count INTEGER;
    target_candidate_count INTEGER;
    target_canonical_person_count INTEGER;
    target_region_count INTEGER;
    invalid_race_count INTEGER;
    same_race_collision_count INTEGER;
    leading_zero_title_count INTEGER;
    incomplete_candidate_count INTEGER;
    missing_vote_count INTEGER;
    non_indigenous_missing_vote_count INTEGER;
    unresolved_review_count INTEGER;
BEGIN
    SELECT
        COUNT(*),
        COUNT(DISTINCT race.region_id),
        COUNT(*) FILTER (
            WHERE race.status <> 'completed'
               OR region.name = '桃園市'
               OR (
                   region.name = '桃園縣'
                   AND (
                       region.region_type <> 'county'
                       OR race.race_type <> 'county_councilor'
                       OR race.title NOT LIKE '桃園縣%'
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

    IF target_race_count <> 144
       OR target_candidate_count <> 935
       OR target_canonical_person_count <> 935
       OR target_region_count <> 17
       OR invalid_race_count <> 0 THEN
        RAISE EXCEPTION
            'Unexpected repaired 2009 scope: races %, candidates %, canonical people %, regions %, invalid races %',
            target_race_count,
            target_candidate_count,
            target_canonical_person_count,
            target_region_count,
            invalid_race_count;
    END IF;

    IF same_race_collision_count <> 0
       OR leading_zero_title_count <> 0
       OR unresolved_review_count <> 0 THEN
        RAISE EXCEPTION
            '2009 identity or normalization check failed: collisions %, leading-zero titles %, unresolved reviews %',
            same_race_collision_count,
            leading_zero_title_count,
            unresolved_review_count;
    END IF;

    IF incomplete_candidate_count <> 0
       OR missing_vote_count <> 97
       OR non_indigenous_missing_vote_count <> 0 THEN
        RAISE EXCEPTION
            'Unexpected 2009 candidate coverage: incomplete %, missing votes %, non-indigenous missing votes %',
            incomplete_candidate_count,
            missing_vote_count,
            non_indigenous_missing_vote_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        WHERE candidate.external_id = 'cec-historical-candidate-af0b114381467bdc'
          AND candidate.person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-person-pan-cheng-chih-pingtung-2009-d3')
          AND candidate.party = '民主進步黨'
    ) THEN
        RAISE EXCEPTION 'Regional 2009 潘政治 candidate was not split and corrected';
    END IF;
END
$$;

UPDATE elections
SET
    voting_date = DATE '2009-12-05',
    is_public = TRUE,
    updated_at = NOW()
WHERE id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b');

UPDATE races
SET
    voting_date = DATE '2009-12-05',
    is_public = TRUE,
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b');

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
      WHERE race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b')
  );

UPDATE candidates candidate
SET
    is_public = TRUE,
    updated_at = NOW()
FROM races race
WHERE race.id = candidate.race_id
  AND race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b');

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-ab20845d085c445b');
    public_race_count INTEGER;
    public_candidate_count INTEGER;
    published_candidate_count INTEGER;
    public_canonical_person_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO public_race_count
    FROM races
    WHERE election_id = target_election_id
      AND is_public = TRUE
      AND voting_date = DATE '2009-12-05';

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

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND is_public = TRUE
          AND voting_date = DATE '2009-12-05'
    ) THEN
        RAISE EXCEPTION '2009 election was not published with the expected date';
    END IF;

    IF public_race_count <> 144
       OR public_candidate_count <> 935
       OR published_candidate_count <> 935
       OR public_canonical_person_count <> 935 THEN
        RAISE EXCEPTION
            '2009 publication validation failed: races %, candidates %, snapshot %, people %',
            public_race_count,
            public_candidate_count,
            published_candidate_count,
            public_canonical_person_count;
    END IF;
END
$$;

COMMIT;
