CREATE OR REPLACE FUNCTION get_person_feedback_context(
    p_person_id UUID,
    p_participant_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    participant_digest TEXT;
    priorities JSONB;
    own_submissions JSONB;
BEGIN
    IF p_participant_token IS NULL OR CHAR_LENGTH(p_participant_token) NOT BETWEEN 16 AND 200 THEN
        RAISE EXCEPTION 'Invalid participant token';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM people person
        WHERE person.id = p_person_id
          AND person.is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Person is not public';
    END IF;

    participant_digest := ENCODE(DIGEST(p_participant_token, 'sha256'), 'hex');

    SELECT COALESCE(
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'sectionKey', priority.section_key,
                'requestCount', priority.request_count
            )
            ORDER BY priority.request_count DESC, priority.section_key
        ),
        '[]'::JSONB
    )
    INTO priorities
    FROM (
        SELECT submission.section_key, COUNT(*)::INTEGER AS request_count
        FROM person_feedback_submissions submission
        WHERE submission.person_id = p_person_id
          AND submission.feedback_kind = 'supplement_request'
          AND submission.review_status IN ('received', 'reviewing', 'verified', 'published')
          AND submission.updated_at <= NOW() - INTERVAL '2 minutes'
        GROUP BY submission.section_key
    ) priority;

    SELECT COALESCE(
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
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
    FROM person_feedback_submissions submission
    WHERE submission.person_id = p_person_id
      AND submission.participant_hash = participant_digest;

    RETURN JSONB_BUILD_OBJECT(
        'priorities', priorities,
        'ownSubmissions', own_submissions
    );
END;
$$;

REVOKE ALL ON FUNCTION get_person_feedback_context(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_person_feedback_context(UUID, TEXT) TO anon, authenticated;
