-- Full-local only. The runner must wrap migration + this regression in BEGIN/ROLLBACK.
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END; $$;
CREATE FUNCTION pg_temp.reject_package(p jsonb, expected text) RETURNS void LANGUAGE plpgsql AS $$
 DECLARE caught boolean:=false;
 BEGIN
 BEGIN PERFORM public.apply_reviewed_office_release(p); EXCEPTION WHEN OTHERS THEN
 IF SQLERRM NOT LIKE '%'||expected||'%' THEN RAISE; END IF; caught:=true; END;
 PERFORM pg_temp.assert_true(caught,'invalid package was not rejected: '||expected);
 END; $$;
CREATE TEMP TABLE fixture AS SELECT c.person_id,min(c.candidate_id::text)::uuid AS candidate_id
 FROM published.candidate_facts c JOIN published.people p USING(person_id)
 WHERE c.election_result='elected' AND p.list_role='councilor' GROUP BY c.person_id LIMIT 1;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM fixture),'fixture exists');
CREATE TEMP TABLE baseline AS SELECT public.office_release_baseline(ARRAY(SELECT person_id FROM fixture)) AS data;
CREATE TEMP TABLE prior_person AS SELECT to_jsonb(p)-ARRAY['position','district','current_office_label','list_role','list_status','list_is_grassroots','list_status_order','list_role_order','list_is_party_only'] AS data FROM published.people p JOIN fixture USING(person_id);
CREATE TEMP TABLE package AS
WITH snap AS (SELECT jsonb_build_object('position',NULL,'district',NULL,'current_office_label',NULL,'list_role','other','list_status','other','list_is_grassroots',false,'list_status_order',3,'list_role_order',8) AS s),
terms AS (SELECT jsonb_agg(jsonb_build_object('candidateId',c.candidate_id,'raceId',c.race_id,'family',public.office_family_for_race(r.race_type),
 'startsOn','2024-02-01','endsOn','2028-02-01','endedOn','2026-01-02','sourceUrl','https://example.test/official-term','sourceVersion','transaction-fixture','reason','SQL regression fixture',
 'current',s||'{"position":"測試議員","current_office_label":"測試議員","list_role":"councilor","list_status":"current","list_status_order":0,"list_role_order":5}'::jsonb,
 'former',s||'{"position":"測試議員","list_role":"councilor","list_status":"former","list_status_order":2,"list_role_order":5}'::jsonb)) AS ts
 FROM published.candidate_facts c JOIN fixture USING(person_id) JOIN public.races r ON r.id=c.race_id CROSS JOIN snap WHERE c.election_result='elected')
SELECT jsonb_build_object('schemaVersion',1,'packageId',gen_random_uuid(),'asOf','2026-09-13','expectedReleaseId',data->'releaseId','expectedOfficeRevision',data->'officeRevision','reviewedBy','SQL test','reason','transaction-only test',
 'people',jsonb_build_array(jsonb_build_object('personId',fixture.person_id,'expectedFingerprint',data#>>'{people,0,fingerprint}','fallback',s,'terms',ts))) AS p
FROM fixture,baseline,snap,terms;
SELECT pg_temp.reject_package(p||'{"expectedOfficeRevision":-1}','OFFICE_BASELINE_CONFLICT') FROM package;
SELECT pg_temp.reject_package(p||'{"claims":[]}','OFFICE_UNEXPECTED_FIELD') FROM package;
SELECT pg_temp.reject_package(jsonb_set(p,'{people,0,expectedFingerprint}','"stale"'),'OFFICE_PERSON_BASELINE_CONFLICT') FROM package;
SELECT pg_temp.reject_package(jsonb_set(p,'{people,0,terms,0,sourceUrl}','""'),'OFFICE_EVIDENCE_REQUIRED') FROM package;
SELECT pg_temp.reject_package(jsonb_set(p,'{people,0,terms,0,current,list_status}','"candidate"'),'OFFICE_INVALID_TERM') FROM package;
SELECT public.apply_reviewed_office_release(p) FROM package;
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2024-01-31')->>'list_status'='other','future election is not current') FROM fixture;
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2024-02-01')->>'list_status'='current','starts on inauguration') FROM fixture;
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-01-01')->>'list_status'='current','cross-year term continues') FROM fixture;
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id,'2026-01-02')->>'list_status'='former','early departure expires on exact date') FROM fixture;
SELECT pg_temp.assert_true(public.candidate_holds_office(candidate_id,'2025-01-01') AND NOT public.candidate_holds_office(candidate_id,'2026-01-02'),'office predicate uses approved dates') FROM fixture;
SELECT pg_temp.assert_true((SELECT starts_on='2024-02-01'::date AND ends_on='2028-02-01'::date FROM public.candidate_office_term(candidate_id)),'voting keeps inauguration and nominal term') FROM fixture;
SELECT pg_temp.assert_true(p.list_status='former' AND p.list_status=d.list_status AND p.current_office_label IS NOT DISTINCT FROM d.current_office_label,'person and directory agree') FROM published.people p JOIN published.people_directory d USING(person_id) JOIN fixture USING(person_id);
SELECT pg_temp.assert_true((SELECT data FROM prior_person)=(SELECT to_jsonb(p)-ARRAY['position','district','current_office_label','list_role','list_status','list_is_grassroots','list_status_order','list_role_order','list_is_party_only'] FROM published.people p JOIN fixture USING(person_id)),'no non-office person fields changed');
SELECT pg_temp.assert_true((SELECT release_id FROM published.release_state WHERE state_key='current') IS NOT DISTINCT FROM ((SELECT data FROM baseline)->>'releaseId')::uuid,'no promote');
SELECT pg_temp.assert_true(position('TRUNCATE' in upper(pg_get_functiondef('public.refresh_public_people_list_cached()'::regprocedure)))=0,'ordinary refresh preserves approved data');
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
CREATE TEMP TABLE legacy_offices_before AS TABLE public.person_office_status_cache;
TRUNCATE public.person_office_status_cache;
SELECT pg_temp.assert_true(public.reviewed_office_snapshot(person_id)->>'list_status'='former','legacy cache lifecycle does not lose approved terms') FROM fixture;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.apply_reviewed_office_release(jsonb)','EXECUTE') AND NOT has_function_privilege('authenticated','public.rollback_reviewed_office_release(uuid,integer,text)','EXECUTE'),'mutations denied to browser roles');
SELECT pg_temp.assert_true(NOT has_table_privilege('anon','public.office_release_history','SELECT'),'private audit history');
SET LOCAL ROLE anon;
SELECT person_id,list_status FROM published.people_directory WHERE person_id=(SELECT person_id FROM published.people_directory WHERE list_status='former' LIMIT 1) LIMIT 1;
RESET ROLE;
-- A stale national assignment must become unknown, not vacant or the old holder.
UPDATE public.national_office_assignments SET holder_person_id=(SELECT person_id FROM fixture) WHERE institution_key='presidency' AND role_key='chief';
SELECT pg_temp.assert_true(tenure_status='unknown' AND holder_name IS NULL AND holder_person_id IS NULL,'expired national holder is pending update') FROM published.national_office_holders WHERE institution_key='presidency' AND role_key='chief';
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname IN ('refresh-office-legislators','refresh-office-presidency','refresh-office-local')),'no expensive production cron');
INSERT INTO public.person_office_status_cache SELECT * FROM legacy_offices_before;
SELECT public.rollback_reviewed_office_release((p->>'packageId')::uuid,(p->>'expectedOfficeRevision')::int+1,'transaction rollback test') FROM package;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.reviewed_office_profiles JOIN fixture USING(person_id)),'rollback restores unreviewed profile');
SELECT pg_temp.assert_true((SELECT revision FROM public.office_release_state)=((SELECT data FROM baseline)->>'officeRevision')::int+2,'rollback advances revision');
SELECT pg_temp.assert_true((public.office_release_baseline(ARRAY(SELECT person_id FROM fixture))#>>'{people,0,fingerprint}')=((SELECT data FROM baseline)#>>'{people,0,fingerprint}'),'rollback restores office presentation exactly');
-- A newly approved presidency term replaces the static holder and cannot fall
-- back to that stale holder when it expires. All rows are transaction fixtures.
DO $$
DECLARE f record; p jsonb; t jsonb; v integer;
BEGIN
 SELECT c.person_id,min(c.candidate_id::text)::uuid AS candidate_id,min(c.race_id::text)::uuid AS race_id INTO f
 FROM published.candidate_facts c JOIN public.races r ON r.id=c.race_id
 WHERE c.election_result='elected' GROUP BY c.person_id
 HAVING count(*)=1 AND bool_and(public.office_family_for_race(r.race_type)='president') LIMIT 1;
 PERFORM pg_temp.assert_true(f.person_id IS NOT NULL,'single-term presidential fixture exists');
 SELECT data.p INTO p FROM package data;
 t:=p#>'{people,0,terms,0}';
 t:=t||jsonb_build_object('candidateId',f.candidate_id,'raceId',f.race_id,'family','president','endedOn',NULL,
 'current',(t->'current')||'{"list_role":"president","list_role_order":0,"position":"總統","current_office_label":"總統"}'::jsonb,
 'former',(t->'former')||'{"list_role":"president","list_role_order":0,"position":"總統"}'::jsonb);
 SELECT revision INTO v FROM public.office_release_state;
 p:=p||jsonb_build_object('packageId',gen_random_uuid(),'expectedOfficeRevision',v,'people',jsonb_build_array(
 jsonb_build_object('personId',f.person_id,'expectedFingerprint',(public.office_release_baseline(ARRAY[f.person_id])#>>'{people,0,fingerprint}'),'fallback',p#>'{people,0,fallback}','terms',jsonb_build_array(t))));
 PERFORM public.apply_reviewed_office_release(p);
 PERFORM pg_temp.assert_true((SELECT holder_person_id=f.person_id AND tenure_status='current' FROM published.national_office_holders WHERE institution_key='presidency' AND role_key='chief'),'approved incoming holder appears on national card');
 UPDATE public.reviewed_office_terms SET ends_on=(now() AT TIME ZONE 'Asia/Taipei')::date-1 WHERE person_id=f.person_id;
 PERFORM pg_temp.assert_true((SELECT holder_person_id IS NULL AND tenure_status='unknown' FROM published.national_office_holders WHERE institution_key='presidency' AND role_key='chief'),'expired successor cannot resurrect static predecessor');
 PERFORM public.rollback_reviewed_office_release((p->>'packageId')::uuid,v+1,'presidency fixture rollback');
END;
$$;
