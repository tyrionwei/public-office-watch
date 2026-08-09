BEGIN;

CREATE TEMP TABLE _reviewed_2022_kaohsiung_assistant_claims (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    claim_value TEXT NOT NULL,
    research_ids JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_2022_kaohsiung_assistant_claims (
    claim_key,
    person_id,
    claim_value,
    research_ids
)
VALUES
(
    'research:tnl-dark-guide-legal:1aa0feae7a171c62',
    '383c916b-6a03-499d-a656-da0a27fea389',
    '臺灣高等法院高雄分院103年度上訴字第715號判決駁回上訴，使公務員登載不實罪有期徒刑1年確定，得易科罰金。',
    jsonb_build_array(
        'tnl-dark-guide-2018-khh-6-47-涉案紀錄-1',
        'tnl-dark-guide-2022-khh-6-2-涉案紀錄-1'
    )
),
(
    'research:tnl-dark-guide-legal:025463bb27f07de1',
    '67474dfb-9151-4a09-969f-82b1158671a0',
    '臺灣高等法院高雄分院103年度上訴字第715號判決駁回上訴，使公務員登載不實罪有期徒刑1年4月確定，得易科罰金。',
    jsonb_build_array(
        'tnl-dark-guide-2018-khh-7-61-涉案紀錄-1',
        'tnl-dark-guide-2022-khh-7-10-涉案紀錄-1'
    )
),
(
    'research:tnl-dark-guide-legal:c9b57d75d1cd3b36',
    '5dffdbb8-9047-49d7-988f-b43e4bb38f6c',
    '臺灣高等法院高雄分院103年度上訴字第715號判決駁回上訴，使公務員登載不實罪有期徒刑10月確定，得易科罰金。',
    jsonb_build_array(
        'tnl-dark-guide-2018-khh-7-48-涉案紀錄-1',
        'tnl-dark-guide-2022-khh-7-12-涉案紀錄-1'
    )
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_2022_kaohsiung_assistant_claims) <> 3 THEN
        RAISE EXCEPTION 'Expected exactly 3 reviewed Kaohsiung assistant-fee claims';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_2022_kaohsiung_assistant_claims staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_2022_kaohsiung_assistant_claims staged
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
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', staged.research_ids,
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
    'tnl-dark-guide-legal-2022-official-batch-1-v1',
    jsonb_build_array(
        jsonb_build_object(
            'version', 'tnl-dark-guide-legal-2022-official-batch-1-v1',
            'reason', 'Reviewed against the official appellate judgment and court release; retained as non-public legal data',
            'reviewedAt', NOW()
        )
    ),
    NOW(),
    NOW()
FROM _reviewed_2022_kaohsiung_assistant_claims staged
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
        JOIN _reviewed_2022_kaohsiung_assistant_claims staged
          ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A'
          AND claim.review_score = 100
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 3 THEN
        RAISE EXCEPTION 'Reviewed 2022 official legal claim guard failed';
    END IF;
END
$$;

COMMIT;
