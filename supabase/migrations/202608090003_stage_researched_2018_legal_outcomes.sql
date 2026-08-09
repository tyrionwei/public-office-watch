BEGIN;

CREATE TEMP TABLE _researched_2018_legal_outcomes (
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
    requires_current_outcome_review BOOLEAN NOT NULL DEFAULT FALSE
) ON COMMIT DROP;

INSERT INTO _researched_2018_legal_outcomes VALUES
(
    'research:tnl-dark-guide-legal:7994e1ccd67d3c02',
    '01c0a0d9-54e1-4c9c-8ab0-1c94fb0f582a',
    '["tnl-dark-guide-2018-khh-5-20-涉案紀錄-1"]'::jsonb,
    '中國時報報導，林芳如在高雄市議長選舉亮票案中經法院判處有期徒刑3月、緩刑2年；報導未載明後續是否另有審級變動。',
    'B', 85, 'vote_disclosure', 'criminal_judgment_non_final', 'criminal',
    '中國時報',
    'https://www.chinatimes.com/amp/newspapers/20120224000464-260107',
    '[{"tier":"trusted_media","name":"中國時報","url":"https://www.chinatimes.com/amp/newspapers/20120224000464-260107","supports":"議長亮票案判刑3月、緩刑2年；與暗公報所列5月不一致"}]'::jsonb,
    '["stage_or_finality_must_be_stated", "source_conflicts_with_dark_guide_sentence"]'::jsonb,
    TRUE
),
(
    'research:tnl-dark-guide-legal:b5c67f9b3063f731',
    '59424fc1-7274-4a56-9d4d-fd7c04014192',
    '["tnl-dark-guide-2018-khh-12-46-涉案紀錄-1"]'::jsonb,
    '最高法院108年度台上字第2051號判決駁回上訴，俄鄧．殷艾 Eteng．Ingay因經建考察費案所涉公務員利用職務機會詐取財物罪，判處有期徒刑2年、褫奪公權3年、緩刑5年確定。',
    'A', 100, 'public_fund_fraud', 'criminal_judgment_final', 'criminal',
    '最高法院',
    'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=494586',
    '[{"tier":"official","name":"最高法院","url":"https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=494586","supports":"108年度台上字第2051號駁回上訴；二審判刑2年、褫奪公權3年、緩刑5年確定"}]'::jsonb,
    '["later_final_outcome_replaces_dark_guide_first_instance_sentence"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:32c4a9043134d8c1',
    'b790710a-4e1b-412e-bbba-c98488a9e6ac',
    '["tnl-dark-guide-2018-khh-15-4-涉案紀錄-1"]'::jsonb,
    '最高法院108年度台上字第2051號判決駁回上訴，唐惠美因經建考察費案所涉公務員利用職務機會詐取財物罪，判處有期徒刑2年、褫奪公權3年、緩刑5年確定。',
    'A', 100, 'public_fund_fraud', 'criminal_judgment_final', 'criminal',
    '最高法院',
    'https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=494586',
    '[{"tier":"official","name":"最高法院","url":"https://jirs.judicial.gov.tw/GNNWS/NNWSS002.asp?id=494586","supports":"108年度台上字第2051號駁回上訴；二審判刑2年、褫奪公權3年、緩刑5年確定"}]'::jsonb,
    '["later_final_outcome_replaces_dark_guide_first_instance_sentence"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:5c04a3452d72446c',
    'cd3e84c5-d23d-43e0-93fd-58e8e9c019f4',
    '["tnl-dark-guide-2018-nwt-7-49-涉案紀錄-1"]'::jsonb,
    '中央社報導，高敏慧先前的收賄販售補助款案於2022年判處有期徒刑5年確定；該案不可與其後助理費案中貪污部分獲判無罪的結果混為一談。',
    'B', 95, 'subsidy_kickback', 'criminal_judgment_final', 'criminal',
    '中央社',
    'https://www.cna.com.tw/news/asoc/202401310312.aspx',
    '[{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/202401310312.aspx","supports":"補助款案2022年判刑5年定讞；另案助理費貪污部分不構成貪污"}]'::jsonb,
    '["separate_assistant_fee_case_must_not_be_conflated", "later_final_outcome_replaces_dark_guide_second_instance_sentence"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:112d6eb573255f6e',
    'e175f675-f67e-4a93-a2b5-edba3376e493',
    '["tnl-dark-guide-2018-nwt-2-56-涉案紀錄-1"]'::jsonb,
    '中央社報導，張晉婷被控以餐會賄選的刑事案件經高院更一審改判無罪，最高法院駁回檢察官上訴，無罪確定。',
    'B', 100, 'vote_buying', 'criminal_acquittal_final', 'criminal',
    '中央社',
    'https://www.cna.com.tw/news/asoc/202108240072.aspx',
    '[{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/202108240072.aspx","supports":"高院更一審改判無罪，最高法院駁回檢察官上訴，刑事無罪確定"}]'::jsonb,
    '["later_final_acquittal_replaces_earlier_convictions", "must_not_describe_as_criminally_convicted"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:112d6eb573255f6e:election-civil',
    'e175f675-f67e-4a93-a2b5-edba3376e493',
    '["tnl-dark-guide-2018-nwt-2-56-涉案紀錄-1"]'::jsonb,
    '張晉婷的刑事案件最終無罪；但同一事件的選舉民事訴訟於2016年判決當選無效確定，兩種法律結果應分開呈現。',
    'B', 100, 'election_validity', 'election_invalidated_final', 'election_civil',
    '中央社',
    'https://www.cna.com.tw/news/asoc/202108240072.aspx',
    '[{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/202108240072.aspx","supports":"民事當選無效二審於2016年確定；刑事部分最終無罪"}]'::jsonb,
    '["must_not_attribute_criminal_liability", "criminal_and_election_civil_outcomes_must_be_displayed_separately"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:e0ec64b67aeb896f',
    'be7f3390-a29d-449f-9281-95fd5e2db1b7',
    '["tnl-dark-guide-2018-khh-8-35-涉案紀錄-1"]'::jsonb,
    '公視報導，中選會於2009年因黃紹庭就任高雄市議員後未立即放棄美國籍，撤銷其當選人名單公告並註銷當選證書；本紀錄屬選舉資格行政處分，不是刑事案件。',
    'B', 95, 'nationality_disqualification', 'administrative_election_qualification_revoked', 'administrative',
    '公視新聞網',
    'https://news.pts.org.tw/article/128200',
    '[{"tier":"trusted_media","name":"公視新聞網","url":"https://news.pts.org.tw/article/128200","supports":"中選會撤銷當選人名單公告並註銷當選證書"},{"tier":"official_context","name":"中央選舉委員會","url":"https://web.cec.gov.tw/api/file/07d28a0f-5b1a-408a-b557-60576d63096e.pdf","supports":"第387次會議資料所附雙重國籍與議員資格法律爭點；不是最終處分證明"}]'::jsonb,
    '["must_not_be_described_as_criminal_conviction", "2015_nationality_status_not_independently_verified", "official_document_is_context_not_final_disposition"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:62c337b028d7b514',
    '23c459f9-d96e-4948-a5a7-b6a618558367',
    '["tnl-dark-guide-2018-tao-3-51-涉案紀錄-1"]'::jsonb,
    '法務部所屬臺灣高等檢察署的無罪判決案例彙編記載，劉茂羣被控以蘋果禮盒賄選的刑事案件，經臺灣高等法院109年度選上訴字第3號判決無罪確定。',
    'A', 100, 'vote_buying', 'criminal_acquittal_final', 'criminal',
    '臺灣高等檢察署',
    'https://www.tph.moj.gov.tw/media/297316/%E5%85%AC%E8%81%B7%E4%BA%BA%E5%93%A1%E9%81%B8%E8%88%89%E7%BD%B7%E5%85%8D%E6%B3%95%E7%84%A1%E7%BD%AA%E5%88%A4%E6%B1%BA%E6%A1%88%E4%BE%8B%E5%BD%99%E7%B7%A8.pdf',
    '[{"tier":"official","name":"臺灣高等檢察署","url":"https://www.tph.moj.gov.tw/media/297316/%E5%85%AC%E8%81%B7%E4%BA%BA%E5%93%A1%E9%81%B8%E8%88%89%E7%BD%B7%E5%85%8D%E6%B3%95%E7%84%A1%E7%BD%AA%E5%88%A4%E6%B1%BA%E6%A1%88%E4%BE%8B%E5%BD%99%E7%B7%A8.pdf","supports":"桃園地檢107年度選偵字第13、62、99號；高院109年度選上訴字第3號無罪確定"}]'::jsonb,
    '["later_final_acquittal_replaces_investigation_stage", "must_not_describe_as_criminally_convicted"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:62c337b028d7b514:election-civil',
    '23c459f9-d96e-4948-a5a7-b6a618558367',
    '["tnl-dark-guide-2018-tao-3-51-涉案紀錄-1"]'::jsonb,
    '劉茂羣的刑事案件最終無罪；但同一送禮事件的選舉民事訴訟於2020年二審判決當選無效確定，兩種法律結果應分開呈現。',
    'B', 100, 'election_validity', 'election_invalidated_final', 'election_civil',
    '中央社',
    'https://www.cna.com.tw/news/asoc/202006100152.aspx',
    '[{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/202006100152.aspx","supports":"當選無效二審駁回上訴、全案確定"},{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/firstnews/202006180116.aspx","supports":"刑事二審仍判無罪，後由官方案例彙編確認無罪確定"}]'::jsonb,
    '["must_not_attribute_criminal_liability", "criminal_and_election_civil_outcomes_must_be_displayed_separately"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:1e34689dab8c8557',
    'a2e9e68d-b4be-45ec-a1fa-f24f7645fcd9',
    '["tnl-dark-guide-2018-khh-1-10-涉案紀錄-1"]'::jsonb,
    '劉馨正因擔任新竹瓦斯公司總經理期間收受廠商賄款240萬元，經臺灣高等法院判處有期徒刑12年、褫奪公權6年；最高法院111年度台上字第4949號駁回上訴，全案確定。',
    'A', 100, 'bribery', 'criminal_judgment_final', 'criminal',
    '法務部行政執行署高雄分署',
    'https://www.iakhs.nat.gov.tw/open/Articles?a=15132',
    '[{"tier":"official","name":"法務部行政執行署高雄分署","url":"https://www.iakhs.nat.gov.tw/open/Articles?a=15132","supports":"高院判刑12年、褫奪公權6年，最高法院駁回上訴定讞"},{"tier":"official","name":"憲法法庭","url":"https://cons.judicial.gov.tw/download/download.aspx?id=462948","supports":"最高法院111年度台上字第4949號駁回上訴而告確定，確定終局判決為高院106年度上訴字第3315號"}]'::jsonb,
    '["later_final_outcome_replaces_dark_guide_first_instance_sentence"]'::jsonb,
    FALSE
),
(
    'research:tnl-dark-guide-legal:d8116e4c6ee1e8ca',
    'b3830402-7cb6-41e8-8bb8-306d0159a981',
    '["tnl-dark-guide-2018-tao-12-53-涉案紀錄-1"]'::jsonb,
    '中央社報導，歐炳辰因觀音鄉長任內低價出售鄉有土地圖利廠商，高院更一審依對主管事務圖利罪判處有期徒刑6年、褫奪公權5年；最高法院駁回上訴，全案確定。',
    'B', 100, 'benefit_conferred_on_vendor', 'criminal_judgment_final', 'criminal',
    '中央社',
    'https://www.cna.com.tw/news/asoc/201908220243.aspx',
    '[{"tier":"trusted_media","name":"中央社","url":"https://www.cna.com.tw/news/asoc/201908220243.aspx","supports":"更一審判刑6年、褫奪公權5年，最高法院駁回上訴定讞"}]'::jsonb,
    '["later_final_outcome_added"]'::jsonb,
    FALSE
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _researched_2018_legal_outcomes) <> 11 THEN
        RAISE EXCEPTION 'Expected exactly 11 researched 2018 legal outcome claims';
    END IF;
    IF (SELECT COUNT(DISTINCT research_id) FROM _researched_2018_legal_outcomes staged CROSS JOIN LATERAL jsonb_array_elements_text(staged.research_ids) research_id) <> 9 THEN
        RAISE EXCEPTION 'Expected exactly 9 linked 2018 research rows';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM _researched_2018_legal_outcomes staged
        LEFT JOIN people person ON person.id = staged.person_id
        WHERE person.id IS NULL OR person.is_public IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'A researched 2018 legal outcome targets a missing or private person';
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
        'sourceId', 'independent-2018-legal-outcome-research',
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
    'independent-2018-legal-outcomes-2026-08-09-v1',
    jsonb_build_array(jsonb_build_object(
        'version', 'independent-2018-legal-outcomes-2026-08-09-v1',
        'reason', 'Replaced the Dark Guide stage snapshot with the independently supported later outcome, separated criminal, election civil and administrative records, and retained all claims as non-public pending human approval',
        'reviewedAt', NOW()
    )), NOW(), NOW()
FROM _researched_2018_legal_outcomes staged
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
        JOIN _researched_2018_legal_outcomes staged ON staged.claim_key = claim.claim_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.confidence_level = staged.confidence_level
          AND claim.review_score = staged.review_score
          AND claim.review_status = 'verified'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.claim_json->>'recordType' = staged.record_type
          AND claim.claim_json->>'legalCasePublicEligible' = 'false'
          AND claim.claim_json->'publicationGate'->>'requiresHumanApproval' = 'true'
    ) <> 11 THEN
        RAISE EXCEPTION 'Researched 2018 legal outcome guard failed';
    END IF;
    IF (
        SELECT COUNT(DISTINCT research_id)
        FROM _researched_2018_legal_outcomes staged
        JOIN person_claims claim ON claim.claim_key = staged.claim_key
        CROSS JOIN LATERAL jsonb_array_elements_text(claim.claim_json->'researchIds') research_id
    ) <> 9 THEN
        RAISE EXCEPTION 'Researched 2018 legal outcome linkage guard failed';
    END IF;
END
$$;

COMMIT;
