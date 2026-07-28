BEGIN;

CREATE OR REPLACE FUNCTION published.person_claims_for(p_person_ids UUID[])
RETURNS TABLE (
    claim_id UUID,
    person_id UUID,
    claim_type TEXT,
    claim_value TEXT,
    claim_json JSONB,
    confidence_level TEXT,
    review_score NUMERIC,
    source_name TEXT,
    source_url TEXT,
    observed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, published
AS $$
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
        claim.claim_json,
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
    ORDER BY
        member.canonical_person_id,
        claim.observed_at DESC NULLS LAST,
        claim.id
    LIMIT 401;
END;
$$;

REVOKE ALL ON FUNCTION published.person_claims_for(UUID[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.person_claims_for(UUID[])
TO service_role;

COMMENT ON FUNCTION published.person_claims_for(UUID[]) IS
    'Bounded canonical person-claim lookup that walks only requested verified merge trees.';

COMMIT;
