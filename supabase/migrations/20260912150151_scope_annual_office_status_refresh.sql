BEGIN;
-- The first fixed inauguration date strictly AFTER the voting date, including year rollover.
CREATE FUNCTION public.regular_office_term(p_family text,p_voting_date date)
RETURNS TABLE(starts_on date,ends_on date)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 WITH anniversary AS (
 SELECT CASE p_family WHEN 'president' THEN make_date(extract(year FROM p_voting_date)::int,5,20)
 WHEN 'legislator' THEN make_date(extract(year FROM p_voting_date)::int,2,1)
 WHEN 'local' THEN make_date(extract(year FROM p_voting_date)::int,12,25) END AS d
 WHERE p_voting_date IS NOT NULL
 AND (p_family<>'local' OR p_voting_date>=DATE '2014-01-01')
 ), start AS (SELECT CASE WHEN d<=p_voting_date THEN (d+INTERVAL '1 year')::date ELSE d END AS d FROM anniversary)
 SELECT d,(d+CASE WHEN p_family='legislator' AND d<DATE '2008-02-01' THEN INTERVAL '3 years' ELSE INTERVAL '4 years' END)::date FROM start WHERE d IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.race_office_term(p_race_id uuid)
RETURNS TABLE(starts_on date,ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(override.starts_on,regular.starts_on),COALESCE(override.ends_on,regular.ends_on)
 FROM public.races race JOIN public.elections election ON election.id=race.election_id
 LEFT JOIN public.race_office_term_overrides override ON override.race_id=race.id
 LEFT JOIN LATERAL public.regular_office_term(public.office_family_for_race(race.race_type),COALESCE(race.voting_date,election.voting_date)) regular
 ON election.election_type<>'by_election' AND (election.name || ' ' || race.title) !~ '補選|遞補'
 WHERE race.id=p_race_id AND race.is_public AND election.is_public;
$$;
-- Keep the batch current-office path in agreement with the scalar date resolver.
DO $$
DECLARE d text; old_join text;
BEGIN
 SELECT pg_get_viewdef('public.current_elected_offices'::regclass,true) INTO d;
 old_join:=substring(d FROM 'LEFT JOIN office_term_calendar calendar[^;]+?WHERE');
 IF old_join IS NULL THEN RAISE EXCEPTION 'Unexpected current office calendar join'; END IF;
 d:=replace(d,old_join,$join$LEFT JOIN LATERAL public.regular_office_term(public.office_family_for_race(race.race_type),COALESCE(race.voting_date,election.voting_date)) calendar ON election.election_type<>'by_election' AND (election.name || ' ' || race.title) !~ '補選|遞補' WHERE$join$);
 EXECUTE 'CREATE OR REPLACE VIEW public.current_elected_offices AS '||d;
END;
$$;
-- Partial cache: only current-office presentation fields, never claims or election outcomes.
CREATE TABLE public.person_office_status_cache (
 person_id uuid PRIMARY KEY REFERENCES public.people(id),
 snapshot jsonb NOT NULL,
 refreshed_family text NOT NULL CHECK(refreshed_family IN ('president','legislator','local')),
 refreshed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.person_office_status_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.person_office_status_cache FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.person_office_status_cache TO service_role;

-- Scope every expensive office/person CTE before computing presentation fields.
DO $scoped_projection$
DECLARE people_sql text; list_sql text;
BEGIN
 SELECT pg_get_viewdef('public.public_people'::regclass,true) INTO people_sql;
 SELECT pg_get_viewdef('public.public_people_list'::regclass,true) INTO list_sql;
 IF strpos(people_sql,'WHERE candidate.is_public = true')=0 OR strpos(list_sql,'FROM public_people people')=0 THEN RAISE EXCEPTION 'Unexpected person projection'; END IF;
 people_sql:=replace(people_sql,'WHERE person.is_public = true','WHERE person.is_public = true AND person.id = ANY(p_ids)');
 people_sql:=replace(people_sql,'WHERE candidate.is_public = true','WHERE candidate.is_public = true AND person_map.canonical_person_id = ANY(p_ids)');
 people_sql:=replace(people_sql,'WHERE source_person.source_type','WHERE person_map.canonical_person_id = ANY(p_ids) AND source_person.source_type');
 -- Scalar checks now run only for the selected people's candidacies.
 people_sql:=regexp_replace(people_sql,'candidate_offices.candidate_id IN \( SELECT current_elected_offices.candidate_id[^)]+\)','public.candidate_holds_office(candidate_offices.candidate_id)','g');
 list_sql:=replace(list_sql,'FROM public_people people','FROM scoped_people people');
 list_sql:=replace(list_sql,'FROM public_candidates','FROM public_candidates WHERE person_id = ANY(p_ids)');
 list_sql:=replace(list_sql,'WHERE assignment.is_current','WHERE assignment.person_id = ANY(p_ids) AND assignment.is_current');
 EXECUTE 'CREATE FUNCTION public.office_status_rows_for(p_ids uuid[]) RETURNS SETOF public.public_people_list LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS '||quote_literal('WITH scoped_people AS ('||rtrim(people_sql,E'; \n\t')||'), '||regexp_replace(ltrim(list_sql),'^WITH ','','i'));
END;
$scoped_projection$;
REVOKE ALL ON FUNCTION public.office_status_rows_for(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_status_rows_for(uuid[]) TO service_role;

CREATE FUNCTION public.refresh_office_status_family(p_family text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
 IF p_family NOT IN ('president','legislator','local') OR p_family IS NULL THEN RAISE EXCEPTION 'Unknown office family'; END IF;
 -- Record the announced election's computed term, only within the requested family.
 INSERT INTO public.office_term_calendar(office_family,starts_on,ends_on,source_url)
 SELECT DISTINCT p_family,t.starts_on,t.ends_on,CASE p_family WHEN 'president' THEN 'https://www.president.gov.tw/Page/87' WHEN 'legislator' THEN 'https://aam.ly.gov.tw/P016001_01.do' ELSE 'https://www.moi.gov.tw/News_Content.aspx?n=2&s=260703' END
 FROM public.races r JOIN public.elections e ON e.id=r.election_id
 CROSS JOIN LATERAL public.regular_office_term(p_family,COALESCE(r.voting_date,e.voting_date)) t
 WHERE public.office_family_for_race(r.race_type)=p_family AND r.is_public AND e.is_public AND e.election_type<>'by_election' AND (e.name || ' ' || r.title) !~ '補選|遞補'
 ON CONFLICT (office_family,starts_on) DO NOTHING;
 WITH affected AS MATERIALIZED (
 SELECT DISTINCT map.canonical_person_id AS person_id
 FROM public.candidates c JOIN public.races r ON r.id=c.race_id
 JOIN public.person_canonical_map map ON map.person_id=c.person_id
 WHERE c.is_public AND c.election_result='elected' AND public.office_family_for_race(r.race_type)=p_family
 UNION
 SELECT person_id FROM public.current_office_assignments WHERE is_current AND role_key=p_family
 ), snapshots AS MATERIALIZED (
 SELECT live.person_id,jsonb_build_object('position',live.position,'district',live.district,
 'current_office_label',live.current_office_label,'upcoming_candidate_label',live.upcoming_candidate_label,
 'list_role',live.list_role,'list_status',live.list_status,'list_is_grassroots',live.list_is_grassroots,
 'list_status_order',live.list_status_order,'list_role_order',live.list_role_order) AS snapshot
 FROM public.office_status_rows_for(ARRAY(SELECT person_id FROM affected)) live
 -- Only overlay people already present in the public cache. No implicit publication.
 JOIN public.public_people_list_cached prior USING(person_id)
 )
 INSERT INTO public.person_office_status_cache(person_id,snapshot,refreshed_family)
 SELECT person_id,snapshot,p_family FROM snapshots
 ON CONFLICT(person_id) DO UPDATE SET snapshot=excluded.snapshot,refreshed_family=excluded.refreshed_family,refreshed_at=now();
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_office_status_family(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_office_status_family(text) TO service_role;

-- Overlay nulls explicitly: expiry must clear an old current-office label.
DO $$
DECLARE d text; field text; expression text;
BEGIN
 SELECT pg_get_viewdef('published.people'::regclass,true) INTO d;
 FOREACH field IN ARRAY ARRAY['position','district','current_office_label','upcoming_candidate_label','list_role','list_status','list_is_grassroots','list_status_order','list_role_order'] LOOP
 expression := CASE WHEN field='list_is_grassroots' THEN '(office.snapshot->>''list_is_grassroots'')::boolean' WHEN field IN ('list_status_order','list_role_order') THEN '(office.snapshot->>'''||field||''')::integer' ELSE '(office.snapshot->>'''||field||''')' END;
 -- Replace all references, including list_is_party_only, retaining original projection names.
 d:=regexp_replace(d,'person\.'||quote_ident(field)||'(?![a-zA-Z0-9_])','(CASE WHEN office.person_id IS NOT NULL THEN '||expression||' ELSE person.'||quote_ident(field)||' END)','g');
 -- A bare projected expression must retain its existing public column name.
 d:=replace(d,' ELSE person.'||quote_ident(field)||' END),',' ELSE person.'||quote_ident(field)||' END) AS '||quote_ident(field)||',');
 END LOOP;
 d:=replace(d,'FROM public_people_list_cached person','FROM public_people_list_cached person LEFT JOIN public.person_office_status_cache office ON office.person_id=person.person_id');
 EXECUTE 'CREATE OR REPLACE VIEW published.people AS '||d;
END;
$$;
CREATE OR REPLACE FUNCTION public.refresh_public_people_list_cached() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 REFRESH MATERIALIZED VIEW public.public_people_list_cached;
 TRUNCATE public.person_office_status_cache;
END;
$$;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='refresh-office-term-status';
-- UTC dates are the preceding day, at 16:05 = 00:05 Asia/Taipei.
SELECT cron.schedule('refresh-office-legislators','5 16 31 1 *',$job$SELECT public.refresh_office_status_family('legislator');$job$);
SELECT cron.schedule('refresh-office-presidency','5 16 19 5 *',$job$SELECT public.refresh_office_status_family('president');$job$);
SELECT cron.schedule('refresh-office-local','5 16 24 12 *',$job$SELECT public.refresh_office_status_family('local');$job$);
NOTIFY pgrst,'reload schema';
COMMIT;
