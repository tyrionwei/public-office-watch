BEGIN;

CREATE TEMP TABLE _council_platform_matches ON COMMIT DROP AS
WITH exact_candidates AS (
    SELECT
        claim.id AS claim_id,
        candidate.id AS candidate_id,
        candidate.race_id,
        race.election_id,
        COUNT(*) OVER (PARTITION BY claim.id) AS candidate_count
    FROM public.person_claims claim
    JOIN public.person_canonical_map claim_map
      ON claim_map.person_id = claim.person_id
    JOIN public.candidates candidate
      ON TRUE
    JOIN public.person_canonical_map candidate_map
      ON candidate_map.person_id = candidate.person_id
     AND candidate_map.canonical_person_id = claim_map.canonical_person_id
    JOIN public.races race
      ON race.id = candidate.race_id
    JOIN public.elections election
      ON election.id = race.election_id
    WHERE claim.claim_type = 'platform'
      AND claim.candidate_id IS NULL
      AND claim.review_status = 'pending'
      AND claim.source_name IN (
          '新北市議會：現任議員',
          '新竹市議會：現任議員',
          '臺中市議會：現任議員',
          '臺北市議會：現任議員',
          '臺南市議會：現任議員'
      )
      AND claim.source_url ~ '^https://(www[.])?(ntp[.]gov[.]tw|hsinchu-cc[.]gov[.]tw|tccc[.]gov[.]tw|tcc[.]gov[.]tw|tncc[.]gov[.]tw)(/|$)'
      AND election.year = 2022
      AND candidate.election_result = 'elected'
      AND race.title LIKE SPLIT_PART(claim.source_name, '議會', 1) || '%議員選舉'
)
SELECT claim_id, candidate_id, race_id, election_id
FROM exact_candidates
WHERE candidate_count = 1;

UPDATE public.person_claims claim
SET
    candidate_id = matched.candidate_id,
    claim_json = (
        COALESCE(claim.claim_json, '{}'::JSONB) - 'transcriptionCandidates'
    ) || JSONB_BUILD_OBJECT(
        'electionContext', JSONB_BUILD_OBJECT(
            'candidateId', matched.candidate_id,
            'raceId', matched.race_id,
            'electionId', matched.election_id
        ),
        'platformText', claim.claim_value,
        'publicationGate', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Official council platform matched to the incumbent elected candidacy',
            'reviewedAt', NOW()
        ),
        'campaignPlatformReview', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Exact person and 2022 council candidacy were confirmed before publication',
            'reviewedAt', NOW()
        ),
        'reviewDecision', JSONB_BUILD_OBJECT(
            'version', 'election-scoped-platform-policy-v1',
            'decision', 'approve',
            'reviewedAt', NOW()
        )
    ),
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    auto_reviewed_at = NOW(),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) || JSONB_BUILD_ARRAY(
        JSONB_BUILD_OBJECT(
            'version', 'election-scoped-platform-policy-v1',
            'decision', 'approve',
            'reason', 'Official council source and unique elected candidacy match',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
FROM _council_platform_matches matched
WHERE claim.id = matched.claim_id;

WITH cec_platforms AS (
    SELECT
        claim.id AS claim_id,
        candidate.race_id,
        race.election_id,
        TRIM(COALESCE(
            claim.claim_json->'transcriptionCandidates'->>'bestOcrText',
            claim.claim_json->'transcriptionCandidates'->>'ocrText',
            claim.claim_json->'transcriptionCandidates'->>'pdfTextLayer'
        )) AS platform_text
    FROM public.person_claims claim
    JOIN public.candidates candidate
      ON candidate.id = claim.candidate_id
    JOIN public.races race
      ON race.id = candidate.race_id
    JOIN public.elections election
      ON election.id = race.election_id
    JOIN public.person_canonical_map claim_map
      ON claim_map.person_id = claim.person_id
    JOIN public.person_canonical_map candidate_map
      ON candidate_map.person_id = candidate.person_id
     AND candidate_map.canonical_person_id = claim_map.canonical_person_id
    WHERE claim.claim_type = 'platform'
      AND claim.review_status = 'pending'
      AND claim.candidate_id IS NOT NULL
      AND claim.source_name = '中央選舉委員會：2022年選舉公報'
      AND claim.source_url ~ '^https://eebulletin[.]cec[.]gov[.]tw/'
      AND election.year = 2022
), eligible_cec_platforms AS (
    SELECT *
    FROM cec_platforms
    WHERE platform_text IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(platform_text, '[^一-龥]', '', 'g')) >= 8
)
UPDATE public.person_claims claim
SET
    claim_value = eligible.platform_text,
    claim_json = (
        COALESCE(claim.claim_json, '{}'::JSONB) - 'transcriptionCandidates'
    ) || JSONB_BUILD_OBJECT(
        'electionContext', JSONB_BUILD_OBJECT(
            'candidateId', claim.candidate_id,
            'raceId', eligible.race_id,
            'electionId', eligible.election_id
        ),
        'platformText', eligible.platform_text,
        'publicationGate', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Election-scoped CEC platform text accepted; minor transcription errors may remain',
            'reviewedAt', NOW()
        ),
        'campaignPlatformReview', JSONB_BUILD_OBJECT(
            'status', 'passed',
            'reason', 'Exact person and candidacy were confirmed before publication',
            'reviewedAt', NOW()
        ),
        'reviewDecision', JSONB_BUILD_OBJECT(
            'version', 'election-scoped-platform-policy-v1',
            'decision', 'approve',
            'reviewedAt', NOW()
        )
    ),
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    auto_reviewed_at = NOW(),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) || JSONB_BUILD_ARRAY(
        JSONB_BUILD_OBJECT(
            'version', 'election-scoped-platform-policy-v1',
            'decision', 'approve',
            'reason', 'Official CEC source and exact candidacy match',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
FROM eligible_cec_platforms eligible
WHERE claim.id = eligible.claim_id;

CREATE OR REPLACE VIEW public.person_claim_review_queue AS
SELECT
    pc.id AS claim_id,
    pc.person_id,
    pc.source_person_id,
    sp.raw_name,
    sp.normalized_name,
    pc.claim_type,
    pc.claim_value,
    pc.claim_json,
    pc.confidence_level,
    pc.review_score,
    pc.review_status,
    pc.visibility,
    pc.source_name,
    pc.source_url,
    pc.scoring_version,
    pc.scoring_reasons,
    pc.updated_at,
    pc.candidate_id
FROM public.person_claims pc
LEFT JOIN public.source_people sp ON sp.id = pc.source_person_id
WHERE pc.review_status IN ('pending', 'needs_more_evidence')
ORDER BY pc.review_score DESC, pc.updated_at DESC;

COMMENT ON VIEW public.person_claim_review_queue IS
    'Private review queue; election-scoped claims expose candidate_id for publication gating.';

NOTIFY pgrst, 'reload schema';

COMMIT;
