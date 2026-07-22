CREATE TEMP TABLE _current_councilor_cec_profiles_batch_3 (
    person_external_id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    election_source_id TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _current_councilor_cec_profiles_batch_3 VALUES
    ('cec-2022-local-councilor-mountain-indigenous-person-314605abb8a9', '馬見Lahuy．Ipin', '新北市第13區山地原住民議員', '新北市第13選舉區', 'cec-2022-new-taipei-city-councilor-candidates', DATE '1992-02-25', 'male'),
    ('votetw-person-f1888d1eed83e89d', '高忠德 Takiludun．Anu', '高雄市第14區山地原住民議員', '高雄市第14選舉區', 'cec-2022-kaohsiung-city-councilor-candidates', DATE '1972-02-18', 'male'),
    ('cec-2022-local-councilor-mountain-indigenous-person-b68ade476665', '張利惠', '屏東縣第9區山地原住民議員', '屏東縣第9選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1960-10-17', 'female'),
    ('cec-2022-local-councilor-regional-person-7e0f991e8d5f', '張嘉玲', '新北市第6區議員', '新北市第6選舉區', 'cec-2022-new-taipei-city-councilor-candidates', DATE '1975-10-31', 'female'),
    ('cec-2022-local-councilor-regional-person-9c23872ca20c', '張維心', '雲林縣第3區議員', '雲林縣第3選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1977-06-08', 'male'),
    ('cec-2022-local-councilor-regional-person-4ada0ec1087c', '張維崢', '雲林縣第1區議員', '雲林縣第1選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1968-02-16', 'male'),
    ('cec-2022-local-councilor-regional-person-2054dd40d7da', '許月里', '澎湖縣第4區議員', '澎湖縣第4選舉區', 'cec-2022-penghu-county-councilor-candidates', DATE '1953-10-04', 'female'),
    ('cec-2022-local-councilor-regional-person-3cd6e78c0552', '許更生', '桃園市第12區議員', '桃園市第12選舉區', 'cec-2022-taoyuan-city-councilor-candidates', DATE '1979-11-09', 'male'),
    ('cec-2022-local-councilor-regional-person-d5332d90859a', '許國政', '澎湖縣第1區議員', '澎湖縣第1選舉區', 'cec-2022-penghu-county-councilor-candidates', DATE '1965-03-21', 'male'),
    ('cec-2022-local-councilor-regional-person-9912e12f018c', '郭美秀', '基隆市第4區議員', '基隆市第4選舉區', 'cec-2022-keelung-city-councilor-candidates', DATE '1964-01-22', 'female'),
    ('cec-2022-local-councilor-regional-person-981efc1b120f', '陳永修', '雲林縣第1區議員', '雲林縣第1選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1982-05-20', 'male'),
    ('cec-2022-local-councilor-regional-person-df6b256b710f', '陳軍佐', '基隆市第2區議員', '基隆市第2選舉區', 'cec-2022-keelung-city-councilor-candidates', DATE '1979-06-17', 'male');

INSERT INTO source_people (
    source_person_key,
    source_type,
    source_id,
    source_name,
    source_url,
    raw_name,
    normalized_name,
    position,
    normalized_role,
    district,
    normalized_region,
    election_year,
    source_payload,
    confidence_suggestion,
    ingest_batch_key,
    is_public,
    updated_at
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
    'official-councilor-profile-gap-20260720-batch-3',
    TRUE,
    NOW()
FROM _current_councilor_cec_profiles_batch_3 profile
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
    FROM _current_councilor_cec_profiles_batch_3 profile
    JOIN people person ON person.external_id = profile.person_external_id
    JOIN source_people source
      ON source.source_person_key = 'official-election:2022:councilor-gap:' || profile.person_external_id
)
INSERT INTO person_identity_matches (
    source_person_id,
    person_id,
    match_status,
    score,
    match_method,
    match_reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    source_person_id,
    person_id,
    'auto_matched',
    100,
    'official_name_region_district',
    'CEC candidate data matched by name, county/city, electoral district, and 2022 election context.',
    jsonb_build_object(
        'version', 'official-councilor-profile-gap-v3',
        'sourcePersonKey', source_person_key
    ),
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
FROM _current_councilor_cec_profiles_batch_3 profile
WHERE person.external_id = profile.person_external_id;

WITH claim_rows AS (
    SELECT
        profile.person_external_id,
        claims.claim_type,
        claims.claim_value
    FROM _current_councilor_cec_profiles_batch_3 profile
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
    claim_key,
    person_id,
    source_person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_status,
    visibility,
    source_name,
    source_url,
    observed_at,
    is_public,
    review_score,
    scoring_version,
    scoring_reasons,
    auto_reviewed_at,
    updated_at
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
    'official-councilor-profile-gap-v3',
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
