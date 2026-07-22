CREATE TEMP TABLE _official_councilor_profiles_batch_10 (
    person_id UUID PRIMARY KEY,
    person_name TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    region TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    observed_at DATE NOT NULL,
    education TEXT,
    experience TEXT
) ON COMMIT DROP;

INSERT INTO _official_councilor_profiles_batch_10 VALUES
    (
        '7748a12a-a34e-4495-9a9a-7288e6cbba7f',
        '蔡蕥鍹',
        '新竹縣第1區議員',
        '新竹縣第1選舉區',
        '新竹縣',
        'hcc-current-councilor-369',
        '新竹縣議會：第20屆議員蔡蕥鍹',
        'https://www.hcc.gov.tw/member-detail?C=369&S=22&program=190',
        DATE '2026-07-22',
        '世新大學新聞研究所碩士',
        '竹北市民代表；民進黨新竹縣黨部顧問；民進黨新竹縣黨部東區主任；新竹縣教師會榮譽顧問；新竹市攝影學會庶務主任；優視覺溝通文案總監；新竹喜來登大飯店公關專員；科技家庭雜誌文字記者主編；新竹風城購物中心企劃專員；台灣鄧雨賢音樂文化協會顧問；文化工作者，著作《重新發現鄧南光》獲國史館台灣文獻館推廣性書刊第二名'
    ),
    (
        '8ba66a1d-a977-46a6-816a-3273b5ab2051',
        '郭美秀',
        '基隆市第4區議員',
        '基隆市第4選舉區',
        '基隆市',
        'moi-current-councilor-er11112cb00016',
        '內政部：現任縣市議員郭美秀',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112CB00016&_TYP=REP&n=574',
        DATE '2026-07-22',
        '中山國小；大德國中；基隆海事職業學校；經國管理暨健康學院理學學士',
        '基隆市聯合汽車駕訓班女教練；偉成商店〈海軍軍艦福利社供應商〉負責人；基隆前市議員楊石城第16、17、18、19屆特助；仁正里第18屆里長；仁正社區發展協會第7、8屆理事長；基隆市中山愛心協會第3屆理事長；基隆市郭氏宗親會第30、31屆副理事長'
    ),
    (
        'd2ed0a64-d402-4276-99ad-ad534f12fd6f',
        '陳軍佐',
        '基隆市第2區議員',
        '基隆市第2選舉區',
        '基隆市',
        'moi-current-councilor-er11112cb00006',
        '內政部：現任縣市議員陳軍佐',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112CB00006&_TYP=REP&n=574',
        DATE '2026-07-22',
        '仁愛國小；銘傳國中；基隆海事職業學校；崇右技術學院副學士；國立臺灣海洋大學輪機系碩士',
        '基隆市林右昌市長秘書；基隆市信義區孝忠里第20屆里長；基隆市市議員陳東財服務處助理；國際獅子會300F區2021年基隆港獅子會會長；基隆市深澳坑警友站副站長；基隆市義警中隊副中隊長；基隆市陳胡姚宗親會理事；基隆市海龍潛水游泳協會理事；基隆市義消第一大隊及義消宣導信二分隊顧問；基隆市銘傳國中家長會副會長；基隆市登山協會監事'
    ),
    (
        '1041f74e-e433-4c11-be69-fbcca4a84c63',
        '吳旭智',
        '新竹縣第1區議員',
        '新竹縣第1選舉區',
        '新竹縣',
        'hcc-current-councilor-360',
        '新竹縣議會：第20屆議員吳旭智',
        'https://www.hcc.gov.tw/member-detail?C=360&S=22&program=190',
        DATE '2026-07-22',
        NULL,
        '第19屆新竹縣議員；美國麻省理工學院旅居科學家；鴻碩電腦有限公司總經理；民國黨資訊長；財團法人工業技術研究院研究員；元培醫事科技大學兼任講師；中華民國自閉症權益促進會理事；財團法人世界領袖教育基金會講師'
    ),
    (
        'c2513cc0-a97f-4d04-8a32-01c4fcdfe300',
        '林碩彥',
        '新竹縣第1區議員',
        '新竹縣第1選舉區',
        '新竹縣',
        'hcc-current-councilor-367',
        '新竹縣議會：第20屆議員林碩彥',
        'https://www.hcc.gov.tw/member-detail?C=367&S=22&program=190',
        DATE '2026-07-22',
        '國立中山大學電機工程碩士',
        NULL
    );

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, normalized_role, district,
    normalized_region, election_year, external_record_id, source_payload,
    confidence_suggestion, ingest_batch_key, is_public, updated_at
)
SELECT
    'official-officeholder:profile-gap:' || profile.person_id,
    'official_officeholder',
    profile.source_id,
    profile.source_name,
    profile.source_url,
    profile.person_name,
    profile.person_name,
    profile.position,
    'councilor',
    profile.district,
    profile.region,
    2022,
    profile.source_id || ':' || profile.person_name,
    jsonb_strip_nulls(jsonb_build_object(
        'education', profile.education,
        'experience', profile.experience,
        'roleOrigin', 'current_officeholder',
        'observedAt', profile.observed_at
    )),
    'A',
    'official-councilor-profile-gap-20260722-batch-10',
    TRUE,
    NOW()
FROM _official_councilor_profiles_batch_10 profile
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
    FROM _official_councilor_profiles_batch_10 profile
    JOIN people person ON person.id = profile.person_id AND person.name = profile.person_name
    JOIN source_people source
      ON source.source_person_key = 'official-officeholder:profile-gap:' || profile.person_id
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
    'Official current councilor profile matched by verified name, region, and electoral district.',
    jsonb_build_object('version', 'official-current-councilor-profiles-v10', 'sourcePersonKey', source_person_key),
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
    SELECT profile.person_id, profile.person_name, profile.observed_at,
        claims.claim_type, claims.claim_value
    FROM _official_councilor_profiles_batch_10 profile
    CROSS JOIN LATERAL (
        VALUES ('education', profile.education), ('experience', profile.experience)
    ) AS claims(claim_type, claim_value)
    WHERE NULLIF(BTRIM(claims.claim_value), '') IS NOT NULL
),
targets AS (
    SELECT claim.*,
        'official-officeholder:profile-gap:' || claim.person_id AS source_person_key
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
    targets.observed_at::TIMESTAMPTZ,
    TRUE,
    100,
    'official-current-councilor-profiles-v10',
    jsonb_build_array('Official current councilor profile matched by verified name, region, and electoral district.'),
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
