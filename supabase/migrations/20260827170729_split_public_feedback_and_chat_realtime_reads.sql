BEGIN;

CREATE FUNCTION public.person_feedback_priorities(
    p_person_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    priorities JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.people AS person
        WHERE person.id = p_person_id
          AND person.is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Person is not public';
    END IF;

    SELECT COALESCE(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'sectionKey', priority.section_key,
                'requestCount', priority.request_count
            )
            ORDER BY priority.request_count DESC, priority.section_key
        ),
        '[]'::JSONB
    )
    INTO priorities
    FROM (
        SELECT submission.section_key, pg_catalog.count(*)::INTEGER AS request_count
        FROM public.person_feedback_submissions AS submission
        WHERE submission.person_id = p_person_id
          AND submission.feedback_kind = 'supplement_request'
          AND submission.review_status IN ('received', 'reviewing', 'verified', 'published')
          AND submission.updated_at <= pg_catalog.now() - INTERVAL '2 minutes'
        GROUP BY submission.section_key
    ) AS priority;

    RETURN priorities;
END;
$$;

CREATE FUNCTION public.get_person_feedback_own_submissions(
    p_person_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    own_submissions JSONB;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.people AS person
        WHERE person.id = p_person_id
          AND person.is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Person is not public';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );

    SELECT COALESCE(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'feedbackKind', submission.feedback_kind,
                'sectionKey', submission.section_key,
                'active', submission.review_status <> 'rejected',
                'updatedAt', submission.updated_at
            )
            ORDER BY submission.updated_at DESC
        ),
        '[]'::JSONB
    )
    INTO own_submissions
    FROM public.person_feedback_submissions AS submission
    WHERE submission.person_id = p_person_id
      AND submission.participant_hash = participant_digest;

    RETURN own_submissions;
END;
$$;

CREATE FUNCTION published.person_feedback_priorities(
    p_person_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.person_feedback_priorities(p_person_id);
$$;

CREATE FUNCTION published.get_person_feedback_own_submissions(
    p_person_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.get_person_feedback_own_submissions(p_person_id);
$$;

REVOKE ALL ON FUNCTION public.person_feedback_priorities(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_person_feedback_own_submissions(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.person_feedback_priorities(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.get_person_feedback_own_submissions(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.person_feedback_priorities(UUID)
TO anon, authenticated;
GRANT EXECUTE ON FUNCTION published.get_person_feedback_own_submissions(UUID)
TO authenticated;

CREATE POLICY "anonymous users can receive global chat broadcasts"
ON realtime.messages
FOR SELECT
TO anon
USING (
    (SELECT realtime.topic()) = 'global-chat'
    AND realtime.messages.extension = 'broadcast'
);

COMMENT ON FUNCTION public.person_feedback_priorities(UUID) IS
    'Returns delayed public aggregate supplement priorities for a public person.';
COMMENT ON FUNCTION public.get_person_feedback_own_submissions(UUID) IS
    'Returns person feedback state owned by the current authenticated Supabase user.';

NOTIFY pgrst, 'reload schema';

COMMIT;
