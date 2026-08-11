INSERT INTO regions (
    external_id,
    name,
    slug,
    region_type,
    display_order,
    is_public,
    updated_at
)
VALUES ('tw', '臺灣', 'taiwan', 'country', 0, TRUE, NOW())
ON CONFLICT (slug) DO UPDATE
SET
    name = EXCLUDED.name,
    region_type = EXCLUDED.region_type,
    is_public = TRUE,
    updated_at = NOW();

WITH issue_templates(issue_key, display_order) AS (
    VALUES
        ('transportation', 10),
        ('housing', 20),
        ('childcare_education', 30),
        ('healthcare_eldercare', 40),
        ('environment_climate', 50),
        ('public_safety', 60),
        ('economic_jobs', 70),
        ('urban_rural_development', 80)
)
INSERT INTO region_issues (region_id, issue_key, display_order)
SELECT region.id, template.issue_key, template.display_order
FROM regions region
CROSS JOIN issue_templates template
WHERE region.slug = 'taiwan'
  AND region.region_type = 'country'
  AND region.is_public = TRUE
ON CONFLICT (region_id, issue_key) DO UPDATE
SET
    display_order = EXCLUDED.display_order,
    is_active = TRUE,
    is_public = TRUE,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION submit_region_issue_response(
    p_region_id UUID,
    p_participant_token TEXT,
    p_issue_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    token_hash TEXT;
    normalized_issue_ids UUID[];
    valid_issue_count INTEGER;
    saved_response region_issue_responses;
BEGIN
    IF p_participant_token IS NULL
       OR LENGTH(p_participant_token) < 32
       OR LENGTH(p_participant_token) > 128 THEN
        RAISE EXCEPTION 'Invalid participant token';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM regions region
        WHERE region.id = p_region_id
          AND region.is_public = TRUE
          AND region.region_type IN ('country', 'municipality', 'city', 'county')
    ) THEN
        RAISE EXCEPTION 'Region is not eligible for issue participation';
    END IF;

    SELECT ARRAY_AGG(DISTINCT issue_id ORDER BY issue_id)
    INTO normalized_issue_ids
    FROM UNNEST(p_issue_ids) AS issue_id;

    IF COALESCE(CARDINALITY(normalized_issue_ids), 0) NOT BETWEEN 1 AND 3 THEN
        RAISE EXCEPTION 'Select between one and three issues';
    END IF;

    SELECT COUNT(*)
    INTO valid_issue_count
    FROM region_issues issue
    WHERE issue.region_id = p_region_id
      AND issue.id = ANY(normalized_issue_ids)
      AND issue.is_active = TRUE
      AND issue.is_public = TRUE;

    IF valid_issue_count <> CARDINALITY(normalized_issue_ids) THEN
        RAISE EXCEPTION 'One or more issues are invalid for this region';
    END IF;

    token_hash := ENCODE(DIGEST(p_participant_token, 'sha256'), 'hex');

    INSERT INTO region_issue_responses (
        region_id,
        participant_hash,
        selected_issue_ids,
        response_status,
        verification_method
    )
    VALUES (
        p_region_id,
        token_hash,
        normalized_issue_ids,
        'accepted',
        'participant_token'
    )
    ON CONFLICT (region_id, participant_hash) DO UPDATE
    SET
        selected_issue_ids = EXCLUDED.selected_issue_ids,
        response_status = 'accepted',
        submission_count = region_issue_responses.submission_count + 1,
        updated_at = NOW()
    RETURNING * INTO saved_response;

    RETURN JSONB_BUILD_OBJECT(
        'responseId', saved_response.id,
        'selectedIssueIds', TO_JSONB(saved_response.selected_issue_ids),
        'responseStatus', saved_response.response_status,
        'updatedAt', saved_response.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION submit_region_issue_response(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_region_issue_response(UUID, TEXT, UUID[]) TO anon, authenticated;

REFRESH MATERIALIZED VIEW published.region_issue_results;
