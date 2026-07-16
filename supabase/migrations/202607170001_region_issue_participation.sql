CREATE TABLE region_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    issue_key TEXT NOT NULL CHECK (issue_key ~ '^[a-z][a-z0-9_]+$'),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (region_id, issue_key)
);

CREATE INDEX idx_region_issues_public_region
    ON region_issues(region_id, display_order)
    WHERE is_active = TRUE AND is_public = TRUE;

CREATE TABLE region_issue_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    participant_hash TEXT NOT NULL,
    selected_issue_ids UUID[] NOT NULL,
    response_status TEXT NOT NULL DEFAULT 'accepted' CHECK (
        response_status IN ('accepted', 'pending', 'verified', 'quarantined')
    ),
    verification_method TEXT NOT NULL DEFAULT 'participant_token',
    submission_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (region_id, participant_hash),
    CHECK (cardinality(selected_issue_ids) BETWEEN 1 AND 3)
);

CREATE INDEX idx_region_issue_responses_public_results
    ON region_issue_responses(region_id, updated_at)
    WHERE response_status IN ('accepted', 'verified');

ALTER TABLE region_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_issue_responses ENABLE ROW LEVEL SECURITY;

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
SELECT r.id, template.issue_key, template.display_order
FROM regions r
CROSS JOIN issue_templates template
WHERE r.is_public = TRUE
  AND r.region_type IN ('municipality', 'city', 'county')
ON CONFLICT (region_id, issue_key) DO UPDATE
SET
    display_order = EXCLUDED.display_order,
    is_active = TRUE,
    is_public = TRUE,
    updated_at = NOW();

CREATE OR REPLACE VIEW public_region_issue_results AS
WITH eligible_responses AS (
    SELECT response.*
    FROM region_issue_responses response
    WHERE response.response_status IN ('accepted', 'verified')
      AND response.updated_at <= NOW() - INTERVAL '2 minutes'
),
region_totals AS (
    SELECT region_id, COUNT(*)::INTEGER AS participant_count
    FROM eligible_responses
    GROUP BY region_id
)
SELECT
    issue.id AS issue_id,
    issue.region_id,
    region.name AS region_name,
    issue.issue_key,
    issue.display_order,
    COUNT(response.id)::INTEGER AS response_count,
    COALESCE(total.participant_count, 0)::INTEGER AS participant_count,
    CASE
        WHEN COALESCE(total.participant_count, 0) = 0 THEN 0::NUMERIC
        ELSE ROUND(COUNT(response.id)::NUMERIC * 100 / total.participant_count, 1)
    END AS selection_rate
FROM region_issues issue
JOIN regions region ON region.id = issue.region_id AND region.is_public = TRUE
LEFT JOIN eligible_responses response
    ON response.region_id = issue.region_id
   AND issue.id = ANY(response.selected_issue_ids)
LEFT JOIN region_totals total ON total.region_id = issue.region_id
WHERE issue.is_active = TRUE
  AND issue.is_public = TRUE
GROUP BY
    issue.id,
    issue.region_id,
    region.name,
    issue.issue_key,
    issue.display_order,
    total.participant_count;

CREATE OR REPLACE FUNCTION get_region_issue_response(
    p_region_id UUID,
    p_participant_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    token_hash TEXT;
    selected_ids UUID[];
BEGIN
    IF p_participant_token IS NULL
       OR LENGTH(p_participant_token) < 32
       OR LENGTH(p_participant_token) > 128 THEN
        RAISE EXCEPTION 'Invalid participant token';
    END IF;

    token_hash := ENCODE(DIGEST(p_participant_token, 'sha256'), 'hex');

    SELECT response.selected_issue_ids
    INTO selected_ids
    FROM region_issue_responses response
    WHERE response.region_id = p_region_id
      AND response.participant_hash = token_hash;

    RETURN JSONB_BUILD_OBJECT(
        'hasResponse', selected_ids IS NOT NULL,
        'selectedIssueIds', COALESCE(TO_JSONB(selected_ids), '[]'::JSONB)
    );
END;
$$;

CREATE OR REPLACE FUNCTION submit_region_issue_response(
    p_region_id UUID,
    p_participant_token TEXT,
    p_issue_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
          AND region.region_type IN ('municipality', 'city', 'county')
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

REVOKE ALL ON region_issues FROM PUBLIC, anon, authenticated;
REVOKE ALL ON region_issue_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public_region_issue_results TO anon, authenticated;

REVOKE ALL ON FUNCTION get_region_issue_response(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_region_issue_response(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_region_issue_response(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_region_issue_response(UUID, TEXT, UUID[]) TO anon, authenticated;

COMMENT ON VIEW public_region_issue_results IS
    'Voluntary participation statistics delayed by two minutes; not a representative opinion poll.';
COMMENT ON TABLE region_issue_responses IS
    'Stores one active 1-3 issue selection per anonymous participant and region. Raw participant tokens are never stored.';
