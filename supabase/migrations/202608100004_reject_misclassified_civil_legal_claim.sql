BEGIN;

-- TPHV 94 年度上易字第 461 號 is a civil damages judgment. The
-- imported summary incorrectly described it as a criminal fine and must not
-- remain in the public criminal-record section.
UPDATE public.person_claims
SET review_status = 'rejected',
    visibility = 'review_only',
    is_public = FALSE,
    scoring_reasons = CASE
      WHEN COALESCE(scoring_reasons, '[]'::JSONB)
        ? 'manual_audit: civil judgment misclassified as criminal record'
        THEN COALESCE(scoring_reasons, '[]'::JSONB)
      ELSE COALESCE(scoring_reasons, '[]'::JSONB)
        || jsonb_build_array('manual_audit: civil judgment misclassified as criminal record')
    END,
    updated_at = NOW()
WHERE claim_key = 'research:tnl-dark-guide-legal:388ed832f4461d69';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.public_person_claims AS public_claim
        JOIN public.person_claims AS claim
          ON claim.id = public_claim.claim_id
        WHERE claim.claim_key = 'research:tnl-dark-guide-legal:388ed832f4461d69'
    ) THEN
        RAISE EXCEPTION 'Misclassified civil judgment remains publicly visible';
    END IF;
END
$$;

COMMIT;
