BEGIN;

REVOKE ALL ON FUNCTION published.get_region_issue_response(UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION published.submit_region_issue_response(UUID, TEXT, UUID[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION published.get_person_feedback_context(UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION published.get_region_issue_response(UUID, TEXT);
DROP FUNCTION published.submit_region_issue_response(UUID, TEXT, UUID[]);
DROP FUNCTION published.get_person_feedback_context(UUID, TEXT);
DROP FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.get_region_issue_response(UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_region_issue_response(UUID, TEXT, UUID[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_person_feedback_context(UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.get_region_issue_response(UUID, TEXT);
DROP FUNCTION public.submit_region_issue_response(UUID, TEXT, UUID[]);
DROP FUNCTION public.get_person_feedback_context(UUID, TEXT);
DROP FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.get_region_issue_response(
    p_region_id UUID
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
    selected_ids UUID[];
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );

    SELECT response.selected_issue_ids
    INTO selected_ids
    FROM public.region_issue_responses AS response
    WHERE response.region_id = p_region_id
      AND response.participant_hash = participant_digest;

    RETURN pg_catalog.jsonb_build_object(
        'hasResponse', selected_ids IS NOT NULL,
        'selectedIssueIds', COALESCE(pg_catalog.to_jsonb(selected_ids), '[]'::JSONB)
    );
END;
$$;

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
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    normalized_issue_ids UUID[];
    valid_issue_count INTEGER;
    saved_response public.region_issue_responses%ROWTYPE;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.regions AS region
        WHERE region.id = p_region_id
          AND region.is_public = TRUE
          AND region.region_type IN ('country', 'municipality', 'city', 'county')
    ) THEN
        RAISE EXCEPTION 'Region is not eligible for issue participation';
    END IF;

    SELECT pg_catalog.array_agg(DISTINCT issue_id ORDER BY issue_id)
    INTO normalized_issue_ids
    FROM pg_catalog.unnest(p_issue_ids) AS issue_id;

    IF COALESCE(pg_catalog.cardinality(normalized_issue_ids), 0) NOT BETWEEN 1 AND 3 THEN
        RAISE EXCEPTION 'Select between one and three issues';
    END IF;

    SELECT pg_catalog.count(*)
    INTO valid_issue_count
    FROM public.region_issues AS issue
    WHERE issue.region_id = p_region_id
      AND issue.id = ANY(normalized_issue_ids)
      AND issue.is_active = TRUE
      AND issue.is_public = TRUE;

    IF valid_issue_count <> pg_catalog.cardinality(normalized_issue_ids) THEN
        RAISE EXCEPTION 'One or more issues are invalid for this region';
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );

    INSERT INTO public.region_issue_responses (
        region_id,
        participant_hash,
        selected_issue_ids,
        response_status,
        verification_method
    )
    VALUES (
        p_region_id,
        participant_digest,
        normalized_issue_ids,
        'accepted',
        'supabase_anonymous_auth'
    )
    ON CONFLICT (region_id, participant_hash) DO UPDATE
    SET
        selected_issue_ids = EXCLUDED.selected_issue_ids,
        response_status = 'accepted',
        verification_method = EXCLUDED.verification_method,
        submission_count = public.region_issue_responses.submission_count + 1,
        updated_at = pg_catalog.now()
    RETURNING * INTO saved_response;

    RETURN pg_catalog.jsonb_build_object(
        'responseId', saved_response.id,
        'selectedIssueIds', pg_catalog.to_jsonb(saved_response.selected_issue_ids),
        'responseStatus', saved_response.response_status,
        'updatedAt', saved_response.updated_at
    );
END;
$$;

CREATE FUNCTION public.get_person_feedback_context(
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
    priorities JSONB;
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

    RETURN pg_catalog.jsonb_build_object(
        'priorities', priorities,
        'ownSubmissions', own_submissions
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
DECLARE
    participant_id UUID;
    participant_digest TEXT;
    normalized_message TEXT;
    normalized_evidence_url TEXT;
    saved_submission public.person_feedback_submissions%ROWTYPE;
BEGIN
    participant_id := auth.uid();
    IF participant_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
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
        FROM public.people AS person
        WHERE person.id = p_person_id
          AND person.is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Person is not public';
    END IF;

    normalized_message := NULLIF(pg_catalog.btrim(COALESCE(p_message, '')), '');
    normalized_evidence_url := NULLIF(pg_catalog.btrim(COALESCE(p_evidence_url, '')), '');

    IF p_feedback_kind = 'problem_report' THEN
        IF p_problem_type NOT IN ('inaccurate', 'outdated', 'broken_source', 'misleading', 'other') THEN
            RAISE EXCEPTION 'Invalid problem type';
        END IF;

        IF pg_catalog.char_length(COALESCE(normalized_message, '')) NOT BETWEEN 20 AND 1500 THEN
            RAISE EXCEPTION 'Problem description must contain 20 to 1500 characters';
        END IF;

        IF normalized_evidence_url IS NOT NULL AND (
            pg_catalog.char_length(normalized_evidence_url) > 2048
            OR normalized_evidence_url !~ '^https?://'
        ) THEN
            RAISE EXCEPTION 'Evidence URL must use http or https';
        END IF;
    ELSE
        p_problem_type := NULL;
        normalized_message := NULL;
        normalized_evidence_url := NULL;
    END IF;

    participant_digest := pg_catalog.encode(
        extensions.digest(participant_id::TEXT, 'sha256'),
        'hex'
    );

    INSERT INTO public.person_feedback_submissions (
        person_id,
        feedback_kind,
        section_key,
        problem_type,
        message,
        evidence_url,
        participant_hash
    )
    VALUES (
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
        submission_count = public.person_feedback_submissions.submission_count + 1,
        updated_at = pg_catalog.now()
    RETURNING * INTO saved_submission;

    RETURN pg_catalog.jsonb_build_object(
        'submissionId', saved_submission.id,
        'feedbackKind', saved_submission.feedback_kind,
        'sectionKey', saved_submission.section_key,
        'reviewStatus', saved_submission.review_status,
        'submissionCount', saved_submission.submission_count
    );
END;
$$;

CREATE FUNCTION published.get_region_issue_response(
    p_region_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.get_region_issue_response(p_region_id);
$$;

CREATE FUNCTION published.submit_region_issue_response(
    p_region_id UUID,
    p_issue_ids UUID[]
)
RETURNS JSONB
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.submit_region_issue_response(p_region_id, p_issue_ids);
$$;

CREATE FUNCTION published.get_person_feedback_context(
    p_person_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.get_person_feedback_context(p_person_id);
$$;

CREATE FUNCTION published.submit_person_feedback(
    p_person_id UUID,
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
SET search_path = ''
AS $$
    SELECT public.submit_person_feedback(
        p_person_id,
        p_feedback_kind,
        p_section_key,
        p_problem_type,
        p_message,
        p_evidence_url
    );
$$;

REVOKE ALL ON FUNCTION public.get_region_issue_response(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_region_issue_response(UUID, UUID[])
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_person_feedback_context(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION published.get_region_issue_response(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.submit_region_issue_response(UUID, UUID[])
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.get_person_feedback_context(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.get_region_issue_response(UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION published.submit_region_issue_response(UUID, UUID[])
TO authenticated;
GRANT EXECUTE ON FUNCTION published.get_person_feedback_context(UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
TO authenticated;

COMMENT ON FUNCTION public.get_region_issue_response(UUID) IS
    'Returns the region issue selection owned by the current authenticated Supabase user.';
COMMENT ON FUNCTION public.submit_region_issue_response(UUID, UUID[]) IS
    'Creates or updates the region issue selection owned by the current authenticated Supabase user.';
COMMENT ON FUNCTION public.get_person_feedback_context(UUID) IS
    'Returns delayed aggregate priorities and feedback state owned by the current authenticated Supabase user.';
COMMENT ON FUNCTION public.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
    'Creates or updates person feedback owned by the current authenticated Supabase user.';

NOTIFY pgrst, 'reload schema';

COMMIT;
