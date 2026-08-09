SET statement_timeout = 0;

-- The source paragraph records a legislative committee question about the
-- Passport Act rules. It is not litigation or alleged misconduct and was
-- misclassified by the legacy VoteTW section parser as a legal case.
CREATE TEMP TABLE _votetw_misclassified_legal_target AS
SELECT claim.id AS claim_id
FROM person_claims claim
JOIN people person ON person.id = claim.person_id
WHERE claim.id = '569fa0da-8ef6-4c99-ac46-f5649887cf2d'
  AND person.name = '林昶佐'
  AND claim.source_name = 'VoteTW'
  AND claim.claim_type = 'legal_case'
  AND claim.source_url =
      'https://votetw.com/wiki/%E6%9E%97%E6%98%B6%E4%BD%90'
  AND claim.claim_value LIKE '%立法院外交國防委員會質詢%'
  AND claim.scoring_version IN (
      '2026-05-23-v1',
      'votetw-misclassified-legal-archive-v1'
  );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_misclassified_legal_target) <> 1 THEN
        RAISE EXCEPTION 'VoteTW misclassified legal boundary drifted';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-misclassified-legal-archive-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-misclassified-legal-archive-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-misclassified-legal-archive-v1',
                    'reason', 'Legislative questioning was incorrectly parsed as a legal case',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_misclassified_legal_target target
WHERE claim.id = target.claim_id
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-misclassified-legal-archive-v1'
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM _votetw_misclassified_legal_target target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-misclassified-legal-archive-v1'
    ) THEN
        RAISE EXCEPTION 'VoteTW misclassified legal state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);
