BEGIN;
CREATE OR REPLACE FUNCTION public.refresh_office_status_family(p_family text) RETURNS integer
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
 -- Refresh only the already-published directory projection in this transaction.
 -- No promote(), source cache rebuild, or unrelated claims/data publication.
 REFRESH MATERIALIZED VIEW published.people_directory;
 RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_office_status_family(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_office_status_family(text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
