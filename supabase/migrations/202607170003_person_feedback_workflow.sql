CREATE TABLE person_feedback_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    feedback_kind TEXT NOT NULL CHECK (
        feedback_kind IN ('supplement_request', 'problem_report')
    ),
    section_key TEXT NOT NULL CHECK (
        section_key IN (
            'basic',
            'candidacies',
            'timeline',
            'affiliations',
            'resume',
            'platform',
            'finance',
            'legal',
            'family',
            'sources'
        )
    ),
    problem_type TEXT CHECK (
        problem_type IS NULL OR problem_type IN (
            'inaccurate',
            'outdated',
            'broken_source',
            'misleading',
            'other'
        )
    ),
    message TEXT,
    evidence_url TEXT,
    participant_hash TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'received' CHECK (
        review_status IN ('received', 'reviewing', 'verified', 'rejected', 'published')
    ),
    submission_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (person_id, feedback_kind, section_key, participant_hash),
    CHECK (
        feedback_kind <> 'problem_report'
        OR (
            problem_type IS NOT NULL
            AND CHAR_LENGTH(COALESCE(message, '')) BETWEEN 20 AND 1500
        )
    ),
    CHECK (
        evidence_url IS NULL
        OR (
            CHAR_LENGTH(evidence_url) <= 2048
            AND evidence_url ~ '^https?://'
        )
    )
);

CREATE INDEX idx_person_feedback_review_queue
    ON person_feedback_submissions(review_status, updated_at DESC);

CREATE INDEX idx_person_feedback_supplement_counts
    ON person_feedback_submissions(person_id, section_key, updated_at)
    WHERE feedback_kind = 'supplement_request'
      AND review_status IN ('received', 'reviewing', 'verified', 'published');

ALTER TABLE person_feedback_submissions ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION submit_person_feedback(
    p_person_id UUID,
    p_participant_token TEXT,
    p_feedback_kind TEXT,
    p_section_key TEXT,
    p_problem_type TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_evidence_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    participant_digest TEXT;
    normalized_message TEXT;
    normalized_evidence_url TEXT;
    saved_submission person_feedback_submissions;
BEGIN
    IF p_participant_token IS NULL OR CHAR_LENGTH(p_participant_token) NOT BETWEEN 16 AND 200 THEN
        RAISE EXCEPTION 'Invalid participant token';
    END IF;

    IF p_feedback_kind NOT IN ('supplement_request', 'problem_report') THEN
        RAISE EXCEPTION 'Invalid feedback kind';
    END IF;

    IF p_section_key NOT IN (
        'basic',
        'candidacies',
        'timeline',
        'affiliations',
        'resume',
        'platform',
        'finance',
        'legal',
        'family',
        'sources'
    ) THEN
        RAISE EXCEPTION 'Invalid feedback section';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM people person
        WHERE person.id = p_person_id
          AND person.is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Person is not public';
    END IF;

    normalized_message := NULLIF(TRIM(COALESCE(p_message, '')), '');
    normalized_evidence_url := NULLIF(TRIM(COALESCE(p_evidence_url, '')), '');

    IF p_feedback_kind = 'problem_report' THEN
        IF p_problem_type NOT IN ('inaccurate', 'outdated', 'broken_source', 'misleading', 'other') THEN
            RAISE EXCEPTION 'Invalid problem type';
        END IF;

        IF CHAR_LENGTH(COALESCE(normalized_message, '')) NOT BETWEEN 20 AND 1500 THEN
            RAISE EXCEPTION 'Problem description must contain 20 to 1500 characters';
        END IF;

        IF normalized_evidence_url IS NOT NULL AND (
            CHAR_LENGTH(normalized_evidence_url) > 2048
            OR normalized_evidence_url !~ '^https?://'
        ) THEN
            RAISE EXCEPTION 'Evidence URL must use http or https';
        END IF;
    ELSE
        p_problem_type := NULL;
        normalized_message := NULL;
        normalized_evidence_url := NULL;
    END IF;

    participant_digest := ENCODE(DIGEST(p_participant_token, 'sha256'), 'hex');

    INSERT INTO person_feedback_submissions (
        person_id,
        feedback_kind,
        section_key,
        problem_type,
        message,
        evidence_url,
        participant_hash
    ) VALUES (
        p_person_id,
        p_feedback_kind,
        p_section_key,
        p_problem_type,
        normalized_message,
        normalized_evidence_url,
        participant_digest
    )
    ON CONFLICT (person_id, feedback_kind, section_key, participant_hash)
    DO UPDATE SET
        problem_type = EXCLUDED.problem_type,
        message = EXCLUDED.message,
        evidence_url = EXCLUDED.evidence_url,
        review_status = 'received',
        submission_count = person_feedback_submissions.submission_count + 1,
        updated_at = NOW()
    RETURNING * INTO saved_submission;

    RETURN JSONB_BUILD_OBJECT(
        'submissionId', saved_submission.id,
        'feedbackKind', saved_submission.feedback_kind,
        'sectionKey', saved_submission.section_key,
        'reviewStatus', saved_submission.review_status,
        'submissionCount', saved_submission.submission_count
    );
END;
$$;

REVOKE ALL ON person_feedback_submissions FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION get_person_feedback_context(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_person_feedback_context(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON TABLE person_feedback_submissions IS
    'Private user requests for missing person data and problem reports. Content is review-only and never published automatically.';

COMMENT ON FUNCTION get_person_feedback_context(UUID, TEXT) IS
    'Returns delayed supplement category counts and only the calling participant token own submission statuses.';
