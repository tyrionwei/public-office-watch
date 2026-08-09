BEGIN;

CREATE TEMP TABLE _remaining_supported_legal_claims (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    research_id TEXT NOT NULL UNIQUE,
    claim_value TEXT NOT NULL,
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('A', 'B')),
    case_kind TEXT NOT NULL,
    case_stage TEXT NOT NULL,
    record_type TEXT NOT NULL,
    source_tier TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    safety_flags JSONB NOT NULL,
    requires_current_outcome_review BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _remaining_supported_legal_claims VALUES
('research:tnl-dark-guide-legal:e2c47700288fd632', '870bdb1b-57d2-461e-a051-282bb8cbaf05', 'tnl-dark-guide-2018-txg-4-38-涉案紀錄-1', '曾違反農會法交付財物罪並影響候選資格', 'B', 'other', 'criminal_outcome_unspecified', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/aipl/202210170291.aspx', '["stage_or_finality_must_be_stated", "current_outcome_not_independently_verified", "media_evidence_capped_at_b"]', TRUE),
('research:tnl-dark-guide-legal:609d7e852302c119', 'be671f26-3901-4e7b-af16-e661388b9715', 'tnl-dark-guide-2018-tao-11-52-涉案紀錄-1', '判刑12年6月、罰金與褫奪公權，最高法院駁回定讞', 'B', 'other', 'criminal_judgment_final', 'criminal', 'trusted_media', '中央社', 'https://www.cna.com.tw/news/asoc/202011110303.aspx', '["media_evidence_capped_at_b"]', FALSE),
('research:tnl-dark-guide-legal:a4de553ed7f60d6f', '53329eec-e1f6-458b-80ff-c5f80501722a', 'tnl-dark-guide-2022-tao-3-5-涉案紀錄-1', '曾被列為十大槍擊要犯', 'B', 'violence_or_threat', 'historical_designation', 'historical_context', 'trusted_media', 'TVBS', 'https://news.tvbs.com.tw/local/79766', '["historical_label_requires_context", "media_evidence_capped_at_b"]', FALSE),
('research:tnl-dark-guide-legal:bb5e4455796436da', '162f0858-4455-4937-8409-d82aa4d3a9b7', 'tnl-dark-guide-2018-khh-8-66-涉案紀錄-1', '使公務員登載不實罪判刑1年', 'A', 'document_falsification', 'criminal_judgment_non_final', 'criminal', 'official', '臺灣高等法院高雄分院', 'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=180824', '["stage_or_finality_must_be_stated", "current_outcome_not_independently_verified"]', TRUE),
('research:tnl-dark-guide-legal:2547644366906e1c', 'fda85fd0-79b8-4007-8612-f47e445f0d50', 'tnl-dark-guide-2018-tao-8-50-涉案紀錄-1', '恐嚇建商案一審判刑10月', 'B', 'violence_or_threat', 'criminal_judgment_non_final', 'criminal', 'trusted_media', '中國時報', 'https://www.chinatimes.com/amp/newspapers/20121025000875-260106', '["stage_or_finality_must_be_stated", "current_outcome_not_independently_verified", "media_evidence_capped_at_b"]', TRUE),
('research:tnl-dark-guide-legal:7facd2e7a7e65ebb', '9b4e581e-7986-4ff2-b0db-598b5859f2de', 'tnl-dark-guide-2018-khh-7-60-涉案紀錄-1', '使公務員登載不實罪判刑10月', 'A', 'document_falsification', 'criminal_judgment_non_final', 'criminal', 'official', '臺灣高等法院高雄分院', 'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=180824', '["stage_or_finality_must_be_stated", "current_outcome_not_independently_verified"]', TRUE),
('research:tnl-dark-guide-legal:76f6b4427988aa6e', 'b87034c4-59d1-4a08-87dc-cb98a74b5b69', 'tnl-dark-guide-2018-tao-1-56-涉案紀錄-1', '當選無效確定', 'B', 'election_validity', 'election_invalidated_final', 'election_civil', 'trusted_media', '自立晚報', 'https://www.idn.com.tw/news/news_content.aspx?artid=20071201ea001&catdid=0&catid=5&catsid=3', '["must_not_attribute_criminal_liability", "media_evidence_capped_at_b"]', FALSE),
('research:tnl-dark-guide-legal:eadbb570ba2807bc', '24938437-767c-4ee6-9a34-be7fd392bfd6', 'tnl-dark-guide-2018-khh-9-33-涉案紀錄-1', '當選無效訴訟確定', 'A', 'election_bribery', 'election_invalidated_final', 'election_civil', 'official', '司法院法學資料檢索系統', 'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=209432', '["must_not_attribute_criminal_liability", "third_party_conduct_must_not_be_attributed"]', FALSE),
('research:tnl-dark-guide-legal:d31708faeb75e774', '9d0649cc-e46d-48da-8ec7-52ce2e64d87c', 'tnl-dark-guide-2018-tao-1-57-涉案紀錄-1', '違法兼任私人公司董事及持股，監察院通過彈劾', 'A', 'public_discipline', 'administrative_impeachment', 'administrative', 'official', '監察院', 'https://www.cy.gov.tw/News_Content.aspx?n=124&s=5607&sms=8912', '["must_not_be_described_as_criminal_conviction"]', FALSE);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _remaining_supported_legal_claims) <> 9 THEN
        RAISE EXCEPTION 'Expected exactly 9 remaining supported legal claims';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _remaining_supported_legal_claims staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A supported legal claim targets a missing or private person';
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
        'safetyFlags', staged.safety_flags,
        'legalCasePublicEligible', false,
        'publicationGate', jsonb_build_object(
            'status', 'verified_not_published',
            'requiresHumanApproval', true,
            'requiresCurrentOutcomeReview', staged.requires_current_outcome_review
        )
    ),
    staged.confidence_level,
    CASE WHEN staged.confidence_level = 'A' THEN 100 ELSE 85 END,
    'verified', 'review_only', staged.source_name, staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'tnl-dark-guide-remaining-supported-legal-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'tnl-dark-guide-remaining-supported-legal-v1',
        'reason', 'Matched the Dark Guide lead to acceptable independent evidence and retained it as non-public legal data pending human publication approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _remaining_supported_legal_claims staged
ON CONFLICT (claim_key) DO NOTHING;

UPDATE person_claims
SET claim_json = jsonb_set(
        claim_json,
        '{researchIds}',
        COALESCE(claim_json->'researchIds', '[]'::jsonb)
            || jsonb_build_array('tnl-dark-guide-2018-khh-1-9-涉案紀錄-1'),
        TRUE
    ),
    updated_at = NOW()
WHERE claim_key = 'research:tnl-dark-guide-legal:b01ffdb4919e2305'
  AND person_id = '38758939-ea2f-4a80-9079-9f2aef6935a4'
  AND NOT COALESCE(claim_json->'researchIds', '[]'::jsonb)
      @> jsonb_build_array('tnl-dark-guide-2018-khh-1-9-涉案紀錄-1');

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM person_claims claim
        JOIN _remaining_supported_legal_claims staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = staged.confidence_level
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
    ) <> 9 THEN
        RAISE EXCEPTION 'Remaining supported legal claim guard failed';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM person_claims claim
        WHERE claim.claim_key = 'research:tnl-dark-guide-legal:b01ffdb4919e2305'
          AND claim.claim_json->'researchIds'
              @> jsonb_build_array('tnl-dark-guide-2018-khh-1-9-涉案紀錄-1')
    ) THEN
        RAISE EXCEPTION 'Duplicate 2018 election-civil research id was not linked';
    END IF;
END
$$;

COMMIT;
