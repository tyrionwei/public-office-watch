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
 IF EXISTS(SELECT FROM cron.job WHERE jobname IN ('refresh-office-legislators','refresh-office-presidency','refresh-office-local')) THEN RAISE EXCEPTION 'Expensive annual jobs remain'; END IF;
END;
$$;
-- Publication/expiry consistency is exercised by tests/sql/reviewed-office-release.sql.
ROLLBACK;
