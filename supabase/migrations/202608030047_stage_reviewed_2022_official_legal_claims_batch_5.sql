BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = '7eb8e4fd-ebfc-49e4-b6eb-20147f22571f'
          AND is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Reviewed canonical person 陳致中 is missing or private';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims
        WHERE claim_key = 'research:tnl-dark-guide-legal:9c9866721e20a3fe'
          AND person_id <> '7eb8e4fd-ebfc-49e4-b6eb-20147f22571f'
    ) THEN
        RAISE EXCEPTION 'The stable 陳致中 legal claim key belongs to another person';
    END IF;
END
$$;

INSERT INTO person_claims (
    claim_key, person_id, claim_type, claim_value, claim_json,
    confidence_level, review_score, review_status, visibility,
    source_name, source_url, observed_at, is_public, scoring_version,
    scoring_reasons, auto_reviewed_at, updated_at
)
VALUES (
    'research:tnl-dark-guide-legal:9c9866721e20a3fe',
    '7eb8e4fd-ebfc-49e4-b6eb-20147f22571f',
    'legal_case',
    '最高法院111年度台上字第4948號判決認定陳致中違反洗錢防制法，處有期徒刑1年、併科罰金150萬元確定；另有偽證罪有期徒刑3月確定，兩罪合併定應執行有期徒刑1年2月。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(
            'tnl-dark-guide-2022-khh-10-5-涉案紀錄-2',
            'tnl-dark-guide-2022-khh-10-5-涉案紀錄-1',
            'tnl-dark-guide-2018-khh-10-14-涉案紀錄-1'
        ),
        'caseKind', 'money_laundering',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '最高法院',
                'url', 'https://www.judicial.gov.tw/tw/cp-1888-853666-7389d-1.html',
                'supports', '最高法院111年度台上字第4948號駁回陳致中上訴；洗錢罪有期徒刑1年、併科罰金150萬元確定'
            ),
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM,98%2c%e7%9f%9a%e4%b8%8a%e8%a8%b4%2c11%2c20100203%2c1',
                'supports', '陳致中偽證罪有期徒刑3月案件'
            ),
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', '中央社',
                'url', 'https://www.cna.com.tw/news/asoc/202306140055.aspx',
                'supports', '洗錢與偽證兩罪合併定應執行有期徒刑1年2月'
            )
        ),
        'safetyFlags', jsonb_build_array('supersedes_outdated_non_final_summary'),
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    'A',
    100,
    'verified',
    'review_only',
    '最高法院',
    'https://www.judicial.gov.tw/tw/cp-1888-853666-7389d-1.html',
    '2026-08-09T00:00:00+08:00'::timestamptz,
    FALSE,
    'tnl-dark-guide-legal-2022-official-batch-5-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-5-v1',
        'reason', 'Replaced the outdated non-final guide summary with the Supreme Court final outcome and merged the related 2018 and 2022 research leads',
        'reviewedAt', NOW()
    )),
    NOW(),
    NOW()
)
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM person_claims
        WHERE claim_key = 'research:tnl-dark-guide-legal:9c9866721e20a3fe'
          AND person_id = '7eb8e4fd-ebfc-49e4-b6eb-20147f22571f'
          AND claim_type = 'legal_case'
          AND confidence_level = 'A'
          AND review_score = 100
          AND review_status = 'verified'
          AND visibility = 'review_only'
          AND is_public = FALSE
          AND claim_json->>'legalCasePublicEligible' = 'false'
          AND claim_json->'publicationGate'->>'status' = 'verified_not_published'
          AND claim_json->'safetyFlags' ? 'supersedes_outdated_non_final_summary'
    ) <> 1 THEN
        RAISE EXCEPTION 'Reviewed 陳致中 legal claim guard failed';
    END IF;
END
$$;

COMMIT;
