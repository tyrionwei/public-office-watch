BEGIN;

CREATE TEMP TABLE _user_reviewed_legal_sources (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_ids JSONB NOT NULL,
    claim_value TEXT NOT NULL,
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('A', 'B')),
    review_score INTEGER NOT NULL,
    case_kind TEXT NOT NULL,
    case_stage TEXT NOT NULL,
    record_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    evidence_sources JSONB NOT NULL,
    safety_flags JSONB NOT NULL,
    requires_current_outcome_review BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _user_reviewed_legal_sources VALUES
(
    'research:tnl-dark-guide-legal:2d7a642cec9887e2',
    'd92e3523-6672-4fee-a4bf-4ff6740ffb47',
    '["tnl-dark-guide-2018-tnn-5-36-涉案紀錄-1", "tnl-dark-guide-2022-tnn-5-2-涉案紀錄-1"]'::jsonb,
    '媒體資料記載李文俊因善化農會選舉賄選遭判刑7個月；目前未取得可直接核對案號的裁判書。',
    'B', 85, 'election_bribery', 'criminal_outcome_reported_by_media', 'criminal',
    '攻城之戰（轉引聯合影音）',
    'https://beammedia.github.io/vote/2018/vote2018_1120.html',
    '[
      {"tier":"trusted_media","name":"攻城之戰（轉引聯合影音）","url":"https://beammedia.github.io/vote/2018/vote2018_1120.html","supports":"李文俊涉及農會賄選並遭判刑7個月"},
      {"tier":"trusted_media","name":"聯合影音","url":"https://video.udn.com/news/262625","supports":"原始新聞連結；目前頁面無法直接讀取"}
    ]'::jsonb,
    '["stage_or_finality_must_be_stated", "no_exact_judgment_number", "media_evidence_capped_at_b"]'::jsonb,
    TRUE
),
(
    'research:tnl-dark-guide-legal:2998c006a850566a',
    'be7f3390-a29d-449f-9281-95fd5e2db1b7',
    '["tnl-dark-guide-2022-khh-8-7-涉案紀錄-1"]'::jsonb,
    '臺灣高雄地方法院100年度審交訴字第65號一審認定黃紹庭駕車肇事致人受傷後離開現場，判處有期徒刑6月，得易科罰金。',
    'A', 100, 'hit_and_run', 'criminal_judgment_first_instance', 'criminal',
    '司法院裁判書系統',
    'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM%2c100%2c%e5%af%a9%e4%ba%a4%e8%a8%b4%2c65%2c20110526%2c1&ot=in',
    '[
      {"tier":"official","name":"臺灣高雄地方法院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM%2c100%2c%e5%af%a9%e4%ba%a4%e8%a8%b4%2c65%2c20110526%2c1&ot=in","supports":"一審認定肇事致人受傷後離開現場，判處有期徒刑6月，得易科罰金"}
    ]'::jsonb,
    '["stage_or_finality_must_be_stated", "current_outcome_not_independently_verified"]'::jsonb,
    TRUE
),
(
    'manual:legal-case:cc83116cd3eebb7b',
    'be7f3390-a29d-449f-9281-95fd5e2db1b7',
    '[]'::jsonb,
    '黃紹庭助理費案一、二審均判處有期徒刑2年、褫奪公權3年、緩刑5年；最高法院於2026年6月24日駁回上訴，全案確定。',
    'B', 90, 'assistant_expense', 'criminal_judgment_final', 'criminal',
    '中央社',
    'https://www.cna.com.tw/news/asoc/202606240214.aspx',
    '[
      {"tier":"official","name":"臺灣高雄地方法院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM%2c113%2c%e8%a8%b4%2c582%2c20250630%2c9&ot=in","supports":"一審認定利用職務機會詐取財物等罪並宣告刑及緩刑"},
      {"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/202606240214.aspx","supports":"最高法院於2026年6月24日駁回上訴，全案確定"}
    ]'::jsonb,
    '["media_evidence_capped_at_b"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:b7953d1c3216ea29',
    '5dab48fe-b083-429c-b110-13484cf88134',
    '["tnl-dark-guide-2022-tao-2-6-涉案紀錄-1"]'::jsonb,
    '孫韻璇在助理費案一審遭判應執行有期徒刑8年；臺灣高等法院於2026年7月30日駁回檢辯上訴，截至該日尚未確認是否再提起第三審上訴。',
    'A', 100, 'assistant_expense', 'criminal_judgment_appellate_non_final', 'criminal',
    '司法院裁判書系統',
    'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c113%2c%e4%b8%8a%e8%a8%b4%2c5851%2c20260730%2c2&ot=in',
    '[
      {"tier":"official","name":"臺灣桃園地方法院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c111%2c%e8%a8%b4%2c1159%2c20240708%2c1&ot=in","supports":"一審認定孫韻璇涉助理費案並判應執行有期徒刑8年"},
      {"tier":"official","name":"臺灣高等法院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c113%2c%e4%b8%8a%e8%a8%b4%2c5851%2c20260730%2c2&ot=in","supports":"2026年7月30日裁定記載同日已駁回檢辯上訴，並續行限制出境、出海"}
    ]'::jsonb,
    '["stage_or_finality_must_be_stated", "current_outcome_not_independently_verified"]'::jsonb,
    TRUE
),
(
    'research:tnl-dark-guide-legal:7c9eaadc192169d3',
    'f7d97ddd-1dea-48d4-9d3a-1f770962a5f4',
    '["tnl-dark-guide-2018-nwt-2-51-涉案紀錄-1", "tnl-dark-guide-2022-nwt-3-1-涉案紀錄-1"]'::jsonb,
    '媒體舊聞與選舉資料整理記載，張志宏曾涉及槍砲案件並入獄，另有2006年向立法委員服務處開槍的紀錄；目前未取得可直接核對案號的裁判書。',
    'B', 85, 'weapons_offense', 'historical_criminal_record_reported_by_media', 'criminal',
    '自由時報',
    'https://news.ltn.com.tw/news/society/paper/121181',
    '[
      {"tier":"trusted_media","name":"自由時報","url":"https://news.ltn.com.tw/news/society/paper/121181","supports":"2006年立法委員服務處槍擊事件的歷史新聞"},
      {"tier":"trusted_media","name":"中國時報","url":"https://www.chinatimes.com/amp/realtimenews/20180829002103-260407","supports":"同名候選人為張喜財之子，曾犯多起刑事案件、入獄後出獄"}
    ]'::jsonb,
    '["historical_label_requires_context", "no_exact_judgment_number", "media_evidence_capped_at_b"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:1ec8ab6be6081e77',
    '6b6e13f3-3c56-4bf5-831f-a035dcdbc4c2',
    '["tnl-dark-guide-2022-nwt-9-3-涉案紀錄-1"]'::jsonb,
    '臺灣桃園地方法院104年度訴字第671號判決認定張凱鈞行使偽造私文書，判處有期徒刑5月，得易科罰金；其後撤回上訴，判決確定。',
    'A', 100, 'document_falsification', 'criminal_judgment_final', 'criminal',
    '司法院裁判書系統',
    'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c104%2c%e8%a8%b4%2c671%2c20200429%2c1&ot=in',
    '[
      {"tier":"official","name":"臺灣桃園地方法院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c104%2c%e8%a8%b4%2c671%2c20200429%2c1&ot=in","supports":"行使偽造私文書罪判處有期徒刑5月；歷審清單記載臺灣高等法院109年度上訴字第2558號撤回上訴"}
    ]'::jsonb,
    '[]'::jsonb,
    FALSE
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _user_reviewed_legal_sources) <> 6 THEN
        RAISE EXCEPTION 'Expected exactly 6 user-reviewed legal claims';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _user_reviewed_legal_sources staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A user-reviewed legal source targets a missing or private person';
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
        'sourceId', 'user-reviewed-independent-legal-research',
        'researchIds', staged.research_ids,
        'caseKind', staged.case_kind,
        'caseStage', staged.case_stage,
        'recordType', staged.record_type,
        'evidenceSources', staged.evidence_sources,
        'safetyFlags', staged.safety_flags,
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', staged.requires_current_outcome_review
        )
    ),
    staged.confidence_level, staged.review_score,
    'verified', 'review_only', staged.source_name, staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'user-reviewed-legal-sources-2026-08-09-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'user-reviewed-legal-sources-2026-08-09-v1',
        'reason', 'Reviewed the supplied judgment or news source against the named person and recorded only the supported procedural stage; retained as non-public legal data pending human publication approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _user_reviewed_legal_sources staged
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
    updated_at = EXCLUDED.updated_at;

UPDATE person_claims
SET claim_json = jsonb_set(
        claim_json,
        '{evidenceSources}',
        COALESCE(claim_json->'evidenceSources', '[]'::jsonb)
            || jsonb_build_array(jsonb_build_object(
                'tier', 'official',
                'name', '臺灣桃園地方法院',
                'url', 'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c106%2c%e8%a8%b4%2c518%2c20191209%2c1&ot=in',
                'supports', '張肇良助理費案一審認定使公務員登載不實等犯行，應執行有期徒刑2年10月'
            )),
        TRUE
    ),
    updated_at = NOW()
WHERE claim_key = 'research:tnl-dark-guide-legal:db114cb21845b476'
  AND person_id = '01bcc037-dc12-49b3-b9b2-5e04033ad2be'
  AND NOT COALESCE(claim_json->'evidenceSources', '[]'::jsonb)
      @> jsonb_build_array(jsonb_build_object(
          'url', 'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c106%2c%e8%a8%b4%2c518%2c20191209%2c1&ot=in'
      ));

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM person_claims claim
        JOIN _user_reviewed_legal_sources staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = staged.confidence_level
          AND claim.review_score = staged.review_score
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
    ) <> 6 THEN
        RAISE EXCEPTION 'User-reviewed legal source guard failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM person_claims claim
        WHERE claim.claim_key = 'research:tnl-dark-guide-legal:db114cb21845b476'
          AND claim.claim_json->'evidenceSources' @> jsonb_build_array(jsonb_build_object(
              'url', 'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c106%2c%e8%a8%b4%2c518%2c20191209%2c1&ot=in'
          ))
    ) THEN
        RAISE EXCEPTION 'Zhang Zhaoliang first-instance supporting judgment was not linked';
    END IF;
END
$$;

COMMIT;
