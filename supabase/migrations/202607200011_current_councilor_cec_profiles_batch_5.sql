CREATE TEMP TABLE _current_councilor_cec_profiles_batch_5 (
    person_external_id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    election_source_id TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _current_councilor_cec_profiles_batch_5 VALUES
    ('cec-2022-local-councilor-regional-person-4f768ab4117c', '王秀玉', '金門縣第2區議員', '金門縣第2選舉區', 'cec-2022-kinmen-county-councilor-candidates', DATE '1968-02-14', 'female'),
    ('cec-2022-local-councilor-regional-person-47f9c919309b', '吳旭智', '新竹縣第1區議員', '新竹縣第1選舉區', 'cec-2022-hsinchu-county-councilor-candidates', DATE '1976-01-01', 'male'),
    ('cec-2022-local-councilor-regional-person-02c745f0e2eb', '吳國寶', '新竹市第5區議員', '新竹市第5選舉區', 'cec-2022-hsinchu-city-councilor-candidates', DATE '1970-02-06', 'male'),
    ('cec-2022-local-councilor-regional-person-4ba61771f88f', '周玉滿', '苗栗縣第3區議員', '苗栗縣第3選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1962-10-20', 'female'),
    ('cec-2022-local-councilor-regional-person-7567eba5d616', '林文彬', '雲林縣第3區議員', '雲林縣第3選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1956-12-14', 'male'),
    ('cec-2018-local-councilor-person-plain-indigenous-68000-13-20131', '林志強', '桃園市第13區平地原住民議員', '桃園市第13選舉區', 'cec-2022-taoyuan-city-councilor-candidates', DATE '1974-10-28', 'male'),
    ('cec-2022-local-councilor-regional-person-db956ee2277f', '林彥甫', '新竹市第4區議員', '新竹市第4選舉區', 'cec-2022-hsinchu-city-councilor-candidates', DATE '1989-11-28', 'male'),
    ('cec-2022-local-councilor-regional-person-53e81ae06a73', '林碩彥', '新竹縣第1區議員', '新竹縣第1選舉區', 'cec-2022-hsinchu-county-councilor-candidates', DATE '1976-01-23', 'male'),
    ('cec-2022-local-councilor-regional-person-9c4636dc070d', '邱素梅', '宜蘭縣第8區議員', '宜蘭縣第8選舉區', 'cec-2022-yilan-county-councilor-candidates', DATE '1965-02-17', 'female'),
    ('cec-2018-local-councilor-person-mountain-indigenous-64000-15-20148', '范織欽 Pasulang．Tomatalate', '高雄市第15區山地原住民議員', '高雄市第15選舉區', 'cec-2022-kaohsiung-city-councilor-candidates', DATE '1957-07-29', 'male'),
    ('cec-2022-local-councilor-regional-person-5b9c41eab7aa', '徐景文', '桃園市第7區議員', '桃園市第7選舉區', 'cec-2022-taoyuan-city-councilor-candidates', DATE '1962-06-24', 'male'),
    ('cec-2022-local-councilor-regional-person-3c9572c4c8c0', '張庭綺', '雲林縣第2區議員', '雲林縣第2選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1980-08-07', 'female'),
    ('cec-2022-local-councilor-regional-person-632c9fa4fa9a', '張榮志', '屏東縣第6區議員', '屏東縣第6選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1959-09-09', 'male'),
    ('cec-2022-local-councilor-regional-person-2d9059f5a915', '陳永賢', '苗栗縣第5區議員', '苗栗縣第5選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1956-07-26', 'male'),
    ('cec-2022-local-councilor-regional-person-6b6f4c37e986', '陳志成', '屏東縣第3區議員', '屏東縣第3選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1963-10-07', 'male'),
    ('cec-2022-local-councilor-regional-person-f6a4be628144', '陳建名', '新竹市第3區議員', '新竹市第3選舉區', 'cec-2022-hsinchu-city-councilor-candidates', DATE '1985-07-20', 'male'),
    ('cec-2022-local-councilor-regional-person-59153d7cdc6d', '陳揚', '屏東縣第1區議員', '屏東縣第1選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1988-07-18', 'male'),
    ('cec-2022-local-councilor-regional-person-a3b928ed1b6c', '黃文政', '新竹市第1區議員', '新竹市第1選舉區', 'cec-2022-hsinchu-city-councilor-candidates', DATE '1970-09-04', 'male'),
    ('cec-2022-local-councilor-regional-person-5b01b16fc086', '黃聲全', '苗栗縣第5區議員', '苗栗縣第5選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1952-07-11', 'male'),
    ('cec-2018-local-councilor-person-plain-indigenous-10005-07-23509', '楊文昌Baiho．Watan', '苗栗縣第7區平地原住民議員', '苗栗縣第7選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1960-05-15', 'male'),
    ('cec-2022-local-councilor-plain-indigenous-person-194a03949a7c', '楊進福', '桃園市第13區平地原住民議員', '桃園市第13選舉區', 'cec-2022-taoyuan-city-councilor-candidates', DATE '1957-01-01', 'male'),
    ('cec-2022-local-councilor-regional-person-3743bda0091c', '戴寧', '嘉義市第1區議員', '嘉義市第1選舉區', 'cec-2022-chiayi-city-councilor-candidates', DATE '1982-02-23', 'female'),
    ('cec-2018-local-councilor-person-mountain-indigenous-68000-14-20168', '簡志偉', '桃園市第14區山地原住民議員', '桃園市第14選舉區', 'cec-2022-taoyuan-city-councilor-candidates', DATE '1978-06-17', 'male'),
    ('cec-2022-local-councilor-regional-person-4e1d9b131fb5', '顏忠義', '雲林縣第2區議員', '雲林縣第2選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1972-01-14', 'male'),
    ('cec-2022-local-councilor-regional-person-4253adb3bc72', '王姷力', '臺東縣第6區議員', '臺東縣第6選舉區', 'cec-2022-taitung-county-councilor-candidates', DATE '1969-09-24', 'female'),
    ('cec-2022-local-councilor-regional-person-845d41e6d863', '王啓澧', '嘉義縣第1區議員', '嘉義縣第1選舉區', 'cec-2022-chiayi-county-councilor-candidates', DATE '1964-11-04', 'male'),
    ('cec-2022-local-councilor-regional-person-c857408f0c01', '吳振嘉', '臺中市第14區議員', '臺中市第14選舉區', 'cec-2022-taichung-city-councilor-candidates', DATE '1970-08-29', 'male'),
    ('cec-2022-local-councilor-regional-person-f4066484bf33', '吳瑞芳', '南投縣第4區議員', '南投縣第4選舉區', 'cec-2022-nantou-county-councilor-candidates', DATE '1957-01-08', 'female'),
    ('cec-2022-local-councilor-regional-person-336dc2f0088c', '宋懷琳', '南投縣第1區議員', '南投縣第1選舉區', 'cec-2022-nantou-county-councilor-candidates', DATE '1955-11-04', 'female'),
    ('cec-2022-local-councilor-regional-person-d802579bbcc3', '李中', '臺中市第11區議員', '臺中市第11選舉區', 'cec-2022-taichung-city-councilor-candidates', DATE '1959-07-20', 'male'),
    ('cec-2022-local-councilor-regional-person-cd7761f75c7a', '李文俊', '臺南市第5區議員', '臺南市第5選舉區', 'cec-2022-tainan-city-councilor-candidates', DATE '1959-01-09', 'male'),
    ('cec-2022-local-councilor-regional-person-04fd0cce63fb', '李雨庭', '高雄市第11區議員', '高雄市第11選舉區', 'cec-2022-kaohsiung-city-councilor-candidates', DATE '1973-09-30', 'female'),
    ('cec-2018-local-councilor-person-plain-indigenous-10015-06-23550', '林正福', '花蓮縣第6區平地原住民議員', '花蓮縣第6選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1965-03-02', 'male'),
    ('cec-2022-local-councilor-plain-indigenous-person-4b245766e603', '林玉芬', '花蓮縣第7區平地原住民議員', '花蓮縣第7選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1966-01-12', 'female'),
    ('cec-2022-local-councilor-regional-person-1869943d3bfd', '林志展', '臺南市第5區議員', '臺南市第5選舉區', 'cec-2022-tainan-city-councilor-candidates', DATE '1965-11-28', 'male'),
    ('cec-2018-local-councilor-person-plain-indigenous-10014-07-23531', '林琮翰', '臺東縣第7區平地原住民議員', '臺東縣第7選舉區', 'cec-2022-taitung-county-councilor-candidates', DATE '1969-07-19', 'male'),
    ('cec-2022-local-councilor-mountain-indigenous-person-963e76d68843', '金淑敏', '花蓮縣第10區山地原住民議員', '花蓮縣第10選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1964-02-07', 'female'),
    ('cec-2022-local-councilor-regional-person-a932da8696d3', '胡仁順', '花蓮縣第1區議員', '花蓮縣第1選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1983-12-28', 'male'),
    ('cec-2022-local-councilor-regional-person-67a9bebbfdaf', '張國洲', '臺東縣第1區議員', '臺東縣第1選舉區', 'cec-2022-taitung-county-councilor-candidates', DATE '1957-07-26', 'male'),
    ('cec-2022-local-councilor-regional-person-6854ef0b9813', '陳文忠', '嘉義縣第2區議員', '嘉義縣第2選舉區', 'cec-2022-chiayi-county-councilor-candidates', DATE '1964-11-02', 'male'),
    ('cec-2022-local-councilor-regional-person-a3ff1802db0e', '陳文昌', '宜蘭縣第9區議員', '宜蘭縣第9選舉區', 'cec-2022-yilan-county-councilor-candidates', DATE '1953-09-01', 'male'),
    ('cec-2022-local-councilor-regional-person-291ff2994aff', '陳明達', '屏東縣第2區議員', '屏東縣第2選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1963-02-08', 'male'),
    ('cec-2022-local-councilor-regional-person-cf27034c59d5', '陳淑惠', '南投縣第3區議員', '南投縣第3選舉區', 'cec-2022-nantou-county-councilor-candidates', DATE '1957-12-25', 'female'),
    ('cec-2022-local-councilor-regional-person-4a6d241b5561', '陳碧華', '苗栗縣第4區議員', '苗栗縣第4選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1954-05-18', 'female'),
    ('cec-2022-local-councilor-mountain-indigenous-person-e022e42ef535', '程美蓮', '花蓮縣第8區山地原住民議員', '花蓮縣第8選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1968-11-14', 'female'),
    ('cec-2022-local-councilor-plain-indigenous-person-ffdbb9684d73', '楊春妹', '新北市第12區平地原住民議員', '新北市第12選舉區', 'cec-2022-new-taipei-city-councilor-candidates', DATE '1961-02-19', 'female'),
    ('cec-2022-local-councilor-regional-person-242a9666c9b8', '詹金富', '花蓮縣第4區議員', '花蓮縣第4選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1961-02-25', 'male'),
    ('cec-2022-local-councilor-regional-person-5c415b8bb8c7', '蔡東富', '雲林縣第2區議員', '雲林縣第2選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1959-05-13', 'male'),
    ('cec-2022-local-councilor-regional-person-4acd0e8bfa46', '鄭乾龍', '花蓮縣第3區議員', '花蓮縣第3選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1964-10-24', 'male'),
    ('cec-2022-local-councilor-regional-person-8332369bb2a9', '韓林梅', '花蓮縣第1區議員', '花蓮縣第1選舉區', 'cec-2022-hualien-county-councilor-candidates', DATE '1965-02-08', 'female'),
    ('cec-2022-local-councilor-plain-indigenous-person-3d1508f55481', '蘇錦雄Paylang．Caya', '新北市第12區平地原住民議員', '新北市第12選舉區', 'cec-2022-new-taipei-city-councilor-candidates', DATE '1964-02-22', 'male');

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, normalized_role, district,
    normalized_region, election_year, source_payload, confidence_suggestion,
    ingest_batch_key, is_public, updated_at
)
SELECT
    'official-election:2022:councilor-gap:' || profile.person_external_id,
    'official_election',
    profile.election_source_id,
    '中央選舉委員會：2022年直轄市及縣市議員候選人資料',
    'https://data.gov.tw/dataset/13119',
    profile.person_name,
    profile.person_name,
    profile.position,
    'councilor',
    profile.district,
    split_part(profile.district, '第', 1),
    2022,
    jsonb_build_object(
        'electionYear', 2022,
        'electionDate', '2022-11-26',
        'birthDate', profile.birth_date,
        'gender', profile.gender
    ),
    'A',
    'official-councilor-profile-gap-20260720-batch-5',
    TRUE,
    NOW()
FROM _current_councilor_cec_profiles_batch_5 profile
ON CONFLICT (source_person_key) DO UPDATE SET
    source_id = EXCLUDED.source_id,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    position = EXCLUDED.position,
    district = EXCLUDED.district,
    normalized_region = EXCLUDED.normalized_region,
    election_year = EXCLUDED.election_year,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH identity_rows AS (
    SELECT
        person.id AS person_id,
        source.id AS source_person_id,
        source.source_person_key
    FROM _current_councilor_cec_profiles_batch_5 profile
    JOIN people person ON person.external_id = profile.person_external_id
    JOIN source_people source
      ON source.source_person_key = 'official-election:2022:councilor-gap:' || profile.person_external_id
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
    'official_name_region_district',
    'CEC candidate data matched by name, county/city, electoral district, and 2022 election context.',
    jsonb_build_object('version', 'official-councilor-profile-gap-v5', 'sourcePersonKey', source_person_key),
    'system:official-councilor-profile-gap',
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

UPDATE people person
SET
    gender = CASE
        WHEN NULLIF(BTRIM(person.gender), '') IS NULL OR person.gender = 'unknown' THEN profile.gender
        ELSE person.gender
    END,
    updated_at = NOW()
FROM _current_councilor_cec_profiles_batch_5 profile
WHERE person.external_id = profile.person_external_id;

WITH claim_rows AS (
    SELECT
        profile.person_external_id,
        claims.claim_type,
        claims.claim_value
    FROM _current_councilor_cec_profiles_batch_5 profile
    CROSS JOIN LATERAL (
        VALUES
            ('birth_date', TO_CHAR(profile.birth_date, 'YYYY-MM-DD')),
            ('gender', profile.gender)
    ) AS claims(claim_type, claim_value)
),
targets AS (
    SELECT
        claim.*,
        person.id AS person_id,
        'official-election:2022:councilor-gap:' || claim.person_external_id AS source_person_key
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
    source.source_person_key || ':' || targets.claim_type,
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
    TIMESTAMPTZ '2022-11-26 00:00:00+08',
    TRUE,
    100,
    'official-councilor-profile-gap-v5',
    jsonb_build_array('Official CEC election dataset matched by name, county/city, electoral district, and election year.'),
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
