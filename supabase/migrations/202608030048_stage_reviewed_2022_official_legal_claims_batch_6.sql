BEGIN;

CREATE TEMP TABLE _reviewed_2022_official_legal_claims_batch_6 (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL,
    claim_value TEXT NOT NULL,
    case_kind TEXT NOT NULL,
    case_stage TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_support TEXT NOT NULL,
    extra_evidence JSONB NOT NULL,
    requires_current_outcome_review BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_2022_official_legal_claims_batch_6 VALUES
(
    'research:tnl-dark-guide-legal:5d87a92ac7cb8d59', 'cf42a5f9-452b-4de1-9f04-b4ff641dec32',
    'tnl-dark-guide-2022-tao-12-2-涉案紀錄-1',
    '臺灣桃園地方法院110年度壢交簡字第519號判決認定江承洲酒後駕車，呼氣酒精濃度每公升1.25毫克，處有期徒刑4月。',
    'driving_under_influence', 'criminal_judgment',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM,110%2c%e5%a3%a2%e4%ba%a4%e7%b0%a1%2c519%2c20210320%2c1',
    '110年度壢交簡字第519號判決所載酒測值、罪名及刑度', '[]', TRUE
),
(
    'research:tnl-dark-guide-legal:f565ca303890b3fe', '07efa76d-ef3c-4831-a95d-2d825912b677',
    'tnl-dark-guide-2022-tao-14-6-涉案紀錄-1',
    '臺灣桃園地方法院110年度審原簡字第18號判決認定湯宏鈞違反公司法未繳納股款規定，處有期徒刑3月，緩刑2年。',
    'unpaid_share_capital', 'criminal_judgment',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM,110%2c%e5%af%a9%e5%8e%9f%e7%b0%a1%2c18%2c20210616%2c1',
    '110年度審原簡字第18號判決所載罪名、刑度及緩刑', '[]', TRUE
),
(
    'research:tnl-dark-guide-legal:998cfbf336d8ab80', 'ae357da3-80a4-47d8-8699-9d2bf19e2f3e',
    'tnl-dark-guide-2022-tao-1-5-涉案紀錄-1',
    '臺灣桃園地方法院108年度易字第952號一審判決認定黃婉如犯妨害公務罪，處有期徒刑4月，得易科罰金。',
    'obstruction_of_official_duty', 'criminal_judgment_first_instance',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c108%2c%e6%98%93%2c952%2c20191120%2c1&ot=in',
    '108年度易字第952號一審判決所載罪名及刑度',
    '[{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/201911200157.aspx","supports":"桃園地院一審判處有期徒刑4月、得易科罰金，報導當時仍可上訴"}]', TRUE
),
(
    'research:tnl-dark-guide-legal:25dd723303bb229f', '00ebf4ed-4aad-4e47-b164-a03871bc07fd',
    'tnl-dark-guide-2022-tao-1-9-涉案紀錄-2',
    '臺灣高等法院二審駁回上訴，詹江村因指稱陳柏惟「賺紅錢」等言論而犯誹謗罪，處拘役80日，得易科罰金，判決確定。',
    'defamation', 'criminal_judgment_final',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c109%2c%e6%98%93%2c745%2c20210219%2c1',
    '109年度易字第745號一審判決所載誹謗罪事實及刑度',
    '[{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/202110270036.aspx","supports":"二審駁回上訴，拘役80日、得易科罰金確定"}]', FALSE
),
(
    'research:tnl-dark-guide-legal:caa3b48629229f3f', '8daefa98-a18a-4a5b-8ec7-05a0acf67576',
    'tnl-dark-guide-2022-khh-6-1-涉案紀錄-1',
    '臺灣高等法院高雄分院109年度上易字第257號判決認定蔡金晏散布高雄市世足轉播活動供應熱狗給穆斯林移工的不實言論，犯誹謗罪，處拘役25日確定。',
    'defamation', 'criminal_judgment_final',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,109%2c%e4%b8%8a%e6%98%93%2c257%2c20200818%2c2',
    '109年度上易字第257號終審判決所載誹謗事實及刑度', '[]', FALSE
),
(
    'research:tnl-dark-guide-legal:765cce8984849451', 'a4173264-754d-49b6-92a3-c049647045ca',
    'tnl-dark-guide-2022-khh-10-17-涉案紀錄-3',
    '臺灣高雄地方法院109年度易字第373號判決認定蔡媽福在友人車禍現場拉扯執勤員警，犯妨害公務罪，處拘役30日。',
    'obstruction_of_official_duty', 'criminal_judgment',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM%2c109%2c%e6%98%93%2c373%2c20210208%2c1&ot=in',
    '109年度易字第373號判決所載妨害公務事實及刑度', '[]', TRUE
),
(
    'research:tnl-dark-guide-legal:494207151f183a01', 'a4173264-754d-49b6-92a3-c049647045ca',
    'tnl-dark-guide-2022-khh-10-17-涉案紀錄-2',
    '臺灣高雄地方法院108年度交簡字第23號判決認定蔡媽福酒後駕車，呼氣酒精濃度每公升0.33毫克，處有期徒刑3月。',
    'driving_under_influence', 'criminal_judgment',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM,108%2c%e4%ba%a4%e7%b0%a1%2c23%2c20190131%2c1',
    '108年度交簡字第23號判決所載酒測值、罪名及刑度', '[]', TRUE
),
(
    'research:tnl-dark-guide-legal:818e93fc3a2773d3', 'eb5a9bc2-5db3-4063-a104-432c27253e41',
    'tnl-dark-guide-2022-khh-11-10-涉案紀錄-1',
    '臺灣高雄地方法院108年度簡字第1211號判決認定韓賜村侵占面額新臺幣1,000萬元支票，處有期徒刑2年，緩刑5年。',
    'embezzlement', 'criminal_judgment',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM,108,%E7%B0%A1,1211,20190423,1',
    '108年度簡字第1211號判決所載侵占事實、刑度及緩刑',
    '[{"tier":"official","name":"臺灣高雄地方法院","url":"https://www.judicial.gov.tw/tw/cp-1888-337635-71e20-1.html","supports":"後續法院新聞稿確認先前侵占案有期徒刑2年、緩刑5年，且當時仍在緩刑期間"}]', FALSE
),
(
    'research:tnl-dark-guide-legal:0701c43e351dbd8b', 'eb5a9bc2-5db3-4063-a104-432c27253e41',
    'tnl-dark-guide-2022-khh-11-10-涉案紀錄-2',
    '臺灣高雄地方法院109年度審交訴字第196號判決認定韓賜村闖紅燈撞擊被害人致死，犯過失致人於死罪，處有期徒刑6月，得易科罰金。',
    'negligent_homicide', 'criminal_judgment_first_instance',
    'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM,109,%E5%AF%A9%E4%BA%A4%E8%A8%B4,196,20201210,1',
    '109年度審交訴字第196號判決所載事故、罪名及刑度',
    '[{"tier":"official","name":"臺灣高雄地方法院","url":"https://www.judicial.gov.tw/tw/cp-1888-337635-71e20-1.html","supports":"法院新聞稿確認闖紅燈致死事實及有期徒刑6月、得易科罰金"}]', TRUE
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_2022_official_legal_claims_batch_6) <> 9 THEN
        RAISE EXCEPTION 'Expected exactly 9 reviewed 2022 official legal claims in batch 6';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_2022_official_legal_claims_batch_6 staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_2022_official_legal_claims_batch_6 staged
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
        )) || staged.extra_evidence,
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
    'tnl-dark-guide-legal-2022-official-batch-6-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-6-v1',
        'reason', 'Matched the Dark Guide lead to the exact official judgment; retained as non-public legal data and omitted unverified finality where necessary',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _reviewed_2022_official_legal_claims_batch_6 staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_2022_official_legal_claims_batch_6 staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A' AND claim.review_score = 100
          AND claim.review_status = 'verified' AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 9 THEN
        RAISE EXCEPTION 'Reviewed 2022 official legal claim batch 6 guard failed';
    END IF;
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_2022_official_legal_claims_batch_6 staged ON staged.claim_key = claim.claim_key
        WHERE staged.requires_current_outcome_review
          AND claim.claim_json->'publicationGate'->>'requiresCurrentOutcomeReview' = 'true'
          AND claim.claim_json->'safetyFlags' ? 'current_outcome_not_independently_verified'
    ) <> 6 THEN
        RAISE EXCEPTION 'Current-outcome review guard failed for batch 6';
    END IF;
END
$$;

COMMIT;
