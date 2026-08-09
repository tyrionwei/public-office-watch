BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0'
          AND is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Reviewed person 王世堅 is missing or private';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims
        WHERE claim_key = 'research:tnl-dark-guide-legal:5a65ef285c986021'
          AND person_id <> 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0'
    ) THEN
        RAISE EXCEPTION 'The stable 王世堅 legal claim key belongs to another person';
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
    'research:tnl-dark-guide-legal:5a65ef285c986021',
    'd888dcb7-abda-48fd-8cd0-b973e0cf43e0',
    'legal_case',
    '臺灣高等法院105年度上易字第2058號刑事判決認定王世堅犯加重誹謗罪，處拘役50日，得易科罰金，判決確定。',
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array('tnl-dark-guide-2022-tpe-4-6-涉案紀錄-6'),
        'caseKind', 'defamation',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c105%2c%e4%b8%8a%e6%98%93%2c2058%2c20161220%2c1&ot=in',
                'supports', '臺灣高等法院105年度上易字第2058號刑事判決及當事人身分'
            ),
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', '中央社',
                'url', 'https://www.cna.com.tw/news/asoc/201612200076.aspx',
                'supports', '加重誹謗案件、拘役50日、得易科罰金及判決確定'
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
    'A',
    100,
    'verified',
    'review_only',
    '司法院法學資料檢索系統',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c105%2c%e4%b8%8a%e6%98%93%2c2058%2c20161220%2c1&ot=in',
    '2026-08-09T00:00:00+08:00'::timestamptz,
    FALSE,
    'tnl-dark-guide-legal-2022-official-batch-4-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-4-v1',
        'reason', 'Reviewed against the High Court judgment and CNA finality report; retained as non-public legal data',
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
        WHERE claim_key = 'research:tnl-dark-guide-legal:5a65ef285c986021'
          AND person_id = 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0'
          AND claim_type = 'legal_case'
          AND confidence_level = 'A'
          AND review_score = 100
          AND review_status = 'verified'
          AND visibility = 'review_only'
          AND is_public = FALSE
          AND claim_json->>'legalCasePublicEligible' = 'false'
          AND claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 1 THEN
        RAISE EXCEPTION 'Reviewed 王世堅 legal claim guard failed';
    END IF;
END
$$;

COMMIT;
