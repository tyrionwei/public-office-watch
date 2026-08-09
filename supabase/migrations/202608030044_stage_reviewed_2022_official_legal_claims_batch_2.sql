BEGIN;

CREATE TEMP TABLE _reviewed_2022_assistant_claims_batch_2 (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    claim_value TEXT NOT NULL,
    research_id TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_2022_assistant_claims_batch_2
    (claim_key, person_id, claim_value, research_id)
VALUES
    (
        'research:tnl-dark-guide-legal:326d5c7c0d71a890',
        'becd698c-5a88-412e-b7b6-a0447801502d',
        '臺灣高等法院高雄分院103年度上訴字第715號判決駁回上訴，使公務員登載不實罪有期徒刑1年2月確定，得易科罰金。',
        'tnl-dark-guide-2022-khh-5-9-涉案紀錄-1'
    ),
    (
        'research:tnl-dark-guide-legal:caeb71bc57686352',
        'a4173264-754d-49b6-92a3-c049647045ca',
        '臺灣高等法院高雄分院103年度上訴字第715號判決駁回上訴，使公務員登載不實罪有期徒刑3月確定，得易科罰金。',
        'tnl-dark-guide-2022-khh-10-17-涉案紀錄-1'
    );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_2022_assistant_claims_batch_2) <> 2 THEN
        RAISE EXCEPTION 'Expected exactly 2 reviewed legal claims in batch 2';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_2022_assistant_claims_batch_2 staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_2022_assistant_claims_batch_2 staged
        JOIN person_claims existing ON existing.claim_key = staged.claim_key
        WHERE existing.person_id <> staged.person_id
    ) THEN
        RAISE EXCEPTION 'A stable legal claim key is already assigned to another person';
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
    staged.claim_key,
    staged.person_id,
    'legal_case',
    staged.claim_value,
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(staged.research_id),
        'caseKind', 'document_falsification',
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(
            jsonb_build_object(
                'tier', 'official',
                'name', '司法院法學資料檢索系統',
                'url', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,103%2c%e4%b8%8a%e8%a8%b4%2c715%2c20150114%2c1',
                'supports', staged.claim_value
            ),
            jsonb_build_object(
                'tier', 'official',
                'name', '臺灣高等法院高雄分院',
                'url', 'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=180824',
                'supports', staged.claim_value
            ),
            jsonb_build_object(
                'tier', 'trusted_media',
                'name', '中廣新聞網',
                'url', 'https://tw.news.yahoo.com/%E9%AB%98%E5%B8%82%E8%AD%B0%E5%93%A1%E5%86%92%E9%A0%98%E5%8A%A9%E7%90%86%E8%B2%BB-%E4%BA%8C%E5%AF%A9%E5%AE%9A%E8%AE%9E-101914235.html',
                'supports', '高雄市議員助理費案二審定讞'
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
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,103%2c%e4%b8%8a%e8%a8%b4%2c715%2c20150114%2c1',
    '2026-08-09T00:00:00+08:00'::timestamptz,
    FALSE,
    'tnl-dark-guide-legal-2022-official-batch-2-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-2-v1',
        'reason', 'Reviewed against the official appellate judgment and court release; retained as non-public legal data',
        'reviewedAt', NOW()
    )),
    NOW(),
    NOW()
FROM _reviewed_2022_assistant_claims_batch_2 staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM person_claims claim
        JOIN _reviewed_2022_assistant_claims_batch_2 staged
          ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A'
          AND claim.review_score = 100
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 2 THEN
        RAISE EXCEPTION 'Reviewed 2022 official legal claim batch 2 guard failed';
    END IF;
END
$$;

COMMIT;
