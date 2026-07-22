CREATE TEMP TABLE _miaoli_councilor_bulletin_profiles_batch_8 (
    person_id UUID PRIMARY KEY,
    person_name TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    education TEXT,
    experience TEXT
) ON COMMIT DROP;

INSERT INTO _miaoli_councilor_bulletin_profiles_batch_8 VALUES
    ('c7e5094c-011d-40da-982f-1edcd8bf7ed3', '温俊勇', '苗栗縣第5區議員', '苗栗縣第5選舉區', 'cec-2022-miaoli-county-councilor-bulletin-district-5', 'https://web.cec.gov.tw/api/file/d7c3c7c0-11e6-4ce3-aed7-5180e7bbdcf6.pdf', '頭份國民小學；興華國民中學；大成高級中學；親民技術學院附設專科進修學校企業管理科；中華大學工業管理學碩士', '現任頭份市民代表會主席；臺灣鄉鎮市民代表會聯合總會副總會長；第19屆頭份鎮民代表；第20屆頭份鎮民代表會主席；苗栗縣18鄉鎮市民代表聯誼會會長；頭份社區發展協會理事長；臉書社群「我是頭份人」創辦人'),
    ('e951290a-83c1-4c57-be66-656cc36cfe77', '陳永賢', '苗栗縣第5區議員', '苗栗縣第5選舉區', 'cec-2022-miaoli-county-councilor-bulletin-district-5', 'https://web.cec.gov.tw/api/file/d7c3c7c0-11e6-4ce3-aed7-5180e7bbdcf6.pdf', '國立花蓮高級工業職業學校建築科', NULL),
    ('4c9ec7d4-a77a-4db4-8df1-1d4db35143a1', '黃聲全', '苗栗縣第5區議員', '苗栗縣第5選舉區', 'cec-2022-miaoli-county-councilor-bulletin-district-5', 'https://web.cec.gov.tw/api/file/d7c3c7c0-11e6-4ce3-aed7-5180e7bbdcf6.pdf', '明新工專肄業', NULL),
    ('55f137c3-cac7-4d7c-b300-32060511e8b9', '楊文昌Baiho．Watan', '苗栗縣第7區平地原住民議員', '苗栗縣第7選舉區', 'cec-2022-miaoli-county-councilor-bulletin-district-7-8', 'https://web.cec.gov.tw/api/file/430dd1a5-aca9-4af1-8610-eb5c444eb1c6.pdf', NULL, '南庄鄉農會主任；苗栗縣議會第15、16、19屆議員'),
    ('ef667946-55fe-48e7-8cf0-bdb804bdd082', '劉美蘭', '苗栗縣第8區山地原住民議員', '苗栗縣第8選舉區', 'cec-2022-miaoli-county-councilor-bulletin-district-7-8', 'https://web.cec.gov.tw/api/file/430dd1a5-aca9-4af1-8610-eb5c444eb1c6.pdf', '南開工專畢業；苗栗國中畢業；大同國小畢業', '第17、18屆泰安鄉鄉長；中國國民黨鄉黨部主任委員；北泰雅鄉區聯誼會副會長；苗栗縣議員助理；苗栗國中家長會長；斯瓦細格教會長執；梅園、汶水國小職員');

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, normalized_role, district,
    normalized_region, election_year, external_record_id, source_payload,
    confidence_suggestion, ingest_batch_key, is_public, updated_at
)
SELECT
    'official-election:2022:miaoli-councilor-bulletin:' || profile.person_id,
    'official_election',
    profile.source_id,
    '中央選舉委員會：2022年苗栗縣議員選舉公報',
    profile.source_url,
    profile.person_name,
    profile.person_name,
    profile.position,
    'councilor',
    profile.district,
    '苗栗縣',
    2022,
    '2022-miaoli-councilor-bulletin:' || profile.person_name,
    jsonb_strip_nulls(jsonb_build_object(
        'electionYear', 2022,
        'electionDate', '2022-11-26',
        'education', profile.education,
        'experience', profile.experience,
        'roleOrigin', 'elected',
        'elected', TRUE
    )),
    'A',
    'official-councilor-profile-gap-20260720-batch-8',
    TRUE,
    NOW()
FROM _miaoli_councilor_bulletin_profiles_batch_8 profile
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
    external_record_id = EXCLUDED.external_record_id,
    source_payload = source_people.source_payload || EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH identity_rows AS (
    SELECT profile.person_id, source.id AS source_person_id, source.source_person_key
    FROM _miaoli_councilor_bulletin_profiles_batch_8 profile
    JOIN people person ON person.id = profile.person_id AND person.name = profile.person_name
    JOIN source_people source
      ON source.source_person_key = 'official-election:2022:miaoli-councilor-bulletin:' || profile.person_id
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
    'CEC election bulletin matched to an existing canonical person by name, county, district, and 2022 election context.',
    jsonb_build_object('version', 'official-miaoli-councilor-bulletin-v8', 'sourcePersonKey', source_person_key),
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

WITH claim_rows AS (
    SELECT profile.person_id, profile.person_name, claims.claim_type, claims.claim_value
    FROM _miaoli_councilor_bulletin_profiles_batch_8 profile
    CROSS JOIN LATERAL (
        VALUES ('education', profile.education), ('experience', profile.experience)
    ) AS claims(claim_type, claim_value)
    WHERE NULLIF(BTRIM(claims.claim_value), '') IS NOT NULL
),
targets AS (
    SELECT
        claim.*,
        'official-election:2022:miaoli-councilor-bulletin:' || claim.person_id AS source_person_key
    FROM claim_rows claim
    JOIN people person ON person.id = claim.person_id AND person.name = claim.person_name
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
    'official-miaoli-councilor-bulletin-v8',
    jsonb_build_array('Official CEC election bulletin matched by canonical person, name, county, electoral district, and election year.'),
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
