BEGIN;

CREATE TEMP TABLE _updated_2018_national_security_outcomes (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    claim_value TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _updated_2018_national_security_outcomes VALUES
('research:tnl-dark-guide-legal:611dd79677a34123', 'a6f2ae78-fd47-4bc7-9843-3e3363329e17', 'tnl-dark-guide-2018-tpe-1-10-涉案紀錄-1', '侯漢廷曾因涉嫌違反國家安全法遭起訴；臺北地方法院於2021年判決無罪，臺灣高等法院於2022年二審維持無罪，仍待發布前確認終局結果。'),
('research:tnl-dark-guide-legal:ae0904ba48484d34', 'd5f59f85-03f8-47e4-b814-4ae60e3b7591', 'tnl-dark-guide-2018-tpe-3-46-涉案紀錄-1', '林明正曾因涉嫌違反國家安全法遭起訴；臺北地方法院於2021年判決無罪，臺灣高等法院於2022年二審維持無罪，仍待發布前確認終局結果。');

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _updated_2018_national_security_outcomes) <> 2 THEN
        RAISE EXCEPTION 'Expected exactly 2 updated 2018 national-security outcomes';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _updated_2018_national_security_outcomes staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'An updated national-security outcome targets a missing or private person';
    END IF;
END
$$;

INSERT INTO person_claims (
    claim_key, person_id, claim_type, claim_value, claim_json,
    confidence_level, review_score, review_status, visibility,
    source_name, source_url, observed_at, is_public, scoring_version,
    scoring_reasons, auto_reviewed_at, updated_at
)
SELECT
    staged.claim_key, staged.person_id, 'legal_case', staged.claim_value,
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(staged.research_id),
        'caseKind', 'national_security',
        'caseStage', 'acquitted_non_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official', 'name', '司法院',
                'url', 'https://www.judicial.gov.tw/tw/cp-1888-416327-f5e01-1.html',
                'supports', '臺北地方法院107年度矚重訴字第1號等案件一審判決無罪'
            ),
            jsonb_build_object(
                'tier', 'trusted_media', 'name', '中央社',
                'url', 'https://www.cna.com.tw/news/asoc/202205135002.aspx',
                'supports', '臺灣高等法院二審維持無罪判決'
            )
        ),
        'safetyFlags', jsonb_build_array(
            'acquittal_must_be_prominent',
            'current_outcome_not_independently_verified'
        ),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', true
        )
    ),
    'B', 90, 'verified', 'review_only',
    '中央社', 'https://www.cna.com.tw/news/asoc/202205135002.aspx',
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'tnl-dark-guide-legal-2018-national-security-outcomes-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2018-national-security-outcomes-v1',
        'reason', 'Updated the original indictment-only research lead with official first-instance and trusted-media second-instance acquittal outcomes; retained as non-public data pending finality review',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _updated_2018_national_security_outcomes staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _updated_2018_national_security_outcomes staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'B' AND claim.review_score = 90
          AND claim.review_status = 'verified' AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->'safetyFlags' ? 'acquittal_must_be_prominent'
          AND claim.claim_json->'publicationGate'->>'requiresCurrentOutcomeReview' = 'true'
    ) <> 2 THEN
        RAISE EXCEPTION 'Updated national-security outcome guard failed';
    END IF;
END
$$;

COMMIT;
