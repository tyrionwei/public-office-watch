BEGIN;

CREATE TEMP TABLE _updated_2022_legal_outcomes (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    claim_value TEXT NOT NULL,
    case_kind TEXT NOT NULL,
    case_stage TEXT NOT NULL,
    record_type TEXT NOT NULL,
    source_tier TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    requires_current_outcome_review BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _updated_2022_legal_outcomes VALUES
('research:tnl-dark-guide-legal:debc57c0b4771afe', '9ed74967-0e4a-42c9-bb38-2f3fe6dc9ca2', 'tnl-dark-guide-2022-nwt-5-5-涉案紀錄-1', '王淑慧因詐領助理補助款逾300萬元，高等法院改判有期徒刑5年、褫奪公權3年，最高法院於2024年駁回上訴定讞。', 'assistant_expense', 'criminal_judgment_final', 'criminal', 'trusted_media', '中央社（華視轉載）', 'https://news.cts.com.tw/cna/society/202403/202403252302535.html', FALSE),
('research:tnl-dark-guide-legal:33acb95bbc3a7218', 'd70850ab-38f7-43ae-aa38-cd17bf307ce0', 'tnl-dark-guide-2022-txg-14-5-涉案紀錄-1', '冉齡軒因詐領助理費148萬餘元，一、二審均判處有期徒刑4年、褫奪公權3年；截至2025年4月仍可上訴。', 'assistant_expense', 'criminal_judgment_non_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202504220070.aspx', TRUE),
('research:tnl-dark-guide-legal:4ee558cc98c33d0e', '73e9695b-143b-4c63-8818-f86af5ac34c2', 'tnl-dark-guide-2022-tpe-1-3-涉案紀錄-1', '李光輝因光輝生醫未上市股票案一審判處有期徒刑10年；其於上訴期間死亡，高等法院於2026年就其部分諭知公訴不受理。', 'securities_fraud', 'prosecution_terminated_due_death', 'criminal', 'trusted_media', '聯合新聞網', 'https://udn.com/news/story/124490/9443503', FALSE),
('research:tnl-dark-guide-legal:2c9be2c533dd6bb4', '04106fcd-9869-4a75-af3d-28a9061eb620', 'tnl-dark-guide-2022-nwt-5-8-涉案紀錄-1', '臺北地方法院於2022年就遠雄弊案一審認定周勝考犯公司法未繳納股款罪，處有期徒刑6月；另涉貪污等罪判處有期徒刑10年，案件仍待後續審級確認。', 'corruption', 'criminal_judgment_non_final', 'criminal', 'official', '司法院', 'https://www.judicial.gov.tw/tw/dl-168164-568660bef9b64b2cb57338976a512c44.html', TRUE),
('research:tnl-dark-guide-legal:359d1a039bfc761b', '447055bb-7efc-483a-95f5-a226eaae81c6', 'tnl-dark-guide-2022-nwt-11-2-涉案紀錄-1', '周雅玲助理費案經法院認定不構成貪污詐取財物，改依使公務員登載不實罪判處有期徒刑8月；仍需確認後續審級結果。', 'assistant_expense', 'criminal_judgment_non_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202310120341.aspx', TRUE),
('research:tnl-dark-guide-legal:78768e7fe968c87f', 'a131cf7d-947a-4e92-9151-202739a00271', 'tnl-dark-guide-2022-tpe-6-21-涉案紀錄-1', '臺北地方法院於2024年一審認定林穎孟犯利用職務機會詐取財物罪及圖利罪，分別判處有期徒刑3年8月及5年8月；案件仍在上訴審。', 'assistant_expense', 'criminal_judgment_non_final', 'criminal', 'official', '司法院', 'https://www.judicial.gov.tw/tw/cp-1888-1209285-115a5-1.html', TRUE),
('research:tnl-dark-guide-legal:8e8df1a6fc2cf99c', '2c6fbb05-3ad2-4dd2-a8ce-b6da983dabe2', 'tnl-dark-guide-2022-tpe-1-25-涉案紀錄-1', '陳政忠宏福案經最高法院於2024年駁回上訴，操縱股價罪判處有期徒刑4年、虛偽記載公開說明書罪判處有期徒刑2年定讞。', 'securities_law', 'criminal_judgment_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202407170256.aspx', FALSE),
('research:tnl-dark-guide-legal:befcaefb22ff4bc9', '3fbbe6f2-93b9-4169-86f6-3a674ceaabc6', 'tnl-dark-guide-2022-nwt-3-13-涉案紀錄-1', '陳科名收受建商賄賂及不正利益1307萬餘元案，最高法院於2025年駁回上訴，應執行有期徒刑10年8月定讞。', 'corruption', 'criminal_judgment_final', 'criminal', 'trusted_media', '聯合新聞網', 'https://udn.com/news/story/7321/9231829', FALSE),
('research:tnl-dark-guide-legal:889075e9fba89455', '3fbbe6f2-93b9-4169-86f6-3a674ceaabc6', 'tnl-dark-guide-2022-nwt-3-13-涉案紀錄-2', '陳科名收受20萬元賄款並向拆除大隊施壓案，最高法院於2024年判處有期徒刑7年6月、褫奪公權3年定讞。', 'corruption', 'criminal_judgment_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202403250075.aspx', FALSE),
('research:tnl-dark-guide-legal:334a4f3e5e34148b', 'fe9169ae-7876-4554-a7f9-ae336118bd88', 'tnl-dark-guide-2022-nwt-5-3-涉案紀錄-1', '曾煥嘉因以人頭詐領助理費128萬餘元，新北地方法院於2025年一審判處有期徒刑3年、褫奪公權4年；仍需確認後續審級結果。', 'assistant_expense', 'criminal_judgment_non_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202501220406.aspx', TRUE),
('research:tnl-dark-guide-legal:45b5251e1925292e', '6d379d3b-3524-4798-85b6-bbd094d1ade8', 'tnl-dark-guide-2022-khh-10-7-涉案紀錄-1', '曾麗燕助理費案一、二審均判處應執行有期徒刑12年、褫奪公權6年；截至2026年仍由最高法院審理中。', 'assistant_expense', 'criminal_judgment_non_final', 'criminal', 'trusted_media', '聯合新聞網', 'https://udn.com/news/story/7321/9494873', TRUE),
('research:tnl-dark-guide-legal:2dfdc13c29930d0a', 'e3ae3061-f70b-4524-8382-16867379c3dc', 'tnl-dark-guide-2022-tao-8-8-涉案紀錄-1', '舒翠玲因不實申請助理費，桃園地方法院於2025年一審依使公務員登載不實罪判處有期徒刑1年、緩刑3年；仍需確認後續審級結果。', 'assistant_expense', 'criminal_judgment_non_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202508210271.aspx', TRUE),
('research:tnl-dark-guide-legal:40edbf3b1da71aef', '6113380a-8991-4551-b321-f64317e7125f', 'tnl-dark-guide-2022-nwt-8-3-涉案紀錄-1', '黃永昌助理費案一、二審均認定不構成貪污及洗錢，依使公務員登載不實罪判處有期徒刑1年、緩刑3年；二審結果仍可上訴。', 'assistant_expense', 'criminal_judgment_non_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202502270136.aspx', TRUE),
('research:tnl-dark-guide-legal:9384b6b92c6b6843', 'd327a74d-5d73-46b7-afe9-4c7c177aa08f', 'tnl-dark-guide-2022-khh-14-2-涉案紀錄-1', '臺灣高等法院高雄分院於2023年二審認定賴文德收受廠商賄款10萬元，判處有期徒刑7年8月、褫奪公權5年；仍需確認後續審級結果。', 'corruption', 'criminal_judgment_non_final', 'criminal', 'official', '司法院', 'https://www.judicial.gov.tw/tw/cp-1888-861077-2d8ea-1.html', TRUE),
('research:tnl-dark-guide-legal:3948d0651e5a6d5a', '5ed7078d-1833-4959-98ee-f9a7ceb77d1e', 'tnl-dark-guide-2022-tpe-5-12-涉案紀錄-1', '應曉薇因2014年參選期間收受不符政治獻金法的捐贈，監察院裁罰新臺幣20萬元。', 'political_finance', 'administrative_sanction', 'administrative', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/201801240341.aspx', FALSE);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _updated_2022_legal_outcomes) <> 15 THEN
        RAISE EXCEPTION 'Expected exactly 15 updated 2022 legal outcomes';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _updated_2022_legal_outcomes staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'An updated legal outcome targets a missing or private person';
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
        'recordType', staged.record_type,
        'evidenceSources', jsonb_build_array(jsonb_build_object(
            'tier', staged.source_tier, 'name', staged.source_name,
            'url', staged.source_url, 'supports', staged.claim_value
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
    CASE WHEN staged.source_tier = 'official' THEN 'A' ELSE 'B' END,
    CASE WHEN staged.source_tier = 'official' THEN 100 ELSE 90 END,
    'verified', 'review_only', staged.source_name, staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'tnl-dark-guide-legal-2022-updated-outcomes-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-updated-outcomes-v1',
        'reason', 'Updated a 2022 Dark Guide research lead with a later official or established-media outcome; retained as non-public legal data pending human publication approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _updated_2022_legal_outcomes staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _updated_2022_legal_outcomes staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.review_status = 'verified' AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
    ) <> 15 THEN
        RAISE EXCEPTION 'Updated 2022 legal outcome guard failed';
    END IF;
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _updated_2022_legal_outcomes staged ON staged.claim_key = claim.claim_key
        WHERE staged.requires_current_outcome_review
          AND claim.claim_json->'publicationGate'->>'requiresCurrentOutcomeReview' = 'true'
          AND claim.claim_json->'safetyFlags' ? 'current_outcome_not_independently_verified'
    ) <> 9 THEN
        RAISE EXCEPTION 'Current-outcome review guard failed for updated 2022 outcomes';
    END IF;
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _updated_2022_legal_outcomes staged ON staged.claim_key = claim.claim_key
        WHERE claim.confidence_level = CASE WHEN staged.source_tier = 'official' THEN 'A' ELSE 'B' END
    ) <> 15 THEN
        RAISE EXCEPTION 'Evidence-tier confidence guard failed for updated 2022 outcomes';
    END IF;
END
$$;

COMMIT;
