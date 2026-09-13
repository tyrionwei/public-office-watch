BEGIN;
SET LOCAL statement_timeout='60s';
DO $$
DECLARE d date;
BEGIN
 SELECT starts_on INTO d FROM public.regular_office_term('legislator','2031-12-20');
 IF d IS DISTINCT FROM DATE '2032-02-01' THEN RAISE EXCEPTION 'Cross-year inauguration failed'; END IF;
 SELECT starts_on INTO d FROM public.regular_office_term('president','2032-01-10');
 IF d IS DISTINCT FROM DATE '2032-05-20' THEN RAISE EXCEPTION 'Future presidential inauguration failed'; END IF;
 SELECT starts_on INTO d FROM public.regular_office_term('local','2034-12-26');
 IF d IS DISTINCT FROM DATE '2035-12-25' THEN RAISE EXCEPTION 'First date after vote must roll year'; END IF;
 SELECT starts_on INTO d FROM public.regular_office_term('legislator','2032-02-01');
 IF d IS DISTINCT FROM DATE '2033-02-01' THEN RAISE EXCEPTION 'After must be strict'; END IF;
 IF EXISTS(SELECT FROM public.regular_office_term('local','2010-11-27')) THEN RAISE EXCEPTION 'Old local elections unsupported'; END IF;
 IF EXISTS(SELECT FROM public.regular_office_term('legislator',NULL)) THEN RAISE EXCEPTION 'Unknown date must stay unknown'; END IF;
 IF EXISTS(SELECT FROM cron.job WHERE jobname='refresh-office-term-status') THEN RAISE EXCEPTION 'Daily full refresh still scheduled'; END IF;
 IF (SELECT count(*) FROM cron.job WHERE (jobname,schedule) IN (('refresh-office-legislators','5 16 31 1 *'),('refresh-office-presidency','5 16 19 5 *'),('refresh-office-local','5 16 24 12 *')) AND active)<>3 THEN RAISE EXCEPTION 'Annual schedules incorrect'; END IF;
END;
$$;
CREATE TEMP TABLE before_cache AS SELECT * FROM public.public_people_list_cached;
SELECT public.refresh_office_status_family('legislator');
DO $$
BEGIN
 IF NOT EXISTS(SELECT FROM public.person_office_status_cache WHERE refreshed_family='legislator') THEN RAISE EXCEPTION 'No legislative rows refreshed'; END IF;
 IF EXISTS((SELECT * FROM public.public_people_list_cached EXCEPT SELECT * FROM before_cache) UNION ALL (SELECT * FROM before_cache EXCEPT SELECT * FROM public.public_people_list_cached)) THEN RAISE EXCEPTION 'Annual job changed whole-site cache'; END IF;
 IF EXISTS(SELECT FROM public.person_office_status_cache s WHERE s.refreshed_family='legislator' AND NOT EXISTS(SELECT 1 FROM public.candidates c JOIN public.races r ON r.id=c.race_id JOIN public.person_canonical_map m ON m.person_id=c.person_id WHERE m.canonical_person_id=s.person_id AND c.is_public AND c.election_result='elected' AND public.office_family_for_race(r.race_type)='legislator') AND NOT EXISTS(SELECT FROM public.current_office_assignments a WHERE a.person_id=s.person_id AND a.is_current AND a.role_key='legislator')) THEN RAISE EXCEPTION 'Refreshed a person outside legislative scope'; END IF;
 IF has_function_privilege('anon','public.refresh_office_status_family(text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous users must not refresh'; END IF;
 RAISE NOTICE 'PASS: first fixed date, rollover, old-date exclusion, annual schedules and legislative-only cache updates';
END;
$$;
SET LOCAL ROLE anon;
SELECT count(*) FROM published.people_directory WHERE current_office_label IS NOT NULL;
ROLLBACK;
