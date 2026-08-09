BEGIN;

CREATE TEMP TABLE _remaining_researched_legal_sources (
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

INSERT INTO _remaining_researched_legal_sources VALUES
(
    'research:tnl-dark-guide-legal:2018-ho-shu-feng-final',
    '4839bc48-2e04-440c-a5d2-e68c305df767',
    '["tnl-dark-guide-2018-nwt-2-48-涉案紀錄-1"]'::jsonb,
    '最高法院110年度台上字第5885號於2022年10月27日駁回上訴，何淑峯因民意代表建議補助款案所涉對於職務上行為收受賄賂罪，判處有期徒刑4年10月、褫奪公權4年確定；此結果取代暗公報所載二審6年。',
    'A', 100, 'subsidy_kickback', 'criminal_judgment_final', 'criminal',
    '新北市選舉委員會',
    'https://web.cec.gov.tw/api/file/8475dddc-2fde-4d0b-82d0-a04c6e6e64dc.pdf',
    '[{"tier":"official","name":"新北市選舉委員會","url":"https://web.cec.gov.tw/api/file/8475dddc-2fde-4d0b-82d0-a04c6e6e64dc.pdf","supports":"最高法院110年度台上字第5885號判決確定；有期徒刑4年10月、褫奪公權4年"},{"tier":"official","name":"最高法院","url":"https://www.judicial.gov.tw/tw/cp-1888-739964-524f1-1.html","supports":"110年度台上字第5885號於2022年10月27日駁回上訴確定，並說明民意代表建議補助款案情"}]'::jsonb,
    '["later_final_outcome_replaces_dark_guide_second_instance_sentence"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-chin-chung-yu-final',
    '4e339b7b-3c36-42a4-9ee1-df4abd2056a5',
    '["tnl-dark-guide-2018-nwt-8-46-涉案紀錄-1"]'::jsonb,
    '最高法院110年度台上字第5885號於2022年10月27日駁回上訴，金中玉因民意代表建議補助款案所涉對於職務上行為收受賄賂罪，判處有期徒刑3年10月、褫奪公權3年確定；此結果取代暗公報所載二審5年8月。',
    'A', 100, 'subsidy_kickback', 'criminal_judgment_final', 'criminal',
    '新北市選舉委員會',
    'https://web.cec.gov.tw/api/file/8475dddc-2fde-4d0b-82d0-a04c6e6e64dc.pdf',
    '[{"tier":"official","name":"新北市選舉委員會","url":"https://web.cec.gov.tw/api/file/8475dddc-2fde-4d0b-82d0-a04c6e6e64dc.pdf","supports":"最高法院110年度台上字第5885號判決確定；有期徒刑3年10月、褫奪公權3年"},{"tier":"official","name":"最高法院","url":"https://www.judicial.gov.tw/tw/cp-1888-739964-524f1-1.html","supports":"110年度台上字第5885號於2022年10月27日駁回上訴確定，並說明民意代表建議補助款案情"}]'::jsonb,
    '["later_final_outcome_replaces_dark_guide_second_instance_sentence"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-lin-ru-zhou-election-civil',
    'e632d8e5-e7b0-4e28-b537-fa4a193dd27f',
    '["tnl-dark-guide-2018-txg-3-40-涉案紀錄-1"]'::jsonb,
    'NOWnews報導，林汝洲的外甥兼競選人員陳進益因2014年選舉買票遭判有期徒刑1年10月、緩刑5年；林汝洲本人所涉選舉民事訴訟則於2016年二審駁回上訴、當選無效確定。競選人員的刑事責任不得記為林汝洲本人前科。',
    'B', 95, 'election_validity', 'election_invalidated_final', 'election_civil',
    'NOWnews今日新聞',
    'https://www.nownews.com/news/2142534',
    '[{"tier":"trusted_media","name":"NOWnews今日新聞","url":"https://www.nownews.com/news/2142534","supports":"外甥兼競選人員陳進益判刑1年10月、緩刑5年；林汝洲當選無效二審確定"}]'::jsonb,
    '["third_party_conduct_must_not_be_attributed", "must_not_attribute_criminal_liability", "criminal_and_election_civil_outcomes_must_be_displayed_separately"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-lin-wan-jung-final',
    '5e10e2bf-ba8b-46a6-ad94-910efefbea49',
    '["tnl-dark-guide-2018-khh-10-55-涉案紀錄-1"]'::jsonb,
    '林宛蓉因高雄市議員公費助理費案，二審判處有期徒刑3月並確定；暗公報所載6月為較早審級結果，公開時應採後續確定刑度。',
    'B', 100, 'assistant_expense', 'criminal_judgment_final', 'criminal',
    '中央通訊社（Yahoo新聞轉載）',
    'https://tw.news.yahoo.com/%E9%AB%98%E5%B8%82%E8%AD%B0%E5%93%A1%E5%86%92%E9%A0%98%E5%8A%A9%E7%90%86%E8%B2%BB-%E4%BA%8C%E5%AF%A9%E5%AE%9A%E8%AE%9E-101914235.html',
    '[{"tier":"trusted_media","name":"中央通訊社（Yahoo新聞轉載）","url":"https://tw.news.yahoo.com/%E9%AB%98%E5%B8%82%E8%AD%B0%E5%93%A1%E5%86%92%E9%A0%98%E5%8A%A9%E7%90%86%E8%B2%BB-%E4%BA%8C%E5%AF%A9%E5%AE%9A%E8%AE%9E-101914235.html","supports":"林宛蓉二審判刑3月定讞"},{"tier":"court_release_mirror","name":"臺灣高雄地方法院100年度訴字第1167號新聞稿鏡像","url":"https://www.lawtw.com/archives/420124","supports":"一審助理費案身分、行為與原判刑度；僅作案情交叉核對"}]'::jsonb,
    '["later_final_outcome_replaces_dark_guide_first_instance_sentence", "media_source_confirms_finality"]'::jsonb
),
(
    'research:tnl-dark-guide-legal:2018-yeh-hai-jui-final',
    '8b4d328b-ea6b-4f01-96e1-5282da69c985',
    '["tnl-dark-guide-2018-tpe-5-79-涉案紀錄-1"]'::jsonb,
    '民視報導，葉海瑞在中泰花園廣場都更案中因製造不實債權等行為，判處有期徒刑1年4月確定，得易科罰金；憲法法庭資料另確認相關臺灣高等法院105年度上易字第1559號為確定終局判決，但該資料未單獨列出葉海瑞刑度。',
    'B', 95, 'false_public_entry', 'criminal_judgment_final', 'criminal',
    '民視新聞',
    'https://sport.ftvnews.com.tw/news/detail/2018A08S07M1',
    '[{"tier":"trusted_media","name":"民視新聞","url":"https://sport.ftvnews.com.tw/news/detail/2018A08S07M1","supports":"葉海瑞因假債權案判刑1年4月定讞，得易科罰金"},{"tier":"official_context","name":"憲法法庭","url":"https://cons.judicial.gov.tw/docdata.aspx?fid=40&id=340008","supports":"臺灣高等法院105年度上易字第1559號為刑法第214條相關確定終局判決；未單獨證明葉海瑞身分及刑度"}]'::jsonb,
    '["official_document_is_context_not_identity_proof", "media_source_confirms_identity_sentence_and_finality"]'::jsonb
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _remaining_researched_legal_sources) <> 5 THEN
        RAISE EXCEPTION 'Expected exactly 5 remaining researched legal claims';
    END IF;
    IF (SELECT COUNT(DISTINCT research_id) FROM _remaining_researched_legal_sources staged CROSS JOIN LATERAL jsonb_array_elements_text(staged.research_ids) research_id) <> 5 THEN
        RAISE EXCEPTION 'Expected exactly 5 linked research rows';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _remaining_researched_legal_sources staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A remaining researched legal claim targets a missing or private person';
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
        'sourceId', 'remaining-independent-legal-source-research',
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
    'remaining-independent-legal-sources-2026-08-09-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'remaining-independent-legal-sources-2026-08-09-v1',
        'reason', 'Replaced stale Dark Guide stage snapshots with supported later outcomes, separated candidate liability from campaign-worker conduct, and retained every claim as non-public pending human approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _remaining_researched_legal_sources staged
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
        JOIN _remaining_researched_legal_sources staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = staged.confidence_level
          AND claim.review_score = staged.review_score
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'recordType' = staged.record_type
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
    ) <> 5 THEN
        RAISE EXCEPTION 'Remaining researched legal claims guard failed';
    END IF;
END
$$;

COMMIT;
