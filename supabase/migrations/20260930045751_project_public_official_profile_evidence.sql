-- Publish adopted profile values without private review records or raw registration payloads.
-- Preserve the full evidence on public.person_claims behind existing private access.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.public_official_profile_json(p_type text,p_json jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $fn$
 SELECT CASE WHEN p_type IN ('birth_date','education','experience') THEN
  jsonb_build_object('officialProfilePolicy',jsonb_strip_nulls(jsonb_build_object(
   'version',p_json->'officialProfilePolicy'->'version',
   'eligible',p_json->'officialProfilePolicy'->'eligible',
   'identityVerified',p_json->'officialProfilePolicy'->'identityVerified',
   'contentVerified',p_json->'officialProfilePolicy'->'contentVerified',
   'datePrecision',p_json->'officialProfilePolicy'->'datePrecision')))
 ELSE p_json END;
$fn$;
-- Pure projection only: no table reads, review authority or SECURITY DEFINER.
CREATE OR REPLACE VIEW public.public_person_claims AS
 SELECT claim.id AS claim_id,
    canonical.canonical_person_id AS person_id,
    claim.claim_type,
    claim.claim_value,
    public.public_official_profile_json(claim.claim_type, claim.claim_json) AS claim_json,
    claim.confidence_level,
    claim.review_score,
    claim.source_name,
    claim.source_url,
    claim.observed_at,
    claim.updated_at,
    claim.candidate_id
   FROM person_claims claim
     JOIN person_canonical_map canonical ON canonical.person_id = claim.person_id
     JOIN people person ON person.id = canonical.canonical_person_id AND person.is_public = true
  WHERE claim.review_status = 'verified'::text AND claim.visibility = 'public'::text AND claim.is_public = true AND public.official_profile_claim_allowed(claim.claim_type,claim.claim_value,claim.claim_json,claim.person_id,claim.source_url)
 AND (claim.claim_type<>'birth_date' OR NOT EXISTS(SELECT 1 FROM public.official_profile_values profile WHERE profile.person_id=canonical.canonical_person_id AND profile.birth_conflict));
CREATE OR REPLACE FUNCTION published.person_claims_for(p_person_ids uuid[])
 RETURNS TABLE(claim_id uuid, person_id uuid, claim_type text, claim_value text, claim_json jsonb, confidence_level text, review_score numeric, source_name text, source_url text, observed_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'published'
AS $function$
DECLARE
    v_person_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT input.person_id)
    INTO v_person_count
    FROM UNNEST(COALESCE(p_person_ids, ARRAY[]::UUID[])) AS input(person_id)
    WHERE input.person_id IS NOT NULL;

    IF v_person_count > 4 THEN
        RAISE EXCEPTION 'person_claims_for accepts at most 4 person ids';
    END IF;

    RETURN QUERY
    WITH RECURSIVE requested_people AS (
        SELECT DISTINCT input.person_id
        FROM UNNEST(COALESCE(p_person_ids, ARRAY[]::UUID[])) AS input(person_id)
        JOIN public.public_people_list_cached profile
          ON profile.person_id = input.person_id
        WHERE input.person_id IS NOT NULL
    ),
    member_ids(canonical_person_id, source_person_id, path, depth) AS (
        SELECT
            requested.person_id,
            requested.person_id,
            ARRAY[requested.person_id],
            0
        FROM requested_people requested

        UNION ALL

        SELECT
            member.canonical_person_id,
            decision.duplicate_person_id,
            member.path || decision.duplicate_person_id,
            member.depth + 1
        FROM member_ids member
        JOIN public.person_merge_decisions decision
          ON decision.canonical_person_id = member.source_person_id
         AND decision.status = 'verified'
        WHERE member.depth < 20
          AND NOT decision.duplicate_person_id = ANY(member.path)
    )
    SELECT
        claim.id,
        member.canonical_person_id,
        claim.claim_type,
        claim.claim_value,
        public.public_official_profile_json(claim.claim_type, claim.claim_json) AS claim_json,
        claim.confidence_level,
        claim.review_score,
        claim.source_name,
        claim.source_url,
        claim.observed_at,
        claim.updated_at
    FROM member_ids member
    JOIN public.people canonical
      ON canonical.id = member.canonical_person_id
     AND canonical.is_public
    JOIN public.person_claims claim
      ON claim.person_id = member.source_person_id
    WHERE claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public
      AND public.official_profile_claim_allowed(claim.claim_type,claim.claim_value,claim.claim_json,claim.person_id,claim.source_url)
      AND (claim.claim_type<>'birth_date' OR NOT EXISTS(SELECT 1 FROM public.official_profile_values profile WHERE profile.person_id=member.canonical_person_id AND profile.birth_conflict))
    ORDER BY
        member.canonical_person_id,
        claim.observed_at DESC NULLS LAST,
        claim.id
    LIMIT 401;
END;
$function$
;


COMMIT;
