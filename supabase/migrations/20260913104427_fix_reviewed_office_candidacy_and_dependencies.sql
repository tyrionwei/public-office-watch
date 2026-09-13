BEGIN;
-- PostgreSQL views retain function OIDs through a rename. Rebind every view
-- still referencing the source copies, while retaining its owner and grants.
DO $$
DECLARE v record; definition text;
BEGIN
 FOR v IN SELECT DISTINCT c.oid,c.oid::regclass AS name,c.relkind
 FROM pg_depend d JOIN pg_rewrite w ON w.oid=d.objid JOIN pg_class c ON c.oid=w.ev_class
 WHERE d.refobjid IN ('public.candidate_holds_office_source(uuid,date)'::regprocedure,'public.candidate_office_term_source(uuid)'::regprocedure)
 LOOP
 IF v.relkind<>'v' THEN RAISE EXCEPTION 'Unexpected materialized office dependency: %',v.name; END IF;
 definition:=pg_get_viewdef(v.oid,true);
 definition:=replace(replace(definition,'candidate_holds_office_source(', 'candidate_holds_office('),'candidate_office_term_source(','candidate_office_term(');
 EXECUTE 'CREATE OR REPLACE VIEW '||v.name||' AS '||definition;
 END LOOP;
END;
$$;

-- Published candidacies with public election date/status fields. Avoid rebuilding
-- display facets and canonical maps per person: candidate_facts already supplies
-- the published identity/race IDs. Never use private candidate or profile facts.
CREATE FUNCTION public.office_public_candidacies(p_person uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
 'candidateId',c.candidate_id,'raceType',r.race_type,'raceTitle',c.race_title,'regionName',c.region_name,
 'status',c.candidacy_status,'result',c.election_result,'raceStatus',r.status,'electionStatus',e.status,
 'votingDate',COALESCE(r.voting_date,e.voting_date),'year',c.election_year,'startsOn',t.starts_on
 ) ORDER BY c.election_year DESC,c.candidate_id),'[]')
 FROM published.candidate_facts c JOIN public.races r ON r.id=c.race_id AND r.is_public
 JOIN public.elections e ON e.id=c.election_id AND e.is_public
 LEFT JOIN public.regions region ON region.id=r.region_id
 LEFT JOIN public.reviewed_office_terms t ON t.candidate_id=c.candidate_id
 WHERE c.person_id=p_person AND (r.region_id IS NULL OR region.is_public);
$$;
REVOKE ALL ON FUNCTION public.office_public_candidacies(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_public_candidacies(uuid) TO service_role;

CREATE FUNCTION public.current_public_candidacy_snapshot(p_person uuid,p_on date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH eligible AS (
 SELECT c FROM jsonb_array_elements(public.office_public_candidacies(p_person)) c
 WHERE c->>'status' IN ('potential','party_nominee','officially_announced','registered','qualified')
 AND COALESCE(c->>'raceStatus','') NOT IN ('cancelled','canceled')
 AND COALESCE(c->>'electionStatus','') NOT IN ('cancelled','canceled')
 AND ((c->>'result'='pending'
 AND COALESCE(c->>'raceStatus','') NOT IN ('completed','finished')
 AND COALESCE(c->>'electionStatus','') NOT IN ('completed','finished')
 AND CASE WHEN c->>'votingDate' IS NOT NULL THEN p_on<=(c->>'votingDate')::date ELSE extract(year FROM p_on)<=(c->>'year')::int END)
 OR (c->>'result'='elected' AND p_on<(c->>'startsOn')::date))
 ORDER BY (c->>'year')::int DESC,c->>'candidateId' LIMIT 1
 ), role AS (
 SELECT c,CASE WHEN c->>'raceType' IN ('legislator','legislative_district','indigenous','party_list_legislator') THEN 'legislator'
 WHEN c->>'raceType' IN ('local_chief','municipality_mayor','county_mayor','township_mayor') THEN 'local_chief'
 WHEN c->>'raceType' IN ('city_councilor','county_councilor','councilor_district') THEN 'councilor' ELSE 'other' END AS r FROM eligible
 ) SELECT jsonb_build_object('position',c->>'raceTitle','district',c->>'regionName','current_office_label',NULL,
 'list_role',r,'list_status','candidate','list_is_grassroots',c->>'raceType' IN ('township_mayor','township_representative','township_representative_district','village_chief'),
 'list_status_order',1,'list_role_order',CASE r WHEN 'legislator' THEN 2 WHEN 'local_chief' THEN 3 WHEN 'councilor' THEN 5 ELSE 8 END) FROM role;
$$;
REVOKE ALL ON FUNCTION public.current_public_candidacy_snapshot(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.current_public_candidacy_snapshot(uuid,date) TO service_role;

CREATE OR REPLACE FUNCTION public.reviewed_office_snapshot(p_person uuid,p_on date DEFAULT (now() AT TIME ZONE 'Asia/Taipei')::date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(
 (SELECT t.current_snapshot FROM public.reviewed_office_terms t WHERE t.person_id=p_person AND p_on>=t.starts_on AND p_on<COALESCE(t.ended_on,t.ends_on)
 ORDER BY (t.current_snapshot->>'list_role_order')::int,t.starts_on DESC,t.candidate_id LIMIT 1),
 public.current_public_candidacy_snapshot(p_person,p_on),
 (SELECT t.former_snapshot FROM public.reviewed_office_terms t WHERE t.person_id=p_person AND p_on>=COALESCE(t.ended_on,t.ends_on)
 ORDER BY COALESCE(t.ended_on,t.ends_on) DESC,(t.former_snapshot->>'list_role_order')::int,t.candidate_id LIMIT 1),
 -- Old packages may contain a candidate fallback. Never perpetuate it.
 CASE WHEN p.fallback->>'list_status'='candidate' THEN jsonb_build_object('position',NULL,'district',NULL,'current_office_label',NULL,'list_role','other','list_status','other','list_is_grassroots',false,'list_status_order',3,'list_role_order',8) ELSE p.fallback END)
 FROM public.reviewed_office_profiles p WHERE p.person_id=p_person
 AND EXISTS(SELECT 1 FROM public.public_people_list_cached b WHERE b.person_id=p_person);
$$;

-- Preserve the existing baseline contract and add explicit live candidacy context.
DO $$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.office_release_baseline(uuid[])'::regprocedure) INTO d;
 d:=replace(d,'''schemaVersion'',1,','''schemaVersion'',1,''candidacyContextVersion'',1,');
 d:=replace(d,'''officeRole'',p.list_role', '''candidacies'',public.office_public_candidacies(p.person_id),''officeRole'',p.list_role');
 EXECUTE d;
END;
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
