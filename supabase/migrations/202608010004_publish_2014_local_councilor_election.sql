SET statement_timeout = 0;

BEGIN;

-- Publish the newest fully reconciled historical councilor batch first.
-- Only canonical people are made public; superseded source person rows remain
-- private and public_candidates resolves candidate links through the canonical map.
DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-5d2d565cde864a14');
    target_race_count INTEGER;
    target_candidate_count INTEGER;
    target_canonical_person_count INTEGER;
    same_race_collision_count INTEGER;
    leading_zero_title_count INTEGER;
    missing_vote_count INTEGER;
    non_indigenous_missing_vote_count INTEGER;
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
        COUNT(*) FILTER (WHERE candidate.vote_count IS NULL),
        COUNT(*) FILTER (
            WHERE candidate.vote_count IS NULL
              AND race.title NOT LIKE '%原住民%'
        )
    INTO missing_vote_count, non_indigenous_missing_vote_count
    FROM candidates candidate
    JOIN races race ON race.id = candidate.race_id
    WHERE race.election_id = target_election_id;

    IF NOT EXISTS (
        SELECT 1
        FROM elections
        WHERE id = target_election_id
          AND year = 2014
          AND election_type = 'councilor'
          AND name = '2014年直轄市及縣市議員選舉'
          AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Expected canonical 2014 councilor election was not found';
    END IF;

    IF target_race_count <> 217
       OR target_candidate_count <> 1600
       OR target_canonical_person_count <> 1600 THEN
        RAISE EXCEPTION
            'Unexpected 2014 scope: races %, candidates %, canonical people %',
            target_race_count,
            target_candidate_count,
            target_canonical_person_count;
    END IF;

    IF same_race_collision_count <> 0 OR leading_zero_title_count <> 0 THEN
        RAISE EXCEPTION
            '2014 normalization check failed: collisions %, leading-zero titles %',
            same_race_collision_count,
            leading_zero_title_count;
    END IF;

    IF missing_vote_count <> 156 OR non_indigenous_missing_vote_count <> 0 THEN
        RAISE EXCEPTION
            'Unexpected 2014 vote coverage: missing %, non-indigenous missing %',
            missing_vote_count,
            non_indigenous_missing_vote_count;
    END IF;
END
$$;

UPDATE elections
SET
    voting_date = DATE '2014-11-29',
    is_public = TRUE,
    updated_at = NOW()
WHERE id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-5d2d565cde864a14');

UPDATE races
SET
    voting_date = DATE '2014-11-29',
    is_public = TRUE,
    updated_at = NOW()
WHERE election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-5d2d565cde864a14');

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
      WHERE race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-5d2d565cde864a14')
  );

UPDATE candidates candidate
SET
    is_public = TRUE,
    updated_at = NOW()
FROM races race
WHERE race.id = candidate.race_id
  AND race.election_id = (SELECT id FROM elections WHERE external_id = 'cec-historical-election-5d2d565cde864a14');

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

DO $$
DECLARE
    target_election_id CONSTANT UUID := (SELECT id FROM elections WHERE external_id = 'cec-historical-election-5d2d565cde864a14');
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
      AND voting_date = DATE '2014-11-29';

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
          AND voting_date = DATE '2014-11-29'
    ) THEN
        RAISE EXCEPTION '2014 election was not published with the expected date';
    END IF;

    IF public_race_count <> 217
       OR public_candidate_count <> 1600
       OR published_candidate_count <> 1600
       OR public_canonical_person_count <> 1600 THEN
        RAISE EXCEPTION
            '2014 publication validation failed: races %, candidates %, snapshot %, people %',
            public_race_count,
            public_candidate_count,
            published_candidate_count,
            public_canonical_person_count;
    END IF;
END
$$;

COMMIT;

RESET statement_timeout;
