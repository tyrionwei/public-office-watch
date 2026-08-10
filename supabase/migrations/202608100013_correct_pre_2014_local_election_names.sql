BEGIN;

DO $$
DECLARE
    target_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO target_count
    FROM public.elections election
    WHERE election.year = 2010
      AND election.election_type = 'councilor'
      AND election.name IN (
          '2010年直轄市及縣市議員選舉',
          '2010年直轄市議員選舉'
      )
      AND election.voting_date = DATE '2010-11-27'
      AND NOT EXISTS (
          SELECT 1
          FROM public.races race
          WHERE race.election_id = election.id
            AND race.race_type <> 'city_councilor'
      );

    IF target_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one all-metropolitan 2010 councilor election, found %', target_count;
    END IF;
END;
$$;

UPDATE public.elections
SET
    name = '2010年直轄市議員選舉',
    updated_at = NOW()
WHERE year = 2010
  AND election_type = 'councilor'
  AND name = '2010年直轄市及縣市議員選舉'
  AND voting_date = DATE '2010-11-27';

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.elections
        WHERE year = 2010
          AND election_type = 'councilor'
          AND name = '2010年直轄市議員選舉'
          AND voting_date = DATE '2010-11-27'
    ) THEN
        RAISE EXCEPTION 'Canonical 2010 metropolitan councilor election name was not persisted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.elections
        WHERE year < 2014
          AND (
              name LIKE '%九合一%'
              OR name LIKE '%地方公職人員選舉%'
              OR name LIKE '%直轄市及縣市%'
          )
    ) THEN
        RAISE EXCEPTION 'A pre-2014 election still uses a nine-in-one or combined-jurisdiction label';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM published.candidate_facts
        WHERE election_year < 2014
          AND (
              election_name LIKE '%九合一%'
              OR election_name LIKE '%地方公職人員選舉%'
              OR election_name LIKE '%直轄市及縣市%'
          )
    ) THEN
        RAISE EXCEPTION 'Published candidate facts still contain a pre-2014 combined election label';
    END IF;
END;
$$;

COMMIT;
