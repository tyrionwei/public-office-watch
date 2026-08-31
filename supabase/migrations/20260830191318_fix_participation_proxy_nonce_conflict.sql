BEGIN;

CREATE OR REPLACE FUNCTION public.assert_participation_proxy_request(
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
    nonce_request_id UUID;
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

    nonce_request_id := request_id_text::UUID;
    INSERT INTO public.participation_proxy_nonces (
        request_id,
        participant_id,
        action,
        body_sha256,
        expires_at
    )
    VALUES (
        nonce_request_id,
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

REVOKE ALL ON FUNCTION public.assert_participation_proxy_request(TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.assert_participation_proxy_request(TEXT, TEXT) IS
    'Validates a body-bound, short-lived, single-use HMAC proof from the Cloudflare participation proxy.';

NOTIFY pgrst, 'reload schema';

COMMIT;
