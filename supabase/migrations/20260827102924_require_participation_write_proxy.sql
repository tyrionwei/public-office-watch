BEGIN;

CREATE FUNCTION public.assert_participation_proxy_request(
    p_expected_action TEXT
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
    request_id TEXT;
    signature TEXT;
    timestamp_text TEXT;
    timestamp_seconds BIGINT;
    proxy_secret TEXT;
    proof_payload TEXT;
    expected_signature TEXT;
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
    request_id := request_headers ->> 'x-participation-proxy-request-id';
    signature := request_headers ->> 'x-participation-proxy-signature';
    timestamp_text := request_headers ->> 'x-participation-proxy-timestamp';

    IF proxy_action IS DISTINCT FROM p_expected_action
       OR proxy_action NOT IN ('region-issue', 'person-feedback')
       OR request_id IS NULL
       OR request_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
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
        || E'\n' || request_id;
    expected_signature := pg_catalog.encode(
        extensions.hmac(proof_payload, proxy_secret, 'sha256'),
        'hex'
    );

    IF signature IS DISTINCT FROM expected_signature THEN
        RAISE EXCEPTION 'Invalid participation proxy proof' USING ERRCODE = '42501';
    END IF;

    RETURN participant_id;
END;
$$;

ALTER FUNCTION public.submit_region_issue_response(UUID, UUID[])
RENAME TO submit_region_issue_response_proxied_internal;

ALTER FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
RENAME TO submit_person_feedback_proxied_internal;

CREATE FUNCTION public.submit_region_issue_response(
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
    PERFORM public.assert_participation_proxy_request('region-issue');
    RETURN public.submit_region_issue_response_proxied_internal(
        p_region_id,
        p_issue_ids
    );
END;
$$;

CREATE FUNCTION public.submit_person_feedback(
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
    PERFORM public.assert_participation_proxy_request('person-feedback');
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

REVOKE ALL ON FUNCTION public.assert_participation_proxy_request(TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_region_issue_response_proxied_internal(UUID, UUID[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_person_feedback_proxied_internal(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_region_issue_response(UUID, UUID[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.assert_participation_proxy_request(TEXT) IS
    'Validates a short-lived HMAC proof added by the Cloudflare participation write proxy.';
COMMENT ON FUNCTION public.submit_region_issue_response(UUID, UUID[]) IS
    'Creates or updates the current participant selection after Cloudflare proxy verification.';
COMMENT ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
    'Creates or updates current participant feedback after Cloudflare proxy verification.';

NOTIFY pgrst, 'reload schema';

COMMIT;
