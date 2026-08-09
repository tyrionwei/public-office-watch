SET statement_timeout = 0;

-- VoteTW profile identifiers are provenance metadata, not public person facts.
-- Claims independently corroborated by an already verified public source are
-- also redundant in the manual queue. Preserve both groups as private audit
-- history instead of deleting them.
CREATE TEMP TABLE _votetw_review_archive (
    claim_id UUID PRIMARY KEY,
    archive_reason TEXT NOT NULL
);

INSERT INTO _votetw_review_archive (claim_id, archive_reason)
SELECT
    claim.id,
    'source_external_id'
FROM person_claims claim
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_type = 'external_id'
  AND claim.review_status = 'needs_more_evidence'
  AND claim.visibility = 'review_only'
  AND claim.is_public = FALSE;

CREATE TEMP TABLE _verified_claim_lookup AS
SELECT
    COALESCE(canonical.canonical_person_id, claim.person_id) AS person_id,
    claim.claim_type,
    MD5(COALESCE(TRIM(claim.claim_value), '')) AS value_hash,
    claim.claim_value
FROM person_claims claim
LEFT JOIN person_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

CREATE INDEX _verified_claim_lookup_match_idx
ON _verified_claim_lookup (person_id, claim_type, value_hash);

ANALYZE _verified_claim_lookup;

INSERT INTO _votetw_review_archive (claim_id, archive_reason)
SELECT DISTINCT
    claim.id,
    'independently_corroborated'
FROM person_claims claim
JOIN person_canonical_map claim_map
  ON claim_map.person_id = claim.person_id
JOIN _verified_claim_lookup evidence
  ON evidence.person_id = claim_map.canonical_person_id
 AND evidence.claim_type = claim.claim_type
 AND evidence.value_hash = MD5(COALESCE(TRIM(claim.claim_value), ''))
 AND COALESCE(TRIM(evidence.claim_value), '') =
     COALESCE(TRIM(claim.claim_value), '')
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_type IN ('birth_date', 'gender', 'party_affiliation')
  AND claim.review_status = 'needs_more_evidence'
  AND claim.visibility = 'review_only'
  AND claim.is_public = FALSE
ON CONFLICT (claim_id) DO NOTHING;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_review_archive) <> 2146 THEN
        RAISE EXCEPTION 'VoteTW review archive total drifted from 2146';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_review_archive
        WHERE archive_reason = 'source_external_id'
    ) <> 1567 THEN
        RAISE EXCEPTION 'VoteTW external id archive count drifted from 1567';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_review_archive
        WHERE archive_reason = 'independently_corroborated'
    ) <> 579 THEN
        RAISE EXCEPTION 'VoteTW corroborated archive count drifted from 579';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-review-reconciliation-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-review-reconciliation-v1',
                'reason',
                    CASE archived.archive_reason
                        WHEN 'source_external_id' THEN
                            'VoteTW external id retained as private provenance metadata'
                        ELSE
                            'VoteTW claim retained as private audit history because an independent verified public source already provides the same value'
                    END,
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_review_archive archived
WHERE claim.id = archived.claim_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _votetw_review_archive archived
        JOIN person_claims claim ON claim.id = archived.claim_id
        WHERE claim.review_status <> 'archived'
           OR claim.visibility <> 'private'
           OR claim.is_public IS TRUE
    ) THEN
        RAISE EXCEPTION 'VoteTW review archive did not reach the expected state';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_review_archive;
DROP TABLE _verified_claim_lookup;

RESET statement_timeout;
