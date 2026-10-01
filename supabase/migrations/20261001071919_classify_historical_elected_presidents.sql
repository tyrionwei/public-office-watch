BEGIN;

-- Scope: the reviewed 2016/2020 elected presidential records for this canonical
-- person, corroborated by https://www.president.gov.tw/Page/705 (14th/15th president).
-- A joint-ticket race or a person's current position alone is NOT historical role evidence.
-- This only fills an otherwise-unclassified directory role; status stays unchanged.
DO $historical_role$
DECLARE
  definition text := pg_get_viewdef('public.public_people_list'::regclass, true);
  previous_comment text := COALESCE(obj_description('public.public_people_list'::regclass), '');
  marker text := 'pow-reviewed-historical-president-v1:';
  old_fragment text := E'ELSE ''other''::text\n                END AS list_role';
  new_fragment text := $fragment$ELSE CASE WHEN classified.person_id = '5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid
                    AND EXISTS (
                      SELECT 1 FROM public.public_candidates historical_candidate
                      JOIN public.public_races historical_race ON historical_race.race_id = historical_candidate.race_id
                      WHERE historical_candidate.person_id = classified.person_id
                        AND (historical_candidate.candidate_id, historical_candidate.election_year) IN (('ed53467b-6bb9-4bdf-b338-092f4b96b9ff'::uuid, 2016), ('1c9caa82-01a1-49be-9a9a-22f3764c6979'::uuid, 2020))
                        AND historical_candidate.person_name = '蔡英文'
                        AND historical_candidate.election_result = 'elected'
                        AND historical_candidate.is_elected IS TRUE
                        AND historical_race.race_type = 'president'
                    ) THEN 'president'::text ELSE 'other'::text END
                END AS list_role$fragment$;
BEGIN
  IF (SELECT count(*) FROM (VALUES
       ('ed53467b-6bb9-4bdf-b338-092f4b96b9ff'::uuid, 2016),
       ('1c9caa82-01a1-49be-9a9a-22f3764c6979'::uuid, 2020)
     ) expected(candidate_id, election_year)
     JOIN public.public_candidates candidate USING(candidate_id)
     JOIN public.public_races race ON race.race_id=candidate.race_id
     WHERE candidate.person_id='5d623ab5-a2a2-4c40-a094-6b3712d648e5'::uuid
       AND candidate.person_name='蔡英文'
       AND candidate.election_year=expected.election_year
       AND candidate.election_result='elected' AND candidate.is_elected IS TRUE
       AND race.race_type='president') <> 2 THEN
    RAISE EXCEPTION 'Reviewed presidential identity/result baseline changed';
  END IF;
  IF position(marker in previous_comment) > 0 THEN
    IF split_part(previous_comment, marker, 2) <> md5(definition) THEN
      RAISE EXCEPTION 'Historical role view changed since application; review before reapplying';
    END IF;
  ELSE
    IF (length(definition) - length(replace(definition, old_fragment, ''))) / length(old_fragment) <> 1 THEN
      RAISE EXCEPTION 'Unexpected public_people_list role definition; review baseline before applying';
    END IF;
    EXECUTE 'CREATE OR REPLACE VIEW public.public_people_list AS ' || replace(definition, old_fragment, new_fragment);
    EXECUTE format('COMMENT ON VIEW public.public_people_list IS %L',
      previous_comment || E'\n' || marker || md5(pg_get_viewdef('public.public_people_list'::regclass, true)));
  END IF;
END $historical_role$;

-- Only the directory role changed; demographic inputs and birth-date projections are unchanged.
REFRESH MATERIALIZED VIEW public.public_people_list_cached;
DO $directory_refresh$
DECLARE directory_found boolean := false;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='published' AND c.relname='people_directory_snapshot' AND c.relkind='m') THEN
    REFRESH MATERIALIZED VIEW published.people_directory_snapshot;
    directory_found := true;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='published' AND c.relname='people_directory' AND c.relkind='m') THEN
    REFRESH MATERIALIZED VIEW published.people_directory;
    directory_found := true;
  END IF;
  IF NOT directory_found THEN RAISE EXCEPTION 'Published directory cache is missing'; END IF;
END $directory_refresh$;

COMMIT;
