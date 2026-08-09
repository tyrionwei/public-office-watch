BEGIN;

CREATE TEMP TABLE _reviewed_election_civil_outcomes (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    additional_research_id TEXT,
    claim_value TEXT NOT NULL,
    source_url TEXT NOT NULL,
    third_party_conduct BOOLEAN NOT NULL,
    requires_current_outcome_review BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_election_civil_outcomes VALUES
('research:tnl-dark-guide-legal:6527b2c76986af47', '6e26b9b0-a4df-43c0-be3b-c8a635bba6fe', 'tnl-dark-guide-2022-txg-2-3-涉案紀錄-1', NULL, '尤碧鈴因競選樁腳買票事件，經選舉民事訴訟判決當選無效確定；本紀錄不表示其本人受刑事有罪判決。', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCHV,108%2c%e9%81%b8%e4%b8%8a%2c30%2c20191231%2c1', TRUE, FALSE),
('research:tnl-dark-guide-legal:49e876340cfbf2f2', '5a99cf63-e406-4752-807c-6d0fa1b2ee03', 'tnl-dark-guide-2022-tnn-2-7-涉案紀錄-1', 'tnl-dark-guide-2018-tnn-2-14-涉案紀錄-1', '方一峰因競選樁腳賄選事件，經選舉民事訴訟於2007年判決當選無效確定；本紀錄不表示其本人受刑事有罪判決。', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TNHV,96%2c%e9%81%b8%e4%b8%8a%2c11%2c20071113%2c1', TRUE, FALSE),
('research:tnl-dark-guide-legal:b01ffdb4919e2305', '38758939-ea2f-4a80-9079-9f2aef6935a4', 'tnl-dark-guide-2022-khh-1-1-涉案紀錄-2', NULL, '朱信強因競選樁腳買票事件，經選舉民事訴訟判決當選無效確定；本紀錄不表示其本人受刑事有罪判決。', 'https://law.judicial.gov.tw/LAW_MOBILE/FJUD/data.aspx?ty=JD&id=KSHV,101%2c%e9%81%b8%e4%b8%8a%2c4%2c20120620%2c1', TRUE, FALSE),
('research:tnl-dark-guide-legal:88f14bd2d4a222ca', 'bfc2d251-548b-456f-86a1-10df3e256ed9', 'tnl-dark-guide-2022-khh-10-2-涉案紀錄-1', 'tnl-dark-guide-2018-khh-10-11-涉案紀錄-1', '朱挺玗經選舉民事訴訟判決當選無效確定；本紀錄僅描述選舉民事判決，不表示刑事有罪。', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHV%2c96%2c%e9%81%b8%e4%b8%8a%2c14%2c20080415%2c1&ot=in', FALSE, FALSE),
('research:tnl-dark-guide-legal:07d869e2ec389c57', '4609c108-c726-47c0-93fb-6da6cd92f7fc', 'tnl-dark-guide-2022-tao-1-7-涉案紀錄-1', 'tnl-dark-guide-2018-tao-1-55-涉案紀錄-1', '林政賢因競選期間發放物品事件，經選舉民事訴訟於2007年判決當選無效確定；本紀錄不表示刑事有罪。', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHV%2c95%2c%e9%81%b8%e4%b8%8a%2c12%2c20070124%2c1', FALSE, FALSE),
('research:tnl-dark-guide-legal:a995fc464a6d931b', '46f2c4fd-a924-4f82-9f66-88a892b45b52', 'tnl-dark-guide-2022-txg-16-3-涉案紀錄-1', NULL, '林榮進因競選樁腳行賄事件，經選舉民事訴訟於2016年判決當選無效確定；本紀錄不表示其本人受刑事有罪判決。', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCHV,104%2c%e9%81%b8%e4%b8%8a%2c53%2c20160106%2c1', TRUE, FALSE),
('research:tnl-dark-guide-legal:edde1e2ca48ffbf8', '4458b34f-03f1-4c72-a76c-1f84f0b6ad2e', 'tnl-dark-guide-2022-nwt-5-16-涉案紀錄-1', 'tnl-dark-guide-2018-nwt-4-55-涉案紀錄-1', '黃俊哲因競選樁腳買票且法院認定其知情，經選舉民事訴訟判決當選無效確定；本紀錄不表示其本人受刑事有罪判決。', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPHV%2c101%2c%e9%81%b8%e4%b8%8a%2c1%2c20121003%2c1', TRUE, FALSE),
('research:tnl-dark-guide-legal:1f9bf0099469d027', '6b158db8-0e27-46b7-9b02-bb3ddeaf22cc', 'tnl-dark-guide-2022-nwt-5-20-涉案紀錄-1', 'tnl-dark-guide-2018-nwt-4-31-涉案紀錄-1', '廖裕德因競選幹部賄選事件，新北地方法院於2015年判決當選無效；本紀錄不表示其本人受刑事有罪判決，後續審級仍待確認。', 'https://law.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=PCDV%2c104%2c%e9%81%b8%2c18%2c20150925%2c1&ot=in', TRUE, TRUE);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_election_civil_outcomes) <> 8 THEN
        RAISE EXCEPTION 'Expected exactly 8 reviewed election civil outcomes';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _reviewed_election_civil_outcomes staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'An election civil outcome targets a missing or private person';
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
        'researchIds', CASE WHEN staged.additional_research_id IS NULL
            THEN jsonb_build_array(staged.research_id)
            ELSE jsonb_build_array(staged.research_id, staged.additional_research_id) END,
        'caseKind', 'election_validity',
        'caseStage', CASE WHEN staged.requires_current_outcome_review
            THEN 'election_invalidated_non_final' ELSE 'election_invalidated_final' END,
        'recordType', 'election_civil',
        'evidenceSources', jsonb_build_array(jsonb_build_object(
            'tier', 'official', 'name', '司法院法學資料檢索系統',
            'url', staged.source_url, 'supports', staged.claim_value
        )),
        'safetyFlags', (
            jsonb_build_array('must_not_attribute_criminal_liability')
            || CASE WHEN staged.third_party_conduct
                THEN jsonb_build_array('third_party_conduct_must_not_be_attributed')
                ELSE '[]'::jsonb END
            || CASE WHEN staged.requires_current_outcome_review
                THEN jsonb_build_array('current_outcome_not_independently_verified')
                ELSE '[]'::jsonb END
        ),
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
    'tnl-dark-guide-election-civil-outcomes-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-election-civil-outcomes-v1',
        'reason', 'Recorded an official election civil judgment separately from criminal liability and retained it as non-public data pending human publication approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _reviewed_election_civil_outcomes staged
ON CONFLICT (claim_key) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _reviewed_election_civil_outcomes staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = 'A'
          AND claim.review_status = 'verified' AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'recordType' = 'election_civil'
          AND claim.claim_json->'safetyFlags' ? 'must_not_attribute_criminal_liability'
    ) <> 8 THEN
        RAISE EXCEPTION 'Reviewed election civil outcome guard failed';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM _reviewed_election_civil_outcomes staged
        JOIN person_claims claim ON claim.claim_key = staged.claim_key
        CROSS JOIN LATERAL jsonb_array_elements_text(claim.claim_json->'researchIds') research_id
        WHERE research_id = staged.research_id OR research_id = staged.additional_research_id
    ) <> 13 THEN
        RAISE EXCEPTION 'Election civil research id linkage guard failed';
    END IF;
END
$$;

COMMIT;
