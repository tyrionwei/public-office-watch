-- 接續 candidate-qualification-regression.sql 的相同交易與合成 fixture；
-- 執行器需省略該 fixture 的 ROLLBACK，本檔結尾一次全部回滾。
INSERT INTO public.candidate_lifecycle_events (
 external_id,candidate_id,registration_name_id,event_type,source_published_on,
 source_name,source_url,source_hash,fetched_at,event_data,is_public
)
SELECT 'asset-fixture-'||input.file_id, input.candidate_id,input.registration_name_id,
 'asset_declaration_published','2026-10-16','合成官方文件，未核對金額',
 'https://pdps-dec.cec.gov.tw/release/formal/files/'||input.file_id||'.pdf',
 repeat('a',64),now(),'{"privateReview":"DO_NOT_EXPOSE_ASSET_REVIEW","amount":123456}',input.visible
FROM qualification_fixture ctx CROSS JOIN LATERAL (VALUES
 (ctx.eligible_id,NULL::uuid,900001,true),
 (ctx.eligible_id,NULL::uuid,900002,true),
 (ctx.eligible_id,NULL::uuid,900003,false),
 (ctx.rejected_id,NULL::uuid,900004,true),
 (ctx.withdrawn_id,NULL::uuid,900005,true),
 (NULL::uuid,ctx.roster_id,900006,true),
 (NULL::uuid,ctx.rejected_roster_id,900007,true)
) input(candidate_id,registration_name_id,file_id,visible);

SET LOCAL ROLE anon;
DO $assert$
DECLARE ctx RECORD; result JSONB; history JSONB;
BEGIN
 SELECT * INTO STRICT ctx FROM qualification_fixture;
 SELECT jsonb_agg(row) INTO result FROM published.candidate_asset_documents_for(
   ARRAY[ctx.eligible_id,ctx.eligible_id,ctx.rejected_id,ctx.withdrawn_id,ctx.roster_id,ctx.rejected_roster_id]) row;
 IF jsonb_array_length(result) IS DISTINCT FROM 3
 OR (SELECT count(*) FROM jsonb_array_elements(result) r WHERE r->>'candidate_id'=ctx.eligible_id::text) <> 2
 OR (SELECT count(*) FROM jsonb_array_elements(result) r WHERE r->>'candidate_id'=ctx.roster_id::text) <> 1
 THEN RAISE EXCEPTION 'Incorrect asset document visibility or duplicate input expansion: %',result; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result) r
   WHERE (SELECT count(*) FROM jsonb_object_keys(r)) <> 5)
 OR result::text LIKE '%DO_NOT_EXPOSE%' OR result::text LIKE '%123456%'
 THEN RAISE EXCEPTION 'Private asset review escaped whitelist'; END IF;
 SELECT jsonb_agg(row) INTO history FROM published.candidate_lifecycle_for(ctx.eligible_id) row;
 IF jsonb_array_length(history) IS DISTINCT FROM 2 OR history::text LIKE '%DO_NOT_EXPOSE%'
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(history) r WHERE r->>'occurred_on' IS NOT NULL)
 THEN RAISE EXCEPTION 'Lifecycle visibility, privacy or declaration date incorrect'; END IF;
 SELECT jsonb_agg(row) INTO history FROM published.candidate_lifecycle_for(ctx.rejected_id) row;
 IF jsonb_array_length(history) IS DISTINCT FROM 1
 OR history->0->>'event_type' IS DISTINCT FROM 'qualification_rejected'
 THEN RAISE EXCEPTION 'Historical qualification event lost or rejected asset exposed'; END IF;
 IF EXISTS(SELECT 1 FROM published.candidate_asset_documents_for(NULL::uuid[]))
 OR EXISTS(SELECT 1 FROM published.candidate_asset_documents_for(ARRAY[]::uuid[]))
 THEN RAISE EXCEPTION 'Empty input exposed documents'; END IF;
 BEGIN
  PERFORM published.candidate_asset_documents_for(array_fill(ctx.eligible_id,ARRAY[129]));
  RAISE EXCEPTION 'Oversized request accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF has_table_privilege('anon','public.candidate_lifecycle_events','SELECT')
 OR has_table_privilege('anon','public.registration_name_roster','SELECT')
 THEN RAISE EXCEPTION 'Private table permission widened'; END IF;
END;
$assert$;
RESET ROLE;
DO $assert$
BEGIN
 BEGIN
  UPDATE public.candidate_lifecycle_events SET source_url='https://example.org/private.pdf'
  WHERE external_id='asset-fixture-900001';
  RAISE EXCEPTION 'Nonofficial document URL accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END;
$assert$;
-- 選後合格參選者的文件仍可讀；公開資格與私人邊界仍適用。
DO $assert$
DECLARE state TEXT; subject UUID; result JSONB;
BEGIN
 SELECT eligible_id INTO STRICT subject FROM qualification_fixture;
 FOREACH state IN ARRAY ARRAY['elected', 'not_elected'] LOOP
  UPDATE public.candidates SET registration_status=state, candidacy_status='qualified' WHERE id=subject;
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT jsonb_agg(row) INTO result FROM published.candidate_asset_documents_for(ARRAY[subject]) row;
  IF jsonb_array_length(result) IS DISTINCT FROM 2 OR result::text LIKE '%DO_NOT_EXPOSE%'
  THEN RAISE EXCEPTION 'Post-election asset documents lost or private review exposed: %',state; END IF;
  SELECT jsonb_agg(row) INTO result FROM published.candidate_lifecycle_for(subject) row;
  IF (SELECT count(*) FROM jsonb_array_elements(result) r WHERE r->>'event_type'='asset_declaration_published') <> 2
  THEN RAISE EXCEPTION 'Post-election asset timeline lost: %',state; END IF;
  EXECUTE 'RESET ROLE';
 END LOOP;
END;
$assert$;
-- 姓名名錄若已有正式人物候選接替，不再公開舊名錄的文件。
UPDATE public.registration_name_roster SET candidate_external_id=(
 SELECT c.external_id FROM public.candidates c JOIN qualification_fixture f ON c.id=f.template_id
) WHERE id=(SELECT roster_id FROM qualification_fixture);
SET LOCAL ROLE anon;
DO $assert$
BEGIN
 IF EXISTS(SELECT 1 FROM published.candidate_asset_documents_for(
   (SELECT ARRAY[roster_id] FROM qualification_fixture)))
 THEN RAISE EXCEPTION 'Replaced registration name leaked documents'; END IF;
END;
$assert$;
RESET ROLE;
UPDATE public.registration_name_roster SET candidate_external_id='qualification-fixture-'||id
 WHERE id=(SELECT roster_id FROM qualification_fixture);
-- 公開主體改為私人後，即使舊投影仍在也不能沿用文件。
UPDATE public.candidates SET is_public=false WHERE id=(SELECT eligible_id FROM qualification_fixture);
UPDATE public.registration_name_roster SET is_public=false WHERE id=(SELECT roster_id FROM qualification_fixture);
SET LOCAL ROLE anon;
DO $assert$
BEGIN
 IF EXISTS(SELECT 1 FROM published.candidate_asset_documents_for(
   (SELECT ARRAY[eligible_id,roster_id] FROM qualification_fixture)))
 THEN RAISE EXCEPTION 'Private subjects leaked documents'; END IF;
END;
$assert$;
RESET ROLE;
ROLLBACK;
