BEGIN;

CREATE TEMP TABLE _researched_legal_sources_batch_2 (
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
    safety_flags JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _researched_legal_sources_batch_2 VALUES
(
    'research:tnl-dark-guide-legal:a3123147e2db506b',
    '43d3589c-8d75-409a-8cc1-f518846b5a1f',
    '["tnl-dark-guide-2022-khh-5-8-涉案紀錄-1"]'::jsonb,
    '臺灣高等法院高雄分院93年度上訴字第701號判決的前案紀錄載明，陳清茂曾因違反槍砲彈藥刀械管制條例，由臺灣高等法院臺南分院90年度上更（一）字第60號判處有期徒刑3年8月確定，並於2003年4月6日執行完畢。',
    'A', 100, 'weapons_offense', 'criminal_judgment_final', 'criminal',
    '司法院裁判書系統',
    'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM%2c93%2c%e4%b8%8a%e8%a8%b4%2c701%2c20040907%2c1&ot=in',
    '[
      {"tier":"official","name":"臺灣高等法院高雄分院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=KSHM%2c93%2c%e4%b8%8a%e8%a8%b4%2c701%2c20040907%2c1&ot=in","supports":"93年度上訴字第701號判決的前案紀錄載明陳清茂因槍砲案件遭判刑3年8月確定，並記載執行完畢日期"}
    ]'::jsonb,
    '["source_is_later_official_judgment_reciting_prior_final_case"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:722bcdf67749b822',
    '3963739a-1d62-4fd7-b50f-aad6ad287326',
    '["tnl-dark-guide-2022-nwt-8-9-涉案紀錄-1"]'::jsonb,
    '臺灣高等法院臺中分院98年度上更（一）字第29號判決認定歐金獅共同行使偽造私文書，判處有期徒刑3月、緩刑2年；最高法院98年度台上字第3523號駁回上訴，全案確定。',
    'A', 100, 'document_falsification', 'criminal_judgment_final', 'criminal',
    '司法院裁判書系統',
    'https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCHM%2c98%2c%e4%b8%8a%e6%9b%b4%28%e4%b8%80%29%2c29%2c20090430%2c1&ot=in',
    '[
      {"tier":"official","name":"臺灣高等法院臺中分院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TCHM%2c98%2c%e4%b8%8a%e6%9b%b4%28%e4%b8%80%29%2c29%2c20090430%2c1&ot=in","supports":"共同行使偽造私文書，判處有期徒刑3月、緩刑2年"},
      {"tier":"official","name":"最高法院","url":"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=TPSM%2c98%2c%e5%8f%b0%e4%b8%8a%2c3523%2c20090625%2c1&ot=in","supports":"98年度台上字第3523號駁回上訴，判決確定"}
    ]'::jsonb,
    '[]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2657bac9120e1f71',
    '6e80b8b0-96fc-45da-a097-d3cf1ea6c9b2',
    '["tnl-dark-guide-2022-khh-10-1-涉案紀錄-1"]'::jsonb,
    '國家文化記憶庫資料記載，顏坤泉因參與1989年安強、十全美關廠工運抗爭，遭以違反《陸海空交通法》判處有期徒刑1年10月。',
    'A', 95, 'labor_movement', 'historical_criminal_judgment_final', 'criminal',
    '國家文化記憶庫',
    'https://tcmb.culture.tw/zh-tw/detail?id=161736&indexCode=Culture_Media',
    '[
      {"tier":"official","name":"國家文化記憶庫（高雄市政府文化局建檔）","url":"https://tcmb.culture.tw/zh-tw/detail?id=161736&indexCode=Culture_Media","supports":"顏坤泉參與安強、十全美關廠工運抗爭，因違反陸海空交通法遭判刑1年10月"},
      {"tier":"first_party_context","name":"公民行動影音紀錄資料庫（顏坤泉署名聲明）","url":"https://www.civilmedia.tw/archives/112677","supports":"顏坤泉自述因1989年工運抗爭遭判刑1年10月的歷史脈絡"}
    ]'::jsonb,
    '["historical_political_repression_context_required", "no_exact_judgment_number", "official_historical_archive_not_judgment"]'::jsonb
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _researched_legal_sources_batch_2) <> 3 THEN
        RAISE EXCEPTION 'Expected exactly 3 researched legal claims in batch 2';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _researched_legal_sources_batch_2 staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A researched legal source targets a missing or private person';
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
        'sourceId', 'independent-legal-research-batch-2',
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
            'requiresCurrentOutcomeReview', false
        )
    ),
    staged.confidence_level, staged.review_score,
    'verified', 'review_only', staged.source_name, staged.source_url,
    '2026-08-09T00:00:00+08:00'::timestamptz, FALSE,
    'independent-legal-research-2026-08-09-v2',
    jsonb_build_array(jsonb_build_object(
        'version', 'independent-legal-research-2026-08-09-v2',
        'reason', 'Matched the named person to an official judgment or government-curated historical record and retained the supported context; kept non-public pending human publication approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _researched_legal_sources_batch_2 staged
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

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM person_claims claim
        JOIN _researched_legal_sources_batch_2 staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = staged.confidence_level
          AND claim.review_score = staged.review_score
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
    ) <> 3 THEN
        RAISE EXCEPTION 'Researched legal source batch 2 guard failed';
    END IF;
END
$$;

COMMIT;
