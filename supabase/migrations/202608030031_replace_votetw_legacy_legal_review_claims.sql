SET statement_timeout = 0;

-- Replace three legacy VoteTW prose dumps with concise, independently sourced
-- review records. These remain non-public until a separate human approval.
CREATE TEMP TABLE _votetw_legacy_legal_targets (
    claim_id UUID PRIMARY KEY,
    person_id UUID NOT NULL,
    person_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_legacy_legal_targets VALUES
    (
        '11b95039-1cc2-47c1-9a78-678a349265b2',
        'd84635b6-18e4-498b-9641-716bbb82eb97',
        '李婉鈺'
    ),
    (
        'b07b3c16-6906-4d45-815d-34babf2c8401',
        '04d59c7b-6645-443f-8fb5-cca569cda73e',
        '潘懷宗'
    ),
    (
        '387a87ce-0eb7-45a4-8bce-95a6c1966557',
        '53f5e2f0-8f8b-4224-820c-aadfd5c66eab',
        '陳明義'
    );

CREATE TEMP TABLE _votetw_independent_legal_review (
    claim_key TEXT PRIMARY KEY,
    person_id UUID UNIQUE NOT NULL,
    person_name TEXT NOT NULL,
    claim_value TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    case_kind TEXT NOT NULL,
    case_stage TEXT NOT NULL,
    record_type TEXT NOT NULL,
    safety_flags JSONB NOT NULL,
    legacy_claim_id UUID UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_independent_legal_review VALUES
    (
        'research:votetw-independent-legal:li-wanyu-2015-defamation-nonprosecution',
        'd84635b6-18e4-498b-9641-716bbb82eb97',
        '李婉鈺',
        '李婉鈺指控林水山涉及民進黨議員初選賄選，遭告誹謗後獲不起訴處分。',
        '自由時報',
        'https://news.ltn.com.tw/news/society/breakingnews/1351571',
        '2015-06-17 00:00:00+08',
        'defamation',
        'non_prosecution',
        'criminal_procedure',
        '["not_a_conviction","outcome_must_be_stated","media_evidence_capped_at_b"]'::JSONB,
        '11b95039-1cc2-47c1-9a78-678a349265b2'
    ),
    (
        'research:votetw-independent-legal:pan-huai-tsung-2017-civil-defamation-appeal',
        '04d59c7b-6645-443f-8fb5-cca569cda73e',
        '潘懷宗',
        '潘懷宗不滿姚文智以「黑心代言」批評而提起民事求償；臺灣高等法院二審駁回其上訴，姚文智免賠。',
        '中央社',
        'https://www.cna.com.tw/news/asoc/201712120118.aspx',
        '2017-12-12 00:00:00+08',
        'civil_defamation',
        'civil_appeal_dismissed_non_final',
        'civil',
        '["must_not_be_described_as_criminal_conviction","later_outcome_review_needed","media_evidence_capped_at_b"]'::JSONB,
        'b07b3c16-6906-4d45-815d-34babf2c8401'
    ),
    (
        'research:votetw-independent-legal:chen-ming-yi-2015-election-recount',
        '53f5e2f0-8f8b-4224-820c-aadfd5c66eab',
        '陳明義',
        '陳明義就2014年新北市議員選舉聲請驗票；初步勘驗後仍差5票，報導當時尚有44張爭議票待法院認定。',
        '自由時報',
        'https://features.ltn.com.tw/english/article/paper/886937',
        '2015-06-06 00:00:00+08',
        'election_recount',
        'election_recount_pending',
        'election_civil',
        '["must_not_attribute_criminal_liability","result_not_final_in_source","media_evidence_capped_at_b"]'::JSONB,
        '387a87ce-0eb7-45a4-8bce-95a6c1966557'
    );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_legacy_legal_targets) <> 3
       OR (SELECT COUNT(*) FROM _votetw_independent_legal_review) <> 3
       OR EXISTS (
           SELECT 1
           FROM _votetw_legacy_legal_targets target
           LEFT JOIN people person ON person.id = target.person_id
           LEFT JOIN person_claims claim ON claim.id = target.claim_id
           WHERE person.id IS NULL
              OR person.name <> target.person_name
              OR person.is_public <> TRUE
              OR claim.id IS NULL
              OR claim.person_id <> target.person_id
              OR claim.source_name <> 'VoteTW'
              OR claim.claim_type <> 'legal_case'
              OR claim.review_status NOT IN (
                  'needs_more_evidence', 'archived'
              )
       )
       OR EXISTS (
           SELECT 1
           FROM person_claims existing
           JOIN _votetw_independent_legal_review incoming
             ON incoming.claim_key = existing.claim_key
           WHERE existing.person_id <> incoming.person_id
              OR existing.claim_type <> 'legal_case'
       ) THEN
        RAISE EXCEPTION 'VoteTW independent legal review boundary drifted';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-legal-raw-replaced-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version = 'votetw-legal-raw-replaced-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-legal-raw-replaced-v1',
                    'reason', 'Archived legacy prose after creating a concise independent-source review record',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_legacy_legal_targets target
WHERE claim.id = target.claim_id
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-legal-raw-replaced-v1'
  );

INSERT INTO person_claims (
    claim_key,
    person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_score,
    review_status,
    visibility,
    source_name,
    source_url,
    observed_at,
    is_public,
    scoring_version,
    scoring_reasons,
    updated_at
)
SELECT
    review.claim_key,
    review.person_id,
    'legal_case',
    review.claim_value,
    jsonb_build_object(
        'sourceId', 'votetw-independent-legal-research',
        'legacyClaimId', review.legacy_claim_id,
        'caseKind', review.case_kind,
        'caseStage', review.case_stage,
        'recordType', review.record_type,
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', review.source_name,
                'url', review.source_url,
                'supports', review.claim_value
            )
        ),
        'safetyFlags', review.safety_flags,
        'legalCasePublicEligible', FALSE,
        'publicationGate', jsonb_build_object(
            'status', 'preview_only',
            'requiresHumanApproval', TRUE,
            'requiresCurrentOutcomeReview', TRUE
        )
    ),
    'B',
    85,
    'pending',
    'review_only',
    review.source_name,
    review.source_url,
    review.observed_at,
    FALSE,
    'votetw-independent-legal-review-v1',
    jsonb_build_array(
        jsonb_build_object(
            'version', 'votetw-independent-legal-review-v1',
            'reason', 'Concise legal record supported by independent trusted media and held for human approval',
            'reviewedAt', NOW()
        )
    ),
    NOW()
FROM _votetw_independent_legal_review review
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    claim_type = EXCLUDED.claim_type,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_score = EXCLUDED.review_score,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    updated_at = EXCLUDED.updated_at
WHERE person_claims.person_id IS DISTINCT FROM EXCLUDED.person_id
   OR person_claims.claim_type IS DISTINCT FROM EXCLUDED.claim_type
   OR person_claims.claim_value IS DISTINCT FROM EXCLUDED.claim_value
   OR person_claims.claim_json IS DISTINCT FROM EXCLUDED.claim_json
   OR person_claims.confidence_level IS DISTINCT FROM EXCLUDED.confidence_level
   OR person_claims.review_score IS DISTINCT FROM EXCLUDED.review_score
   OR person_claims.review_status IS DISTINCT FROM EXCLUDED.review_status
   OR person_claims.visibility IS DISTINCT FROM EXCLUDED.visibility
   OR person_claims.source_name IS DISTINCT FROM EXCLUDED.source_name
   OR person_claims.source_url IS DISTINCT FROM EXCLUDED.source_url
   OR person_claims.observed_at IS DISTINCT FROM EXCLUDED.observed_at
   OR person_claims.is_public IS DISTINCT FROM EXCLUDED.is_public
   OR person_claims.scoring_version IS DISTINCT FROM EXCLUDED.scoring_version;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_legacy_legal_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version = 'votetw-legal-raw-replaced-v1'
    ) <> 3
       OR (
           SELECT COUNT(*)
           FROM _votetw_independent_legal_review review
           JOIN person_claims claim USING (claim_key)
           WHERE claim.review_status = 'pending'
             AND claim.visibility = 'review_only'
             AND claim.is_public = FALSE
             AND claim.confidence_level = 'B'
             AND claim.scoring_version =
                 'votetw-independent-legal-review-v1'
       ) <> 3
       OR EXISTS (
           SELECT 1
           FROM _votetw_independent_legal_review review
           JOIN person_claims claim USING (claim_key)
           JOIN public_person_claims public_claim
             ON public_claim.claim_id = claim.id
       ) THEN
        RAISE EXCEPTION 'VoteTW independent legal review state mismatch';
    END IF;
END;
$$;
