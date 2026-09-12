\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/migrations/20260912112359_feedback_admin_workflow.sql
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERT: %',message; END IF; END; $$;
DO $$
DECLARE admin_id uuid := gen_random_uuid(); ordinary uuid := gen_random_uuid(); fid uuid; person uuid; saved jsonb; dashboard jsonb; payload jsonb; rid uuid:=gen_random_uuid(); before_count int; original_message text:='這是測試用回報內容，請查證人物學經歷的年份是否正確。';
BEGIN
  INSERT INTO auth.users(id,raw_app_meta_data,is_anonymous) VALUES(admin_id,'{"chat_admin":true}',false),(ordinary,'{}',false);
  SELECT id INTO person FROM public.people LIMIT 1;
  PERFORM pg_temp.assert_true(person IS NOT NULL,'fixture person exists');
  INSERT INTO public.person_feedback_submissions(person_id,feedback_kind,section_key,problem_type,message,participant_hash)
  VALUES(person,'problem_report','resume','inaccurate',original_message,gen_random_uuid()::text) RETURNING id INTO fid;
  BEGIN PERFORM public.admin_feedback(ordinary,'dashboard'); RAISE EXCEPTION 'nonadmin unexpectedly authorized'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM pg_temp.assert_true(NOT has_function_privilege('anon','public.admin_feedback(uuid,text,jsonb)','EXECUTE'),'anon denied RPC');
  PERFORM pg_temp.assert_true(NOT has_function_privilege('authenticated','public.admin_feedback(uuid,text,jsonb)','EXECUTE'),'authenticated denied RPC');
  PERFORM pg_temp.assert_true(NOT has_table_privilege('authenticated','public.person_feedback_history','SELECT'),'history private');
  payload:=jsonb_build_object('id',fid,'expectedRevision',1,'requestId',rid,'decision','accepted','priority','high','workStatus','in_progress','note','請優先核對官方來源','summary','測試摘要');
  saved:=public.admin_feedback(admin_id,'save',payload);
  PERFORM pg_temp.assert_true(saved->>'priority'='high' AND saved->>'revision'='2','accept priority');
  PERFORM pg_temp.assert_true(NOT saved ? 'participant_hash','identity excluded');
  SELECT count(*) INTO before_count FROM public.person_feedback_history WHERE feedback_id=fid;
  PERFORM public.admin_feedback(admin_id,'save',payload);
  PERFORM pg_temp.assert_true((SELECT count(*)=before_count FROM public.person_feedback_history WHERE feedback_id=fid),'retry idempotent');
  BEGIN PERFORM public.admin_feedback(admin_id,'save',payload||jsonb_build_object('note','different')); RAISE EXCEPTION 'bad retry allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FEEDBACK_REQUEST_CONFLICT' THEN RAISE; END IF; END;
  BEGIN PERFORM public.admin_feedback(admin_id,'save',payload||jsonb_build_object('requestId',gen_random_uuid())); RAISE EXCEPTION 'stale allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FEEDBACK_CONFLICT' THEN RAISE; END IF; END;
  -- Exercise the exact ON CONFLICT columns used by the existing proxy-guarded submission function.
  UPDATE public.person_feedback_submissions SET submission_count=submission_count+1,review_status='received',updated_at=now() WHERE id=fid;
  PERFORM pg_temp.assert_true((SELECT decision='accepted' AND priority='high' AND review_status='verified' AND content_version=1 AND revision=3 FROM public.person_feedback_submissions WHERE id=fid),'duplicate retains decision and bumps revision');
  UPDATE public.person_feedback_submissions SET message=original_message||'新增官方資料。',submission_count=submission_count+1,review_status='received',updated_at=now() WHERE id=fid;
  PERFORM pg_temp.assert_true((SELECT decision='pending' AND priority='normal' AND work_status='pending' AND previous_decision='accepted' AND content_version=2 AND review_note='請優先核對官方來源' FROM public.person_feedback_submissions WHERE id=fid),'changed content reopens preserves note');
  payload:=payload||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',4,'decision','rejected','priority','normal','workStatus','pending','note','');
  BEGIN PERFORM public.admin_feedback(admin_id,'save',payload); RAISE EXCEPTION 'empty reason allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FEEDBACK_REASON_REQUIRED' THEN RAISE; END IF; END;
  PERFORM pg_temp.assert_true((SELECT revision=4 FROM public.person_feedback_submissions WHERE id=fid),'invalid save unchanged');
  saved:=public.admin_feedback(admin_id,'save',payload||jsonb_build_object('note','已核對，原資料正確'));
  saved:=public.admin_feedback(admin_id,'save',payload||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',5,'decision','accepted','workStatus','completed','note','補充修正已完成'));
  PERFORM pg_temp.assert_true(saved->>'decision'='accepted' AND saved->>'work_status'='completed','redecision completion supported');
  dashboard:=public.admin_feedback(admin_id,'dashboard',jsonb_build_object('query','補充修正已完成'));
  PERFORM pg_temp.assert_true(dashboard->'groups'->'normal'->>'total'='1' AND dashboard->'groups'->'normal'->>'unfinished'='0','note search and completed excluded backlog');
  PERFORM pg_temp.assert_true((SELECT count(*)=4 FROM jsonb_object_keys(dashboard->'groups')),'four sections always');
  saved:=public.admin_feedback(admin_id,'detail',jsonb_build_object('id',fid));
  PERFORM pg_temp.assert_true(saved->>'history_total'='6','all events preserved');
  BEGIN UPDATE public.person_feedback_history SET event='baseline' WHERE feedback_id=fid; RAISE EXCEPTION 'history update allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Feedback history is immutable' THEN RAISE; END IF; END;
END;
$$;
DO $$
DECLARE aid uuid:=gen_random_uuid(); person uuid; fid uuid; participant text:=gen_random_uuid()::text; dashboard jsonb; saved jsonb; i int;
BEGIN
  INSERT INTO auth.users(id,raw_app_meta_data,is_anonymous) VALUES(aid,'{"chat_admin":true}',false);
  SELECT id INTO person FROM public.people LIMIT 1;
  FOR i IN 1..12 LOOP
    INSERT INTO public.person_feedback_submissions(person_id,feedback_kind,section_key,problem_type,message,participant_hash)
      VALUES(person,'problem_report','resume','inaccurate','分頁專用合成測試回報，這是長度足夠的測試描述 '||i,CASE WHEN i=1 THEN participant ELSE gen_random_uuid()::text END)
      RETURNING id INTO fid;
  END LOOP;
  dashboard:=public.admin_feedback(aid,'dashboard','{"query":"分頁專用","pages":{"pending":2,"priority":1}}');
  PERFORM pg_temp.assert_true(dashboard->'groups'->'pending'->>'total'='12','filtered total');
  PERFORM pg_temp.assert_true(jsonb_array_length(dashboard->'groups'->'pending'->'items')=2,'independent second page');
  -- Real ON CONFLICT execution exercises trigger timing, not just direct UPDATE.
  INSERT INTO public.person_feedback_submissions(person_id,feedback_kind,section_key,problem_type,message,participant_hash)
    VALUES(person,'problem_report','resume','inaccurate','分頁專用合成測試回報，這是長度足夠的測試描述 1',participant)
    ON CONFLICT(person_id,feedback_kind,section_key,participant_hash) DO UPDATE SET
      message=EXCLUDED.message,review_status='received',submission_count=public.person_feedback_submissions.submission_count+1,updated_at=now()
    RETURNING id INTO fid;
  PERFORM pg_temp.assert_true((SELECT count(*)=2 FROM public.person_feedback_history WHERE feedback_id=fid),'upsert produces one duplicate history');
  saved:=public.admin_feedback(aid,'detail',jsonb_build_object('id',fid));
  PERFORM pg_temp.assert_true(saved->'item'->>'content_version'='1','unchanged upsert does not create content version');
END;
$$;
SELECT 'feedback admin database tests passed' AS result;
ROLLBACK;
