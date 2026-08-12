BEGIN;

CREATE OR REPLACE FUNCTION published.region_issue_results(
    p_region_id UUID DEFAULT NULL,
    p_region_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    issue_id UUID,
    region_id UUID,
    region_name TEXT,
    issue_key TEXT,
    display_order INTEGER,
    response_count INTEGER,
    participant_count INTEGER,
    selection_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT
        result.issue_id,
        result.region_id,
        result.region_name,
        result.issue_key,
        result.display_order,
        result.response_count,
        result.participant_count,
        result.selection_rate
    FROM public.public_region_issue_results AS result
    WHERE (
        p_region_id IS NOT NULL
        AND result.region_id = p_region_id
    ) OR (
        p_region_id IS NULL
        AND p_region_name IS NOT NULL
        AND result.region_name = p_region_name
    )
    ORDER BY result.display_order, result.issue_id
    LIMIT 16;
$$;

CREATE OR REPLACE FUNCTION published.get_region_issue_response(
    p_region_id UUID,
    p_participant_token TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT public.get_region_issue_response(p_region_id, p_participant_token);
$$;

CREATE OR REPLACE FUNCTION published.submit_region_issue_response(
    p_region_id UUID,
    p_participant_token TEXT,
    p_issue_ids UUID[]
)
RETURNS JSONB
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT public.submit_region_issue_response(
        p_region_id,
        p_participant_token,
        p_issue_ids
    );
$$;

REVOKE ALL ON FUNCTION public.get_region_issue_response(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_region_issue_response(UUID, TEXT, UUID[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_region_issue_response(UUID, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_region_issue_response(UUID, TEXT, UUID[])
TO service_role;

REVOKE ALL ON FUNCTION published.region_issue_results(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.get_region_issue_response(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.submit_region_issue_response(UUID, TEXT, UUID[])
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.region_issue_results(UUID, TEXT)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION published.get_region_issue_response(UUID, TEXT)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION published.submit_region_issue_response(UUID, TEXT, UUID[])
TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
