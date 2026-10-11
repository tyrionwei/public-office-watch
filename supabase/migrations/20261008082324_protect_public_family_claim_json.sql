-- 親屬關係文字與來源由外層欄位提供；內部審核證據保留於原表。
-- 純公開投影，不修改審核狀態、權限、人物關聯或逾時設定。
CREATE OR REPLACE FUNCTION public.public_official_profile_json(p_type text,p_json jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $fn$
 SELECT CASE WHEN p_type = 'family_relation' THEN
  CASE WHEN p_json->'familyPublicationPolicy' @> '{"version":"family-publication-v1","decision":"explicit_user_approved","eligible":true}'::jsonb
   THEN '{"familyPublicationPolicy":{"version":"family-publication-v1","decision":"explicit_user_approved","eligible":true}}'::jsonb
   ELSE '{}'::jsonb END
 WHEN p_type IN ('birth_date','education','experience') THEN
  jsonb_build_object('officialProfilePolicy',jsonb_strip_nulls(jsonb_build_object(
   'version',p_json->'officialProfilePolicy'->'version',
   'eligible',p_json->'officialProfilePolicy'->'eligible',
   'identityVerified',p_json->'officialProfilePolicy'->'identityVerified',
   'contentVerified',p_json->'officialProfilePolicy'->'contentVerified',
   'datePrecision',p_json->'officialProfilePolicy'->'datePrecision')))
 ELSE p_json END;
$fn$;
