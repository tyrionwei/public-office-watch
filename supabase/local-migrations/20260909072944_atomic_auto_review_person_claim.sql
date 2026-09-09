BEGIN;

-- The CLI supplies the exact reviewed snapshot. This entry point cannot edit claim
-- content or approve sensitive/scoped claims, and grants no browser access.
CREATE OR REPLACE FUNCTION public.auto_approve_person_claim(
    p_expected_claim JSONB,
    p_expected_affiliations JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
SET lock_timeout = '2s'
AS $$
DECLARE
    claim_row public.person_claims%ROWTYPE;
    claim_snapshot JSONB;
    affiliation_snapshot JSONB;
    expected_affiliations JSONB;
    review_time TIMESTAMPTZ := clock_timestamp();
    affiliation_updates INTEGER := 0;
    expected_updates INTEGER := 0;
    changed_claims INTEGER;
    snapshot_keys TEXT[] := ARRAY[
        'id', 'claim_key', 'person_id', 'source_person_id', 'candidate_id',
        'claim_type', 'claim_value', 'claim_json', 'confidence_level', 'review_score',
        'review_status', 'visibility', 'is_public', 'source_name', 'source_url',
        'scoring_version', 'scoring_reasons', 'updated_at'
    ];
    no_change JSONB := '{"outcome":"conflict","updated_claims":0,"updated_affiliations":0}'::JSONB;
BEGIN
    IF jsonb_typeof(p_expected_claim) IS DISTINCT FROM 'object'
       OR NOT p_expected_claim ?& snapshot_keys
       OR p_expected_claim->>'updated_at' IS NULL
       OR jsonb_typeof(p_expected_affiliations) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_expected_affiliations) > 32 THEN
        RAISE EXCEPTION 'Invalid auto-review snapshot' USING ERRCODE = '22023';
    END IF;

    IF p_expected_claim->>'claim_type' = 'party_affiliation' THEN
        -- source_claim_key has no FK or uniqueness constraint. The short table
        -- lock prevents inserts from changing the complete set during approval.
        LOCK TABLE public.person_party_affiliations IN SHARE ROW EXCLUSIVE MODE;
    ELSIF jsonb_array_length(p_expected_affiliations) <> 0 THEN
        RAISE EXCEPTION 'Unexpected affiliation snapshot' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO claim_row FROM public.person_claims
    WHERE id = (p_expected_claim->>'id')::UUID FOR UPDATE;
    IF NOT FOUND THEN RETURN no_change; END IF;
    IF claim_row.person_id IS NULL
       OR claim_row.review_status NOT IN ('pending', 'needs_more_evidence')
       OR claim_row.claim_type IN ('legal_case', 'family_relation', 'candidacy', 'platform') THEN
        RETURN no_change;
    END IF;

    SELECT jsonb_object_agg(key, value) INTO claim_snapshot
    FROM jsonb_each(to_jsonb(claim_row)) WHERE key = ANY(snapshot_keys);
    IF claim_snapshot IS DISTINCT FROM p_expected_claim THEN RETURN no_change; END IF;

    IF claim_row.claim_type = 'party_affiliation' THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(affiliation) ORDER BY affiliation.id), '[]'::JSONB)
        INTO affiliation_snapshot
        FROM public.person_party_affiliations affiliation
        WHERE affiliation.source_claim_key = claim_row.claim_key;
        SELECT COALESCE(jsonb_agg(value ORDER BY value->>'id'), '[]'::JSONB)
        INTO expected_affiliations FROM jsonb_array_elements(p_expected_affiliations);
        IF jsonb_array_length(affiliation_snapshot) = 0
           OR affiliation_snapshot IS DISTINCT FROM expected_affiliations THEN RETURN no_change; END IF;
        IF EXISTS (
            SELECT 1 FROM public.person_party_affiliations affiliation
            WHERE affiliation.source_claim_key = claim_row.claim_key
              AND (affiliation.person_id IS DISTINCT FROM claim_row.person_id
                OR affiliation.review_status NOT IN ('pending', 'needs_more_evidence', 'verified')
                OR (affiliation.review_status = 'verified' AND affiliation.is_public IS DISTINCT FROM TRUE))
        ) THEN RETURN no_change; END IF;
        SELECT COUNT(*)::INTEGER INTO expected_updates FROM public.person_party_affiliations
        WHERE source_claim_key = claim_row.claim_key AND review_status IN ('pending', 'needs_more_evidence');
    END IF;

    UPDATE public.person_claims SET
        review_status = 'verified', visibility = 'public', is_public = TRUE,
        scoring_version = 'auto-verified-external-id-or-identity-match-v4-atomic',
        scoring_reasons = CASE WHEN jsonb_typeof(claim_row.scoring_reasons) = 'array'
            THEN claim_row.scoring_reasons ELSE '[]'::JSONB END || jsonb_build_array(jsonb_build_object(
                'version', 'auto-verified-external-id-or-identity-match-v4-atomic',
                'reason', 'Claim snapshot and associated party records verified atomically after source eligibility checks',
                'reviewedAt', review_time)),
        auto_reviewed_at = review_time, updated_at = review_time
    WHERE id = claim_row.id;
    GET DIAGNOSTICS changed_claims = ROW_COUNT;
    IF changed_claims <> 1 THEN RAISE EXCEPTION 'Auto-review claim update did not complete'; END IF;

    IF claim_row.claim_type = 'party_affiliation' THEN
        UPDATE public.person_party_affiliations
        SET review_status = 'verified', is_public = TRUE, updated_at = review_time
        WHERE source_claim_key = claim_row.claim_key AND review_status IN ('pending', 'needs_more_evidence');
        GET DIAGNOSTICS affiliation_updates = ROW_COUNT;
        IF affiliation_updates <> expected_updates THEN RAISE EXCEPTION 'Auto-review affiliation update did not complete'; END IF;
    END IF;
    RETURN jsonb_build_object('outcome', 'applied', 'updated_claims', changed_claims, 'updated_affiliations', affiliation_updates);
END;
$$;

REVOKE ALL ON FUNCTION public.auto_approve_person_claim(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_person_claim(JSONB, JSONB) TO service_role;

COMMIT;
