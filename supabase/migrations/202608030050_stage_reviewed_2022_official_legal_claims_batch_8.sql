BEGIN;

CREATE TEMP TABLE _reviewed_2022_official_legal_claims_batch_8 (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    claim_value TEXT NOT NULL,
    case_kind TEXT NOT NULL,
    source_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_2022_official_legal_claims_batch_8 VALUES
('research:tnl-dark-guide-legal:1fb307f962117f9a', 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0', 'tnl-dark-guide-2022-tpe-4-6-涉案紀錄-2', '王世堅所屬日成營造公司因聘僱許可失效之外國人違反就業服務法，王世堅判處有期徒刑5月確定。', 'employment_law', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=PCDM,88%2c%e6%98%93%2c3997%2c20001121'),
('research:tnl-dark-guide-legal:b945e5954cc64308', 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0', 'tnl-dark-guide-2022-tpe-4-6-涉案紀錄-4', '王世堅因機場抗議事件犯妨害公務及侮辱罪，判處有期徒刑6月確定。', 'obstruction_of_official_duty', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM,97%2c%e7%b0%a1%e4%b8%8a%2c384%2c20100528%2c1'),
('research:tnl-dark-guide-legal:bb288f03a5357d2f', 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0', 'tnl-dark-guide-2022-tpe-4-6-涉案紀錄-5', '王世堅在處理陳情期間辱罵員警，犯妨害公務罪，判處拘役50日確定。', 'obstruction_of_official_duty', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPDM,95%2c%e7%b0%a1%2c2178%2c20060731%2c1'),
('research:tnl-dark-guide-legal:e563dbaa74d0e395', 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0', 'tnl-dark-guide-2022-tpe-4-6-涉案紀錄-1', '王世堅因登載不實憑證逃漏稅，違反商業會計法等，判處有期徒刑6月、緩刑3年確定。', 'accounting_fraud', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPDM,88%2c%e8%a8%b4%2c500%2c20000822'),
('research:tnl-dark-guide-legal:eeea0ead346b5447', 'a63fdd15-dc3d-4f92-ab70-8f58d1a20b5e', 'tnl-dark-guide-2022-txg-17-2-涉案紀錄-1', '朱元宏擔任律師期間以可向法官行賄為由詐取財物，判處有期徒刑3年10月定讞。', 'fraud', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM,96%2c%e6%98%93%2c2675%2c20071129%2c1'),
('research:tnl-dark-guide-legal:e268937402f0f4a2', '1cef9cde-28ab-4c5f-8a97-ee0a128c56d8', 'tnl-dark-guide-2022-khh-8-6-涉案紀錄-1', '吳益政指示助理登載不實資料申領助理費，犯偽造文書罪，判處有期徒刑4月確定。', 'assistant_expense', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM,103%2c%e4%b8%8a%e8%a8%b4%2c715%2c20150114%2c1'),
('research:tnl-dark-guide-legal:a5eeabc45e865d8a', 'c377a734-1e11-462d-bb18-ce0dfbbc7774', 'tnl-dark-guide-2022-tao-1-21-涉案紀錄-1', '李曉鐘因桃園縣議長賄選案接受招待，判處有期徒刑1年、緩刑3年確定。', 'election_bribery', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c90%2c%e9%87%8d%e4%b8%8a%e6%9b%b4(%e4%b8%89)%2c239%2c20021001%2c1'),
('research:tnl-dark-guide-legal:a62c90e407316d22', '808ee7ca-05b5-44ae-a5c9-dd51ec7c1369', 'tnl-dark-guide-2022-nwt-5-17-涉案紀錄-1', '阮橋本徒手毆打前員工，犯傷害罪，判處拘役20日、緩刑2年確定。', 'assault', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPDM%2c107%2c%e7%b0%a1%e4%b8%8a%2c163%2c20181212%2c1&ot=in'),
('research:tnl-dark-guide-legal:4403e3493781a239', '597a69dd-47e1-44f0-a9c8-35b0072201bf', 'tnl-dark-guide-2022-txg-5-5-涉案紀錄-1', '林義偉因酒後駕車犯公共危險罪，判處有期徒刑4月確定。', 'drunk_driving', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM%2c111%2c%e4%b8%ad%e4%ba%a4%e7%b0%a1%2c1904%2c20220928%2c1&ot=in'),
('research:tnl-dark-guide-legal:b95ffab7de52fb90', 'c56135aa-d267-454b-8d8f-3fec1a219cca', 'tnl-dark-guide-2022-tnn-7-3-涉案紀錄-1', '林燕祝在臺南市議會潑灑廚餘並辱罵他人，犯公然侮辱罪，判處拘役40日確定。', 'public_insult', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNDM,101%2c%e7%b0%a1%e4%b8%8a%2c282%2c20130830%2c1'),
('research:tnl-dark-guide-legal:6141bd9c513df961', 'ea9d5f4a-8775-42a2-b8ee-1fed925cf9d8', 'tnl-dark-guide-2022-nwt-6-4-涉案紀錄-1', '金瑞龍協助公務員浮報工程差額，犯使公務員登載不實罪，判處有期徒刑6月確定。', 'document_falsification', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPSM%2c108%2c%e5%8f%b0%e4%b8%8a%2c568%2c20200325%2c1'),
('research:tnl-dark-guide-legal:7935442be5c79206', '53329eec-e1f6-458b-80ff-c5f80501722a', 'tnl-dark-guide-2022-tao-3-5-涉案紀錄-5', '段樹文犯意圖營利聚眾賭博罪，判處有期徒刑1年2月確定。', 'gambling', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c102%2c%e4%b8%8a%e8%a8%b4%2c3173%2c20141104%2c1'),
('research:tnl-dark-guide-legal:26c01e74f6b54dda', '505f6c1e-6e82-40e0-ac7e-952755bd0dc5', 'tnl-dark-guide-2022-txg-15-3-涉案紀錄-1', '洪志明任職臺中市原民會期間因關說案犯對主管事務圖利罪，判決免刑確定。', 'corruption', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCHM,102%2c%e4%b8%8a%e8%a8%b4%2c918%2c20140529%2c1'),
('research:tnl-dark-guide-legal:4fcb36bbcfce123b', '1277fb81-8a85-44a8-929a-4d5759e188aa', 'tnl-dark-guide-2022-txg-17-1-涉案紀錄-1', '孫造雄因酒後駕車犯公共危險罪，判處有期徒刑2月確定。', 'drunk_driving', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM,108%2c%e4%b8%ad%e5%8e%9f%e4%ba%a4%e7%b0%a1%2c29%2c20190227%2c1'),
('research:tnl-dark-guide-legal:f286514895db2209', '1277fb81-8a85-44a8-929a-4d5759e188aa', 'tnl-dark-guide-2022-txg-17-1-涉案紀錄-2', '孫造雄偽造活動估價單申請補助，犯偽造準私文書罪，判處有期徒刑3月確定。', 'document_falsification', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM,110%2c%e5%8e%9f%e7%b0%a1%2c31%2c20220107%2c1'),
('research:tnl-dark-guide-legal:db114cb21845b476', '01bcc037-dc12-49b3-b9b2-5e04033ad2be', 'tnl-dark-guide-2022-tao-10-5-涉案紀錄-3', '張肇良以人頭申領補助費，犯使公務員登載不實罪，判處有期徒刑2年10月確定。', 'assistant_expense', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c109%2c%e4%b8%8a%e8%a8%b4%2c889%2c20200805%2c1&ot=in'),
('research:tnl-dark-guide-legal:87d3fe35a209ed50', '01bcc037-dc12-49b3-b9b2-5e04033ad2be', 'tnl-dark-guide-2022-tao-10-5-涉案紀錄-2', '張肇良要求員工將支票掛失止付後追查侵占，犯誣告罪，判處有期徒刑3月確定。', 'false_accusation', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c102%2c%e5%af%a9%e6%98%93%2c678%2c20130531%2c1&ot=in'),
('research:tnl-dark-guide-legal:3cc4e7ed172d2e03', '0315a8ac-f8b2-46c8-9f36-b738ab0f10d6', 'tnl-dark-guide-2022-tnn-6-7-涉案紀錄-2', '郭清華在議長補選期間推擠致他人受傷，犯過失傷害罪，判處有期徒刑4月確定。', 'negligent_injury', 'https://law.judicial.gov.tw/FJUD/data.aspx?ro=2&q=567e5e1d2d698b545f01810d83c68f26&gy=jsys&gc=M&sort=DS&ot=in'),
('research:tnl-dark-guide-legal:8e08a9726249d7e7', '77845745-b9e3-4a11-b756-d8e494872ca5', 'tnl-dark-guide-2022-txg-3-6-涉案紀錄-1', '陳玄曄因酒後駕車犯公共危險罪，判處有期徒刑3月確定。', 'drunk_driving', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM,105%2c%e4%ba%a4%e7%b0%a1%2c5051%2c20170113%2c1'),
('research:tnl-dark-guide-legal:5aec1265ee452578', 'a2409dae-42ec-4a44-869c-f3f754becfa9', 'tnl-dark-guide-2022-khh-2-2-涉案紀錄-1', '陳明澤在服務處鐵皮屋經營賭場，犯圖利聚眾賭博罪，判處有期徒刑4月、緩刑2年確定。', 'gambling', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=CTDM,106,%E7%B0%A1,929,20170622,1'),
('research:tnl-dark-guide-legal:80e12c1dc692548d', 'af8d759a-1b06-408b-9db9-d0c2d0880ea7', 'tnl-dark-guide-2022-khh-10-14-涉案紀錄-1', '陳麗娜在議長選舉期間亮票，判處有期徒刑5月確定。', 'ballot_secrecy', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM,101%2c%e6%98%93%2c228%2c20121031%2c5'),
('research:tnl-dark-guide-legal:8c6933702f87336a', 'e6fecff0-169b-46ee-ae6e-888179d54342', 'tnl-dark-guide-2022-txg-15-4-涉案紀錄-1', '黃仁犯散播謠言意圖使人不當選罪，判處有期徒刑1年確定。', 'election_false_statement', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCHM%2c102%2c%e9%81%b8%e4%b8%8a%e6%9b%b4(%e4%b8%80)%2c19%2c20130606%2c1'),
('research:tnl-dark-guide-legal:cc9778d5635ce3d9', 'e6fecff0-169b-46ee-ae6e-888179d54342', 'tnl-dark-guide-2022-txg-15-4-涉案紀錄-3', '黃仁因妨害投票案件判處有期徒刑1年，減為有期徒刑6月確定。', 'voting_interference', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM%2c100%2c%e8%a8%b4%2c1527%2c20120531%2c1'),
('research:tnl-dark-guide-legal:916bc5d54c0dcccb', '730868b1-745f-48dc-b4bf-66405a27841b', 'tnl-dark-guide-2022-khh-11-8-涉案紀錄-1', '黃天煌任大寮鄉長期間率眾至工業區抗議，犯妨害公務等罪，判處有期徒刑1年6月、緩刑3年確定。', 'obstruction_of_official_duty', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSDM,99%2c%e5%af%a9%e7%b0%a1%2c3172%2c20100730%2c1'),
('research:tnl-dark-guide-legal:13291b3b787fdf3b', '58a6e4f8-a174-45dc-adc6-eb6873026a0e', 'tnl-dark-guide-2022-tao-3-2-涉案紀錄-1', '楊朝偉因對前妻施以暴力犯傷害罪，判處拘役20日確定。', 'domestic_violence', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM,98%2c%e5%af%a9%e6%98%93%2c1689%2c20100305%2c1'),
('research:tnl-dark-guide-legal:5a06d6bd4d878c63', '3c08a218-2917-453b-9f3b-6d74e12d93d7', 'tnl-dark-guide-2022-tao-4-10-涉案紀錄-1', '劉勝全因蘆竹鄉農會賄選案判處有期徒刑3月、緩刑5年定讞，並因緩刑期間付保護管束而被撤銷議員候選資格。', 'election_bribery', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c98%2c%e9%81%b8%e7%b0%a1%e4%b8%8a%2c1%2c20091123%2c1'),
('research:tnl-dark-guide-legal:787063e1c3cd1b0b', '3963739a-1d62-4fd7-b50f-aad6ad287326', 'tnl-dark-guide-2022-nwt-8-9-涉案紀錄-2', '歐金獅任公司實際負責人期間，以申請文件表明未實際繳納的股款已收足，判處有期徒刑4月確定。', 'company_capital_falsification', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c99%2c%e6%a1%83%e7%b0%a1%2c2596%2c20110224%2c1&ot=in'),
('research:tnl-dark-guide-legal:4075ca2f9cd3fc88', '922348f9-6812-47a5-8adc-63ad48c4172d', 'tnl-dark-guide-2022-tpe-5-3-涉案紀錄-1', '鍾小平違法收受政治獻金，判處有期徒刑1月15日確定。', 'political_finance', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPDM,100%2c%e5%af%a9%e6%98%93%2c318%2c20111118%2c1');

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_2022_official_legal_claims_batch_8) <> 28 THEN
        RAISE EXCEPTION 'Expected exactly 28 reviewed 2022 official legal claims in batch 8';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_2022_official_legal_claims_batch_8 staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_2022_official_legal_claims_batch_8 staged
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
        'caseStage', 'criminal_judgment_final',
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(jsonb_build_object(
            'tier', 'official', 'name', '司法院法學資料檢索系統',
            'url', staged.source_url, 'supports', staged.claim_value
        )),
        'safetyFlags', '[]'::jsonb,
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', false
        )
    ),
    'A', 100, 'verified', 'review_only',
    '司法院法學資料檢索系統', staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'tnl-dark-guide-legal-2022-official-batch-8-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-8-v1',
        'reason', 'Matched the Dark Guide lead to an exact official judgment with an explicit final outcome; retained as non-public legal data pending human publication approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _reviewed_2022_official_legal_claims_batch_8 staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_2022_official_legal_claims_batch_8 staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A' AND claim.review_score = 100
          AND claim.review_status = 'verified' AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
    ) <> 28 THEN
        RAISE EXCEPTION 'Reviewed 2022 official legal claim batch 8 guard failed';
    END IF;
END
$$;

COMMIT;
