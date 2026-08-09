CREATE TEMP TABLE _current_councilor_profiles_batch_2 (
    person_external_id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    profile_source_id TEXT NOT NULL,
    profile_source_name TEXT NOT NULL,
    profile_source_url TEXT NOT NULL,
    election_source_id TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender TEXT NOT NULL,
    education TEXT,
    experience TEXT
) ON COMMIT DROP;

INSERT INTO _current_councilor_profiles_batch_2 VALUES
    (
        'cec-2022-local-councilor-regional-person-6f91c9f4cc23',
        '吳進昌',
        '桃園市第12區議員',
        '桃園市第12選舉區',
        'tycc-current-councilor-wu-chin-chang',
        '桃園市議會：第3屆議員吳進昌',
        'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=1025',
        'cec-2022-taoyuan-city-councilor-candidates',
        DATE '1965-04-20',
        'male',
        '桃園市立富林國小畢業；桃園市立草漯國中畢業；省立桃園農工畢業',
        '富林國小家長會長；樹林社區發展協會理事長；臺灣省觀光農園發展協會理事長；桃園縣觀音鄉第19屆村長；桃園市觀音區第1、2屆里長；台灣大學休閒農業經營管理班結業；台糖訓練中心農業經營管理班結業'
    ),
    (
        'cec-2022-local-councilor-regional-person-3b86bbf95b6e',
        '林詩穎',
        '宜蘭縣第2區議員',
        '宜蘭縣第2選舉區',
        'ilcc-current-councilor-lin-shih-ying',
        '宜蘭縣議會：第20屆議員林詩穎',
        'https://www.ilcc.gov.tw/Html/H_05/H_0501.asp?User_id=A2008&clique=DDP&pic=2',
        'cec-2022-yilan-county-councilor-candidates',
        DATE '1982-06-17',
        'female',
        '中國文化大學政治學系',
        '宜蘭縣議會第20屆議員；第20、21屆頭城鎮民代表；民進黨中央黨部社會運動部專員；民進黨宜蘭縣黨部第16、17、18、19屆執行委員'
    ),
    (
        'cec-2022-local-councilor-regional-person-c63b2116054f',
        '邱坤桶',
        '新竹縣第9區議員',
        '新竹縣第9選舉區',
        'hcc-current-councilor-chiu-kun-tung',
        '新竹縣議會：第20屆議員邱坤桶',
        'https://www.hcc.gov.tw/member-detail-lightbox?C=291&S=22&program=190',
        'cec-2022-hsinchu-county-councilor-candidates',
        DATE '1961-02-10',
        'male',
        '逢甲大學；竹南高中；寶山國中；新城國小',
        '第15屆新竹縣議會議員；第15屆寶山鄉鄉長；新竹肉品市場股份有限公司總經理；第17屆寶山鄉鄉長；第18屆寶山鄉鄉長'
    ),
    (
        'cec-2022-local-councilor-regional-person-f395429bd5ad',
        '周君綾',
        '彰化縣第3區議員',
        '彰化縣第3選舉區',
        'chcc-current-councilor-chou-chun-ling',
        '彰化縣議會：第20屆議員周君綾',
        'https://www.chcc.gov.tw/member/details.aspx?Parser=99%2C6%2C40%2C%2C%2C%2C156',
        'cec-2022-changhua-county-councilor-candidates',
        DATE '1981-04-28',
        'female',
        '彰師大碩士（公共事務與公民教育學系）；建國科大；員林農工；和美國中；和美國小',
        '和美鎮代表會第19～21屆鎮民代表；民進黨彰化縣議會第18屆黨團辦公室主任；立法委員黃秀芳、陳秀寳、陳素月、議員尤瑞春聯合服務處執行長；環境生態保護協會理事長；彰濱公益服務協進會前理事長；道東文教協會理事；青芳國際同濟會員；和美高中校友會永久會員；四張里廣澤宮管理委員會委員；泉州厝泉安宮顧問'
    ),
    (
        'cec-2022-local-councilor-regional-person-d09bcc1ddbac',
        '施佩妤',
        '彰化縣第2區議員',
        '彰化縣第2選舉區',
        'chcc-current-councilor-shih-pei-yu',
        '彰化縣議會：第20屆議員施佩妤',
        'https://www.chcc.gov.tw/member/details.aspx?Parser=99%2C6%2C40%2C%2C%2C%2C154',
        'cec-2022-changhua-county-councilor-candidates',
        DATE '1984-07-17',
        'female',
        '鹿港國小；東南國中；鹿港高中；淡江大學畢業',
        '鹿江文化藝術基金會董事；鹿港大專文青會第24屆主任委員；鹿港中學校友會理事；鹿港後備憲兵荷松協會顧問；鹿港國際青年商會副會長；鹿港義警分隊副分隊長；鹿港鎮體育會副總幹事；鹿菁獅子會理事；彰化縣施姓宗親會理事；彰化縣鹿港紫極殿文教基金會執行長'
    ),
    (
        'cec-2022-local-councilor-regional-person-5703a5be3c27',
        '洪如萍',
        '雲林縣第4區議員',
        '雲林縣第4選舉區',
        'ylcc-current-councilor-hung-ju-ping',
        '雲林縣議會：第20屆議員洪如萍',
        'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514130',
        'cec-2022-yunlin-county-councilor-candidates',
        DATE '1978-08-26',
        'female',
        '東興國小；崙背國中；東吳高職幼保科；虎尾科技大學附設進修學院；虎尾科技大學工業工程與管理研究所碩士畢業',
        '行政院客家委員會第4、5、6屆委員；崙背鄉民代表會第20、21屆代表；內政部營建署下水道工程處中區分處派駐人員；惠華幼兒園、東昇幼兒園、立人幼兒園幼教師；甲級廢棄物處理技術員；立法委員蘇治芬秘書'
    ),
    (
        'cec-2022-local-councilor-regional-person-51639344fdc5',
        '洪宗麒',
        '屏東縣第4區議員',
        '屏東縣第4選舉區',
        'ptcc-current-councilor-hung-tsung-chi',
        '屏東縣議會：第20屆議員洪宗麒',
        'https://www.ptcc.gov.tw/?Page=PersionalDetail&Guid=0229af1d-1020-f5ab-44e6-f5471c39d65b',
        'cec-2022-pingtung-county-councilor-candidates',
        DATE '1976-03-07',
        'male',
        '國立空中大學科技管理學系',
        '萬丹鄉第20～21屆鄉民代表；中國國民黨第20～21屆全國黨代表；屏東縣104至110年調解業務暨法律扶助績優人員'
    ),
    (
        'cec-2022-local-councilor-regional-person-656c33ed67be',
        '孫韻璇',
        '桃園市第2區議員',
        '桃園市第2選舉區',
        'tycc-current-councilor-sun-yun-hsuan',
        '桃園市議會：第3屆議員孫韻璇',
        'https://www.tycc.gov.tw/TC/councilor-detail.aspx?mid=39&num=985',
        'cec-2022-taoyuan-city-councilor-candidates',
        DATE '1979-07-04',
        'female',
        '新北市私立復興高級商工職業學校',
        '開南大學法律系在學生；市議員服務處主任；桃園市龜山區全民運動體育會理事長；精忠社區發展協會理事長；精忠里里長；音樂藝術工作鍵盤老師'
    ),
    (
        'cec-2022-local-councilor-regional-person-74a31760c48b',
        '徐美惠',
        '新竹市第2區議員',
        '新竹市第2選舉區',
        'hscc-current-councilor-hsu-mei-hui',
        '新竹市議會：第11屆議員徐美惠',
        'https://www.hsinchu-cc.gov.tw/tc/councilor.aspx?mid=39&c=18',
        'cec-2022-hsinchu-city-councilor-candidates',
        DATE '1976-09-08',
        'female',
        NULL,
        NULL
    );

WITH source_rows AS (
    SELECT
        'official-current:councilor:' || profile.profile_source_id AS source_person_key,
        'official_officeholder' AS source_type,
        profile.profile_source_id AS source_id,
        profile.profile_source_name AS source_name,
        profile.profile_source_url AS source_url,
        profile.person_name,
        profile.position,
        profile.district,
        jsonb_strip_nulls(jsonb_build_object(
            'isCurrent', TRUE,
            'observedDate', '2026-07-20',
            'education', profile.education,
            'experience', profile.experience
        )) AS source_payload
    FROM _current_councilor_profiles_batch_2 profile

    UNION ALL

    SELECT
        'official-election:2022:councilor:' || profile.profile_source_id,
        'official_election',
        profile.election_source_id,
        '中央選舉委員會：2022年直轄市及縣市議員候選人資料',
        'https://data.gov.tw/dataset/13119',
        profile.person_name,
        profile.position,
        profile.district,
        jsonb_build_object(
            'electionYear', 2022,
            'electionDate', '2022-11-26',
            'birthDate', profile.birth_date,
            'gender', profile.gender
        )
    FROM _current_councilor_profiles_batch_2 profile
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
    source_type,
    source_id,
    source_name,
    source_url,
    person_name,
    person_name,
    position,
    'councilor',
    district,
    split_part(district, '第', 1),
    source_payload,
    'A',
    'official-councilor-profile-gap-20260720-batch-2',
    TRUE,
    NOW()
FROM source_rows
ON CONFLICT (source_person_key) DO UPDATE SET
    source_type = EXCLUDED.source_type,
    source_id = EXCLUDED.source_id,
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

WITH identity_rows AS (
    SELECT
        person.id AS person_id,
        source.id AS source_person_id,
        source.source_person_key
    FROM _current_councilor_profiles_batch_2 profile
    JOIN people person ON person.external_id = profile.person_external_id
    JOIN source_people source
      ON source.source_person_key IN (
          'official-current:councilor:' || profile.profile_source_id,
          'official-election:2022:councilor:' || profile.profile_source_id
      )
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
    'Official council roster and CEC candidate data matched by name, county/city, and electoral district.',
    jsonb_build_object(
        'version', 'official-councilor-profile-gap-v2',
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
    education = COALESCE(NULLIF(BTRIM(person.education), ''), profile.education),
    experience = COALESCE(NULLIF(BTRIM(person.experience), ''), profile.experience),
    source_url = profile.profile_source_url,
    updated_at = NOW()
FROM _current_councilor_profiles_batch_2 profile
WHERE person.external_id = profile.person_external_id;

WITH claim_rows AS (
    SELECT
        profile.person_external_id,
        profile.profile_source_id,
        claims.claim_type,
        claims.claim_value,
        claims.observed_at,
        claims.source_kind
    FROM _current_councilor_profiles_batch_2 profile
    CROSS JOIN LATERAL (
        VALUES
            ('birth_date', TO_CHAR(profile.birth_date, 'YYYY-MM-DD'), TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
            ('gender', profile.gender, TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
            ('education', profile.education, TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
            ('experience', profile.experience, TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile')
    ) AS claims(claim_type, claim_value, observed_at, source_kind)
    WHERE NULLIF(BTRIM(claims.claim_value), '') IS NOT NULL
),
targets AS (
    SELECT
        claim.*,
        person.id AS person_id,
        CASE
            WHEN claim.source_kind = 'profile' THEN 'official-current:councilor:' || claim.profile_source_id
            ELSE 'official-election:2022:councilor:' || claim.profile_source_id
        END AS source_person_key
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
    targets.observed_at,
    TRUE,
    100,
    'official-councilor-profile-gap-v2',
    jsonb_build_array('Official council roster or CEC election dataset matched by name, county/city, and electoral district.'),
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
