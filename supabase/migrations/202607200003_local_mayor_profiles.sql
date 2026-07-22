WITH profile_rows AS (
    SELECT *
    FROM (
        VALUES
            (
                'official-current:pingtung-city-mayor:chou-chia-chi',
                'pingtung-city-office-mayor-profile',
                '屏東市公所：關於市長',
                'https://www.ptcg.gov.tw/cp.aspx?n=BF0BA82BEF4EFECB',
                '周佳琪',
                '屏東縣屏東市市長',
                '屏東縣屏東市',
                DATE '2026-07-16',
                ARRAY['屏東大學高階經營管理碩士（研修）', '美國拉爾文大學碩士', '大仁科技大學學士']::TEXT[],
                ARRAY['屏東國際青年商會會長', '屏東青年創業協會副理事長', '正修科技大學兼任講師', '屏東縣婦女會理事長', '屏東縣2023年社會優秀青年']::TEXT[]
            ),
            (
                'official-current:yilan-city-mayor:chen-mei-ling',
                'yilan-city-office-mayor-profile',
                '宜蘭市公所：認識市長',
                'https://yilan.e-land.gov.tw/cp.aspx?n=18722',
                '陳美玲',
                '宜蘭縣宜蘭市市長',
                '宜蘭縣宜蘭市',
                DATE '2026-01-07',
                ARRAY['女子國小畢業', '復興國中畢業', '省立宜蘭高商畢業', '國立宜蘭大學推廣教育學分班', '國立空中大學公共行政系就讀中']::TEXT[],
                ARRAY['宜蘭市第15、16、17、18、19、20、21屆市民代表', '國防部福利總處宜蘭中心雇員', '陳姓宗親會宜蘭支分會監事', '復興國中教育基金會董事', '宜蘭市民眾服務站理事']::TEXT[]
            ),
            (
                'official-current:taitung-city-mayor:chen-ming-feng',
                'taitung-city-office-mayor-profile',
                '臺東市公所：市長專欄',
                'https://www.taitungcity.gov.tw/article/%E6%A9%9F%E9%97%9C%E4%BB%8B%E7%B4%B9',
                '陳銘風',
                '臺東縣臺東市市長',
                '臺東縣臺東市',
                DATE '2026-07-20',
                ARRAY['國立臺灣科技大學營造工程碩士', '公東高工', '寶桑國中', '仁愛國小']::TEXT[],
                ARRAY['臺東縣議員', '臺東市市民代表', '臺東縣體育會理事長', '中華民國鐵人三項協會副理事長', '臺東縣鐵人三項委員會主任委員', '臺東扶輪社副社長']::TEXT[]
            )
    ) AS rows(
        source_person_key,
        source_id,
        source_name,
        source_url,
        person_name,
        position,
        district,
        observed_date,
        education,
        experience
    )
)
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
    source_payload,
    confidence_suggestion,
    ingest_batch_key,
    is_public,
    updated_at
)
SELECT
    source_person_key,
    'official_officeholder',
    source_id,
    source_name,
    source_url,
    person_name,
    person_name,
    position,
    'local_chief',
    district,
    district,
    jsonb_build_object(
        'isCurrent', TRUE,
        'observedDate', observed_date,
        'education', to_jsonb(education),
        'experience', to_jsonb(experience)
    ),
    'A',
    'official-profile-gap-20260720',
    TRUE,
    NOW()
FROM profile_rows
ON CONFLICT (source_person_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    position = EXCLUDED.position,
    normalized_role = EXCLUDED.normalized_role,
    district = EXCLUDED.district,
    normalized_region = EXCLUDED.normalized_region,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH election_rows AS (
    SELECT *
    FROM (
        VALUES
            (
                'official-election:2022-pingtung-city-mayor:chou-chia-chi',
                'cec-2022-pingtung-local-election-winners',
                '屏東縣選舉委員會：2022年鄉鎮市長選舉當選人名單',
                'https://web.cec.gov.tw/api/file/ebeea52b-01c5-45a3-b3d4-61860c2e3a4a.pdf',
                '周佳琪',
                '屏東縣屏東市市長選舉',
                '屏東縣屏東市市長選舉',
                '屏東縣屏東市',
                DATE '1983-01-05',
                'female',
                DATE '2022-12-02'
            ),
            (
                'official-election:2022-nantou-city-mayor:chang-chia-che',
                'cec-2022-nantou-local-election-winners',
                '南投縣選舉委員會：2022年鄉鎮市長選舉當選人名單',
                'https://web.cec.gov.tw/api/file/43a4d4e3-0787-4b3c-8cd7-ac25b44e09ca.pdf',
                '張嘉哲',
                '南投縣南投市市長選舉',
                '南投縣南投市市長選舉',
                '南投縣南投市',
                DATE '1981-11-26',
                'male',
                DATE '2022-12-02'
            ),
            (
                'official-election:2014-yilan-city-representative:chen-mei-ling',
                'cec-2014-yilan-local-election-registration',
                '宜蘭縣選舉委員會：2014年地方公職人員選舉候選人資料',
                'https://web.cec.gov.tw/api/file/91ffb18e-2950-4c2c-ab5e-5e7fbbf0e105.pdf',
                '陳美玲',
                '宜蘭縣宜蘭市第1選舉區市民代表選舉',
                '宜蘭縣宜蘭市市長選舉',
                '宜蘭縣宜蘭市',
                DATE '1965-01-28',
                'female',
                DATE '2014-09-04'
            ),
            (
                'official-election:2022-taitung-city-mayor:chen-ming-feng',
                'cec-2022-taitung-local-election-winners',
                '臺東縣選舉委員會：2022年鄉鎮市長選舉當選人名單',
                'https://web.cec.gov.tw/api/file/dbe199b0-b035-425b-a152-e099e305de5d.pdf',
                '陳銘風',
                '臺東縣臺東市市長選舉',
                '臺東縣臺東市市長選舉',
                '臺東縣臺東市',
                DATE '1964-01-10',
                'male',
                DATE '2022-12-02'
            )
    ) AS rows(
        source_person_key,
        source_id,
        source_name,
        source_url,
        person_name,
        source_race_title,
        target_race_title,
        district,
        birth_date,
        gender,
        observed_date
    )
)
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
    source_payload,
    confidence_suggestion,
    ingest_batch_key,
    is_public,
    updated_at
)
SELECT
    source_person_key,
    'official_election',
    source_id,
    source_name,
    source_url,
    person_name,
    person_name,
    REPLACE(source_race_title, '選舉', ''),
    'local_chief',
    district,
    district,
    jsonb_build_object(
        'electionYear', CASE WHEN source_id LIKE '%2014%' THEN 2014 ELSE 2022 END,
        'raceTitle', source_race_title,
        'matchedCurrentRaceTitle', target_race_title,
        'birthDate', birth_date,
        'gender', gender,
        'observedDate', observed_date
    ),
    'A',
    'official-profile-gap-20260720',
    TRUE,
    NOW()
FROM election_rows
ON CONFLICT (source_person_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    position = EXCLUDED.position,
    normalized_role = EXCLUDED.normalized_role,
    district = EXCLUDED.district,
    normalized_region = EXCLUDED.normalized_region,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH source_targets AS (
    SELECT *
    FROM (
        VALUES
            ('official-current:pingtung-city-mayor:chou-chia-chi', '周佳琪', '屏東縣屏東市市長選舉'),
            ('official-election:2022-pingtung-city-mayor:chou-chia-chi', '周佳琪', '屏東縣屏東市市長選舉'),
            ('official-election:2022-nantou-city-mayor:chang-chia-che', '張嘉哲', '南投縣南投市市長選舉'),
            ('official-current:yilan-city-mayor:chen-mei-ling', '陳美玲', '宜蘭縣宜蘭市市長選舉'),
            ('official-election:2014-yilan-city-representative:chen-mei-ling', '陳美玲', '宜蘭縣宜蘭市市長選舉'),
            ('official-current:taitung-city-mayor:chen-ming-feng', '陳銘風', '臺東縣臺東市市長選舉'),
            ('official-election:2022-taitung-city-mayor:chen-ming-feng', '陳銘風', '臺東縣臺東市市長選舉')
    ) AS rows(source_person_key, person_name, race_title)
),
targets AS (
    SELECT DISTINCT
        source_targets.source_person_key,
        source_targets.race_title,
        candidates.person_id
    FROM source_targets
    JOIN public_candidates candidates
      ON candidates.person_name = source_targets.person_name
     AND candidates.race_title = source_targets.race_title
     AND candidates.election_year = 2022
     AND (candidates.is_elected = TRUE OR candidates.registration_status = 'elected')
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
    source.id,
    targets.person_id,
    'auto_matched',
    100,
    'official_name_office_election',
    'Official government profile or election record matched to the elected 2022 mayor candidate.',
    jsonb_build_object(
        'version', 'official-name-office-election-v1',
        'electionYear', 2022,
        'raceTitle', targets.race_title
    ),
    'system:official-profile-gap',
    NOW(),
    NOW()
FROM targets
JOIN source_people source
  ON source.source_person_key = targets.source_person_key
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at;

WITH profile_rows AS (
    SELECT *
    FROM (
        VALUES
            ('周佳琪', '屏東縣屏東市市長選舉', '屏東大學高階經營管理碩士（研修）；美國拉爾文大學碩士；大仁科技大學學士', '屏東國際青年商會會長；屏東青年創業協會副理事長；正修科技大學兼任講師；屏東縣婦女會理事長；屏東縣2023年社會優秀青年', 'https://www.ptcg.gov.tw/cp.aspx?n=BF0BA82BEF4EFECB'),
            ('陳美玲', '宜蘭縣宜蘭市市長選舉', '女子國小畢業；復興國中畢業；省立宜蘭高商畢業；國立宜蘭大學推廣教育學分班；國立空中大學公共行政系就讀中', '宜蘭市第15、16、17、18、19、20、21屆市民代表；國防部福利總處宜蘭中心雇員；陳姓宗親會宜蘭支分會監事；復興國中教育基金會董事；宜蘭市民眾服務站理事', 'https://yilan.e-land.gov.tw/cp.aspx?n=18722'),
            ('陳銘風', '臺東縣臺東市市長選舉', '國立臺灣科技大學營造工程碩士；公東高工；寶桑國中；仁愛國小', '臺東縣議員；臺東市市民代表；臺東縣體育會理事長；中華民國鐵人三項協會副理事長；臺東縣鐵人三項委員會主任委員；臺東扶輪社副社長', 'https://www.taitungcity.gov.tw/article/%E6%A9%9F%E9%97%9C%E4%BB%8B%E7%B4%B9')
    ) AS rows(person_name, race_title, education, experience, source_url)
),
targets AS (
    SELECT DISTINCT
        profile_rows.*,
        candidates.person_id
    FROM profile_rows
    JOIN public_candidates candidates
      ON candidates.person_name = profile_rows.person_name
     AND candidates.race_title = profile_rows.race_title
     AND candidates.election_year = 2022
     AND (candidates.is_elected = TRUE OR candidates.registration_status = 'elected')
)
UPDATE people person
SET
    education = targets.education,
    experience = targets.experience,
    source_url = targets.source_url,
    updated_at = NOW()
FROM targets
WHERE person.id = targets.person_id
  AND (
      NULLIF(BTRIM(person.education), '') IS NULL
      OR NULLIF(BTRIM(person.experience), '') IS NULL
  );

WITH gender_rows AS (
    SELECT *
    FROM (
        VALUES
            ('周佳琪', '屏東縣屏東市市長選舉', 'female'),
            ('張嘉哲', '南投縣南投市市長選舉', 'male'),
            ('陳美玲', '宜蘭縣宜蘭市市長選舉', 'female'),
            ('陳銘風', '臺東縣臺東市市長選舉', 'male')
    ) AS rows(person_name, race_title, gender)
),
targets AS (
    SELECT DISTINCT gender_rows.gender, candidates.person_id
    FROM gender_rows
    JOIN public_candidates candidates
      ON candidates.person_name = gender_rows.person_name
     AND candidates.race_title = gender_rows.race_title
     AND candidates.election_year = 2022
     AND (candidates.is_elected = TRUE OR candidates.registration_status = 'elected')
)
UPDATE people person
SET
    gender = targets.gender,
    updated_at = NOW()
FROM targets
WHERE person.id = targets.person_id
  AND (NULLIF(BTRIM(person.gender), '') IS NULL OR person.gender = 'unknown');

WITH profile_claims AS (
    SELECT *
    FROM (
        VALUES
            ('official-current:pingtung-city-mayor:chou-chia-chi', '周佳琪', '屏東縣屏東市市長選舉', 'education', '屏東大學高階經營管理碩士（研修）；美國拉爾文大學碩士；大仁科技大學學士', TIMESTAMPTZ '2026-07-16 00:00:00+08'),
            ('official-current:pingtung-city-mayor:chou-chia-chi', '周佳琪', '屏東縣屏東市市長選舉', 'experience', '屏東國際青年商會會長；屏東青年創業協會副理事長；正修科技大學兼任講師；屏東縣婦女會理事長；屏東縣2023年社會優秀青年', TIMESTAMPTZ '2026-07-16 00:00:00+08'),
            ('official-current:yilan-city-mayor:chen-mei-ling', '陳美玲', '宜蘭縣宜蘭市市長選舉', 'education', '女子國小畢業；復興國中畢業；省立宜蘭高商畢業；國立宜蘭大學推廣教育學分班；國立空中大學公共行政系就讀中', TIMESTAMPTZ '2026-01-07 00:00:00+08'),
            ('official-current:yilan-city-mayor:chen-mei-ling', '陳美玲', '宜蘭縣宜蘭市市長選舉', 'experience', '宜蘭市第15、16、17、18、19、20、21屆市民代表；國防部福利總處宜蘭中心雇員；陳姓宗親會宜蘭支分會監事；復興國中教育基金會董事；宜蘭市民眾服務站理事', TIMESTAMPTZ '2026-01-07 00:00:00+08'),
            ('official-current:taitung-city-mayor:chen-ming-feng', '陳銘風', '臺東縣臺東市市長選舉', 'education', '國立臺灣科技大學營造工程碩士；公東高工；寶桑國中；仁愛國小', TIMESTAMPTZ '2026-07-20 00:00:00+08'),
            ('official-current:taitung-city-mayor:chen-ming-feng', '陳銘風', '臺東縣臺東市市長選舉', 'experience', '臺東縣議員；臺東市市民代表；臺東縣體育會理事長；中華民國鐵人三項協會副理事長；臺東縣鐵人三項委員會主任委員；臺東扶輪社副社長', TIMESTAMPTZ '2026-07-20 00:00:00+08')
    ) AS rows(source_person_key, person_name, race_title, claim_type, claim_value, observed_at)
),
targets AS (
    SELECT DISTINCT profile_claims.*, candidates.person_id
    FROM profile_claims
    JOIN public_candidates candidates
      ON candidates.person_name = profile_claims.person_name
     AND candidates.race_title = profile_claims.race_title
     AND candidates.election_year = 2022
     AND (candidates.is_elected = TRUE OR candidates.registration_status = 'elected')
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
    targets.observed_at,
    TRUE,
    100,
    'official-profile-gap-v1',
    jsonb_build_array('Official current mayor profile'),
    NOW(),
    NOW()
FROM targets
JOIN source_people source
  ON source.source_person_key = targets.source_person_key
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

WITH election_claims AS (
    SELECT *
    FROM (
        VALUES
            ('official-election:2022-pingtung-city-mayor:chou-chia-chi', '周佳琪', '屏東縣屏東市市長選舉', 'birth_date', '1983-01-05', TIMESTAMPTZ '2022-12-02 00:00:00+08'),
            ('official-election:2022-pingtung-city-mayor:chou-chia-chi', '周佳琪', '屏東縣屏東市市長選舉', 'gender', 'female', TIMESTAMPTZ '2022-12-02 00:00:00+08'),
            ('official-election:2022-nantou-city-mayor:chang-chia-che', '張嘉哲', '南投縣南投市市長選舉', 'birth_date', '1981-11-26', TIMESTAMPTZ '2022-12-02 00:00:00+08'),
            ('official-election:2022-nantou-city-mayor:chang-chia-che', '張嘉哲', '南投縣南投市市長選舉', 'gender', 'male', TIMESTAMPTZ '2022-12-02 00:00:00+08'),
            ('official-election:2014-yilan-city-representative:chen-mei-ling', '陳美玲', '宜蘭縣宜蘭市市長選舉', 'birth_date', '1965-01-28', TIMESTAMPTZ '2014-09-04 00:00:00+08'),
            ('official-election:2014-yilan-city-representative:chen-mei-ling', '陳美玲', '宜蘭縣宜蘭市市長選舉', 'gender', 'female', TIMESTAMPTZ '2014-09-04 00:00:00+08'),
            ('official-election:2022-taitung-city-mayor:chen-ming-feng', '陳銘風', '臺東縣臺東市市長選舉', 'birth_date', '1964-01-10', TIMESTAMPTZ '2022-12-02 00:00:00+08'),
            ('official-election:2022-taitung-city-mayor:chen-ming-feng', '陳銘風', '臺東縣臺東市市長選舉', 'gender', 'male', TIMESTAMPTZ '2022-12-02 00:00:00+08')
    ) AS rows(source_person_key, person_name, race_title, claim_type, claim_value, observed_at)
),
targets AS (
    SELECT DISTINCT election_claims.*, candidates.person_id
    FROM election_claims
    JOIN public_candidates candidates
      ON candidates.person_name = election_claims.person_name
     AND candidates.race_title = election_claims.race_title
     AND candidates.election_year = 2022
     AND (candidates.is_elected = TRUE OR candidates.registration_status = 'elected')
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
    targets.observed_at,
    TRUE,
    100,
    'official-election-result-v1',
    jsonb_build_array('Official election commission record'),
    NOW(),
    NOW()
FROM targets
JOIN source_people source
  ON source.source_person_key = targets.source_person_key
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
