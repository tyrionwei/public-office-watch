-- 由執行器在交易內載入 migration，再執行本檔；不授權私人資料表。
CREATE TEMP TABLE family_link_fixture AS
SELECT array_agg(person_id ORDER BY person_id) AS people, gen_random_uuid() AS private_id
FROM (SELECT d.person_id FROM public.public_people_list_cached d
  JOIN public.people p ON p.id=d.person_id AND p.is_public
  ORDER BY d.person_id LIMIT 3) selected;
ALTER TABLE family_link_fixture ADD COLUMN claim_ids uuid[];
UPDATE family_link_fixture SET claim_ids=ARRAY(SELECT gen_random_uuid() FROM generate_series(1,12));
GRANT SELECT ON family_link_fixture TO anon;
DO $fixture$
DECLARE ctx record; i integer; policy jsonb; payload jsonb;
BEGIN
 SELECT * INTO STRICT ctx FROM family_link_fixture;
 IF cardinality(ctx.people) <> 3 THEN RAISE EXCEPTION 'Need three local public fixture people'; END IF;
 INSERT INTO public.people(id,name,is_public) VALUES(ctx.private_id,'合成私人親屬',false);
 policy:='{"version":"family-publication-v1","decision":"explicit_user_approved","eligible":true}';
 FOR i IN 1..12 LOOP
  payload:=jsonb_build_object('familyPublicationPolicy',policy,'privateReview','DO_NOT_EXPOSE_FAMILY_LINK_REVIEW',
    'relativeName','DO_NOT_EXPOSE_FAMILY_LINK_REVIEW',
    'relativePersonId',CASE WHEN i=2 THEN ctx.people[1] WHEN i=4 THEN ctx.private_id
       WHEN i=9 THEN ctx.people[1] ELSE ctx.people[2] END);
  IF i=3 THEN payload:=payload-'familyPublicationPolicy'; END IF;
  IF i=5 THEN payload:=jsonb_set(payload,'{relativePersonId}','"malformed-uuid"'); END IF;
  IF i=6 THEN payload:=jsonb_set(payload,'{familyPublicationPolicy,eligible}','"true"'); END IF;
  INSERT INTO public.person_claims(id,claim_key,person_id,claim_type,claim_value,claim_json,
    confidence_level,review_score,review_status,visibility,is_public)
  VALUES(ctx.claim_ids[i],'family-link-fixture-'||ctx.claim_ids[i],
    CASE WHEN i=2 THEN ctx.people[2] WHEN i=10 THEN ctx.people[3] ELSE ctx.people[1] END,
    CASE WHEN i=11 THEN 'other' ELSE 'family_relation' END,'合成公開關係',payload,'B',80,
    CASE WHEN i=7 THEN 'pending' ELSE 'verified' END,
    CASE WHEN i=8 THEN 'private' ELSE 'public' END,i<>12);
 END LOOP;
END;
$fixture$;
SET LOCAL ROLE anon;
DO $assert$
DECLARE ctx record; result jsonb;
BEGIN
 SELECT * INTO STRICT ctx FROM family_link_fixture;
 SELECT jsonb_agg(to_jsonb(row)) INTO result FROM published.person_family_links_for(ctx.people[1:2]) row
 WHERE row.claim_id=ANY(ctx.claim_ids);
 IF jsonb_array_length(result) IS DISTINCT FROM 2
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result) r WHERE r->>'claim_id'=ctx.claim_ids[1]::text
   AND r->>'person_id'=ctx.people[1]::text AND r->>'relative_person_id'=ctx.people[2]::text)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result) r WHERE r->>'claim_id'=ctx.claim_ids[2]::text
   AND r->>'person_id'=ctx.people[2]::text AND r->>'relative_person_id'=ctx.people[1]::text)
 THEN RAISE EXCEPTION 'Reciprocal links, approval or requested scope incorrect: %', result; END IF;
 IF result::text LIKE '%DO_NOT_EXPOSE%'
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(result) r WHERE (SELECT count(*) FROM jsonb_object_keys(r))<>4)
 THEN RAISE EXCEPTION 'Family links leaked review metadata'; END IF;
 IF (SELECT count(*) FROM published.person_family_links_for(ARRAY[ctx.people[1],ctx.people[1]]) r
   WHERE r.claim_id=ANY(ctx.claim_ids)) <> 1
 THEN RAISE EXCEPTION 'Duplicate request duplicated links'; END IF;
 IF EXISTS(SELECT 1 FROM published.person_family_links_for(NULL::uuid[]))
 OR EXISTS(SELECT 1 FROM published.person_family_links_for(ARRAY[]::uuid[]))
 OR EXISTS(SELECT 1 FROM published.person_family_links_for(ARRAY[ctx.private_id]))
 THEN RAISE EXCEPTION 'Empty or private request returned links'; END IF;
 BEGIN
  PERFORM published.person_family_links_for(array_fill(ctx.people[1],ARRAY[5]));
  RAISE EXCEPTION 'Oversized input accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF has_table_privilege('anon','public.person_claims','SELECT')
 OR has_function_privilege('anon','published.person_claims_for(uuid[])','EXECUTE')
 THEN RAISE EXCEPTION 'Private table or retired RPC permissions widened'; END IF;
END;
$assert$;
RESET ROLE;
-- 上游先限制全部類型的 claims，滿401筆必須報錯，不能回傳不完整關係。
INSERT INTO public.person_claims(claim_key,person_id,claim_type,claim_value,
  review_status,visibility,is_public,observed_at)
SELECT 'family-link-overflow-'||gen_random_uuid(), ctx.people[3], 'other', '合成非親屬資料',
  'verified','public',true,now()
FROM family_link_fixture ctx CROSS JOIN generate_series(1,401);
SET LOCAL ROLE anon;
DO $assert$
BEGIN
 BEGIN
  PERFORM published.person_family_links_for((SELECT ARRAY[people[3]] FROM family_link_fixture));
  RAISE EXCEPTION 'Truncated upstream claims accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
END;
$assert$;
RESET ROLE;
-- 即使清單快取未更新，人物收回公開後兩端都不能再回傳連結。
UPDATE public.people SET is_public=false WHERE id=(SELECT people[2] FROM family_link_fixture);
SET LOCAL ROLE anon;
DO $assert$
BEGIN
 IF EXISTS(SELECT 1 FROM published.person_family_links_for(
   (SELECT people[1:2] FROM family_link_fixture)) r
   WHERE r.claim_id=ANY((SELECT claim_ids FROM family_link_fixture)::uuid[]))
 THEN RAISE EXCEPTION 'Stale directory exposed private endpoint'; END IF;
END;
$assert$;
RESET ROLE;
