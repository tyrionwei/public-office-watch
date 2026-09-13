BEGIN;
-- Durable, reviewed office data. These records survive ordinary cache refreshes.
CREATE TABLE public.office_release_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), revision integer NOT NULL DEFAULT 0
);
INSERT INTO public.office_release_state DEFAULT VALUES;
CREATE TABLE public.office_release_history (
 id uuid PRIMARY KEY, revision integer UNIQUE NOT NULL, baseline_release_id uuid,
 reviewed_by text NOT NULL, reason text NOT NULL, payload jsonb NOT NULL,
 before_profiles jsonb NOT NULL, before_terms jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reviewed_office_profiles (
 person_id uuid PRIMARY KEY REFERENCES public.people(id), fallback jsonb NOT NULL,
 release_id uuid NOT NULL REFERENCES public.office_release_history(id)
);
CREATE TABLE public.reviewed_office_terms (
 candidate_id uuid PRIMARY KEY REFERENCES public.candidates(id), person_id uuid NOT NULL REFERENCES public.reviewed_office_profiles(person_id),
 race_id uuid NOT NULL REFERENCES public.races(id), family text NOT NULL CHECK(family IN ('president','legislator','local')),
 starts_on date NOT NULL, ends_on date NOT NULL CHECK(ends_on>starts_on),
 ended_on date CHECK(ended_on>=starts_on AND ended_on<=ends_on),
 source_url text NOT NULL, source_version text NOT NULL, reason text NOT NULL,
 current_snapshot jsonb NOT NULL, former_snapshot jsonb NOT NULL,
 release_id uuid NOT NULL REFERENCES public.office_release_history(id)
);
CREATE INDEX reviewed_office_person_dates ON public.reviewed_office_terms(person_id,starts_on,ends_on);
ALTER TABLE public.office_release_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_release_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewed_office_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewed_office_terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_release_state,public.office_release_history,public.reviewed_office_profiles,public.reviewed_office_terms FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.office_release_state,public.office_release_history,public.reviewed_office_profiles,public.reviewed_office_terms TO service_role;

CREATE FUNCTION public.valid_office_snapshot(s jsonb,p_status text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_typeof(s)='object' AND
 NOT EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('position','district','current_office_label','list_role','list_status','list_is_grassroots','list_status_order','list_role_order'))
 AND s ?& ARRAY['position','district','current_office_label','list_role','list_status','list_is_grassroots','list_status_order','list_role_order']
 AND s->>'list_status'=p_status
 AND jsonb_typeof(s->'list_is_grassroots')='boolean'
 AND jsonb_typeof(s->'position') IN ('string','null') AND jsonb_typeof(s->'district') IN ('string','null')
 AND jsonb_typeof(s->'current_office_label') IN ('string','null')
 AND (s->>'list_status_order')=CASE p_status WHEN 'current' THEN '0' WHEN 'former' THEN '2' WHEN 'candidate' THEN '1' ELSE '3' END
 AND (s->>'list_role_order')~'^[0-8]$'
 AND s->>'list_role' IN ('president','vice_president','legislator','local_chief','local_deputy','councilor','agency_head','party_officer','other')
 AND (CASE WHEN p_status='current' THEN length(s->>'current_office_label')>0 ELSE s->'current_office_label'='null'::jsonb END)
 AND length(s::text)<4000;
$$;
CREATE FUNCTION public.reviewed_office_snapshot(p_person uuid,p_on date DEFAULT (now() AT TIME ZONE 'Asia/Taipei')::date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(
 (SELECT t.current_snapshot FROM public.reviewed_office_terms t WHERE t.person_id=p_person AND p_on>=t.starts_on AND p_on<COALESCE(t.ended_on,t.ends_on)
 ORDER BY (t.current_snapshot->>'list_role_order')::int,t.starts_on DESC,t.candidate_id LIMIT 1),
 (SELECT t.former_snapshot FROM public.reviewed_office_terms t WHERE t.person_id=p_person AND p_on>=COALESCE(t.ended_on,t.ends_on)
 ORDER BY COALESCE(t.ended_on,t.ends_on) DESC,(t.former_snapshot->>'list_role_order')::int,t.candidate_id LIMIT 1),p.fallback)
 FROM public.reviewed_office_profiles p WHERE p.person_id=p_person AND EXISTS(SELECT 1 FROM public.public_people_list_cached b WHERE b.person_id=p_person);
$$;
REVOKE ALL ON FUNCTION public.reviewed_office_snapshot(uuid,date) FROM PUBLIC;
-- This helper exposes only approved public office presentation, never evidence or history.
GRANT EXECUTE ON FUNCTION public.reviewed_office_snapshot(uuid,date) TO anon,authenticated,service_role;

-- Approved dates are shared by office presentation and platform voting.
ALTER FUNCTION public.candidate_office_term(uuid) RENAME TO candidate_office_term_source;
CREATE FUNCTION public.candidate_office_term(p_candidate_id uuid) RETURNS TABLE(starts_on date,ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.starts_on,t.ends_on FROM public.reviewed_office_terms t WHERE t.candidate_id=p_candidate_id
 UNION ALL SELECT * FROM public.candidate_office_term_source(p_candidate_id)
 WHERE NOT EXISTS(SELECT 1 FROM public.reviewed_office_terms t WHERE t.candidate_id=p_candidate_id);
$$;
ALTER FUNCTION public.candidate_holds_office(uuid,date) RENAME TO candidate_holds_office_source;
CREATE FUNCTION public.candidate_holds_office(p_candidate_id uuid,p_on date DEFAULT (now() AT TIME ZONE 'Asia/Taipei')::date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT p_on>=starts_on AND p_on<COALESCE(ended_on,ends_on) FROM public.reviewed_office_terms WHERE candidate_id=p_candidate_id),public.candidate_holds_office_source(p_candidate_id,p_on));
$$;
REVOKE ALL ON FUNCTION public.candidate_office_term_source(uuid),public.candidate_holds_office_source(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.candidate_office_term(uuid),public.candidate_holds_office(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.candidate_office_term(uuid),public.candidate_holds_office(uuid,date) TO anon,authenticated,service_role;

-- The expensive source projection remains a local manual tool, never a cron job.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('refresh-office-legislators','refresh-office-presidency','refresh-office-local');
CREATE OR REPLACE FUNCTION public.refresh_office_status_family(p_family text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Use a reviewed office release; source recomputation is local-only'; END;
$$;
CREATE OR REPLACE FUNCTION public.refresh_public_people_list_cached() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN REFRESH MATERIALIZED VIEW public.public_people_list_cached; END;
$$;

-- Keep the existing stable person fields, replacing only the office overlay.
DO $$
DECLARE d text;
BEGIN
 SELECT pg_get_viewdef('published.people'::regclass,true) INTO d;
 IF strpos(d,'LEFT JOIN person_office_status_cache office ON office.person_id = person.person_id')=0 THEN RAISE EXCEPTION 'Unexpected people office overlay'; END IF;
 d:=replace(d,'LEFT JOIN person_office_status_cache office ON office.person_id = person.person_id',
 'LEFT JOIN LATERAL (SELECT person.person_id,public.reviewed_office_snapshot(person.person_id) AS snapshot WHERE EXISTS(SELECT 1 FROM public.reviewed_office_profiles rp WHERE rp.person_id=person.person_id) UNION ALL SELECT legacy.person_id,legacy.snapshot FROM public.person_office_status_cache legacy WHERE legacy.person_id=person.person_id AND NOT EXISTS(SELECT 1 FROM public.reviewed_office_profiles rp WHERE rp.person_id=person.person_id)) office ON true');
 -- Upcoming candidacy is not an office fact and is never copied in an office package.
 d:=regexp_replace(d,'CASE\s+WHEN office.person_id IS NOT NULL THEN office.snapshot ->> ''upcoming_candidate_label''::text\s+ELSE person.upcoming_candidate_label\s+END','person.upcoming_candidate_label','g');
 EXECUTE 'CREATE OR REPLACE VIEW published.people AS '||d;
END;
$$;
-- A small date overlay on the directory snapshot avoids waiting for cron or a
-- running local computer at midnight, including irregular by-election dates.
DO $$
DECLARE dependencies jsonb; entry jsonb; cols text; fn regprocedure; definition text;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,'definition',pg_get_viewdef(c.oid,true))) INTO dependencies
 FROM (SELECT DISTINCT c.oid FROM pg_depend dep JOIN pg_rewrite r ON r.oid=dep.objid JOIN pg_class c ON c.oid=r.ev_class
 WHERE dep.refobjid='published.people_directory'::regclass AND c.oid<>'published.people_directory'::regclass AND c.relkind='v') c;
 SELECT string_agg(CASE WHEN a.attname IN ('position','district','current_office_label','list_role','list_status','list_is_grassroots','list_status_order','list_role_order')
 THEN format('CASE WHEN o.snapshot IS NULL THEN d.%I ELSE (o.snapshot->>%L)::%s END AS %I',a.attname,a.attname,format_type(a.atttypid,a.atttypmod),a.attname)
 WHEN a.attname='list_is_party_only' THEN 'd.list_is_party_only AND COALESCE(o.snapshot->>''current_office_label'','''')='''' AS list_is_party_only'
 ELSE format('d.%I',a.attname) END,',' ORDER BY a.attnum) INTO cols
 FROM pg_attribute a WHERE a.attrelid='published.people_directory'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 ALTER MATERIALIZED VIEW published.people_directory RENAME TO people_directory_snapshot;
 REVOKE ALL ON published.people_directory_snapshot FROM PUBLIC,anon,authenticated;
 EXECUTE 'CREATE VIEW published.people_directory AS SELECT '||cols||' FROM published.people_directory_snapshot d LEFT JOIN LATERAL (SELECT public.reviewed_office_snapshot(d.person_id) AS snapshot WHERE EXISTS(SELECT 1 FROM public.reviewed_office_profiles rp WHERE rp.person_id=d.person_id) OFFSET 0) o ON true';
 GRANT SELECT ON published.people_directory TO anon,authenticated,service_role;
 FOR entry IN SELECT * FROM jsonb_array_elements(COALESCE(dependencies,'[]')) LOOP
 EXECUTE 'CREATE OR REPLACE VIEW '||(entry->>'name')||' AS '||(entry->>'definition');
 END LOOP;
 -- Existing publication helpers still refresh the static snapshot, never the wrapper.
 FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','published') AND p.prokind='f' AND p.prosrc LIKE '%REFRESH MATERIALIZED VIEW published.people_directory%' LOOP
 SELECT pg_get_functiondef(fn) INTO definition;
 EXECUTE replace(definition,'REFRESH MATERIALIZED VIEW published.people_directory','REFRESH MATERIALIZED VIEW published.people_directory_snapshot');
 END LOOP;
END;
$$;

-- Presidency cards must not keep a previous holder after an approved term ends.
-- Other institutions are appointments and require their own evidence workflow.
CREATE OR REPLACE VIEW published.national_office_holders AS
SELECT a.institution_key,a.role_key,
 CASE WHEN state.managed THEN holder.name ELSE a.holder_name END AS holder_name,
 CASE WHEN state.managed THEN holder.person_id ELSE a.holder_person_id END AS holder_person_id,
 CASE WHEN state.managed THEN holder.party ELSE a.party_name END AS party_name,
 CASE WHEN state.managed THEN CASE WHEN holder.person_id IS NULL THEN 'unknown' ELSE 'current' END ELSE a.tenure_status END AS tenure_status,
 CASE WHEN state.managed THEN COALESCE(holder.source_name,'核准任期，後續人選待更新') ELSE a.source_name END AS source_name,
 CASE WHEN state.managed THEN COALESCE(holder.source_url,'') ELSE a.source_url END AS source_url,
 CASE WHEN state.managed THEN COALESCE(active.starts_on,a.observed_at) ELSE a.observed_at END AS observed_at,a.display_order,a.updated_at
FROM public.national_office_assignments a
LEFT JOIN LATERAL (
 SELECT count(DISTINCT t.person_id) AS n,min(t.person_id::text)::uuid AS person_id,
 min(t.source_url) AS source_url,min(t.starts_on) AS starts_on
 FROM public.reviewed_office_terms t
 WHERE a.institution_key='presidency' AND t.family='president'
 AND t.current_snapshot->>'list_role'=CASE a.role_key WHEN 'chief' THEN 'president' ELSE 'vice_president' END
 AND (now() AT TIME ZONE 'Asia/Taipei')::date>=t.starts_on
 AND (now() AT TIME ZONE 'Asia/Taipei')::date<COALESCE(t.ended_on,t.ends_on)
) active ON true
LEFT JOIN LATERAL (
 SELECT p.person_id,p.name,p.party,active.source_url,'核准任期來源'::text AS source_name
 FROM published.people p WHERE active.n=1 AND p.person_id=active.person_id
) holder ON true
CROSS JOIN LATERAL (
 SELECT a.institution_key='presidency' AND (active.n>0 OR EXISTS(
 SELECT 1 FROM public.reviewed_office_profiles rp WHERE rp.person_id=a.holder_person_id) OR EXISTS(
 SELECT 1 FROM public.reviewed_office_terms t WHERE t.family='president'
 AND t.current_snapshot->>'list_role'=CASE a.role_key WHEN 'chief' THEN 'president' ELSE 'vice_president' END
 AND t.starts_on<=(now() AT TIME ZONE 'Asia/Taipei')::date AND t.ends_on>=a.observed_at)) AS managed
) state;

CREATE FUNCTION public.office_release_baseline(p_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('schemaVersion',1,'releaseId',(SELECT release_id FROM published.release_state WHERE state_key='current'),
 'officeRevision',(SELECT revision FROM public.office_release_state WHERE singleton),
 'people',COALESCE((SELECT jsonb_agg(jsonb_build_object('personId',p.person_id,'fingerprint',md5(to_jsonb(p)::text),'officeRole',p.list_role,'officeStatus',p.list_status,'officeSnapshot',jsonb_build_object('position',p.position,'district',p.district,'current_office_label',p.current_office_label,'list_role',p.list_role,'list_status',p.list_status,'list_is_grassroots',p.list_is_grassroots,'list_status_order',p.list_status_order,'list_role_order',p.list_role_order))) FROM published.people p WHERE p.person_id=ANY(p_ids)),'[]'));
$$;
REVOKE ALL ON FUNCTION public.office_release_baseline(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_release_baseline(uuid[]) TO service_role;

CREATE FUNCTION public.apply_reviewed_office_release(p jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE revision_now integer; release_now uuid; item jsonb; term jsonb; pid uuid; ids uuid[]; new_id uuid; before_p jsonb; before_t jsonb;
BEGIN
 SELECT revision INTO revision_now FROM public.office_release_state WHERE singleton FOR UPDATE;
 SELECT release_id INTO release_now FROM published.release_state WHERE state_key='current' FOR SHARE;
 IF (p->>'schemaVersion')::int IS DISTINCT FROM 1 OR (p->>'expectedOfficeRevision')::int IS DISTINCT FROM revision_now OR (p->>'expectedReleaseId')::uuid IS DISTINCT FROM release_now THEN RAISE EXCEPTION 'OFFICE_BASELINE_CONFLICT'; END IF;
 IF length(btrim(p->>'reviewedBy'))<2 OR length(btrim(p->>'reason'))<2 OR p->>'reviewedBy' IS NULL OR p->>'reason' IS NULL OR jsonb_typeof(p->'people') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'people') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'OFFICE_INVALID_REVIEW'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('schemaVersion','packageId','asOf','expectedOfficeRevision','expectedReleaseId','reviewedBy','reason','people')) THEN RAISE EXCEPTION 'OFFICE_UNEXPECTED_FIELD'; END IF;
 IF p->>'asOf' IS NULL THEN RAISE EXCEPTION 'OFFICE_DATE_REQUIRED'; END IF;
 PERFORM (p->>'asOf')::date;
 new_id:=(p->>'packageId')::uuid;
 SELECT array_agg((x->>'personId')::uuid) INTO ids FROM jsonb_array_elements(p->'people') x;
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'OFFICE_DUPLICATE_PERSON'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p->'people') LOOP
 pid:=(item->>'personId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM published.people person WHERE person.person_id=pid AND md5(to_jsonb(person)::text)=item->>'expectedFingerprint') THEN RAISE EXCEPTION 'OFFICE_PERSON_BASELINE_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('personId','expectedFingerprint','fallback','terms')) OR (item#>>'{fallback,list_status}') NOT IN ('other','candidate') OR public.valid_office_snapshot(item->'fallback',item#>>'{fallback,list_status}') IS DISTINCT FROM true OR jsonb_typeof(item->'terms') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'terms') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'OFFICE_INVALID_PERSON'; END IF;
 IF EXISTS(SELECT 1 FROM published.candidate_facts c WHERE c.person_id=pid AND c.election_result='elected' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(item->'terms') t WHERE (t->>'candidateId')::uuid=c.candidate_id)) THEN RAISE EXCEPTION 'OFFICE_INCOMPLETE_PERSON_TERMS'; END IF;
 FOR term IN SELECT * FROM jsonb_array_elements(item->'terms') LOOP
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(term) k WHERE k NOT IN ('candidateId','raceId','family','startsOn','endsOn','endedOn','sourceUrl','sourceVersion','reason','current','former')) OR public.valid_office_snapshot(term->'current','current') IS DISTINCT FROM true OR public.valid_office_snapshot(term->'former','former') IS DISTINCT FROM true THEN RAISE EXCEPTION 'OFFICE_INVALID_TERM'; END IF;
 IF NOT EXISTS(SELECT 1 FROM published.candidate_facts c JOIN public.races r ON r.id=c.race_id WHERE c.candidate_id=(term->>'candidateId')::uuid AND c.person_id=pid AND c.race_id=(term->>'raceId')::uuid AND c.election_result='elected' AND public.office_family_for_race(r.race_type)=term->>'family') THEN RAISE EXCEPTION 'OFFICE_UNPUBLISHED_CANDIDATE'; END IF;
 IF term#>>'{current,list_role}' IS DISTINCT FROM term#>>'{former,list_role}' OR NOT (CASE term->>'family' WHEN 'president' THEN term#>>'{current,list_role}' IN ('president','vice_president') WHEN 'legislator' THEN term#>>'{current,list_role}'='legislator' WHEN 'local' THEN term#>>'{current,list_role}' IN ('local_chief','councilor','other') ELSE false END) THEN RAISE EXCEPTION 'OFFICE_ROLE_FAMILY_CONFLICT'; END IF;
 IF COALESCE(term->>'sourceUrl','') !~ '^https://[^ /]+' OR length(COALESCE(term->>'sourceVersion',''))<1 OR length(COALESCE(term->>'reason',''))<2 THEN RAISE EXCEPTION 'OFFICE_EVIDENCE_REQUIRED'; END IF;
 END LOOP;
 END LOOP;
 SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]') INTO before_p FROM public.reviewed_office_profiles r WHERE person_id=ANY(ids);
 SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]') INTO before_t FROM public.reviewed_office_terms r WHERE person_id=ANY(ids);
 INSERT INTO public.office_release_history(id,revision,baseline_release_id,reviewed_by,reason,payload,before_profiles,before_terms)
 VALUES(new_id,revision_now+1,release_now,p->>'reviewedBy',p->>'reason',p,before_p,before_t);
 DELETE FROM public.reviewed_office_terms WHERE person_id=ANY(ids);
 FOR item IN SELECT * FROM jsonb_array_elements(p->'people') LOOP
 pid:=(item->>'personId')::uuid;
 INSERT INTO public.reviewed_office_profiles VALUES(pid,item->'fallback',new_id) ON CONFLICT(person_id) DO UPDATE SET fallback=excluded.fallback,release_id=excluded.release_id;
 FOR term IN SELECT * FROM jsonb_array_elements(item->'terms') LOOP
 INSERT INTO public.reviewed_office_terms VALUES((term->>'candidateId')::uuid,pid,(term->>'raceId')::uuid,term->>'family',(term->>'startsOn')::date,(term->>'endsOn')::date,(term->>'endedOn')::date,term->>'sourceUrl',term->>'sourceVersion',term->>'reason',term->'current',term->'former',new_id);
 END LOOP;
 END LOOP;
 UPDATE public.office_release_state SET revision=revision_now+1 WHERE singleton;
 REFRESH MATERIALIZED VIEW published.people_directory_snapshot;
 RETURN revision_now+1;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_reviewed_office_release(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_reviewed_office_release(jsonb) TO service_role;
CREATE FUNCTION public.rollback_reviewed_office_release(p_id uuid,p_expected_revision integer,p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h public.office_release_history; v integer; ids uuid[]; current_release uuid;
BEGIN
 SELECT revision INTO v FROM public.office_release_state WHERE singleton FOR UPDATE;
 SELECT * INTO h FROM public.office_release_history WHERE id=p_id;
 SELECT release_id INTO current_release FROM published.release_state WHERE state_key='current' FOR SHARE;
 IF jsonb_typeof(h.payload->'people') IS DISTINCT FROM 'array' OR h.id IS NULL OR v IS DISTINCT FROM p_expected_revision OR h.revision<>v OR h.baseline_release_id IS DISTINCT FROM current_release THEN RAISE EXCEPTION 'OFFICE_ROLLBACK_CONFLICT'; END IF;
 IF length(COALESCE(btrim(p_reason),''))<2 THEN RAISE EXCEPTION 'OFFICE_REASON_REQUIRED'; END IF;
 SELECT array_agg((x->>'personId')::uuid) INTO ids FROM jsonb_array_elements(h.payload->'people') x;
 DELETE FROM public.reviewed_office_terms WHERE person_id=ANY(ids);
 DELETE FROM public.reviewed_office_profiles WHERE person_id=ANY(ids);
 INSERT INTO public.reviewed_office_profiles SELECT * FROM jsonb_populate_recordset(NULL::public.reviewed_office_profiles,h.before_profiles);
 INSERT INTO public.reviewed_office_terms SELECT * FROM jsonb_populate_recordset(NULL::public.reviewed_office_terms,h.before_terms);
 INSERT INTO public.office_release_history(id,revision,baseline_release_id,reviewed_by,reason,payload,before_profiles,before_terms)
 VALUES(gen_random_uuid(),v+1,current_release,current_user,p_reason,jsonb_build_object('rollbackOf',p_id),'[]','[]');
 UPDATE public.office_release_state SET revision=v+1 WHERE singleton;
 REFRESH MATERIALIZED VIEW published.people_directory_snapshot;
 RETURN v+1;
END;
$$;
REVOKE ALL ON FUNCTION public.rollback_reviewed_office_release(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_reviewed_office_release(uuid,integer,text) TO service_role;
CREATE FUNCTION public.office_release_source(p_family text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 200) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH targets AS MATERIALIZED (
 SELECT DISTINCT c.person_id FROM published.candidate_facts c JOIN public.races r ON r.id=c.race_id
 WHERE c.election_result='elected' AND public.office_family_for_race(r.race_type)=p_family
 AND (p_after IS NULL OR c.person_id>p_after) ORDER BY c.person_id LIMIT least(greatest(p_limit,1),500)
 ), exclusions AS MATERIALIZED (
 SELECT m.canonical_person_id AS person_id,x.election_year,x.race_type,min(x.ended_at) AS ended_on,bool_or(x.ended_at IS NULL) AS unknown_end
 FROM public.current_office_exclusions x JOIN public.person_canonical_map m ON m.person_id=x.person_id GROUP BY 1,2,3
 ), rows AS (
 SELECT c.person_id,c.candidate_id,c.race_id,public.office_family_for_race(r.race_type) AS family,r.race_type,r.title,c.region_name,
 COALESCE(t.starts_on,o.starts_on,d.starts_on) AS starts_on,COALESCE(t.ends_on,o.ends_on,d.ends_on) AS ends_on,
 x.ended_on,COALESCE(x.unknown_end,false) AS unknown_end,
 COALESCE(t.source_url,o.source_url,core.source_url) AS source_url,
 md5(jsonb_build_array(c.candidate_id,c.race_id,c.election_result,t.starts_on,t.ends_on,o.starts_on,o.ends_on,e.voting_date,r.voting_date,x.ended_on,x.unknown_end)::text) AS source_version
 FROM targets selected JOIN published.candidate_facts c ON c.person_id=selected.person_id AND c.election_result='elected'
 JOIN public.races r ON r.id=c.race_id JOIN public.elections e ON e.id=r.election_id
 JOIN public.candidates core ON core.id=c.candidate_id
 LEFT JOIN public.candidate_office_tenures t ON t.candidate_id=c.candidate_id
 LEFT JOIN public.race_office_term_overrides o ON o.race_id=c.race_id
 LEFT JOIN LATERAL public.regular_office_term(public.office_family_for_race(r.race_type),COALESCE(r.voting_date,e.voting_date)) d
 ON e.election_type<>'by_election' AND (e.name||' '||r.title)!~'補選|遞補'
 LEFT JOIN exclusions x ON x.person_id=c.person_id AND x.election_year=e.year AND x.race_type=r.race_type
 ), people AS (
 SELECT person_id,jsonb_agg(to_jsonb(rows)-'person_id' ORDER BY starts_on,candidate_id) AS terms FROM rows GROUP BY person_id
 ) SELECT jsonb_build_object('people',COALESCE((SELECT jsonb_agg(to_jsonb(people) ORDER BY person_id) FROM people),'[]'),
 'next',(SELECT max(person_id::text) FROM targets),'count',(SELECT count(*) FROM targets));
$$;
REVOKE ALL ON FUNCTION public.office_release_source(text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_release_source(text,uuid,integer) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
