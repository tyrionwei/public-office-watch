-- 僅在已確認的本機／隔離資料庫執行；需先載入本次 schema。
-- 少量合成候選沿用本機公開人物/選區，最終全部 ROLLBACK。
BEGIN;
CREATE TEMP TABLE qualification_fixture AS
SELECT c.id AS template_id, c.person_id, c.race_id, f.election_id,
       r.event_key, r.region_key, r.region_slug,
       gen_random_uuid() AS eligible_id, gen_random_uuid() AS rejected_id,
       gen_random_uuid() AS withdrawn_id, gen_random_uuid() AS roster_id,
       gen_random_uuid() AS rejected_roster_id
FROM public.candidates c JOIN published.candidates f ON f.candidate_id=c.id
JOIN published.races r ON r.race_id=c.race_id
WHERE f.election_year=2026 AND c.registration_status IN ('registered','qualified')
  AND c.person_id IS NOT NULL AND r.race_type IN ('city_councilor','county_councilor')
LIMIT 1;
-- 為每件合成候選選不同既有公開人物，避免撞到 (person_id,race_id) 唯一鍵。
ALTER TABLE qualification_fixture ADD COLUMN fixture_people UUID[];
UPDATE qualification_fixture ctx SET fixture_people=(SELECT array_agg(person_id) FROM (
 SELECT p.person_id FROM published.people_directory p
 WHERE NOT EXISTS(SELECT 1 FROM public.candidates c WHERE c.person_id=p.person_id AND c.race_id=ctx.race_id)
 ORDER BY p.person_id LIMIT 3
) available);
DO $fixture$
DECLARE ctx RECORD; item RECORD; core public.candidates; fact published.candidate_facts;
BEGIN
 SELECT * INTO STRICT ctx FROM qualification_fixture;
 FOR item IN SELECT * FROM (VALUES
    (ctx.eligible_id,'registered','registered','pending',ctx.fixture_people[1]),
    (ctx.rejected_id,'disqualified','withdrawn_or_disqualified','unknown',ctx.fixture_people[2]),
    (ctx.withdrawn_id,'withdrawn','withdrawn_or_disqualified','unknown',ctx.fixture_people[3])
 ) AS input(id,registration_status,candidacy_status,election_result,person_id) LOOP
  SELECT * INTO core FROM public.candidates WHERE id=ctx.template_id;
  core.id:=item.id; core.person_id:=item.person_id; core.external_id:='qualification-fixture-'||item.id;
  core.candidate_name:='資格測試人物'; core.party:='資格測試政黨';
  core.registration_status:=item.registration_status; core.candidacy_status:=item.candidacy_status;
  core.election_result:=item.election_result; core.vote_count:=NULL; core.vote_rate:=NULL;
  core.is_elected:=NULL; core.candidate_no:=NULL;
  INSERT INTO public.candidates SELECT core.*;
  SELECT * INTO fact FROM published.candidate_facts WHERE candidate_id=ctx.template_id;
  fact.candidate_id:=item.id; fact.person_id:=item.person_id; fact.person_name:=core.candidate_name; fact.party:=core.party;
  fact.registration_status:=item.registration_status; fact.candidacy_status:=item.candidacy_status;
  fact.election_result:=item.election_result; fact.vote_count:=NULL; fact.vote_rate:=NULL;
  fact.is_elected:=NULL; fact.candidate_no:=NULL;
  INSERT INTO published.candidate_facts SELECT fact.*;
 END LOOP;
 INSERT INTO public.registration_name_roster(id,source_claim_id,candidate_external_id,race_id,
   display_name,source_name,source_url,source_hash,is_public,registration_status)
 SELECT id,gen_random_uuid(),'qualification-fixture-'||id,ctx.race_id,
   '資格測試名錄','測試官方來源','https://web.cec.gov.tw/central/article/test',repeat('a',64),true,status
 FROM (VALUES(ctx.roster_id,'registered'),(ctx.rejected_roster_id,'disqualified')) AS input(id,status);
 INSERT INTO public.candidate_lifecycle_events(external_id,candidate_id,event_type,occurred_on,
   source_published_on,source_name,source_url,source_hash,fetched_at,event_data,is_public)
 VALUES('qualification-fixture-'||ctx.rejected_id,ctx.rejected_id,'qualification_rejected','2026-10-16',
  '2026-10-16','測試官方來源','https://web.cec.gov.tw/central/article/test',repeat('a',64),now(),
  '{"privateReview":"DO_NOT_EXPOSE_QUALIFICATION_REVIEW"}',true);
 INSERT INTO public.candidate_lifecycle_events(external_id,registration_name_id,event_type,occurred_on,
   source_name,source_url,source_hash,fetched_at,is_public)
 VALUES('qualification-fixture-'||ctx.rejected_roster_id,ctx.rejected_roster_id,'qualification_rejected',
   '2026-10-16','測試官方來源','https://web.cec.gov.tw/central/article/test',repeat('a',64),now(),false);
 -- 同一事件不能同時指向人物候選與姓名名錄。
 BEGIN
  UPDATE public.candidate_lifecycle_events SET registration_name_id=ctx.roster_id
  WHERE candidate_id=ctx.rejected_id;
  RAISE EXCEPTION 'Ambiguous event subject accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END;
$fixture$;
GRANT SELECT ON qualification_fixture TO anon;
-- 合格測試從已登記原列開始；保存完整列，驗證正常狀態 trigger 與新增事件可一起回復。
CREATE TEMP TABLE qualification_transition_before AS
SELECT jsonb_build_object(
 'candidate',(SELECT to_jsonb(c) FROM public.candidates c WHERE c.id=ctx.eligible_id),
 'fact',(SELECT to_jsonb(f) FROM published.candidate_facts f WHERE f.candidate_id=ctx.eligible_id),
 'roster',(SELECT to_jsonb(n) FROM public.registration_name_roster n WHERE n.id=ctx.roster_id),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY id),'[]'::jsonb)
   FROM public.candidate_status_history h WHERE h.candidate_id=ctx.eligible_id),
 'events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY id),'[]'::jsonb)
   FROM public.candidate_lifecycle_events e WHERE e.candidate_id=ctx.eligible_id OR e.registration_name_id=ctx.roster_id),
 'people',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.people p WHERE p.id=ANY(ctx.fixture_people))
) AS payload FROM qualification_fixture ctx;
SAVEPOINT qualification_confirmed_transition;
UPDATE public.candidates SET registration_status='qualified',candidacy_status='qualified',updated_at=now()
WHERE id IN (SELECT eligible_id FROM qualification_fixture);
UPDATE published.candidate_facts f SET registration_status=c.registration_status,
 candidacy_status=c.candidacy_status,status_updated_at=c.status_updated_at,candidate_updated_at=c.updated_at
FROM public.candidates c JOIN qualification_fixture ctx ON ctx.eligible_id=c.id WHERE f.candidate_id=c.id;
UPDATE public.registration_name_roster SET registration_status='qualified'
WHERE id IN (SELECT roster_id FROM qualification_fixture);
INSERT INTO public.candidate_lifecycle_events(external_id,candidate_id,event_type,occurred_on,
 source_published_on,source_name,source_url,source_hash,fetched_at,event_data,is_public)
SELECT 'qualification-confirmed-fixture-'||eligible_id,eligible_id,'qualification_confirmed','2026-10-16',
 '2026-10-16','測試官方審定來源','https://web.cec.gov.tw/central/article/test',repeat('b',64),now(),
 '{"privateReview":"DO_NOT_EXPOSE_QUALIFICATION_CONFIRMED"}',true FROM qualification_fixture;
INSERT INTO public.candidate_lifecycle_events(external_id,registration_name_id,event_type,occurred_on,
 source_published_on,source_name,source_url,source_hash,fetched_at,is_public)
SELECT 'qualification-confirmed-fixture-'||roster_id,roster_id,'qualification_confirmed','2026-10-16',
 '2026-10-16','測試官方審定來源','https://web.cec.gov.tw/central/article/test',repeat('b',64),now(),false
FROM qualification_fixture;
DO $confirmed_scope$
DECLARE ctx RECORD; baseline JSONB;
BEGIN
 SELECT * INTO STRICT ctx FROM qualification_fixture;
 SELECT payload INTO STRICT baseline FROM qualification_transition_before;
 IF (SELECT to_jsonb(c)-ARRAY['registration_status','candidacy_status','status_updated_at','updated_at']
     FROM public.candidates c WHERE id=ctx.eligible_id)
   IS DISTINCT FROM (baseline->'candidate')-ARRAY['registration_status','candidacy_status','status_updated_at','updated_at']
 OR (SELECT to_jsonb(f)-ARRAY['registration_status','candidacy_status','status_updated_at','candidate_updated_at']
     FROM published.candidate_facts f WHERE candidate_id=ctx.eligible_id)
   IS DISTINCT FROM (baseline->'fact')-ARRAY['registration_status','candidacy_status','status_updated_at','candidate_updated_at']
 OR (SELECT to_jsonb(n)-'registration_status' FROM public.registration_name_roster n WHERE id=ctx.roster_id)
   IS DISTINCT FROM (baseline->'roster')-'registration_status'
 OR (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.people p WHERE id=ANY(ctx.fixture_people))
   IS DISTINCT FROM baseline->'people'
 THEN RAISE EXCEPTION 'Qualification changed registration source, votes, identity or office'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidate_lifecycle_events WHERE registration_name_id=ctx.roster_id
   AND candidate_id IS NULL AND event_type='qualification_confirmed' AND source_hash=repeat('b',64)
   AND occurred_on='2026-10-16' AND NOT is_public)
 THEN RAISE EXCEPTION 'Qualified name-only event/source missing or publication widened'; END IF;
END;
$confirmed_scope$;
SET LOCAL ROLE anon;
DO $assert$
DECLARE ctx RECORD; page JSONB; profile JSONB; names JSONB; history JSONB; total INTEGER;
BEGIN
 SELECT * INTO STRICT ctx FROM qualification_fixture;
 SELECT payload INTO page FROM published.race_page_for(ctx.race_id);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'candidate_rows') row
   WHERE row->>'candidate_id'=ctx.eligible_id::text AND row->>'registration_status'='qualified'
    AND row->>'candidacy_status'='qualified')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(page->'candidate_rows') row WHERE row->>'candidate_id' IN (ctx.rejected_id::text,ctx.withdrawn_id::text))
 THEN RAISE EXCEPTION 'Race candidate eligibility incorrect'; END IF;
 SELECT payload INTO page FROM published.home_page_for(ctx.region_slug);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'candidate_rows') row WHERE row->>'candidate_id'=ctx.eligible_id::text)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(page->'candidate_rows') row
   WHERE row->>'candidate_id' IN(ctx.rejected_id::text,ctx.withdrawn_id::text))
 THEN RAISE EXCEPTION 'Home page includes ineligible registration'; END IF;
 SELECT payload INTO profile FROM published.person_profiles_for(ARRAY[ctx.fixture_people[2]]);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(profile->'candidate_rows') row
   WHERE row->>'candidate_id'=ctx.rejected_id::text AND row->>'registration_status'='disqualified'
    AND row->>'election_result'='unknown' AND row->>'vote_count' IS NULL AND row->>'is_elected' IS NULL)
 THEN RAISE EXCEPTION 'Rejected registration lost from person history'; END IF;
 SELECT jsonb_agg(row) INTO history FROM published.candidate_lifecycle_for(ctx.rejected_id) row;
 IF jsonb_array_length(history) IS DISTINCT FROM 1 OR history::text LIKE '%DO_NOT_EXPOSE%'
 THEN RAISE EXCEPTION 'Lifecycle missing or private review exposed'; END IF;
 SELECT payload INTO profile FROM published.person_profiles_for(ARRAY[ctx.fixture_people[1]]);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(profile->'candidate_rows') row
   WHERE row->>'candidate_id'=ctx.eligible_id::text AND row->>'registration_status'='qualified'
    AND row->>'candidacy_status'='qualified' AND row->>'election_result'='pending'
    AND row->>'vote_count' IS NULL AND row->>'vote_rate' IS NULL AND row->>'is_elected' IS NULL)
 THEN RAISE EXCEPTION 'Qualified candidate status/result missing from person profile'; END IF;
 SELECT jsonb_agg(row) INTO history FROM published.candidate_lifecycle_for(ctx.eligible_id) row;
 IF jsonb_array_length(history) IS DISTINCT FROM 1 OR history::text LIKE '%DO_NOT_EXPOSE%'
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(history) row
   WHERE row->>'event_type'='qualification_confirmed' AND row->>'occurred_on'='2026-10-16'
    AND row->>'source_url'='https://web.cec.gov.tw/central/article/test')
 THEN RAISE EXCEPTION 'Qualification confirmation/source missing or private review exposed'; END IF;
 SELECT jsonb_agg(row) INTO names FROM published.registration_names_for(ARRAY[ctx.race_id]) row;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(names) row WHERE row->>'candidate_id'=ctx.roster_id::text AND row->>'registration_status'='qualified')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(names) row WHERE row->>'candidate_id'=ctx.rejected_roster_id::text)
 THEN RAISE EXCEPTION 'Registration name eligibility incorrect'; END IF;
 SELECT candidate_count INTO total FROM published.election_party_performance(ctx.event_key,ARRAY[ctx.election_id],NULL,ctx.region_key)
 WHERE party_name='資格測試政黨';
 IF total IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Party statistics counted rejected/withdrawn registrations: %',total; END IF;
 IF EXISTS(SELECT 1 FROM published.active_party_candidates WHERE candidate_id IN(ctx.rejected_id,ctx.withdrawn_id))
 THEN RAISE EXCEPTION 'Active party candidates include rejected registration'; END IF;
 IF has_function_privilege('anon','published.home_candidate_summaries_for(uuid[])','EXECUTE')
 THEN RAISE EXCEPTION 'Retired RPC permission widened'; END IF;
 IF has_table_privilege('anon','public.registration_name_roster','SELECT')
 OR has_table_privilege('anon','public.candidate_lifecycle_events','SELECT')
 THEN RAISE EXCEPTION 'Private table access widened'; END IF;
END;
$assert$;
RESET ROLE;
ROLLBACK TO SAVEPOINT qualification_confirmed_transition;
DO $confirmed_rollback$
DECLARE ctx RECORD; baseline JSONB;
BEGIN
 SELECT * INTO STRICT ctx FROM qualification_fixture;
 SELECT payload INTO STRICT baseline FROM qualification_transition_before;
 IF (SELECT to_jsonb(c) FROM public.candidates c WHERE id=ctx.eligible_id) IS DISTINCT FROM baseline->'candidate'
 OR (SELECT to_jsonb(f) FROM published.candidate_facts f WHERE candidate_id=ctx.eligible_id) IS DISTINCT FROM baseline->'fact'
 OR (SELECT to_jsonb(n) FROM public.registration_name_roster n WHERE id=ctx.roster_id) IS DISTINCT FROM baseline->'roster'
 OR (SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY id),'[]'::jsonb) FROM public.candidate_status_history h
     WHERE candidate_id=ctx.eligible_id) IS DISTINCT FROM baseline->'history'
 OR (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY id),'[]'::jsonb) FROM public.candidate_lifecycle_events e
     WHERE candidate_id=ctx.eligible_id OR registration_name_id=ctx.roster_id) IS DISTINCT FROM baseline->'events'
 OR (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.people p WHERE id=ANY(ctx.fixture_people))
   IS DISTINCT FROM baseline->'people'
 THEN RAISE EXCEPTION 'Qualification confirmation rollback did not restore exact before-image'; END IF;
END;
$confirmed_rollback$;
SET LOCAL ROLE anon;
DO $registered_again$
DECLARE ctx RECORD; page JSONB;
BEGIN
 SELECT * INTO STRICT ctx FROM qualification_fixture;
 SELECT payload INTO page FROM published.race_page_for(ctx.race_id);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'candidate_rows') row
   WHERE row->>'candidate_id'=ctx.eligible_id::text AND row->>'registration_status'='registered')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(page->'candidate_rows') row
   WHERE row->>'candidate_id' IN(ctx.rejected_id::text,ctx.withdrawn_id::text))
 THEN RAISE EXCEPTION 'Qualification rollback lost registration or restored ineligible candidates'; END IF;
 IF NOT EXISTS(SELECT 1 FROM published.registration_names_for(ARRAY[ctx.race_id]) row
   WHERE row->>'candidate_id'=ctx.roster_id::text AND row->>'registration_status'='registered')
 OR EXISTS(SELECT 1 FROM published.registration_names_for(ARRAY[ctx.race_id]) row
   WHERE row->>'candidate_id'=ctx.rejected_roster_id::text)
 THEN RAISE EXCEPTION 'Qualification rollback lost name registration or restored rejected name'; END IF;
 IF EXISTS(SELECT 1 FROM published.candidate_lifecycle_for(ctx.eligible_id)
   WHERE event_type='qualification_confirmed')
 THEN RAISE EXCEPTION 'Rolled-back qualification confirmation remains public'; END IF;
END;
$registered_again$;
RESET ROLE;
ROLLBACK;
