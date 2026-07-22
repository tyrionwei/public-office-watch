CREATE TEMP TABLE _current_councilor_official_profiles_batch_7 (
    person_external_id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    source_person_key TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    external_record_id TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    education TEXT,
    education_claim_key TEXT,
    experience TEXT,
    experience_claim_key TEXT
) ON COMMIT DROP;

INSERT INTO _current_councilor_official_profiles_batch_7 VALUES
    ('cec-2022-local-councilor-mountain-indigenous-person-314605abb8a9', '馬見Lahuy．Ipin', 'new-taipei-city-council-current-councilors:current-councilor-604', 'new-taipei-city-council-current-councilors', '新北市議會：現任議員', 'https://www.ntp.gov.tw/councilor-detail?program=37&A=13&C=604', 'current-councilor-604', '新北市議員', '新北市第13選舉區（山地原住民）', '台北縣立屈尺國小 台北市中山區中山國民小學 台北市立民族國中 台北縣立金山高中 東吳大學政治學系', 'official-profile:new-taipei-city-council-current-councilors:dc0a0821eb66:8c4617ab-f688-46c5-9dd8-fc79b238224e:education', '新北市第3屆議員 新北市議會法規審查委員會召集人 國民黨中央委員 國民黨全國黨代表 新北市義警山地中隊長 烏來泰雅龍舟隊 烏來區青年工作會會長 烏來區體育發展協會顧問 東吳大學、輔仁大學財經法律碩士班(在學)
新北市第4屆議員', 'official-profile:new-taipei-city-council-current-councilors:dc0a0821eb66:8c4617ab-f688-46c5-9dd8-fc79b238224e:experience'),
    ('cec-2022-local-councilor-regional-person-7e0f991e8d5f', '張嘉玲', 'new-taipei-city-council-current-councilors:current-councilor-618', 'new-taipei-city-council-current-councilors', '新北市議會：現任議員', 'https://www.ntp.gov.tw/councilor-detail?program=37&A=6&C=618', 'current-councilor-618', '新北市議員', '新北市第6選舉區（中和區）', '中山大學 公共事務管理碩士 東吳大學 企業管理系學士', 'official-profile:new-taipei-city-council-current-councilors:5f1cf544092c:efeaf1b6-46f1-4e18-b70e-5e58f119f7d5:education', '總統府秘書長/立法院長蘇嘉全辦公室主任 蔡英文總統競選總部 婦女部主任 行政院長/高雄市長謝長廷 秘書 民主進步黨 婦女部主任 新境界文教基金會 研究員 綠色和平電台 主持人
新北市第4屆議員', 'official-profile:new-taipei-city-council-current-councilors:5f1cf544092c:efeaf1b6-46f1-4e18-b70e-5e58f119f7d5:experience'),
    ('cec-2022-local-councilor-regional-person-9d31fa776bc6', '蘇泓欽', 'new-taipei-city-council-current-councilors:current-councilor-600', 'new-taipei-city-council-current-councilors', '新北市議會：現任議員', 'https://www.ntp.gov.tw/councilor-detail?program=37&A=8&C=600', 'current-councilor-600', '新北市議員', '新北市第8選舉區（土城區、樹林區、鶯歌區、三峽區）', '澳洲國立昆士蘭科技大學電腦通訊工程研究所碩士', 'official-profile:new-taipei-city-council-current-councilors:264e35c716fb:87781b95-e9f4-4a36-8077-df139eb7264c:education', '新北市第3屆議員 土地銀行總行資訊電腦工程師
新北市第4屆議員', 'official-profile:new-taipei-city-council-current-councilors:264e35c716fb:87781b95-e9f4-4a36-8077-df139eb7264c:experience'),
    ('cec-2022-local-councilor-regional-person-e56f3c3ff415', '王威元', 'new-taipei-city-council-current-councilors:current-councilor-592', 'new-taipei-city-council-current-councilors', '新北市議會：現任議員', 'https://www.ntp.gov.tw/councilor-detail?program=37&A=4&C=592', 'current-councilor-592', '新北市議員', '新北市第4選舉區（三重區、蘆洲區）', '國立台北科技大學經營管理所碩士 國立中興大學行銷系學士 台北市立明倫高中畢業 台北縣私立格致中學國中部畢業 台北縣立三重國小畢業', 'official-profile:new-taipei-city-council-current-councilors:d9f1ce88aa2b:41b4628e-a979-4e92-9d1e-f26dacddf00a:education', NULL, NULL),
    ('cec-2022-local-councilor-regional-person-f499db29aff3', '白珮茹', 'new-taipei-city-council-current-councilors:current-councilor-560', 'new-taipei-city-council-current-councilors', '新北市議會：現任議員', 'https://www.ntp.gov.tw/councilor-detail?program=37&A=11&C=560', 'current-councilor-560', '新北市議員', '新北市第11選舉區（汐止區、金山區、萬里區）', '政治大學行政管理碩士 實踐大學資訊管理學系 文德女中 誠正國中 北峰國小 南港國小', 'official-profile:new-taipei-city-council-current-councilors:134be1bed38e:bc670a37-1175-4d6a-853c-a1f430840455:education', NULL, NULL),
    ('cec-2022-local-councilor-regional-person-4d71b495a973', '周雅玲', 'new-taipei-city-council-current-councilors:current-councilor-520', 'new-taipei-city-council-current-councilors', '新北市議會：現任議員', 'https://www.ntp.gov.tw/councilor-detail?program=37&A=11&C=520', 'current-councilor-520', '新北市議員', '新北市第11選舉區（汐止區、金山區、萬里區）', '汐止國小 秀峰國中 育達商業職業學校 中華技術學院二專部', 'official-profile:new-taipei-city-council-current-councilors:7cd67055798c:447055bb-7efc-483a-95f5-a226eaae81c6:education', NULL, NULL),
    ('cec-2022-local-councilor-regional-person-f5f9654e4eb2', '劉哲彰', 'new-taipei-city-council-current-councilors:current-councilor-556', 'new-taipei-city-council-current-councilors', '新北市議會：現任議員', 'https://www.ntp.gov.tw/councilor-detail?program=37&A=9&C=556', 'current-councilor-556', '新北市議員', '新北市第9選舉區（新店區、深坑區、石碇區、坪林區、烏來區）', '美國阿肯色大學教育博士 美國匹茲堡州立大學人力資源發展碩士 美國匹茲堡州立大學企業管理學士 新北市及人中學', 'official-profile:new-taipei-city-council-current-councilors:0a79a5fe42de:63e51128-7f40-4131-859b-ac8bea108ce5:education', NULL, NULL),
    ('cec-2022-local-councilor-regional-person-4f768ab4117c', '王秀玉', 'kinmen-county-council-current-councilors:current-councilor-5669e13da359', 'kinmen-county-council-current-councilors', '金門縣議會：本屆縣議員', 'https://www.kmcc.gov.tw/8844/54357/55476/55522/', 'current-councilor-5669e13da359', '金門縣議員', '金門縣第二選區(金湖鎮、金沙鎮)', NULL, NULL, '一、金沙鎮民代表會第八屆、第九屆副主席
二、金沙鎮民代表會第十屆、第十一屆主席
三、金門縣新住民女性關懷協會理事長
四、金門縣婦女會第二十屆理事長
五、金門縣議會第七屆議員', 'official-profile:kinmen-county-council-current-councilors:b4d77438c7c6:3cd58010-24c3-40f1-89a9-7a6ce71b3183:experience');

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, normalized_role, district,
    normalized_region, external_record_id, source_payload, confidence_suggestion,
    ingest_batch_key, is_public, updated_at
)
SELECT
    profile.source_person_key,
    'official_officeholder',
    profile.source_id,
    profile.source_name,
    profile.source_url,
    profile.person_name,
    profile.person_name,
    profile.position,
    'councilor',
    profile.district,
    CASE
        WHEN profile.source_id LIKE 'new-taipei-%' THEN '新北市'
        WHEN profile.source_id LIKE 'kinmen-%' THEN '金門縣'
    END,
    profile.external_record_id,
    jsonb_strip_nulls(jsonb_build_object(
        'profileUrl', profile.source_url,
        'education', profile.education,
        'experience', profile.experience,
        'roleOrigin', 'elected',
        'elected', TRUE
    )),
    'A',
    'official-councilor-profile-gap-20260720-batch-7',
    TRUE,
    NOW()
FROM _current_councilor_official_profiles_batch_7 profile
ON CONFLICT (source_person_key) DO UPDATE SET
    source_id = EXCLUDED.source_id,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    position = EXCLUDED.position,
    normalized_role = EXCLUDED.normalized_role,
    district = EXCLUDED.district,
    normalized_region = EXCLUDED.normalized_region,
    external_record_id = EXCLUDED.external_record_id,
    source_payload = source_people.source_payload || EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH identity_rows AS (
    SELECT
        person.id AS person_id,
        source.id AS source_person_id,
        source.source_person_key
    FROM _current_councilor_official_profiles_batch_7 profile
    JOIN people person ON person.external_id = profile.person_external_id
    JOIN source_people source ON source.source_person_key = profile.source_person_key
)
INSERT INTO person_identity_matches (
    source_person_id, person_id, match_status, score, match_method, match_reason,
    evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    source_person_id,
    person_id,
    'auto_matched',
    100,
    'official_current_name_region_district',
    'Official current council profile matched by name, current council office, and region or electoral district.',
    jsonb_build_object('version', 'official-current-councilor-profiles-v7', 'sourcePersonKey', source_person_key),
    'system:official-current-councilor-profiles',
    NOW(),
    NOW()
FROM identity_rows
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at;

WITH claim_rows AS (
    SELECT
        person_external_id,
        source_person_key,
        education_claim_key AS claim_key,
        'education'::TEXT AS claim_type,
        education AS claim_value
    FROM _current_councilor_official_profiles_batch_7
    WHERE education IS NOT NULL
    UNION ALL
    SELECT
        person_external_id,
        source_person_key,
        experience_claim_key,
        'experience',
        experience
    FROM _current_councilor_official_profiles_batch_7
    WHERE experience IS NOT NULL
),
targets AS (
    SELECT
        claim.*,
        person.id AS person_id
    FROM claim_rows claim
    JOIN people person ON person.external_id = claim.person_external_id
)
INSERT INTO person_claims (
    claim_key, person_id, source_person_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, updated_at
)
SELECT
    targets.claim_key,
    targets.person_id,
    source.id,
    targets.claim_type,
    targets.claim_value,
    source.source_payload || jsonb_build_object('sourcePersonKey', source.source_person_key, 'field', targets.claim_type),
    'A',
    'verified',
    'public',
    source.source_name,
    source.source_url,
    TIMESTAMPTZ '2026-07-20 00:00:00+08',
    TRUE,
    100,
    'official-current-councilor-profiles-v7',
    jsonb_build_array('Official current council profile matched by name, current office, and region or electoral district.'),
    NOW(),
    NOW()
FROM targets
JOIN source_people source ON source.source_person_key = targets.source_person_key
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    source_person_id = EXCLUDED.source_person_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = EXCLUDED.updated_at;

REFRESH MATERIALIZED VIEW public_people_list_cached;
