BEGIN;

CREATE OR REPLACE FUNCTION published.chat_messages(
    p_before_created_at TIMESTAMPTZ DEFAULT NULL,
    p_before_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public.public_chat_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT message.*
    FROM public.get_public_chat_messages(
        p_before_created_at,
        p_before_id,
        LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50)
    ) AS message;
$$;

CREATE OR REPLACE FUNCTION published.get_person_feedback_context(
    p_person_id UUID,
    p_participant_token TEXT
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT public.get_person_feedback_context(
        p_person_id,
        p_participant_token
    );
$$;

CREATE OR REPLACE FUNCTION published.submit_person_feedback(
    p_person_id UUID,
    p_participant_token TEXT,
    p_feedback_kind TEXT,
    p_section_key TEXT,
    p_problem_type TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_evidence_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT public.submit_person_feedback(
        p_person_id,
        p_participant_token,
        p_feedback_kind,
        p_section_key,
        p_problem_type,
        p_message,
        p_evidence_url
    );
$$;

REVOKE ALL ON FUNCTION public.get_public_chat_messages(TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_person_feedback_context(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_chat_messages(TIMESTAMPTZ, UUID, INTEGER)
TO service_role;
GRANT EXECUTE ON FUNCTION public.get_person_feedback_context(UUID, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
TO service_role;

REVOKE ALL ON FUNCTION public.candidate_candidacy_status_from_legacy(TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.candidate_election_result_from_legacy(TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_election_district_label(TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.candidate_candidacy_status_from_legacy(TEXT)
TO service_role, admin_role;
GRANT EXECUTE ON FUNCTION public.candidate_election_result_from_legacy(TEXT, BOOLEAN)
TO service_role, admin_role;
GRANT EXECUTE ON FUNCTION public.normalize_election_district_label(TEXT)
TO service_role, admin_role;

REVOKE ALL ON FUNCTION published.chat_messages(TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.get_person_feedback_context(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.chat_messages(TIMESTAMPTZ, UUID, INTEGER)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION published.get_person_feedback_context(UUID, TEXT)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
