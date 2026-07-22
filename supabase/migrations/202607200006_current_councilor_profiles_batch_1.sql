WITH profile_rows (
    person_external_id,
    person_name,
    position,
    district,
    profile_source_id,
    profile_source_name,
    profile_source_url,
    election_source_id,
    birth_date,
    gender,
    education,
    experience
) AS (
    VALUES
        (
            'cec-2022-local-councilor-regional-person-68ee0a59b2c2',
            '王辰翔',
            '新竹縣第10區議員',
            '新竹縣第10選舉區',
            'hcc-current-councilor-wang-chen-hsiang',
            '新竹縣議會：第20屆議員王辰翔',
            'https://www.hcc.gov.tw/member-detail-lightbox?C=374&S=22&program=190',
            'cec-2022-hsinchu-county-councilor-candidates',
            DATE '1989-06-07',
            'male',
            '東泰高中',
            '新竹縣議會副議長王炳漢助理；新竹縣王姓宗親會理事；中國國民黨第21屆黨代表；新竹縣北埔鄉青年志工協會理事長；新竹縣北埔鄉水磜社區發展協會理事長'
        ),
        (
            'cec-2022-local-councilor-regional-person-48b4415e7475',
            '王浩',
            '嘉義市第2區議員',
            '嘉義市第2選舉區',
            'cycc-current-councilor-wang-hao',
            '嘉義市議會：第11屆議員王浩',
            'https://www.cycc.gov.tw/web/UnitStaff_New/Default2.aspx?c0=3716&p0=1152',
            'cec-2022-chiayi-city-councilor-candidates',
            DATE '1990-03-13',
            'male',
            '國立臺灣大學新聞研究所碩士',
            '立法委員陳淑華辦公室嘉義服務處西區主任；嘉義市產業總工會顧問；時代力量嘉義市黨部執行長；地方法院勞動調解委員；臺灣汽車貨運暨倉儲業產業工會總幹事；新北市產業工會秘書長；桃園縣（市）產業總工會秘書長'
        ),
        (
            'cec-2022-local-councilor-regional-person-f628593bb4fe',
            '王國代',
            '金門縣第2區議員',
            '金門縣第2選舉區',
            'kmcc-current-councilor-wang-kuo-tai',
            '金門縣議會：第8屆議員王國代',
            'https://www.kmcc.gov.tw/8844/54357/55476/55525/',
            'cec-2022-kinmen-county-councilor-candidates',
            DATE '1970-01-02',
            'male',
            '何浦國小；金沙國中；泰北高中；台北工專；金門大學碩士畢業',
            '精忠衛隊協會榮譽理事長；金門縣志願役官兵協會理事長；第三士校協會理事長；金門縣紅十字會理事；金門縣義勇消防總隊顧問；金門縣農工職業學校家長會顧問'
        ),
        (
            'cec-2022-local-councilor-regional-person-37b1cb7cdedf',
            '朱健銘',
            '新竹縣第1區議員',
            '新竹縣第1選舉區',
            'hcc-current-councilor-chu-chien-ming',
            '新竹縣議會：第20屆議員朱健銘',
            'https://www.hcc.gov.tw/member-detail-lightbox?C=366&S=22&program=190',
            'cec-2022-hsinchu-county-councilor-candidates',
            DATE '1980-06-01',
            'male',
            '中華大學企管系；義民高中；竹北國中；竹仁國小',
            '竹北市民代表；柏克利游泳學校校長；新竹縣競技運動協會理事長；新竹縣救災志工協會理事長；新竹縣登山健行協會理事長；竹北義消顧問；新竹縣慈善愛心公德會理事長；新竹縣水上救生協會顧問；新竹縣後憲荷松協會顧問；竹北里守望相助隊隊員'
        ),
        (
            'cec-2022-local-councilor-regional-person-e008882b6e24',
            '江志明',
            '嘉義縣第3區議員',
            '嘉義縣第3選舉區',
            'cyscc-current-councilor-chiang-chih-ming',
            '嘉義縣議會：第20屆議員江志明',
            'https://www.cyscc.gov.tw/Parliamentary_Content/315/14203/',
            'cec-2022-chiayi-county-councilor-candidates',
            DATE '1971-01-09',
            'male',
            '協志高職畢業',
            '立法委員陳明文大林服務處執行長；嘉義縣江氏宗親會理事長；中華民國農會會員代表；大林鎮明華里里長；大林義警義消分隊顧問；溪口慈雲宮副主任委員；太和街三山國王廟信徒代表'
        )
),
source_rows AS (
    SELECT
        'official-current:councilor:' || profile.profile_source_id AS source_person_key,
        'official_officeholder' AS source_type,
        profile.profile_source_id AS source_id,
        profile.profile_source_name AS source_name,
        profile.profile_source_url AS source_url,
        profile.person_name,
        profile.position,
        profile.district,
        jsonb_build_object(
            'isCurrent', TRUE,
            'observedDate', '2026-07-20',
            'education', profile.education,
            'experience', profile.experience
        ) AS source_payload
    FROM profile_rows profile

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
    FROM profile_rows profile
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
    'official-councilor-profile-gap-20260720',
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

WITH target_rows (person_external_id, profile_source_id) AS (
    VALUES
        ('cec-2022-local-councilor-regional-person-68ee0a59b2c2', 'hcc-current-councilor-wang-chen-hsiang'),
        ('cec-2022-local-councilor-regional-person-48b4415e7475', 'cycc-current-councilor-wang-hao'),
        ('cec-2022-local-councilor-regional-person-f628593bb4fe', 'kmcc-current-councilor-wang-kuo-tai'),
        ('cec-2022-local-councilor-regional-person-37b1cb7cdedf', 'hcc-current-councilor-chu-chien-ming'),
        ('cec-2022-local-councilor-regional-person-e008882b6e24', 'cyscc-current-councilor-chiang-chih-ming')
),
identity_rows AS (
    SELECT
        person.id AS person_id,
        source.id AS source_person_id,
        source.source_person_key
    FROM target_rows target
    JOIN people person ON person.external_id = target.person_external_id
    JOIN source_people source
      ON source.source_person_key IN (
          'official-current:councilor:' || target.profile_source_id,
          'official-election:2022:councilor:' || target.profile_source_id
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
        'version', 'official-councilor-profile-gap-v1',
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

WITH profile_rows (
    person_external_id,
    profile_source_url,
    birth_date,
    gender,
    education,
    experience
) AS (
    VALUES
        ('cec-2022-local-councilor-regional-person-68ee0a59b2c2', 'https://www.hcc.gov.tw/member-detail-lightbox?C=374&S=22&program=190', DATE '1989-06-07', 'male', '東泰高中', '新竹縣議會副議長王炳漢助理；新竹縣王姓宗親會理事；中國國民黨第21屆黨代表；新竹縣北埔鄉青年志工協會理事長；新竹縣北埔鄉水磜社區發展協會理事長'),
        ('cec-2022-local-councilor-regional-person-48b4415e7475', 'https://www.cycc.gov.tw/web/UnitStaff_New/Default2.aspx?c0=3716&p0=1152', DATE '1990-03-13', 'male', '國立臺灣大學新聞研究所碩士', '立法委員陳淑華辦公室嘉義服務處西區主任；嘉義市產業總工會顧問；時代力量嘉義市黨部執行長；地方法院勞動調解委員；臺灣汽車貨運暨倉儲業產業工會總幹事；新北市產業工會秘書長；桃園縣（市）產業總工會秘書長'),
        ('cec-2022-local-councilor-regional-person-f628593bb4fe', 'https://www.kmcc.gov.tw/8844/54357/55476/55525/', DATE '1970-01-02', 'male', '何浦國小；金沙國中；泰北高中；台北工專；金門大學碩士畢業', '精忠衛隊協會榮譽理事長；金門縣志願役官兵協會理事長；第三士校協會理事長；金門縣紅十字會理事；金門縣義勇消防總隊顧問；金門縣農工職業學校家長會顧問'),
        ('cec-2022-local-councilor-regional-person-37b1cb7cdedf', 'https://www.hcc.gov.tw/member-detail-lightbox?C=366&S=22&program=190', DATE '1980-06-01', 'male', '中華大學企管系；義民高中；竹北國中；竹仁國小', '竹北市民代表；柏克利游泳學校校長；新竹縣競技運動協會理事長；新竹縣救災志工協會理事長；新竹縣登山健行協會理事長；竹北義消顧問；新竹縣慈善愛心公德會理事長；新竹縣水上救生協會顧問；新竹縣後憲荷松協會顧問；竹北里守望相助隊隊員'),
        ('cec-2022-local-councilor-regional-person-e008882b6e24', 'https://www.cyscc.gov.tw/Parliamentary_Content/315/14203/', DATE '1971-01-09', 'male', '協志高職畢業', '立法委員陳明文大林服務處執行長；嘉義縣江氏宗親會理事長；中華民國農會會員代表；大林鎮明華里里長；大林義警義消分隊顧問；溪口慈雲宮副主任委員；太和街三山國王廟信徒代表')
)
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
FROM profile_rows profile
WHERE person.external_id = profile.person_external_id;

WITH claim_rows (
    person_external_id,
    profile_source_id,
    claim_type,
    claim_value,
    observed_at,
    source_kind
) AS (
    VALUES
        ('cec-2022-local-councilor-regional-person-68ee0a59b2c2', 'hcc-current-councilor-wang-chen-hsiang', 'birth_date', '1989-06-07', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-68ee0a59b2c2', 'hcc-current-councilor-wang-chen-hsiang', 'gender', 'male', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-68ee0a59b2c2', 'hcc-current-councilor-wang-chen-hsiang', 'education', '東泰高中', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-68ee0a59b2c2', 'hcc-current-councilor-wang-chen-hsiang', 'experience', '新竹縣議會副議長王炳漢助理；新竹縣王姓宗親會理事；中國國民黨第21屆黨代表；新竹縣北埔鄉青年志工協會理事長；新竹縣北埔鄉水磜社區發展協會理事長', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-48b4415e7475', 'cycc-current-councilor-wang-hao', 'birth_date', '1990-03-13', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-48b4415e7475', 'cycc-current-councilor-wang-hao', 'gender', 'male', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-48b4415e7475', 'cycc-current-councilor-wang-hao', 'education', '國立臺灣大學新聞研究所碩士', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-48b4415e7475', 'cycc-current-councilor-wang-hao', 'experience', '立法委員陳淑華辦公室嘉義服務處西區主任；嘉義市產業總工會顧問；時代力量嘉義市黨部執行長；地方法院勞動調解委員；臺灣汽車貨運暨倉儲業產業工會總幹事；新北市產業工會秘書長；桃園縣（市）產業總工會秘書長', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-f628593bb4fe', 'kmcc-current-councilor-wang-kuo-tai', 'birth_date', '1970-01-02', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-f628593bb4fe', 'kmcc-current-councilor-wang-kuo-tai', 'gender', 'male', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-f628593bb4fe', 'kmcc-current-councilor-wang-kuo-tai', 'education', '何浦國小；金沙國中；泰北高中；台北工專；金門大學碩士畢業', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-f628593bb4fe', 'kmcc-current-councilor-wang-kuo-tai', 'experience', '精忠衛隊協會榮譽理事長；金門縣志願役官兵協會理事長；第三士校協會理事長；金門縣紅十字會理事；金門縣義勇消防總隊顧問；金門縣農工職業學校家長會顧問', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-37b1cb7cdedf', 'hcc-current-councilor-chu-chien-ming', 'birth_date', '1980-06-01', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-37b1cb7cdedf', 'hcc-current-councilor-chu-chien-ming', 'gender', 'male', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-37b1cb7cdedf', 'hcc-current-councilor-chu-chien-ming', 'education', '中華大學企管系；義民高中；竹北國中；竹仁國小', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-37b1cb7cdedf', 'hcc-current-councilor-chu-chien-ming', 'experience', '竹北市民代表；柏克利游泳學校校長；新竹縣競技運動協會理事長；新竹縣救災志工協會理事長；新竹縣登山健行協會理事長；竹北義消顧問；新竹縣慈善愛心公德會理事長；新竹縣水上救生協會顧問；新竹縣後憲荷松協會顧問；竹北里守望相助隊隊員', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-e008882b6e24', 'cyscc-current-councilor-chiang-chih-ming', 'birth_date', '1971-01-09', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-e008882b6e24', 'cyscc-current-councilor-chiang-chih-ming', 'gender', 'male', TIMESTAMPTZ '2022-11-26 00:00:00+08', 'election'),
        ('cec-2022-local-councilor-regional-person-e008882b6e24', 'cyscc-current-councilor-chiang-chih-ming', 'education', '協志高職畢業', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile'),
        ('cec-2022-local-councilor-regional-person-e008882b6e24', 'cyscc-current-councilor-chiang-chih-ming', 'experience', '立法委員陳明文大林服務處執行長；嘉義縣江氏宗親會理事長；中華民國農會會員代表；大林鎮明華里里長；大林義警義消分隊顧問；溪口慈雲宮副主任委員；太和街三山國王廟信徒代表', TIMESTAMPTZ '2026-07-20 00:00:00+08', 'profile')
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
    'official-councilor-profile-gap-v1',
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
