CREATE TEMP TABLE _current_councilor_cec_profiles_batch_4 (
    person_external_id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    election_source_id TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _current_councilor_cec_profiles_batch_4 VALUES
    ('cec-2022-local-councilor-regional-person-16ca8a7aa4d2', '曾美露', '苗栗縣第1區議員', '苗栗縣第1選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1955-01-13', 'female'),
    ('cec-2022-local-councilor-regional-person-be577dc123dc', '曾博鴻', '雲林縣第1區議員', '雲林縣第1選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1980-10-20', 'male'),
    ('cec-2022-local-councilor-regional-person-d9676f4b4bb9', '温俊勇', '苗栗縣第5區議員', '苗栗縣第5選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1976-09-21', 'male'),
    ('cec-2022-local-councilor-regional-person-f182679159d4', '黃思婷', '嘉義市第2區議員', '嘉義市第2選舉區', 'cec-2022-chiayi-city-councilor-candidates', DATE '1987-12-30', 'female'),
    ('cec-2022-local-councilor-regional-person-f198d000e1e1', '黃盈裕', '屏東縣第5區議員', '屏東縣第5選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1978-08-17', 'male'),
    ('cec-2022-local-councilor-regional-person-7390dd477fba', '黃榮利', '嘉義縣第1區議員', '嘉義縣第1選舉區', 'cec-2022-chiayi-county-councilor-candidates', DATE '1955-01-04', 'male'),
    ('cec-2022-local-councilor-regional-person-9120161a79e3', '葉明博', '屏東縣第2區議員', '屏東縣第2選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1956-09-09', 'male'),
    ('cec-2022-local-councilor-mountain-indigenous-person-abfa415395d8', '劉美蘭 Iwan·Sigiy', '苗栗縣第8區山地原住民議員', '苗栗縣第8選舉區', 'cec-2022-miaoli-county-councilor-candidates', DATE '1962-10-23', 'female'),
    ('cec-2022-local-councilor-regional-person-871a85a33d07', '蔡永富', '雲林縣第5區議員', '雲林縣第5選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1967-01-26', 'male'),
    ('cec-2022-local-councilor-regional-person-6a38dd3441eb', '蔡咏鍀', '雲林縣第6區議員', '雲林縣第6選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1961-10-10', 'male'),
    ('cec-2022-local-councilor-regional-person-b0d07e202814', '蔡蕥鍹', '新竹縣第1區議員', '新竹縣第1選舉區', 'cec-2022-hsinchu-county-councilor-candidates', DATE '1978-01-09', 'female'),
    ('cec-2022-local-councilor-regional-person-e1854a04867f', '鄭玲惠', '雲林縣第4區議員', '雲林縣第4選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1961-10-17', 'female'),
    ('cec-2022-local-councilor-regional-person-2b133656407f', '簡嘉億', '嘉義縣第2區議員', '嘉義縣第2選舉區', 'cec-2022-chiayi-county-councilor-candidates', DATE '1975-01-06', 'male'),
    ('cec-2022-local-councilor-regional-person-c0f9c5934f85', '魏筠', '桃園市第7區議員', '桃園市第7選舉區', 'cec-2022-taoyuan-city-councilor-candidates', DATE '1980-01-10', 'female'),
    ('cec-2022-local-councilor-regional-person-9d31fa776bc6', '蘇泓欽', '新北市第8區議員', '新北市第8選舉區', 'cec-2022-new-taipei-city-councilor-candidates', DATE '1979-03-07', 'male'),
    ('cec-2022-local-councilor-regional-person-4652a0e21eec', '蘇國瓏', '雲林縣第5區議員', '雲林縣第5選舉區', 'cec-2022-yunlin-county-councilor-candidates', DATE '1972-08-12', 'male'),
    ('cec-2022-local-councilor-regional-person-96589a445c94', '蘇資婷', '屏東縣第1區議員', '屏東縣第1選舉區', 'cec-2022-pingtung-county-councilor-candidates', DATE '1976-08-31', 'female');

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
    'official-councilor-profile-gap-20260720-batch-4',
    TRUE,
    NOW()
FROM _current_councilor_cec_profiles_batch_4 profile
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
    FROM _current_councilor_cec_profiles_batch_4 profile
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
    jsonb_build_object('version', 'official-councilor-profile-gap-v4', 'sourcePersonKey', source_person_key),
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
FROM _current_councilor_cec_profiles_batch_4 profile
WHERE person.external_id = profile.person_external_id;

WITH claim_rows AS (
    SELECT
        profile.person_external_id,
        claims.claim_type,
        claims.claim_value
    FROM _current_councilor_cec_profiles_batch_4 profile
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
    'official-councilor-profile-gap-v4',
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

INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at
)
SELECT
    duplicate.id,
    canonical.id,
    'verified',
    'A',
    'The CEC 2022 record and official Miaoli County Council roster identify the same incumbent in the same indigenous council district.',
    jsonb_build_object(
        'version', 'official-councilor-profile-gap-v4',
        'sourceUrl', 'https://data.gov.tw/dataset/13119',
        'electionYear', 2022,
        'district', '苗栗縣第8選舉區'
    ),
    'system:official-councilor-profile-gap',
    NOW()
FROM people duplicate
JOIN people canonical
  ON canonical.external_id = 'official-current:miaoli-county-council-current-councilors:current-councilor-1c4b7124b8f0'
WHERE duplicate.external_id = 'votetw-person-1016e11c1bc56f9a'
  AND duplicate.id <> canonical.id
  AND NOT EXISTS (
      SELECT 1
      FROM person_merge_decisions existing
      WHERE existing.duplicate_person_id = duplicate.id
        AND existing.status IN ('suggested', 'verified')
  );

REFRESH MATERIALIZED VIEW public_people_list_cached;
