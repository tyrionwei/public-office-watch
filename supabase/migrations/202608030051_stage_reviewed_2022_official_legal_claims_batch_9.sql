BEGIN;

CREATE TEMP TABLE _reviewed_2022_official_legal_claims_batch_9 (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    claim_value TEXT NOT NULL,
    case_kind TEXT NOT NULL,
    source_url TEXT NOT NULL,
    requires_current_outcome_review BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_2022_official_legal_claims_batch_9 VALUES
('research:tnl-dark-guide-legal:388ed832f4461d69', 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0', 'tnl-dark-guide-2022-tpe-4-6-涉案紀錄-3', '王世堅在臺北市議會以言語辱罵李慶元，刑事法院判處罰金300元。', 'defamation_or_insult', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHV%2C94%2C%E4%B8%8A%E6%98%93%2C461%2C20050906%2C1', FALSE),
('research:tnl-dark-guide-legal:7efa9141a8477333', '38758939-ea2f-4a80-9079-9f2aef6935a4', 'tnl-dark-guide-2022-khh-1-1-涉案紀錄-1', '朱信強因農會改選賄選案，判處有期徒刑6月。', 'election_bribery', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM%2c96%2c%E4%B8%8A%E6%98%93%2c322%2c20070823%2c1', FALSE),
('research:tnl-dark-guide-legal:746e1e40e9528986', '53329eec-e1f6-458b-80ff-c5f80501722a', 'tnl-dark-guide-2022-tao-3-5-涉案紀錄-4', '段樹文與同夥持槍限制被害人行動，犯妨害自由罪，判刑後減為有期徒刑7月。', 'coercion_or_deprivation_of_liberty', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TYDM%2c96%2c%e8%a8%b4%2c1704%2c20080508%2c1&ot=in', TRUE),
('research:tnl-dark-guide-legal:82b9147f10199654', 'd309025e-d2d6-484d-97f0-6268032d47ad', 'tnl-dark-guide-2022-nwt-1-6-涉案紀錄-1', '蔡錦賢犯預備行賄罪，判處有期徒刑7月確定。', 'election_bribery', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c88%2c%e4%b8%8a%e6%98%93%2c4090%2c20000126', FALSE),
('research:tnl-dark-guide-legal:1f5a12d6496247b6', '1f8e35f4-ba21-4791-93c8-03c35194a168', 'tnl-dark-guide-2022-txg-13-12-涉案紀錄-2', '鄭伯其販售偽藥，犯藥事法販賣偽藥罪，判處有期徒刑5月。', 'pharmaceutical_law', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM%2c101%2c%e8%a8%b4%2c1245%2c20120712%2c1&ot=in', TRUE),
('research:tnl-dark-guide-legal:3b824f53a679ac7b', '1f8e35f4-ba21-4791-93c8-03c35194a168', 'tnl-dark-guide-2022-txg-13-12-涉案紀錄-3', '鄭伯其製作不實病歷申請健保費用，犯詐欺取財罪，判處有期徒刑1年6月、緩刑3年。', 'health_insurance_fraud', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM%2c109%2c%e8%a8%b4%2c368%2c20200708%2c1&ot=in', TRUE),
('research:tnl-dark-guide-legal:730e9622ff1218dd', '1f8e35f4-ba21-4791-93c8-03c35194a168', 'tnl-dark-guide-2022-txg-13-12-涉案紀錄-1', '鄭伯其在造勢活動衝突中犯傷害罪，判處有期徒刑5月。', 'assault', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM%2c94%2c%e6%98%93%2c1146%2c20051005%2c2&ot=in', TRUE),
('research:tnl-dark-guide-legal:3e1f475acb9d9368', '3963739a-1d62-4fd7-b50f-aad6ad287326', 'tnl-dark-guide-2022-nwt-8-9-涉案紀錄-3', '歐金獅在議員選舉期間預備行賄，判處有期徒刑9月。', 'election_bribery', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM%2c104%2c%e9%81%b8%e4%b8%8a%e8%a8%b4%2c16%2c20151118%2c2&ot=in', TRUE),
('research:tnl-dark-guide-legal:f1eb9d30438f4be3', 'ebcae6e3-2b33-4f5a-b347-827c1b1d7be7', 'tnl-dark-guide-2022-tpe-1-14-涉案紀錄-1', '林瑞圖因施壓銀行超額貸款案犯偽造文書罪，判處有期徒刑5月。', 'document_falsification', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHM,91%2c%e4%b8%8a%e8%a8%b4%2c464%2c20030715%2c1', TRUE),
('research:tnl-dark-guide-legal:d81977355e51287f', 'e6fecff0-169b-46ee-ae6e-888179d54342', 'tnl-dark-guide-2022-txg-15-4-涉案紀錄-2', '黃仁在餐敘期間犯妨害名譽罪，判處有期徒刑4月並減為2月。', 'defamation_or_insult', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCDM,96%2c%e6%98%93%2c2091%2c20070816%2c1', TRUE);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_2022_official_legal_claims_batch_9) <> 10 THEN
        RAISE EXCEPTION 'Expected exactly 10 reviewed 2022 official legal claims in batch 9';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_2022_official_legal_claims_batch_9 staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A reviewed legal claim targets a missing or private person';
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
        'caseStage', CASE WHEN staged.requires_current_outcome_review
            THEN 'criminal_judgment' ELSE 'criminal_judgment_final' END,
        'recordType', 'criminal',
        'evidenceSources', jsonb_build_array(jsonb_build_object(
            'tier', 'official', 'name', '司法院法學資料檢索系統',
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
    'A', 100, 'verified', 'review_only',
    '司法院法學資料檢索系統', staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'tnl-dark-guide-legal-2022-official-batch-9-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-legal-2022-official-batch-9-v1',
        'reason', 'Matched the Dark Guide lead to an exact official judgment and repaired malformed embedded judgment links where needed; retained as non-public legal data pending human publication approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _reviewed_2022_official_legal_claims_batch_9 staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_2022_official_legal_claims_batch_9 staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A' AND claim.review_score = 100
          AND claim.review_status = 'verified' AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'status' = 'verified_not_published'
    ) <> 10 THEN
        RAISE EXCEPTION 'Reviewed 2022 official legal claim batch 9 guard failed';
    END IF;
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_2022_official_legal_claims_batch_9 staged ON staged.claim_key = claim.claim_key
        WHERE staged.requires_current_outcome_review
          AND claim.claim_json->'publicationGate'->>'requiresCurrentOutcomeReview' = 'true'
          AND claim.claim_json->'safetyFlags' ? 'current_outcome_not_independently_verified'
    ) <> 7 THEN
        RAISE EXCEPTION 'Current-outcome review guard failed for batch 9';
    END IF;
END
$$;

COMMIT;
