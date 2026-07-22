CREATE TEMP TABLE _cec_historical_councilor_profiles_batch_9 (
    person_id UUID PRIMARY KEY,
    person_name TEXT NOT NULL,
    source_position TEXT NOT NULL,
    source_role TEXT NOT NULL,
    district TEXT NOT NULL,
    region TEXT NOT NULL,
    election_year INTEGER NOT NULL,
    election_date DATE NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    education TEXT,
    experience TEXT
) ON COMMIT DROP;

INSERT INTO _cec_historical_councilor_profiles_batch_9 VALUES
    ('fa867817-6653-4e35-878f-316a6a669203', '黃思婷', '嘉義市第2選舉區議員候選人', 'councilor', '嘉義市第2選舉區', '嘉義市', 2022, DATE '2022-11-26', 'cec-2022-chiayi-city-councilor-bulletin-district-2', '中央選舉委員會：2022年嘉義市議員選舉第2選舉區公報', 'https://web.cec.gov.tw/api/file/dbb86c94-7781-476e-9f36-2dc895918b3a.pdf', '長庚科技大學護理系；新生醫護管理專科學校護理科；成德中學；民富國小', '嘉義市第10屆市議員；臺北醫學大學管理學院生物科技高階管理碩士在職專班就讀；嘉義基督教醫院護理師；嘉義長庚醫院護理師'),
    ('3acc221e-2690-4137-96bd-8e910e59a559', '戴寧', '嘉義市第1選舉區議員候選人', 'councilor', '嘉義市第1選舉區', '嘉義市', 2022, DATE '2022-11-26', 'cec-2022-chiayi-city-councilor-bulletin-district-1', '中央選舉委員會：2022年嘉義市議員選舉第1選舉區公報', 'https://web.cec.gov.tw/api/file/4533e175-7290-480b-9b77-efe52ff1dda1.pdf', NULL, '嘉義市第8、9、10屆議員；嘉義市自行車委員會主任委員；嘉義市跆拳道委員會主任委員'),
    ('85c119ef-d20e-4137-8ccf-e3ec49e27e74', '吳政杰', '澎湖縣湖西鄉鄉長候選人', 'township_chief', '澎湖縣湖西鄉', '澎湖縣', 2018, DATE '2018-11-24', 'cec-2018-penghu-township-chief-bulletin', '中央選舉委員會：2018年澎湖縣鄉長選舉公報', 'https://web.cec.gov.tw/api/file/c18ab19f-15bf-454b-ae5c-ebdbbba1e042.pdf', '美國春田大學休閒管理碩士；輔仁大學體育系及日文輔系', '湖西鄉鄉長；澎湖縣議員；澎湖科技大學講師；日商桑裕運動俱樂部經理'),
    ('991feb32-f129-4442-b3ef-64621adb44df', '許月里', '澎湖縣西嶼鄉鄉長候選人', 'township_chief', '澎湖縣西嶼鄉', '澎湖縣', 2018, DATE '2018-11-24', 'cec-2018-penghu-township-chief-bulletin', '中央選舉委員會：2018年澎湖縣鄉長選舉公報', 'https://web.cec.gov.tw/api/file/c18ab19f-15bf-454b-ae5c-ebdbbba1e042.pdf', '國小畢業', '西嶼鄉第15、16屆鄉民代表；澎湖縣第15、16、17屆議員；西嶼鄉第17屆鄉長'),
    ('c143923f-cb44-4c9a-8e0c-dc855c7410d0', '簡嘉億', '嘉義縣民雄鄉第1選舉區鄉民代表候選人', 'township_representative', '嘉義縣民雄鄉第1選舉區', '嘉義縣', 2010, DATE '2010-06-12', 'cec-2010-chiayi-county-minxiong-representative-bulletin-district-1', '中央選舉委員會：2010年嘉義縣民雄鄉民代表選舉第1選舉區公報', 'https://web.cec.gov.tw/api/file/b6a207ba-0506-46b6-b2cd-54f092f38ba3.pdf', '國立嘉義大學畢業；國立中正大學政治研究所碩士學分班', '嘉義縣太保國中人事管理員；嘉義縣新港鄉公所人事室主任；嘉義縣梅山鄉公所人事室主任；嘉義縣政府人事室課長');

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, normalized_role, district,
    normalized_region, election_year, external_record_id, source_payload,
    confidence_suggestion, ingest_batch_key, is_public, updated_at
)
SELECT
    'official-election:' || profile.election_year || ':profile-gap:' || profile.person_id,
    'official_election',
    profile.source_id,
    profile.source_name,
    profile.source_url,
    profile.person_name,
    profile.person_name,
    profile.source_position,
    profile.source_role,
    profile.district,
    profile.region,
    profile.election_year,
    profile.election_year || '-cec-bulletin:' || profile.person_name,
    jsonb_strip_nulls(jsonb_build_object(
        'electionYear', profile.election_year,
        'electionDate', profile.election_date,
        'education', profile.education,
        'experience', profile.experience,
        'roleOrigin', 'candidate'
    )),
    'A',
    'official-councilor-profile-gap-20260722-batch-9',
    TRUE,
    NOW()
FROM _cec_historical_councilor_profiles_batch_9 profile
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
    FROM _cec_historical_councilor_profiles_batch_9 profile
    JOIN people person ON person.id = profile.person_id AND person.name = profile.person_name
    JOIN source_people source
      ON source.source_person_key = 'official-election:' || profile.election_year || ':profile-gap:' || profile.person_id
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
    'official_historical_election_identity',
    'CEC election bulletin matched to an existing canonical person using verified historical election identity.',
    jsonb_build_object('version', 'official-cec-historical-profile-gap-v9', 'sourcePersonKey', source_person_key),
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
    SELECT profile.person_id, profile.person_name, profile.election_year, profile.election_date,
        claims.claim_type, claims.claim_value
    FROM _cec_historical_councilor_profiles_batch_9 profile
    CROSS JOIN LATERAL (
        VALUES ('education', profile.education), ('experience', profile.experience)
    ) AS claims(claim_type, claim_value)
    WHERE NULLIF(BTRIM(claims.claim_value), '') IS NOT NULL
),
targets AS (
    SELECT claim.*,
        'official-election:' || claim.election_year || ':profile-gap:' || claim.person_id AS source_person_key
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
    targets.election_date::TIMESTAMPTZ,
    TRUE,
    100,
    'official-cec-historical-profile-gap-v9',
    jsonb_build_array('Official CEC election bulletin matched to a verified historical election identity.'),
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
