BEGIN;

CREATE TEMP TABLE _reviewed_current_2026_tnl_legal_claims_batch_2 (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    claim_value TEXT NOT NULL,
    claim_json JSONB NOT NULL,
    confidence_level TEXT NOT NULL,
    review_score NUMERIC NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_current_2026_tnl_legal_claims_batch_2 (
    claim_key,
    person_id,
    claim_value,
    claim_json,
    confidence_level,
    review_score,
    source_name,
    source_url
)
VALUES
(
    'research:tnl-dark-guide-legal:6611e03020520fd5',
    'fa5f9237-db06-4630-b553-c50132cd518a',
    '王孝維於2020年公開說明，稱其17歲時因強盜罪遭判處有期徒刑3年6月。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array('tnl-dark-guide-2022-tpe-2-6-涉案紀錄-1'),
        'caseKind', 'robbery',
        'caseStage', 'historical_self_reported_conviction',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', '自由時報',
                'url', 'https://news.ltn.com.tw/news/politics/breakingnews/3156534',
                'supports', '報導當事人公開說明17歲時因強盜罪遭判處有期徒刑3年6月'
            ),
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', '民視新聞',
                'url', 'https://tw.news.yahoo.com/%E9%81%AD%E7%88%86%E6%B6%89%E5%BC%B7%E7%9B%9C%E7%BD%AA%E9%BB%91%E6%AD%B7%E5%8F%B2-%E7%8E%8B%E5%AD%9D%E7%B6%AD-17%E6%AD%B2%E6%99%82%E8%AA%A4%E4%BA%A4%E6%90%8D%E5%8F%8B-053035421.html',
                'supports', '報導當事人自述早年強盜罪及3年6月刑期'
            )
        ),
        'safetyFlags', jsonb_build_array(
            'self_reported_history',
            'media_evidence_capped_at_b',
            'sentence_execution_duration_not_included'
        ),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    'B',
    85,
    '自由時報',
    'https://news.ltn.com.tw/news/politics/breakingnews/3156534'
),
(
    'research:tnl-dark-guide-legal:d0164479234678c9',
    '31334f6d-bb62-4e12-ac82-a1d7c0141dbb',
    '臺灣高等法院臺南分院108年度選上易字第228號判決認定農會選舉交付不正利益，判處應執行有期徒刑1年確定。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(
            'tnl-dark-guide-2022-tnn-5-3-涉案紀錄-2',
            'tnl-dark-guide-2018-tnn-5-34-涉案紀錄-1'
        ),
        'caseKind', 'election_bribery',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNHM,108%2c%e9%81%b8%e4%b8%8a%e6%98%93%2c228%2c20191007%2c1',
                'supports', '臺灣高等法院臺南分院108年度選上易字第228號判決'
            ),
            jsonb_build_object(
                'tier', 'official',
                'name', '臺灣高等檢察署',
                'url', 'https://www.tps.moj.gov.tw/media/329418/2023%E5%85%AC%E8%81%B7%E4%BA%BA%E5%93%A1%E9%81%B8%E8%88%89%E7%BD%B7%E5%85%8D%E6%B3%95%E5%81%B5%E6%9F%A5%E8%A6%81%E9%A0%98%E5%BD%99%E7%B7%A8_10%E5%A3%B9%E6%8B%BE-%E8%BE%B2%E6%9C%83%E9%81%B8%E8%88%89%E6%9F%A5%E8%B3%84%E9%A1%9E.pdf',
                'supports', '農會選舉查賄案例列載李偉智案與108年度選上易字第228號判決'
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
    'A',
    100,
    '司法院法學資料檢索系統',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNHM,108%2c%e9%81%b8%e4%b8%8a%e6%98%93%2c228%2c20191007%2c1'
),
(
    'research:tnl-dark-guide-legal:a87bdcf7d18cb877',
    '31334f6d-bb62-4e12-ac82-a1d7c0141dbb',
    '臺灣臺南地方法院104年度簡字第2753號判決認定違反建築法，判處有期徒刑4月；現有官方來源未另證明後續審級。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array('tnl-dark-guide-2022-tnn-5-3-涉案紀錄-1'),
        'caseKind', 'building_code',
        'caseStage', 'criminal_judgment_non_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNDM,104%2c%e7%b0%a1%2c2753%2c20160429%2c1',
                'supports', '臺灣臺南地方法院104年度簡字第2753號判決'
            )
        ),
        'safetyFlags', jsonb_build_array('stage_or_finality_must_be_stated'),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', true
        )
    ),
    'A',
    100,
    '司法院法學資料檢索系統',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNDM,104%2c%e7%b0%a1%2c2753%2c20160429%2c1'
),
(
    'research:tnl-dark-guide-legal:66cba536c6f07b9f',
    '10b42c94-fd40-44ca-aef8-2e065cab6c98',
    '臺灣高等法院高雄分院103年度上訴字第715號判決認定使公務員登載不實罪，判處有期徒刑1年10月確定，得易科罰金。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(
            'tnl-dark-guide-2022-khh-6-4-涉案紀錄-1',
            'tnl-dark-guide-2018-khh-6-100-涉案紀錄-1'
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
                'supports', '李喬如判處有期徒刑1年10月，得易科罰金'
            ),
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', '中廣新聞網',
                'url', 'https://tw.news.yahoo.com/%E9%AB%98%E5%B8%82%E8%AD%B0%E5%93%A1%E5%86%92%E9%A0%98%E5%8A%A9%E7%90%86%E8%B2%BB-%E4%BA%8C%E5%AF%A9%E5%AE%9A%E8%AE%9E-101914235.html',
                'supports', '二審定讞及李喬如1年10月刑期'
            )
        ),
        'safetyFlags', jsonb_build_array('source_duration_conflict_resolved_to_official_judgment'),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    'A',
    100,
    '司法院法學資料檢索系統',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,103%2c%e4%b8%8a%e8%a8%b4%2c715%2c20150114%2c1'
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_current_2026_tnl_legal_claims_batch_2) <> 4
       OR (SELECT COUNT(*) FROM _reviewed_current_2026_tnl_legal_claims_batch_2 WHERE confidence_level = 'A') <> 3
       OR (SELECT COUNT(*) FROM _reviewed_current_2026_tnl_legal_claims_batch_2 WHERE confidence_level = 'B') <> 1 THEN
        RAISE EXCEPTION 'Expected 4 claims split into 3 A and 1 B';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_current_2026_tnl_legal_claims_batch_2 staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_current_2026_tnl_legal_claims_batch_2 staged
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
    staged.confidence_level,
    staged.review_score,
    'verified',
    'review_only',
    staged.source_name,
    staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz,
    FALSE,
    'tnl-dark-guide-legal-current-2026-batch-2-v1',
    jsonb_build_array(
        jsonb_build_object(
            'version', 'tnl-dark-guide-legal-current-2026-batch-2-v1',
            'reason', CASE
                WHEN staged.confidence_level = 'A'
                    THEN 'Reviewed against an official court source and retained as non-public legal data'
                ELSE 'Reviewed against independent trusted media and retained as non-public legal data'
            END,
            'reviewedAt', NOW()
        )
    ),
    NOW(),
    NOW()
FROM _reviewed_current_2026_tnl_legal_claims_batch_2 staged
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
        JOIN _reviewed_current_2026_tnl_legal_claims_batch_2 staged
          ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = staged.confidence_level
          AND claim.review_score = staged.review_score
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 4 THEN
        RAISE EXCEPTION 'Reviewed legal claim batch-2 guard failed';
    END IF;
END
$$;

COMMIT;
