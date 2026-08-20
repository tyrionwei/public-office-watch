BEGIN;

UPDATE public.person_claims
SET
    review_status = 'pending',
    visibility = 'review_only',
    is_public = FALSE,
    claim_json = JSONB_SET(
        COALESCE(claim_json, '{}'::JSONB),
        '{campaignPlatformReview}',
        JSONB_BUILD_OBJECT(
            'status', 'pending_candidate_match',
            'reason', 'Historical platforms require an exact CEC election bulletin and candidate_id before publication',
            'quarantinedAt', '2026-08-13T00:00:00+08:00'
        ),
        TRUE
    ),
    updated_at = NOW()
WHERE claim_type = 'platform'
  AND candidate_id IS NULL
  AND (
      review_status = 'verified'
      OR visibility = 'public'
      OR is_public = TRUE
  );

ALTER TABLE public.person_claims
    ADD CONSTRAINT person_claims_public_platform_requires_candidate
    CHECK (
        claim_type <> 'platform'
        OR candidate_id IS NOT NULL
        OR is_public IS DISTINCT FROM TRUE
        OR visibility IS DISTINCT FROM 'public'
    );

COMMENT ON CONSTRAINT person_claims_public_platform_requires_candidate
ON public.person_claims IS
    'Election platforms may be public only after an exact candidacy has been identified.';

NOTIFY pgrst, 'reload schema';

COMMIT;
