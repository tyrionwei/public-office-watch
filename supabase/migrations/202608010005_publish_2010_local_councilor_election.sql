BEGIN;

-- Publish the next reconciled historical councilor batch without widening the
-- release to 2009 or earlier elections. Candidate people are resolved through
-- the canonical map so superseded source rows remain private.
DO $$
DECLARE
    target_election_id CONSTANT UUID := '1af4c963-3825-478a-a412-15eed51bdb29';
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
            WHERE race.race_type <> 'city_councilor'
               OR race.status <> 'completed'
               OR region.region_type <> 'municipality'
               OR region.name NOT IN ('新北市', '臺北市', '臺中市', '臺南市', '高雄市')
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

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND year = 2010
          AND election_type = 'councilor'
          AND name = '2010年直轄市及縣市議員選舉'
          AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Expected canonical 2010 councilor election was not found';
    END IF;

    IF target_race_count <> 69
       OR target_candidate_count <> 646
       OR target_canonical_person_count <> 646
       OR target_region_count <> 5
       OR invalid_race_count <> 0 THEN
        RAISE EXCEPTION
            'Unexpected 2010 scope: races %, candidates %, canonical people %, regions %, invalid races %',
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
            '2010 identity or normalization check failed: collisions %, leading-zero titles %, unresolved reviews %',
            same_race_collision_count,
            leading_zero_title_count,
            unresolved_review_count;
    END IF;

    IF incomplete_candidate_count <> 0
       OR missing_vote_count <> 51
       OR non_indigenous_missing_vote_count <> 0 THEN
        RAISE EXCEPTION
            'Unexpected 2010 candidate coverage: incomplete %, missing votes %, non-indigenous missing votes %',
            incomplete_candidate_count,
            missing_vote_count,
            non_indigenous_missing_vote_count;
    END IF;
END
$$;

UPDATE elections
SET
    voting_date = DATE '2010-11-27',
    is_public = TRUE,
    updated_at = NOW()
WHERE id = '1af4c963-3825-478a-a412-15eed51bdb29';

UPDATE races
SET
    voting_date = DATE '2010-11-27',
    is_public = TRUE,
    updated_at = NOW()
WHERE election_id = '1af4c963-3825-478a-a412-15eed51bdb29';

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
      WHERE race.election_id = '1af4c963-3825-478a-a412-15eed51bdb29'
  );

UPDATE candidates candidate
SET
    is_public = TRUE,
    updated_at = NOW()
FROM races race
WHERE race.id = candidate.race_id
  AND race.election_id = '1af4c963-3825-478a-a412-15eed51bdb29';

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

DO $$
DECLARE
    target_election_id CONSTANT UUID := '1af4c963-3825-478a-a412-15eed51bdb29';
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
      AND voting_date = DATE '2010-11-27';

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
          AND voting_date = DATE '2010-11-27'
    ) THEN
        RAISE EXCEPTION '2010 election was not published with the expected date';
    END IF;

    IF public_race_count <> 69
       OR public_candidate_count <> 646
       OR published_candidate_count <> 646
       OR public_canonical_person_count <> 646 THEN
        RAISE EXCEPTION
            '2010 publication validation failed: races %, candidates %, snapshot %, people %',
            public_race_count,
            public_candidate_count,
            published_candidate_count,
            public_canonical_person_count;
    END IF;
END
$$;

COMMIT;
