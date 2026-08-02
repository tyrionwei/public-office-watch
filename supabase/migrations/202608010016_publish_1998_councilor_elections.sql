BEGIN;

DO $$
DECLARE
    county_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f');
    metropolitan_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f');
    county_race_count INTEGER;
    county_candidate_count INTEGER;
    county_region_count INTEGER;
    metropolitan_race_count INTEGER;
    metropolitan_candidate_count INTEGER;
    metropolitan_region_count INTEGER;
    canonical_person_count INTEGER;
    incomplete_candidate_count INTEGER;
    invalid_race_count INTEGER;
    leading_zero_title_count INTEGER;
    same_race_collision_count INTEGER;
    same_name_pair_count INTEGER;
    unresolved_same_name_pair_count INTEGER;
    unresolved_review_count INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = county_election_id
          AND name = '1998年縣市議員選舉'
          AND year = 1998
          AND election_type = 'councilor'
          AND voting_date = DATE '1998-01-24'
          AND status = 'completed'
          AND is_public = FALSE
    ) OR NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = metropolitan_election_id
          AND name = '1998年直轄市議員選舉'
          AND year = 1998
          AND election_type = 'councilor'
          AND voting_date = DATE '1998-12-05'
          AND status = 'completed'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Expected private 1998 councilor elections were not found';
    END IF;

    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO county_race_count, county_region_count
    FROM races
    WHERE election_id = county_election_id;

    SELECT COUNT(*)
    INTO county_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = county_election_id;

    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO metropolitan_race_count, metropolitan_region_count
    FROM races
    WHERE election_id = metropolitan_election_id;

    SELECT COUNT(*)
    INTO metropolitan_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = metropolitan_election_id;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    WHERE race.election_id IN (county_election_id, metropolitan_election_id);

    SELECT COUNT(*)
    INTO incomplete_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id IN (county_election_id, metropolitan_election_id)
      AND (
          candidate.candidate_no IS NULL
          OR BTRIM(candidate.candidate_no) = ''
          OR candidate.party IS NULL
          OR BTRIM(candidate.party) = ''
          OR candidate.vote_count IS NULL
          OR candidate.vote_rate IS NULL
          OR candidate.is_elected IS NULL
          OR candidate.candidacy_status IS NULL
          OR candidate.election_result IS NULL
          OR candidate.registration_status IS NULL
      );

    SELECT COUNT(*)
    INTO invalid_race_count
    FROM races race
    JOIN regions region ON region.id = race.region_id
    WHERE race.election_id IN (county_election_id, metropolitan_election_id)
      AND (
          race.status <> 'completed'
          OR race.voting_date IS DISTINCT FROM CASE
              WHEN race.election_id = county_election_id THEN DATE '1998-01-24'
              ELSE DATE '1998-12-05'
          END
          OR (
              race.election_id = county_election_id
              AND NOT (
                  (region.region_type = 'county' AND race.race_type = 'county_councilor')
                  OR (region.region_type = 'city' AND race.race_type = 'city_councilor')
              )
          )
          OR (
              race.election_id = metropolitan_election_id
              AND NOT (
                  region.region_type = 'municipality'
                  AND race.race_type = 'city_councilor'
              )
          )
      );

    SELECT COUNT(*)
    INTO leading_zero_title_count
    FROM races
    WHERE election_id IN (county_election_id, metropolitan_election_id)
      AND title ~ '第0[0-9]';

    SELECT COUNT(*)
    INTO same_race_collision_count
    FROM (
        SELECT race.id, canonical.canonical_person_id, COALESCE(candidate.candidate_no, '')
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id IN (county_election_id, metropolitan_election_id)
        GROUP BY race.id, canonical.canonical_person_id, COALESCE(candidate.candidate_no, '')
        HAVING COUNT(*) > 1
    ) collision;

    WITH named_people AS (
        SELECT DISTINCT person.name, canonical.canonical_person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN people person ON person.id = candidate.person_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id IN (county_election_id, metropolitan_election_id)
    ), same_name_pairs AS (
        SELECT left_person.name, left_person.canonical_person_id AS left_person_id,
               right_person.canonical_person_id AS right_person_id
        FROM named_people left_person
        JOIN named_people right_person
          ON right_person.name = left_person.name
         AND right_person.canonical_person_id > left_person.canonical_person_id
    )
    SELECT
        COUNT(*),
        COUNT(*) FILTER (
            WHERE NOT EXISTS (
                SELECT 1
                FROM person_merge_decisions decision
                WHERE decision.status IN ('verified', 'rejected', 'archived')
                  AND (
                      (decision.duplicate_person_id = pair.left_person_id AND decision.canonical_person_id = pair.right_person_id)
                      OR
                      (decision.duplicate_person_id = pair.right_person_id AND decision.canonical_person_id = pair.left_person_id)
                  )
            )
        )
    INTO same_name_pair_count, unresolved_same_name_pair_count
    FROM same_name_pairs pair;

    SELECT COUNT(*)
    INTO unresolved_review_count
    FROM person_duplicate_review_queue review
    WHERE review.duplicate_person_id IN (
        SELECT DISTINCT canonical.canonical_person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id IN (county_election_id, metropolitan_election_id)
    )
       OR review.canonical_person_id IN (
        SELECT DISTINCT canonical.canonical_person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id IN (county_election_id, metropolitan_election_id)
    );

    IF county_race_count <> 194
       OR county_candidate_count <> 1952
       OR county_region_count <> 23
       OR metropolitan_race_count <> 13
       OR metropolitan_candidate_count <> 215
       OR metropolitan_region_count <> 2
       OR canonical_person_count <> 2167 THEN
        RAISE EXCEPTION
            'Unexpected 1998 scope: county races %, candidates %, regions %; metropolitan races %, candidates %, regions %; canonical people %',
            county_race_count,
            county_candidate_count,
            county_region_count,
            metropolitan_race_count,
            metropolitan_candidate_count,
            metropolitan_region_count,
            canonical_person_count;
    END IF;

    IF incomplete_candidate_count <> 0
       OR invalid_race_count <> 0
       OR leading_zero_title_count <> 0
       OR same_race_collision_count <> 0
       OR same_name_pair_count <> 6
       OR unresolved_same_name_pair_count <> 0
       OR unresolved_review_count <> 0 THEN
        RAISE EXCEPTION
            '1998 publication checks failed: incomplete %, invalid races %, leading zeros %, collisions %, same-name pairs %, unresolved pairs %, unresolved reviews %',
            incomplete_candidate_count,
            invalid_race_count,
            leading_zero_title_count,
            same_race_collision_count,
            same_name_pair_count,
            unresolved_same_name_pair_count,
            unresolved_review_count;
    END IF;
END
$$;

UPDATE regions region
SET is_public = TRUE,
    updated_at = NOW()
WHERE region.is_public IS DISTINCT FROM TRUE
  AND region.id IN (
      SELECT DISTINCT race.region_id
      FROM races race
      WHERE race.election_id IN (
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
      )
  );

UPDATE elections
SET is_public = TRUE,
    updated_at = NOW()
WHERE id IN (
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
);

UPDATE races
SET is_public = TRUE,
    updated_at = NOW()
WHERE election_id IN (
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
);

UPDATE people person
SET is_public = TRUE,
    updated_at = NOW()
WHERE person.is_public IS DISTINCT FROM TRUE
  AND person.id IN (
      SELECT DISTINCT canonical.canonical_person_id
      FROM candidates candidate
      JOIN races race ON race.id = candidate.race_id
      JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
      WHERE race.election_id IN (
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
      )
  );

UPDATE candidates candidate
SET is_public = TRUE,
    updated_at = NOW()
FROM races race
WHERE race.id = candidate.race_id
  AND race.election_id IN (
      (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
      (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
  );

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

DO $$
DECLARE
    public_election_count INTEGER;
    public_race_count INTEGER;
    public_candidate_count INTEGER;
    public_canonical_person_count INTEGER;
    published_election_count INTEGER;
    published_race_count INTEGER;
    published_candidate_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO public_election_count
    FROM elections
    WHERE id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
    )
      AND is_public = TRUE;

    SELECT COUNT(*)
    INTO public_race_count
    FROM races
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
    )
      AND is_public = TRUE;

    SELECT COUNT(*)
    INTO public_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
    )
      AND candidate.is_public = TRUE;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO public_canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    JOIN people person ON person.id = canonical.canonical_person_id
    WHERE race.election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
    )
      AND person.is_public = TRUE;

    SELECT COUNT(*)
    INTO published_election_count
    FROM published.elections
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
    );

    SELECT COUNT(*)
    INTO published_race_count
    FROM published.races
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
    );

    SELECT COUNT(*)
    INTO published_candidate_count
    FROM published.candidate_facts
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
    );

    IF public_election_count <> 2
       OR public_race_count <> 207
       OR public_candidate_count <> 2167
       OR public_canonical_person_count <> 2167
       OR published_election_count <> 2
       OR published_race_count <> 207
       OR published_candidate_count <> 2167 THEN
        RAISE EXCEPTION
            '1998 publication validation failed: core elections %, races %, candidates %, people %; published elections %, races %, candidates %',
            public_election_count,
            public_race_count,
            public_candidate_count,
            public_canonical_person_count,
            published_election_count,
            published_race_count,
            published_candidate_count;
    END IF;
END
$$;

COMMIT;
