-- 只提供已核准關係的對方公開人物；私人審核 JSON 維持原白名單。
CREATE OR REPLACE FUNCTION published.person_family_links_for(p_person_ids uuid[])
RETURNS TABLE(claim_id uuid, person_id uuid, relative_person_id uuid, relative_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE visible_claims jsonb;
BEGIN
  IF coalesce(cardinality(p_person_ids), 0) > 4 THEN
    RAISE EXCEPTION 'person_family_links_for accepts at most 4 person ids'
      USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO visible_claims
  FROM published.person_claims_for(p_person_ids) c;
  -- 上游以第401筆作溢位訊號；不可將截斷後的關係視為完整結果。
  IF jsonb_array_length(visible_claims) > 400 THEN
    RAISE EXCEPTION 'person_family_links_for profile claim limit exceeded'
      USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT visible.claim_id, visible.person_id, relative.id, relative.name
  FROM jsonb_to_recordset(visible_claims) AS visible(
    claim_id uuid, person_id uuid, claim_type text, claim_json jsonb)
  JOIN public.person_claims original ON original.id = visible.claim_id
  JOIN public.people relative
    ON relative.id::text = original.claim_json->>'relativePersonId'
   AND relative.is_public
  JOIN public.public_people_list_cached directory ON directory.person_id = relative.id
  WHERE visible.claim_type = 'family_relation'
    AND visible.claim_json->'familyPublicationPolicy' @>
      '{"version":"family-publication-v1","decision":"explicit_user_approved","eligible":true}'::jsonb
    AND relative.id <> visible.person_id
  ORDER BY visible.person_id, visible.claim_id
  LIMIT 401;
END;
$fn$;
REVOKE ALL ON FUNCTION published.person_family_links_for(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.person_family_links_for(uuid[]) TO anon, authenticated, service_role;
COMMENT ON FUNCTION published.person_family_links_for(uuid[]) IS
  '已核准親屬 claim 的單跳公開人物連結；最多4個人物，不推導親屬關係，不公開審核 JSON。';
