BEGIN;

-- Publish the two official 2002 councilor cycles only after the historical
-- boundaries, identity decisions and complete CEC vote results are in place.
DO $$
DECLARE
    county_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f');
    metropolitan_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5');
    county_race_count INTEGER;
    county_candidate_count INTEGER;
    county_region_count INTEGER;
    metropolitan_race_count INTEGER;
    metropolitan_candidate_count INTEGER;
    metropolitan_region_count INTEGER;
    canonical_person_count INTEGER;
    incomplete_candidate_count INTEGER;
    missing_vote_count INTEGER;
    invalid_race_count INTEGER;
    leading_zero_title_count INTEGER;
    same_race_collision_count INTEGER;
    unresolved_review_count INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = county_election_id
          AND name = '2002年縣市議員選舉'
          AND year = 2002
          AND election_type = 'councilor'
          AND voting_date = DATE '2002-01-26'
          AND status = 'completed'
          AND is_public = FALSE
    ) OR NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = metropolitan_election_id
          AND name = '2002年直轄市議員選舉'
          AND year = 2002
          AND election_type = 'councilor'
          AND voting_date = DATE '2002-12-07'
          AND status = 'completed'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Expected private 2002 councilor elections were not found';
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
        COUNT(*) FILTER (
            WHERE candidate.vote_count IS NULL
               OR candidate.vote_rate IS NULL
        )
    INTO incomplete_candidate_count, missing_vote_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id IN (county_election_id, metropolitan_election_id);

    SELECT COUNT(*)
    INTO invalid_race_count
    FROM races race
    JOIN regions region ON region.id = race.region_id
    WHERE race.election_id IN (county_election_id, metropolitan_election_id)
      AND (
          race.status <> 'completed'
          OR race.voting_date IS DISTINCT FROM CASE
              WHEN race.election_id = county_election_id THEN DATE '2002-01-26'
              ELSE DATE '2002-12-07'
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

    IF county_race_count <> 195
       OR county_candidate_count <> 2058
       OR county_region_count <> 23
       OR metropolitan_race_count <> 13
       OR metropolitan_candidate_count <> 228
       OR metropolitan_region_count <> 2
       OR canonical_person_count <> 2286 THEN
        RAISE EXCEPTION
            'Unexpected 2002 scope: county races %, candidates %, regions %; metropolitan races %, candidates %, regions %; canonical people %',
            county_race_count,
            county_candidate_count,
            county_region_count,
            metropolitan_race_count,
            metropolitan_candidate_count,
            metropolitan_region_count,
            canonical_person_count;
    END IF;

    IF incomplete_candidate_count <> 0
       OR missing_vote_count <> 0
       OR invalid_race_count <> 0
       OR leading_zero_title_count <> 0
       OR same_race_collision_count <> 0
       OR unresolved_review_count <> 0 THEN
        RAISE EXCEPTION
            '2002 publication checks failed: incomplete %, missing votes %, invalid races %, leading zeros %, collisions %, unresolved reviews %',
            incomplete_candidate_count,
            missing_vote_count,
            invalid_race_count,
            leading_zero_title_count,
            same_race_collision_count,
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
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
      )
  );

UPDATE elections
SET is_public = TRUE,
    updated_at = NOW()
WHERE id IN (
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
);

UPDATE races
SET is_public = TRUE,
    updated_at = NOW()
WHERE election_id IN (
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
    (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
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
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
          (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
      )
  );

UPDATE candidates candidate
SET is_public = TRUE,
    updated_at = NOW()
FROM races race
WHERE race.id = candidate.race_id
  AND race.election_id IN (
      (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
      (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
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
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
    )
      AND is_public = TRUE;

    SELECT COUNT(*)
    INTO public_race_count
    FROM races
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
    )
      AND is_public = TRUE;

    SELECT COUNT(*)
    INTO public_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
    )
      AND candidate.is_public = TRUE;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO public_canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    JOIN people person ON person.id = canonical.canonical_person_id
    WHERE race.election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
    )
      AND person.is_public = TRUE;

    SELECT COUNT(*)
    INTO published_election_count
    FROM published.elections
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
    );

    SELECT COUNT(*)
    INTO published_race_count
    FROM published.races
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
    );

    SELECT COUNT(*)
    INTO published_candidate_count
    FROM published.candidate_facts
    WHERE election_id IN (
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-64eb47f415a89d1f'),
        (SELECT id FROM elections WHERE external_id = 'cec-historical-election-2de835db0c8749b5')
    );

    IF public_election_count <> 2
       OR public_race_count <> 208
       OR public_candidate_count <> 2286
       OR public_canonical_person_count <> 2286
       OR published_election_count <> 2
       OR published_race_count <> 208
       OR published_candidate_count <> 2286 THEN
        RAISE EXCEPTION
            '2002 publication validation failed: core elections %, races %, candidates %, people %; published elections %, races %, candidates %',
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
