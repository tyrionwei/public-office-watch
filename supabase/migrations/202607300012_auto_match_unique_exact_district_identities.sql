SET statement_timeout = 0;

BEGIN;

WITH eligible_matches AS (
    SELECT
        review.source_person_id,
        (review.candidates -> 0 ->> 'personId')::UUID AS person_id,
        review.best_match_score,
        review.district AS source_district,
        review.candidates -> 0 ->> 'district' AS person_district
    FROM public.person_identity_review_queue review
    WHERE review.source_type = 'official_election'
      AND review.review_status = 'probable_match'
      AND review.candidate_count = 1
      AND review.best_match_score IN (85, 90, 95)
      AND review.candidates -> 0 ->> 'matchStatus' = 'probable_match'
      AND REPLACE(
            REGEXP_REPLACE(
                REPLACE(COALESCE(review.district, ''), '臺', '台'),
                '(議員|候選人)$',
                ''
            ),
            '選舉區',
            '選區'
          ) = REPLACE(
            REGEXP_REPLACE(
                REPLACE(COALESCE(review.candidates -> 0 ->> 'district', ''), '臺', '台'),
                '(議員|候選人)$',
                ''
            ),
            '選舉區',
            '選區'
          )
),
updated_matches AS (
    UPDATE public.person_identity_matches identity_match
    SET
        match_status = 'auto_matched',
        match_method = 'auto_approved_unique_exact_district',
        match_reason = CONCAT_WS(
            '; ',
            NULLIF(identity_match.match_reason, ''),
            'auto-approved: unique canonical name with matching gender, role, and exact normalized district'
        ),
        evidence_json = identity_match.evidence_json || JSONB_BUILD_OBJECT(
            'autoReviewPolicy', 'unique-exact-district-v1',
            'candidateCount', 1,
            'exactDistrict', TRUE,
            'sourceDistrict', eligible.source_district,
            'canonicalDistrict', eligible.person_district,
            'originalScore', eligible.best_match_score
        ),
        reviewed_by = 'system:unique-exact-district-v1',
        reviewed_at = NOW(),
        updated_at = NOW()
    FROM eligible_matches eligible
    WHERE identity_match.source_person_id = eligible.source_person_id
      AND identity_match.person_id = eligible.person_id
      AND identity_match.match_status = 'probable_match'
    RETURNING identity_match.id
)
SELECT COUNT(*) AS auto_matched_identity_count
FROM updated_matches;

SELECT published.promote(NULL);

COMMENT ON FUNCTION public.normalize_election_district_label(TEXT) IS
    'Normalizes stored district labels; used with unique-name, gender, role, and exact-district evidence during identity review.';

COMMIT;

RESET statement_timeout;
