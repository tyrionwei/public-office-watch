-- Run after the release migrations inside a transaction that is rolled back.
-- Uses an already-published councilor as an ephemeral fixture; never run on production.
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END; $$;
CREATE TEMP TABLE office_test_person AS
SELECT person.person_id, candidate.id AS candidate_id, candidate.race_id
FROM published.people_directory person
JOIN public.person_canonical_map map ON map.canonical_person_id=person.person_id
JOIN public.candidates candidate ON candidate.person_id=map.person_id
WHERE person.list_status='current' AND person.list_role='councilor'
 AND public.candidate_holds_office(candidate.id)
 AND NOT EXISTS (SELECT 1 FROM public.current_office_assignments a WHERE a.person_id=person.person_id AND a.is_current)
LIMIT 1;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM office_test_person),'published current councilor fixture exists');
CREATE TEMP TABLE office_test_release AS SELECT * FROM published.release_state;
CREATE TEMP TABLE office_test_ids AS SELECT person_id FROM published.people;
CREATE TEMP TABLE office_test_other_family AS SELECT * FROM public.person_office_status_cache WHERE refreshed_family<>'local';
-- Expire every current candidacy of this person using real term overrides.
INSERT INTO public.race_office_term_overrides(race_id,starts_on,ends_on,source_url,reason)
SELECT DISTINCT c.race_id,current_date-730,current_date-1,'https://example.test/term','transaction-only expiry regression fixture'
FROM public.candidates c JOIN public.person_canonical_map map ON map.person_id=c.person_id
WHERE map.canonical_person_id=(SELECT person_id FROM office_test_person) AND public.candidate_holds_office(c.id)
ON CONFLICT(race_id) DO UPDATE SET starts_on=excluded.starts_on,ends_on=excluded.ends_on;
SELECT pg_temp.assert_true(NOT public.candidate_holds_office(candidate_id),'fixture term has expired') FROM office_test_person;
SELECT pg_temp.assert_true((SELECT list_status='current' FROM published.people_directory WHERE person_id=(SELECT person_id FROM office_test_person)),'directory starts stale');
-- Keep this regression bounded to the fixture person while exercising the real
-- office projection. Full-family capacity is a separate rehearsal check.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.office_status_rows_for(uuid[])'::regprocedure) INTO definition;
 definition:=replace(definition,'public.office_status_rows_for(', 'pg_temp.fixture_office_status_rows_for(');
 EXECUTE definition;
END;
$$;
CREATE OR REPLACE FUNCTION public.office_status_rows_for(p_ids uuid[]) RETURNS SETOF public.public_people_list
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT * FROM pg_temp.fixture_office_status_rows_for(ARRAY(SELECT person_id FROM pg_temp.office_test_person WHERE person_id=ANY(p_ids)));
$$;
SELECT public.refresh_office_status_family('local');
SELECT pg_temp.assert_true((SELECT list_status<>'current' FROM published.people WHERE person_id=(SELECT person_id FROM office_test_person)),'person page reflects expiry');
SELECT pg_temp.assert_true(NOT EXISTS (
 SELECT 1 FROM published.people p JOIN published.people_directory d USING(person_id)
 WHERE (p.list_status,p.list_role,p.current_office_label,p.position,p.district) IS DISTINCT FROM (d.list_status,d.list_role,d.current_office_label,d.position,d.district)
),'all published directory office fields agree');
SELECT pg_temp.assert_true(NOT EXISTS ((SELECT * FROM published.release_state EXCEPT SELECT * FROM office_test_release) UNION ALL (SELECT * FROM office_test_release EXCEPT SELECT * FROM published.release_state)),'no release promotion');
SELECT pg_temp.assert_true(NOT EXISTS ((SELECT person_id FROM published.people_directory EXCEPT SELECT * FROM office_test_ids) UNION ALL (SELECT * FROM office_test_ids EXCEPT SELECT person_id FROM published.people_directory)),'directory includes only already-published people');
SELECT pg_temp.assert_true(NOT EXISTS ((SELECT * FROM public.person_office_status_cache WHERE refreshed_family<>'local' EXCEPT SELECT * FROM office_test_other_family) UNION ALL (SELECT * FROM office_test_other_family EXCEPT SELECT * FROM public.person_office_status_cache WHERE refreshed_family<>'local')),'other families not recomputed');
DO $$
DECLARE region_slug text; region_name text; expected jsonb; actual jsonb;
BEGIN
 SELECT slug,name INTO region_slug,region_name FROM published.regions WHERE region_type='municipality' LIMIT 1;
 IF region_slug IS NULL THEN RAISE EXCEPTION 'county/city fixture missing'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY seat_count DESC,party_name),'[]') INTO expected
 FROM (SELECT public.canonical_party_name(p.party) AS party_name,count(*)::integer AS seat_count
 FROM published.people p WHERE p.list_role='councilor' AND p.list_status='current'
 AND (p.district ILIKE region_name||'%' OR p.district ILIKE replace(region_name,'臺','台')||'%')
 GROUP BY public.canonical_party_name(p.party) ORDER BY seat_count DESC,party_name LIMIT 21) s;
 actual:=published.home_page_for(region_slug)->'seat_rows';
 PERFORM pg_temp.assert_true(actual=expected,'home council seats agree with published people');
END;
$$;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.refresh_office_status_family(text)','EXECUTE'),'anon cannot refresh');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.refresh_office_status_family(text)','EXECUTE'),'authenticated cannot refresh');
SELECT 'office status directory regression passed' AS result;
