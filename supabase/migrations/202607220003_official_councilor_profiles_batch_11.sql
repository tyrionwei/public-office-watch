CREATE TEMP TABLE _official_councilor_profiles_batch_11 (
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

INSERT INTO _official_councilor_profiles_batch_11 VALUES
    (
        '14133509-6f53-4093-9023-47d4f192b831',
        '徐美惠',
        '新竹市第2區議員',
        '新竹市第2選舉區',
        '新竹市',
        'moi-current-councilor-er11112ob00001',
        '內政部：現任縣市議員徐美惠',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112OB00001&_TYP=REP&n=574',
        DATE '2026-07-22',
        '國立清華大學碩士',
        '新竹市政府；市議員徐信芳服務處；後站發展促進會理事長；新竹市軟式網球會副總幹事'
    ),
    (
        'e0e84214-1295-4aca-866d-eef7598625cf',
        '高忠德 Takiludun．Anu',
        '高雄市第14區山地原住民議員',
        '第14選舉區（山地原住民）',
        '高雄市',
        'moi-current-councilor-er11112ea00064',
        '內政部：現任直轄市議員高忠德 Takiludun．Anu',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0001&_PARENT_ID=ER11112EA00064&_TYP=REP&n=573',
        DATE '2026-07-22',
        '高雄市樟山國小；高雄市寶來國中；陸軍士官學校',
        '陸軍士官長；執業高山嚮導及搜救；斜角早午餐負責人；台灣原住民權益促進會委員；台中市布農族邁阿尚協會理事；高雄市桃源區南橫傳統領域文化自然資源自治協會籌備主任委員'
    ),
    (
        '2b2eb1ea-b9c3-4f22-b6ee-15bf03a7cb68',
        '許國政',
        '澎湖縣第1區議員',
        '澎湖縣第1選舉區',
        '澎湖縣',
        'moi-current-councilor-er11112xb00014',
        '內政部：現任縣市議員許國政',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112XB00014&_TYP=REP&n=574',
        DATE '2026-07-22',
        '國立澎湖科技大學；澎湖海事水產職業學校；馬公國中；馬公國小',
        '馬公市民代表會主席；中國國民黨澎湖縣黨部主委；澎湖科技大學校友會理事長；澎湖縣帆船協會理事長；澎湖縣國際標準舞蹈研究協會理事長；澎湖縣警光棒壘球協會理事長；澎湖縣後備憲兵荷松協會理事長；澎湖縣軍人退伍協會常務理事；澎湖縣許氏宗親會常務理事；澎湖縣照顧服務協會常務監事'
    ),
    (
        '15df4611-9f4e-4c19-a64c-8f9733cc4f69',
        '黃榮利',
        '嘉義縣第1區議員',
        '嘉義縣第1選舉區',
        '嘉義縣',
        'moi-current-councilor-er11112qb00001',
        '內政部：現任縣市議員黃榮利',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112QB00001&_TYP=REP&n=574',
        DATE '2026-07-22',
        '稻江科技暨管理學院畢業',
        '安仁里長4年；太保市民代表會副主席4年；太保市農會理事長8年；太保市農會總幹事13年；太保市長'
    ),
    (
        '39563e8f-84f0-4a1e-ae54-5acbe27167ec',
        '葉明博',
        '屏東縣第2區議員',
        '屏東縣第2選舉區',
        '屏東縣',
        'moi-current-councilor-er11112tb00050',
        '內政部：現任縣市議員葉明博',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112TB00050&_TYP=REP&n=574',
        DATE '2026-07-22',
        '高中畢業',
        '屏東縣議會第15至17屆議員'
    ),
    (
        '5db607c6-c694-4c6d-8cef-b79f8918ce99',
        '吳國寶',
        '新竹市第5區議員',
        '新竹市第5選舉區',
        '新竹市',
        'moi-current-councilor-er11112ob00009',
        '內政部：現任縣市議員吳國寶',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112OB00009&_TYP=REP&n=574',
        DATE '2026-07-22',
        NULL,
        '新竹市議會第7、8、9、10屆議員；教育部核准專科以上講師資格；新竹市吳氏宗親會理事長；新竹市逢春長青會理事長；新竹市義交大隊第三中隊榮譽會長；新竹市地價評議委員會委員；中華大學講師（2002至2009年）；台灣犯罪被害人權服務協會榮譽理事長'
    ),
    (
        '81bb7edb-a5af-4d85-899c-05a01f2f7bf0',
        '林彥甫',
        '新竹市第4區議員',
        '新竹市第4選舉區',
        '新竹市',
        'moi-current-councilor-er11112ob00003',
        '內政部：現任縣市議員林彥甫',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112OB00003&_TYP=REP&n=574',
        DATE '2026-07-22',
        NULL,
        '新竹市議會第10屆議員'
    ),
    (
        '2f6bf48b-6c5e-42de-b19a-4214d99d8660',
        '邱素梅',
        '宜蘭縣第8區議員',
        '宜蘭縣第8選舉區',
        '宜蘭縣',
        'moi-current-councilor-er11112gb00021',
        '內政部：現任縣市議員邱素梅',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112GB00021&_TYP=REP&n=574',
        DATE '2026-07-22',
        NULL,
        '宜蘭縣第17、19屆議員；邱素梅地政士事務所負責人；宜蘭縣智障者權益促進會顧問團團長；宜蘭縣弘德愛心協會理事；順安永安宮委員'
    ),
    (
        'bdfc752d-470c-46d4-8b47-ad8aa9cb6651',
        '范織欽 Pasulang．Tomatalate',
        '高雄市第15區山地原住民議員',
        '高雄市第15選舉區',
        '高雄市',
        'moi-current-councilor-er11112ea00059',
        '內政部：現任直轄市議員范織欽 Pasulang．Tomatalate',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0001&_PARENT_ID=ER11112EA00059&_TYP=REP&n=573',
        DATE '2026-07-22',
        NULL,
        '原住民族委員會族群委員；高雄市政府原住民事務委員會主任委員；高雄縣興中國小校長；茂林國小校長；多納國小校長'
    ),
    (
        '06e7c308-e832-4548-aa10-0649ba1eda11',
        '陳建名',
        '新竹市第3區議員',
        '新竹市第3選舉區',
        '新竹市',
        'moi-current-councilor-er11112ob00030',
        '內政部：現任縣市議員陳建名',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112OB00030&_TYP=REP&n=574',
        DATE '2026-07-22',
        NULL,
        '新竹市議會第10屆議員；民主進步黨新竹市黨部主任委員；民主進步黨發言人；北極殿副主委；曲溪福安宮主委；大新竹棒球、慢壘聯盟總會長；新竹市民防大隊副大隊長；南勢青山王文化發展協會理事長；玄濟宮文化發展協會理事長'
    ),
    (
        '6daac75e-813f-4114-a5ff-9d1a97fc68cf',
        '黃文政',
        '新竹市第1區議員',
        '新竹市第1選舉區',
        '新竹市',
        'moi-current-councilor-er11112ob00024',
        '內政部：現任縣市議員黃文政',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112OB00024&_TYP=REP&n=574',
        DATE '2026-07-22',
        NULL,
        '新竹市議員；中國國民黨第18至21屆全國黨代表；中國國民黨新竹市客家事務委員會主委；新竹市青工會副總會長；新竹市青溪總會理事；東區民眾服務社理事；綠水里里長（2006至2018年）；國立新竹高級商業職業學校家長會副會長；綠水里巡守隊隊長；風城健康養生促進會理事長；新竹市黃姓宗親會第11、13、14屆理事長；中華民國黃氏宗親聯合總會監事；集郵學會理事長；新竹市博愛獅子會第33屆會長'
    ),
    (
        '4458b34f-03f1-4c72-a76c-1f84f0b6ad2e',
        '黃俊哲',
        '新北市第5區議員',
        '新北市第5選舉區',
        '新北市',
        'moi-current-councilor-er11112fa00049',
        '內政部：現任直轄市議員黃俊哲',
        'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0001&_PARENT_ID=ER11112FA00049&_TYP=REP&n=573',
        DATE '2026-07-22',
        '新埔國小；光仁國中；華僑中學；實踐大學國貿系畢業；輔仁大學企業管理研究所碩士畢業；國立臺灣大學國家發展研究所碩士畢業',
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
    'official-councilor-profile-gap-20260722-batch-11',
    TRUE,
    NOW()
FROM _official_councilor_profiles_batch_11 profile
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
    FROM _official_councilor_profiles_batch_11 profile
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
    jsonb_build_object('version', 'official-current-councilor-profiles-v11', 'sourcePersonKey', source_person_key),
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
    FROM _official_councilor_profiles_batch_11 profile
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
    'official-current-councilor-profiles-v11',
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
