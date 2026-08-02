SET statement_timeout = 0;

BEGIN;

DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0');
    race_count INTEGER;
    candidate_count INTEGER;
    region_count INTEGER;
    canonical_person_count INTEGER;
    incomplete_candidate_count INTEGER;
    invalid_race_count INTEGER;
    leading_zero_title_count INTEGER;
    same_race_collision_count INTEGER;
    same_name_pair_count INTEGER;
    unresolved_review_count INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND external_id = 'cec-historical-election-947547c42d36c8a0'
          AND name = '1994年直轄市議員選舉'
          AND year = 1994
          AND election_type = 'councilor'
          AND voting_date = DATE '1994-12-03'
          AND status = 'completed'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Expected repaired private 1994 metropolitan councilor election was not found';
    END IF;

    SELECT COUNT(*), COUNT(DISTINCT region_id)
    INTO race_count, region_count
    FROM races
    WHERE races.election_id = target_election_id;

    SELECT COUNT(*)
    INTO candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    WHERE race.election_id = target_election_id;

    SELECT COUNT(*)
    INTO incomplete_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id
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
    WHERE race.election_id = target_election_id
      AND (
          race.status <> 'completed'
          OR race.voting_date IS DISTINCT FROM DATE '1994-12-03'
          OR race.race_type <> 'city_councilor'
          OR region.region_type <> 'municipality'
          OR race.region_id = '7b181cb2-9e4f-4334-984b-fd5430555c77'
      );

    SELECT COUNT(*)
    INTO leading_zero_title_count
    FROM races
    WHERE races.election_id = target_election_id
      AND title ~ '第0[0-9]';

    SELECT COUNT(*)
    INTO same_race_collision_count
    FROM (
        SELECT race.id, canonical.canonical_person_id, COALESCE(candidate.candidate_no, '')
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id = target_election_id
        GROUP BY race.id, canonical.canonical_person_id, COALESCE(candidate.candidate_no, '')
        HAVING COUNT(*) > 1
    ) collision;

    WITH named_people AS (
        SELECT DISTINCT person.name, canonical.canonical_person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN people person ON person.id = candidate.person_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id = target_election_id
    )
    SELECT COUNT(*)
    INTO same_name_pair_count
    FROM named_people left_person
    JOIN named_people right_person
      ON right_person.name = left_person.name
     AND right_person.canonical_person_id > left_person.canonical_person_id;

    SELECT COUNT(*)
    INTO unresolved_review_count
    FROM person_duplicate_review_queue review
    WHERE review.duplicate_person_id IN (
        SELECT DISTINCT canonical.canonical_person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id = target_election_id
    )
       OR review.canonical_person_id IN (
        SELECT DISTINCT canonical.canonical_person_id
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE race.election_id = target_election_id
    );

    IF race_count <> 14
       OR candidate_count <> 274
       OR region_count <> 2
       OR canonical_person_count <> 274
       OR incomplete_candidate_count <> 0
       OR invalid_race_count <> 0
       OR leading_zero_title_count <> 0
       OR same_race_collision_count <> 0
       OR same_name_pair_count <> 0
       OR unresolved_review_count <> 0 THEN
        RAISE EXCEPTION
            '1994 publication checks failed: races %, candidates %, regions %, people %, incomplete %, invalid races %, leading zeros %, collisions %, same-name pairs %, unresolved reviews %',
            race_count,
            candidate_count,
            region_count,
            canonical_person_count,
            incomplete_candidate_count,
            invalid_race_count,
            leading_zero_title_count,
            same_race_collision_count,
            same_name_pair_count,
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
      WHERE race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0')
  );

UPDATE elections
SET is_public = TRUE,
    updated_at = NOW()
WHERE id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0');

UPDATE races
SET is_public = TRUE,
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0');

UPDATE people person
SET is_public = TRUE,
    updated_at = NOW()
WHERE person.is_public IS DISTINCT FROM TRUE
  AND person.id IN (
      SELECT DISTINCT canonical.canonical_person_id
      FROM candidates candidate
      JOIN races race ON race.id = candidate.race_id
      JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
      WHERE race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0')
  );

UPDATE candidates candidate
SET is_public = TRUE,
    updated_at = NOW()
FROM races race
WHERE race.id = candidate.race_id
  AND race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0');

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-947547c42d36c8a0');
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
    WHERE id = target_election_id
      AND is_public = TRUE;

    SELECT COUNT(*)
    INTO public_race_count
    FROM races
    WHERE races.election_id = target_election_id
      AND is_public = TRUE;

    SELECT COUNT(*)
    INTO public_candidate_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id
      AND candidate.is_public = TRUE;

    SELECT COUNT(DISTINCT canonical.canonical_person_id)
    INTO public_canonical_person_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
    JOIN people person ON person.id = canonical.canonical_person_id
    WHERE race.election_id = target_election_id
      AND person.is_public = TRUE;

    SELECT COUNT(*)
    INTO published_election_count
    FROM published.elections
    WHERE election_id = target_election_id;

    SELECT COUNT(*)
    INTO published_race_count
    FROM published.races
    WHERE election_id = target_election_id;

    SELECT COUNT(*)
    INTO published_candidate_count
    FROM published.candidate_facts
    WHERE election_id = target_election_id;

    IF public_election_count <> 1
       OR public_race_count <> 14
       OR public_candidate_count <> 274
       OR public_canonical_person_count <> 274
       OR published_election_count <> 1
       OR published_race_count <> 14
       OR published_candidate_count <> 274 THEN
        RAISE EXCEPTION
            '1994 publication validation failed: core elections %, races %, candidates %, people %; published elections %, races %, candidates %',
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

RESET statement_timeout;
