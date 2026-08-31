BEGIN;

CREATE TABLE public.participation_proxy_nonces (
    request_id UUID PRIMARY KEY,
    participant_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN (
        'region-issue',
        'person-feedback',
        'platform-fulfillment',
        'platform-fulfillment-withdrawal'
    )),
    body_sha256 TEXT NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX participation_proxy_nonces_expires_at_idx
    ON public.participation_proxy_nonces (expires_at);

ALTER TABLE public.participation_proxy_nonces ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.participation_proxy_nonces
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.participation_proxy_body_sha256(
    p_values TEXT[]
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT pg_catalog.encode(
        extensions.digest(
            COALESCE(
                pg_catalog.string_agg(
                    CASE
                        WHEN item.value IS NULL THEN '-1:'
                        ELSE pg_catalog.octet_length(item.value)::TEXT
                            || ':' || item.value
                    END,
                    E'\n'
                    ORDER BY item.ordinality
                ),
                ''
            ),
            'sha256'
        ),
        'hex'
    )
    FROM pg_catalog.unnest(p_values)
        WITH ORDINALITY AS item(value, ordinality);
$$;

CREATE FUNCTION public.assert_participation_proxy_request(
    p_expected_action TEXT,
    p_expected_body_sha256 TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    participant_id UUID;
    request_headers JSONB;
    proxy_action TEXT;
    body_sha256 TEXT;
    request_id_text TEXT;
    request_id UUID;
    signature TEXT;
    timestamp_text TEXT;
    timestamp_seconds BIGINT;
    proxy_secret TEXT;
    proof_payload TEXT;
    expected_signature TEXT;
    nonce_inserted INTEGER;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    request_headers := COALESCE(
        NULLIF(pg_catalog.current_setting('request.headers', TRUE), ''),
        '{}'
    )::JSONB;
    proxy_action := request_headers ->> 'x-participation-proxy-action';
    body_sha256 := request_headers ->> 'x-participation-proxy-body-sha256';
    request_id_text := request_headers ->> 'x-participation-proxy-request-id';
    signature := request_headers ->> 'x-participation-proxy-signature-v2';
    timestamp_text := request_headers ->> 'x-participation-proxy-timestamp';

    IF proxy_action IS DISTINCT FROM p_expected_action
       OR proxy_action NOT IN (
           'region-issue',
           'person-feedback',
           'platform-fulfillment',
           'platform-fulfillment-withdrawal'
       )
       OR body_sha256 IS NULL
       OR body_sha256 !~ '^[0-9a-f]{64}$'
       OR body_sha256 IS DISTINCT FROM p_expected_body_sha256
       OR request_id_text IS NULL
       OR request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR timestamp_text IS NULL
       OR timestamp_text !~ '^[0-9]{10}$'
       OR signature IS NULL
       OR signature !~ '^[0-9a-f]{64}$'
    THEN
        RAISE EXCEPTION 'Participation write proxy required' USING ERRCODE = '42501';
    END IF;

    timestamp_seconds := timestamp_text::BIGINT;
    IF pg_catalog.abs(
        EXTRACT(EPOCH FROM pg_catalog.clock_timestamp())::BIGINT
        - timestamp_seconds
    ) > 60 THEN
        RAISE EXCEPTION 'Participation proxy proof expired' USING ERRCODE = '42501';
    END IF;

    SELECT secret.decrypted_secret
    INTO proxy_secret
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = 'participation_proxy_hmac_key'
    ORDER BY secret.created_at DESC
    LIMIT 1;

    IF proxy_secret IS NULL THEN
        RAISE EXCEPTION 'Participation proxy is not configured' USING ERRCODE = '42501';
    END IF;

    proof_payload := participant_id::TEXT
        || E'\n' || proxy_action
        || E'\n' || timestamp_text
        || E'\n' || request_id_text
        || E'\n' || body_sha256;
    expected_signature := pg_catalog.encode(
        extensions.hmac(proof_payload, proxy_secret, 'sha256'),
        'hex'
    );

    IF signature IS DISTINCT FROM expected_signature THEN
        RAISE EXCEPTION 'Invalid participation proxy proof' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.participation_proxy_nonces AS nonce
    WHERE nonce.expires_at <= pg_catalog.clock_timestamp();

    request_id := request_id_text::UUID;
    INSERT INTO public.participation_proxy_nonces (
        request_id,
        participant_id,
        action,
        body_sha256,
        expires_at
    )
    VALUES (
        request_id,
        participant_id,
        proxy_action,
        body_sha256,
        pg_catalog.to_timestamp(timestamp_seconds) + INTERVAL '60 seconds'
    )
    ON CONFLICT ON CONSTRAINT participation_proxy_nonces_pkey DO NOTHING;

    GET DIAGNOSTICS nonce_inserted = ROW_COUNT;
    IF nonce_inserted = 0 THEN
        RAISE EXCEPTION 'Participation proxy proof already used' USING ERRCODE = '42501';
    END IF;

    RETURN participant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_region_issue_response(
    p_region_id UUID,
    p_issue_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.assert_participation_proxy_request(
        'region-issue',
        public.participation_proxy_body_sha256(
            ARRAY[
                p_region_id::TEXT,
                pg_catalog.cardinality(p_issue_ids)::TEXT
            ] || COALESCE(p_issue_ids::TEXT[], ARRAY[]::TEXT[])
        )
    );
    RETURN public.submit_region_issue_response_proxied_internal(
        p_region_id,
        p_issue_ids
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_person_feedback(
    p_person_id UUID,
    p_feedback_kind TEXT,
    p_section_key TEXT,
    p_problem_type TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_evidence_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.assert_participation_proxy_request(
        'person-feedback',
        public.participation_proxy_body_sha256(ARRAY[
            p_person_id::TEXT,
            p_feedback_kind,
            p_section_key,
            p_problem_type,
            p_message,
            p_evidence_url
        ])
    );
    RETURN public.submit_person_feedback_proxied_internal(
        p_person_id,
        p_feedback_kind,
        p_section_key,
        p_problem_type,
        p_message,
        p_evidence_url
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_platform_fulfillment_vote(
    p_claim_id UUID,
    p_item_key TEXT,
    p_vote_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    saved_vote public.platform_fulfillment_votes%ROWTYPE;
BEGIN
    participant_id := public.assert_participation_proxy_request(
        'platform-fulfillment',
        public.participation_proxy_body_sha256(ARRAY[
            p_claim_id::TEXT,
            p_item_key,
            p_vote_status
        ])
    );

    IF p_item_key IS NULL OR p_item_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid platform item key';
    END IF;

    IF p_vote_status NOT IN (
        'fulfilled',
        'in_progress',
        'not_fulfilled',
        'insufficient_information'
    ) THEN
        RAISE EXCEPTION 'Invalid platform fulfilment status';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
    ) THEN
        RAISE EXCEPTION 'Platform item is not available for voting';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
          AND item.voting_is_open
    ) THEN
        RAISE EXCEPTION 'Platform fulfilment voting is not open';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );

    INSERT INTO public.platform_fulfillment_votes (
        claim_id,
        item_key,
        participant_hash,
        vote_status
    )
    VALUES (
        p_claim_id,
        p_item_key,
        participant_digest,
        p_vote_status
    )
    ON CONFLICT (claim_id, item_key, participant_hash) DO UPDATE
    SET
        vote_status = EXCLUDED.vote_status,
        submission_count = public.platform_fulfillment_votes.submission_count + 1,
        updated_at = pg_catalog.now()
    RETURNING * INTO saved_vote;

    RETURN pg_catalog.jsonb_build_object(
        'claimId', saved_vote.claim_id,
        'itemKey', saved_vote.item_key,
        'voteStatus', saved_vote.vote_status,
        'updatedAt', saved_vote.updated_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_platform_fulfillment_vote(
    p_claim_id UUID,
    p_item_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    deleted_count BIGINT;
BEGIN
    participant_id := public.assert_participation_proxy_request(
        'platform-fulfillment-withdrawal',
        public.participation_proxy_body_sha256(ARRAY[
            p_claim_id::TEXT,
            p_item_key
        ])
    );

    IF p_item_key IS NULL OR p_item_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid platform item key';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
    ) THEN
        RAISE EXCEPTION 'Platform item is not available for voting';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM published.platform_fulfillment_results(p_claim_id) AS item
        WHERE item.item_key = p_item_key
          AND item.voting_is_open
    ) THEN
        RAISE EXCEPTION 'Platform fulfilment voting is not open';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );

    DELETE FROM public.platform_fulfillment_votes AS vote
    WHERE vote.claim_id = p_claim_id
      AND vote.item_key = p_item_key
      AND vote.participant_hash = participant_digest;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN pg_catalog.jsonb_build_object(
        'claimId', p_claim_id,
        'itemKey', p_item_key,
        'withdrawn', deleted_count > 0
    );
END;
$$;

DROP FUNCTION public.assert_participation_proxy_request(TEXT);

REVOKE ALL ON FUNCTION public.participation_proxy_body_sha256(TEXT[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_participation_proxy_request(TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_region_issue_response(UUID, UUID[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_platform_fulfillment_vote(UUID, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.withdraw_platform_fulfillment_vote(UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.submit_region_issue_response(UUID, UUID[])
TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_platform_fulfillment_vote(UUID, TEXT, TEXT)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_platform_fulfillment_vote(UUID, TEXT)
TO authenticated;

COMMENT ON TABLE public.participation_proxy_nonces IS
    'Short-lived, single-use request identifiers for Cloudflare participation proxy proofs.';
COMMENT ON FUNCTION public.participation_proxy_body_sha256(TEXT[]) IS
    'Builds the canonical length-prefixed SHA-256 body proof used by participation wrappers.';
COMMENT ON FUNCTION public.assert_participation_proxy_request(TEXT, TEXT) IS
    'Validates a body-bound, short-lived, single-use HMAC proof from the Cloudflare participation proxy.';

NOTIFY pgrst, 'reload schema';

COMMIT;
