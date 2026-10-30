-- Synthetic fixture only. Runner verifies a dedicated network-none ephemeral DB.
BEGIN;
CREATE TEMP TABLE ballot_before AS SELECT jsonb_build_object(
 'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.candidates t),
 'roster',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.registration_name_roster t),
 'events',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.candidate_lifecycle_events t)) AS snapshot;
CREATE TEMP TABLE ballot_ctx AS SELECT gen_random_uuid() AS election_id,gen_random_uuid() AS race_id,
 gen_random_uuid() AS private_race_id,gen_random_uuid() AS candidate_id,gen_random_uuid() AS person_id,
 ARRAY(SELECT gen_random_uuid() FROM generate_series(1,10)) AS names;
GRANT SELECT ON ballot_ctx TO anon;
INSERT INTO public.elections SELECT election_id,2026,'合成選舉',true FROM ballot_ctx;
INSERT INTO public.races SELECT race_id,election_id,gen_random_uuid(),'合成選區','合成縣',true FROM ballot_ctx;
INSERT INTO public.races SELECT private_race_id,election_id,gen_random_uuid(),'私人選區','合成縣',false FROM ballot_ctx;
INSERT INTO public.candidates SELECT candidate_id,'replaces-roster',person_id,race_id,'合成人物',NULL,
 'qualified','qualified','原政黨','https://web.cec.gov.tw/original',true,TIMESTAMPTZ '2026-10-01T00:00:00Z' FROM ballot_ctx;
INSERT INTO public.registration_name_roster(id,source_claim_id,candidate_external_id,race_id,display_name,party,
 source_name,source_url,source_hash,is_public,registration_status)
SELECT names[i],gen_random_uuid(),CASE WHEN i=7 THEN 'replaces-roster' ELSE 'ballot-fixture-'||i END,
 CASE WHEN i=6 THEN private_race_id ELSE race_id END,'合成名錄'||i,'原政黨','原登記來源',
 'https://web.cec.gov.tw/registration',repeat('a',64),i<>5,
 CASE WHEN i=4 THEN 'disqualified' WHEN i=8 THEN 'withdrawn' ELSE 'qualified' END
FROM ballot_ctx CROSS JOIN generate_series(1,10) i;

-- 1 private event, 2 duplicate same number, 3 conflicting numbers, 4 ineligible,
-- 5 private subject, 6 private race, 7 replaced roster, 8 withdrawn, 9 unknown, 10 public.
INSERT INTO public.candidate_lifecycle_events(external_id,registration_name_id,event_type,
 source_name,source_url,source_hash,fetched_at,event_data,is_public)
SELECT 'ballot-fixture-'||i,names[i],'ballot_number_assigned','抽籤來源',
 'https://web.cec.gov.tw/ballot',repeat('b',64),'2026-10-28T03:34:35Z',
 jsonb_build_object('candidateNo',i::text,'privateReview','DO_NOT_EXPOSE','sourcePersonKey','PRIVATE_KEY'),i<>1
FROM ballot_ctx CROSS JOIN generate_series(1,10) i WHERE i<>9;
INSERT INTO public.candidate_lifecycle_events(external_id,registration_name_id,event_type,
 source_name,source_url,source_hash,fetched_at,event_data,is_public)
SELECT 'ballot-fixture-duplicate',names[2],'ballot_number_assigned','抽籤來源',
 'https://web.cec.gov.tw/ballot',repeat('b',64),TIMESTAMPTZ '2026-10-28T03:34:35Z','{"candidateNo":"2"}'::jsonb,true FROM ballot_ctx
UNION ALL SELECT 'ballot-fixture-conflict',names[3],'ballot_number_assigned','更正尚待核',
 'https://web.cec.gov.tw/correction',repeat('c',64),TIMESTAMPTZ '2026-10-28T03:34:35Z','{"candidateNo":"11"}'::jsonb,true FROM ballot_ctx;

DO $assert$
DECLARE value jsonb; ctx record; old_row jsonb; after_row jsonb; count_changed integer;
BEGIN
 SELECT * INTO STRICT ctx FROM ballot_ctx;
 -- Malformed, missing and numeric JSON numbers must fail; source/review data is untouched.
 FOREACH value IN ARRAY ARRAY['{}','{"candidateNo":"0"}','{"candidateNo":"02"}',
   '{"candidateNo":"3abc"}','{"candidateNo":3}','{"candidateNo":"123456789012345678901"}']::jsonb[] LOOP
  BEGIN
   INSERT INTO public.candidate_lifecycle_events(external_id,registration_name_id,event_type,source_name,source_url,source_hash,fetched_at,event_data)
   VALUES('bad-'||value::text,ctx.names[1],'ballot_number_assigned','source','https://example.test',repeat('a',64),now(),value);
   RAISE EXCEPTION 'invalid ballot payload accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
 END LOOP;
 BEGIN
  UPDATE public.candidate_lifecycle_events SET candidate_id=ctx.candidate_id WHERE external_id='ballot-fixture-1';
  RAISE EXCEPTION 'ambiguous subject accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 -- Stable external ID deduplication is still enforced by the original event key.
 BEGIN
  INSERT INTO public.candidate_lifecycle_events SELECT * FROM public.candidate_lifecycle_events WHERE external_id='ballot-fixture-1';
  RAISE EXCEPTION 'duplicate event accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 -- Model exact before/after guards for a ballot-only candidate patch and inverse.
 SELECT to_jsonb(c) INTO old_row FROM public.candidates c WHERE id=ctx.candidate_id;
 UPDATE public.candidates c SET candidate_no='8' WHERE id=ctx.candidate_id AND to_jsonb(c)=old_row;
 GET DIAGNOSTICS count_changed=ROW_COUNT;
 IF count_changed<>1 THEN RAISE EXCEPTION 'before-image guard failed'; END IF;
 SELECT to_jsonb(c) INTO after_row FROM public.candidates c WHERE id=ctx.candidate_id;
 IF after_row-'candidate_no' IS DISTINCT FROM old_row-'candidate_no' THEN RAISE EXCEPTION 'protected fields changed'; END IF;
 UPDATE public.candidates c SET candidate_no='9' WHERE id=ctx.candidate_id AND to_jsonb(c)=old_row;
 GET DIAGNOSTICS count_changed=ROW_COUNT;
 IF count_changed<>0 THEN RAISE EXCEPTION 'stale before-image accepted'; END IF;
 UPDATE public.candidates c SET candidate_no=old_row->>'candidate_no' WHERE id=ctx.candidate_id AND to_jsonb(c)=after_row;
 IF (SELECT to_jsonb(c) FROM public.candidates c WHERE id=ctx.candidate_id) IS DISTINCT FROM old_row THEN
  RAISE EXCEPTION 'exact inverse did not restore candidate'; END IF;
END;
$assert$;

SET LOCAL ROLE anon;
DO $assert$
DECLARE ctx record; rows jsonb; value text; history jsonb;
BEGIN
 SELECT * INTO STRICT ctx FROM ballot_ctx;
 SELECT jsonb_agg(row) INTO rows FROM published.registration_names_for(ARRAY[ctx.race_id,ctx.private_race_id]) row;
 IF jsonb_array_length(rows)<>5 THEN RAISE EXCEPTION 'eligibility/private/replacement gate changed: %',rows; END IF;
 FOR i IN 1..10 LOOP
  SELECT row->>'candidate_no' INTO value FROM jsonb_array_elements(rows) row WHERE row->>'candidate_id'=ctx.names[i]::text;
  IF i=2 AND value IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'same-number events failed'; END IF;
  IF i=10 AND value IS DISTINCT FROM '10' THEN RAISE EXCEPTION 'public number missing'; END IF;
  IF i IN (1,3,9) AND value IS NOT NULL THEN RAISE EXCEPTION 'private/conflicting/unknown number leaked'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(rows) row WHERE row->>'person_id'<>'' OR row->>'registration_status'<>'qualified'
   OR row->>'source_url'<>'https://web.cec.gov.tw/registration' OR row->>'party'<>'原政黨') THEN
  RAISE EXCEPTION 'identity/status/original source changed'; END IF;
 SELECT jsonb_agg(to_jsonb(row)) INTO history FROM published.registration_name_ballots_for(ctx.names) row;
 IF jsonb_array_length(history)<>5 OR history::text LIKE '%DO_NOT_EXPOSE%' OR history::text LIKE '%PRIVATE_KEY%'
   OR history::text LIKE '%source_hash%' OR history::text LIKE '%event_data%' THEN
  RAISE EXCEPTION 'event whitelist or subject gate failed'; END IF;
 IF EXISTS(SELECT 1 FROM published.registration_names_for(ARRAY[]::uuid[]))
 OR EXISTS(SELECT 1 FROM published.registration_name_ballots_for(NULL)) THEN RAISE EXCEPTION 'empty input not empty'; END IF;
 BEGIN
  PERFORM * FROM published.registration_name_ballots_for(array_fill(ctx.names[1],ARRAY[129]));
  RAISE EXCEPTION 'input bound accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF has_table_privilege('anon','public.candidate_lifecycle_events','SELECT')
 OR has_table_privilege('anon','public.registration_name_roster','SELECT') THEN RAISE EXCEPTION 'private table grant expanded'; END IF;
 BEGIN PERFORM * FROM public.registration_name_roster; RAISE EXCEPTION 'private roster read accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.candidate_lifecycle_events SET is_public=true; RAISE EXCEPTION 'anon event write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$assert$;
RESET ROLE;
INSERT INTO public.candidate_lifecycle_events(external_id,registration_name_id,event_type,
 source_name,source_url,source_hash,fetched_at,event_data,is_public)
SELECT 'overflow-'||i,names[10],'ballot_number_assigned','合成來源','https://web.cec.gov.tw/fixture',
 repeat('b',64),now(),'{"candidateNo":"10"}'::jsonb,true FROM ballot_ctx CROSS JOIN generate_series(1,514) i;
SET LOCAL ROLE anon;
DO $assert$
DECLARE n uuid; total integer;
BEGIN
 SELECT names[10] INTO n FROM ballot_ctx;
 SELECT count(*) INTO total FROM published.registration_name_ballots_for(ARRAY[n]);
 IF total<>513 THEN RAISE EXCEPTION 'overflow sentinel missing: %',total; END IF;
END;
$assert$;
RESET ROLE;
-- Exact data rollback includes original sources, public flags, identities and events.
ROLLBACK;
SELECT 'ballot_fixture_transaction_rolled_back' AS result;
