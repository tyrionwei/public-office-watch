BEGIN;

CREATE TEMP TABLE _reviewed_current_2026_tnl_legal_claims (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    claim_value TEXT NOT NULL,
    claim_json JSONB NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_current_2026_tnl_legal_claims (
    claim_key,
    person_id,
    claim_value,
    claim_json,
    source_name,
    source_url
)
VALUES
(
    'research:tnl-dark-guide-legal:bfe65e82f2e5bf42',
    '4cb6ee34-2d7d-42ae-b579-ec59ec95fc43',
    '臺灣高等法院臺南分院110年度上更一字第20號判決認定使公務員登載不實罪，判處有期徒刑4月確定。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(
            'tnl-dark-guide-2018-tnn-3-21-涉案紀錄-1',
            'tnl-dark-guide-2022-tnn-3-6-涉案紀錄-1'
        ),
        'caseKind', 'document_falsification',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNHM,110%2c%e4%b8%8a%e6%9b%b4%e4%b8%80%2c20%2c20211230%2c1',
                'supports', '臺灣高等法院臺南分院110年度上更一字第20號判決及確定結果'
            ),
            jsonb_build_object(
                'tier', 'official',
                'name', '臺灣臺南地方法院',
                'url', 'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=542544',
                'supports', '107年度訴字第667號第一審判決資料'
            )
        ),
        'safetyFlags', jsonb_build_array('historical_non_final_description_replaced'),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    '司法院法學資料檢索系統',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNHM,110%2c%e4%b8%8a%e6%9b%b4%e4%b8%80%2c20%2c20211230%2c1'
),
(
    'research:tnl-dark-guide-legal:3d058020facade28',
    '08c78b83-b063-4f43-95d2-7f29d550203e',
    '過失致人於死案件判處有期徒刑8月、緩刑4年並付保護管束確定；法院其後裁定免除繼續執行保護管束。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array('tnl-dark-guide-2018-tnn-6-42-涉案紀錄-1'),
        'caseKind', 'negligent_homicide',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '臺灣高等法院臺南分院',
                'url', 'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=353153',
                'supports', '過失致死判決確定及其後免除保護管束裁定'
            )
        ),
        'safetyFlags', jsonb_build_array('later_supervision_order_included'),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    '臺灣高等法院臺南分院',
    'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=353153'
),
(
    'research:tnl-dark-guide-legal:5f467c1bcc356a15',
    'bdb47895-889a-478a-81a7-aa8138a85c39',
    '臺灣高等法院高雄分院103年度上訴字第715號判決駁回上訴，使公務員登載不實罪有期徒刑4月確定，得易科罰金。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(
            'tnl-dark-guide-2018-khh-7-62-涉案紀錄-1',
            'tnl-dark-guide-2022-khh-7-11-涉案紀錄-1'
        ),
        'caseKind', 'document_falsification',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,103%2c%e4%b8%8a%e8%a8%b4%2c715%2c20150114%2c1',
                'supports', '臺灣高等法院高雄分院103年度上訴字第715號判決'
            ),
            jsonb_build_object(
                'tier', 'official',
                'name', '臺灣高等法院高雄分院',
                'url', 'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=180824',
                'supports', '使公務員登載不實罪判處有期徒刑4月'
            )
        ),
        'safetyFlags', '[]'::jsonb,
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    '司法院法學資料檢索系統',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,103%2c%e4%b8%8a%e8%a8%b4%2c715%2c20150114%2c1'
),
(
    'research:tnl-dark-guide-legal:780dddf448416241',
    'd3684cd2-1e7d-4de8-9995-009e40e814eb',
    '2010年高雄市議員選舉當選無效之訴，二審駁回上訴而定讞；此為民事當選效力判決，不等同刑事有罪。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(
            'tnl-dark-guide-2018-khh-5-24-涉案紀錄-1',
            'tnl-dark-guide-2022-khh-5-7-涉案紀錄-1'
        ),
        'caseKind', 'election_validity',
        'caseStage', 'election_invalidated_final',
        'recordType', 'election_civil',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHV,101%2c%e9%81%b8%e4%b8%8a%2c9%2c20130320%2c2',
                'supports', '高雄高分院101年度選上字第9號當選無效判決'
            ),
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', 'Newtalk',
                'url', 'https://newtalk.tw/news/view/2012-08-13/28211',
                'supports', '第一審當選無效及案件脈絡'
            )
        ),
        'safetyFlags', jsonb_build_array('must_not_attribute_criminal_liability'),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    '司法院法學資料檢索系統',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHV,101%2c%e9%81%b8%e4%b8%8a%2c9%2c20130320%2c2'
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_current_2026_tnl_legal_claims) <> 4 THEN
        RAISE EXCEPTION 'Expected exactly 4 reviewed current-2026 legal claims';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_current_2026_tnl_legal_claims staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_current_2026_tnl_legal_claims staged
        JOIN person_claims existing ON existing.claim_key = staged.claim_key
        WHERE existing.person_id <> staged.person_id
    ) THEN
        RAISE EXCEPTION 'A stable legal claim key is already assigned to another person';
    END IF;
END
$$;

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
    auto_reviewed_at,
    updated_at
)
SELECT
    staged.claim_key,
    staged.person_id,
    'legal_case',
    staged.claim_value,
    staged.claim_json,
    'A',
    100,
    'verified',
    'review_only',
    staged.source_name,
    staged.source_url,
    '2026-08-03T00:00:00+08:00'::timestamptz,
    FALSE,
    'tnl-dark-guide-legal-current-2026-v1',
    jsonb_build_array(
        jsonb_build_object(
            'version', 'tnl-dark-guide-legal-current-2026-v1',
            'reason', 'Reviewed against an official court source and retained as non-public legal data',
            'reviewedAt', NOW()
        )
    ),
    NOW(),
    NOW()
FROM _reviewed_current_2026_tnl_legal_claims staged
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
    auto_reviewed_at = COALESCE(person_claims.auto_reviewed_at, EXCLUDED.auto_reviewed_at),
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
        FROM person_claims claim
        JOIN _reviewed_current_2026_tnl_legal_claims staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A'
          AND claim.review_score = 100
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 4 THEN
        RAISE EXCEPTION 'Reviewed legal claim guard failed';
    END IF;
END
$$;

COMMIT;
