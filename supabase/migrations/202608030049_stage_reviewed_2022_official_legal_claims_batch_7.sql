BEGIN;

CREATE TEMP TABLE _reviewed_2022_official_legal_claims_batch_7 (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL,
    claim_value TEXT NOT NULL,
    case_kind TEXT NOT NULL,
    case_stage TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_support TEXT NOT NULL,
    requires_current_outcome_review BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_2022_official_legal_claims_batch_7 VALUES
(
    'research:tnl-dark-guide-legal:f7a333d1c024aff0', '4cb6ee34-2d7d-42ae-b579-ec59ec95fc43',
    'tnl-dark-guide-2022-tnn-3-6-涉案紀錄-1',
    '臺灣高等法院臺南分院110年度上更一字第20號判決認定吳通龍因助理費案件犯使公務員登載不實罪，處有期徒刑4月。',
    'document_falsification', 'criminal_judgment',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNHM,110%2c%e4%b8%8a%e6%9b%b4%e4%b8%80%2c20%2c20211230%2c1',
    '110年度上更一字第20號判決所載罪名及刑度', TRUE
),
(
    'research:tnl-dark-guide-legal:f52ffaf03bf6808c', 'd84635b6-18e4-498b-9641-716bbb82eb97',
    'tnl-dark-guide-2022-nwt-5-11-涉案紀錄-1',
    '臺灣新北地方法院106年度簡字第8425號判決認定李婉鈺於餐廳對他人比中指並以「肖查某」辱罵，犯公然侮辱罪，處拘役10日。',
    'public_insult', 'criminal_judgment',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=PCDM%2c106%2c%e7%b0%a1%2c8425%2c20180104%2c1&ot=in',
    '106年度簡字第8425號判決所載公然侮辱事實及刑度', TRUE
),
(
    'research:tnl-dark-guide-legal:e3ae3a8e489fc341', 'd84635b6-18e4-498b-9641-716bbb82eb97',
    'tnl-dark-guide-2022-nwt-5-11-涉案紀錄-2',
    '臺灣高等法院108年度上易字第1880號判決認定李婉鈺拉扯員警密錄器、掌摑並辱罵員警，犯妨害公務等罪，處有期徒刑4月確定。',
    'obstruction_of_official_duty', 'criminal_judgment_final',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c108%2c%e4%b8%8a%e6%98%93%2c1880%2c20200507%2c1&ot=in',
    '108年度上易字第1880號終審判決所載妨害公務等事實及刑度', FALSE
),
(
    'research:tnl-dark-guide-legal:35718c6c90b66447', 'd84635b6-18e4-498b-9641-716bbb82eb97',
    'tnl-dark-guide-2022-nwt-5-11-涉案紀錄-3',
    '臺灣高等法院108年度上易字第1880號判決認定李婉鈺深夜至張碩文住處持續按門鈴，犯強制未遂罪，處拘役20日確定。',
    'attempted_coercion', 'criminal_judgment_final',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c108%2c%e4%b8%8a%e6%98%93%2c1880%2c20200507%2c1&ot=in',
    '108年度上易字第1880號終審判決所載強制未遂事實及刑度', FALSE
),
(
    'research:tnl-dark-guide-legal:f542fd707ae91872', '43d3589c-8d75-409a-8cc1-f518846b5a1f',
    'tnl-dark-guide-2022-khh-5-8-涉案紀錄-3',
    '臺灣高等法院高雄分院105年度上易字第270號判決認定陳清茂於協調糾紛時以言詞恫嚇要求賠償1,000萬元，犯恐嚇取財罪，處有期徒刑7月確定。',
    'extortion', 'criminal_judgment_final',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,105%2c%e4%b8%8a%e6%98%93%2c270%2c20170525%2c1',
    '105年度上易字第270號終審判決所載恐嚇取財事實及刑度', FALSE
),
(
    'research:tnl-dark-guide-legal:e72150d8cc094d74', '43d3589c-8d75-409a-8cc1-f518846b5a1f',
    'tnl-dark-guide-2022-khh-5-8-涉案紀錄-2',
    '最高法院96年度台上字第2492號判決駁回上訴，陳清茂因意圖販賣而持有第三級毒品，處有期徒刑4年確定。',
    'drug_offense', 'criminal_judgment_final',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPSM%2c96%2c%e5%8f%b0%e4%b8%8a%2c2492%2c20070504&ot=in',
    '96年度台上字第2492號最高法院判決所載罪名、刑度及上訴結果', FALSE
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_2022_official_legal_claims_batch_7) <> 6 THEN
        RAISE EXCEPTION 'Expected exactly 6 reviewed 2022 official legal claims in batch 7';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_2022_official_legal_claims_batch_7 staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_2022_official_legal_claims_batch_7 staged
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
    staged.claim_key, staged.person_id, 'legal_case', staged.claim_value,
    jsonb_build_object(
        'sourceId', 'tnl-dark-guide-independent-legal-research',
        'researchIds', jsonb_build_array(staged.research_id),
        'caseKind', staged.case_kind,
        'caseStage', staged.case_stage,
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(jsonb_build_object(
            'tier', 'official', 'name', '司法院法學資料檢索系統',
            'url', staged.source_url, 'supports', staged.source_support
        )),
        'safetyFlags', CASE WHEN staged.requires_current_outcome_review
            THEN jsonb_build_array('current_outcome_not_independently_verified')
            ELSE '[]'::jsonb END,
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', staged.requires_current_outcome_review
        )
    ),
    'A', 100, 'verified', 'review_only',
    '司法院法學資料檢索系統', staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'tnl-dark-guide-legal-2022-official-batch-7-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-7-v1',
        'reason', 'Matched the Dark Guide lead to an exact official judgment; retained as non-public legal data and omitted unverified finality where necessary',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _reviewed_2022_official_legal_claims_batch_7 staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_2022_official_legal_claims_batch_7 staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A' AND claim.review_score = 100
          AND claim.review_status = 'verified' AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 6 THEN
        RAISE EXCEPTION 'Reviewed 2022 official legal claim batch 7 guard failed';
    END IF;
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_2022_official_legal_claims_batch_7 staged ON staged.claim_key = claim.claim_key
        WHERE staged.requires_current_outcome_review
          AND claim.claim_json->'publicationGate'->>'requiresCurrentOutcomeReview' = 'true'
          AND claim.claim_json->'safetyFlags' ? 'current_outcome_not_independently_verified'
    ) <> 2 THEN
        RAISE EXCEPTION 'Current-outcome review guard failed for batch 7';
    END IF;
END
$$;

COMMIT;
