WITH source_rows AS (
    SELECT *
    FROM (
        VALUES
            (
                'official-current:changhua-city-mayor:lin-shih-hsien',
                'official_officeholder',
                'changhua-city-office-mayor-profile',
                '彰化市公所：市長專區',
                'https://www.changhua.gov.tw/Content/45',
                '林世賢',
                '彰化縣彰化市市長',
                '彰化縣彰化市',
                jsonb_build_object(
                    'isCurrent', TRUE,
                    'observedDate', '2024-04-16',
                    'education', jsonb_build_array(
                        '國立屏東農專獸醫科',
                        '精誠高中',
                        '彰化國中',
                        '中山國小',
                        '國立臺灣大學政治學研究所碩士在職專班肄業'
                    ),
                    'experience', jsonb_build_array(
                        '彰化縣議會第18屆縣議員',
                        '彰化環保聯盟理事長',
                        '賴和文教基金會董事',
                        '彰化醫療界聯盟總幹事',
                        '翁金珠縣政白皮書執筆',
                        '李登輝之友彰化總會長',
                        '彰化師範大學實驗動物管理委員',
                        '彰化縣動物防疫所公務員',
                        '臺灣中社理事、環科召集人',
                        '2002年彰化區扁友會總幹事',
                        '2004、2008、2012年彰化縣醫療界扁友會、長工會、小英之友會等會總幹事',
                        '國考獸醫師'
                    )
                )
            ),
            (
                'official-election:2014-changhua-county-council:lin-shih-hsien',
                'official_election',
                'cec-2014-changhua-local-election-winners',
                '臺灣省選舉委員會：2014年彰化縣議員選舉當選人名單',
                'https://web.cec.gov.tw/api/file/f73cd05b-dda9-4032-bdd7-f4172e3be4f5.pdf',
                '林世賢',
                '彰化縣議會第18屆議員',
                '彰化縣第1選舉區',
                jsonb_build_object(
                    'electionYear', 2014,
                    'raceTitle', '彰化縣議會第18屆議員選舉第1選舉區',
                    'matchedCurrentRaceTitle', '彰化縣彰化市市長選舉',
                    'birthDate', '1959-06-01',
                    'gender', 'male',
                    'observedDate', '2014-11-29'
                )
            ),
            (
                'official-election:2022-hualien-city-mayor:wei-chia-yen',
                'official_election',
                'cec-2022-hualien-local-election-registration',
                '花蓮縣選舉委員會：2022年鄉鎮市長選舉候選人登記資料',
                'https://web.cec.gov.tw/api/file/1448d2fe-b0a6-42a0-9c57-5b40c2f02fd1.pdf',
                '魏嘉彥',
                '花蓮縣花蓮市市長',
                '花蓮縣花蓮市',
                jsonb_build_object(
                    'electionYear', 2022,
                    'raceTitle', '花蓮縣花蓮市市長選舉',
                    'birthDate', '1985-05-22',
                    'gender', 'male',
                    'observedDate', '2022-09-06'
                )
            )
    ) AS rows(
        source_person_key,
        source_type,
        source_id,
        source_name,
        source_url,
        person_name,
        position,
        district,
        source_payload
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
    source_type,
    source_id,
    source_name,
    source_url,
    person_name,
    person_name,
    position,
    'local_chief',
    district,
    district,
    source_payload,
    'A',
    'official-profile-gap-20260720',
    TRUE,
    NOW()
FROM source_rows
ON CONFLICT (source_person_key) DO UPDATE SET
    source_type = EXCLUDED.source_type,
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
            ('official-current:changhua-city-mayor:lin-shih-hsien', '林世賢', '彰化縣彰化市市長選舉'),
            ('official-election:2014-changhua-county-council:lin-shih-hsien', '林世賢', '彰化縣彰化市市長選舉'),
            ('official-election:2022-hualien-city-mayor:wei-chia-yen', '魏嘉彥', '花蓮縣花蓮市市長選舉')
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

WITH target AS (
    SELECT DISTINCT candidates.person_id
    FROM public_candidates candidates
    WHERE candidates.person_name = '林世賢'
      AND candidates.race_title = '彰化縣彰化市市長選舉'
      AND candidates.election_year = 2022
      AND (candidates.is_elected = TRUE OR candidates.registration_status = 'elected')
)
UPDATE people person
SET
    education = '國立屏東農專獸醫科；精誠高中；彰化國中；中山國小；國立臺灣大學政治學研究所碩士在職專班肄業',
    experience = '彰化縣議會第18屆縣議員；彰化環保聯盟理事長；賴和文教基金會董事；彰化醫療界聯盟總幹事；翁金珠縣政白皮書執筆；李登輝之友彰化總會長；彰化師範大學實驗動物管理委員；彰化縣動物防疫所公務員；臺灣中社理事、環科召集人；2002年彰化區扁友會總幹事；2004、2008、2012年彰化縣醫療界扁友會、長工會、小英之友會等會總幹事；國考獸醫師',
    source_url = 'https://www.changhua.gov.tw/Content/45',
    gender = 'male',
    updated_at = NOW()
FROM target
WHERE person.id = target.person_id
  AND (
      NULLIF(BTRIM(person.experience), '') IS NULL
      OR NULLIF(BTRIM(person.education), '') IS NULL
      OR person.education = '專科'
      OR person.gender = 'unknown'
  );

WITH target AS (
    SELECT DISTINCT candidates.person_id
    FROM public_candidates candidates
    WHERE candidates.person_name = '魏嘉彥'
      AND candidates.race_title = '花蓮縣花蓮市市長選舉'
      AND candidates.election_year = 2022
      AND (candidates.is_elected = TRUE OR candidates.registration_status = 'elected')
)
UPDATE people person
SET
    gender = 'male',
    updated_at = NOW()
FROM target
WHERE person.id = target.person_id
  AND (NULLIF(BTRIM(person.gender), '') IS NULL OR person.gender = 'unknown');

WITH claim_rows AS (
    SELECT *
    FROM (
        VALUES
            ('official-current:changhua-city-mayor:lin-shih-hsien', '林世賢', '彰化縣彰化市市長選舉', 'education', '國立屏東農專獸醫科；精誠高中；彰化國中；中山國小；國立臺灣大學政治學研究所碩士在職專班肄業', TIMESTAMPTZ '2024-04-16 00:00:00+08', 'official-profile-gap-v1', 'Official current mayor profile'),
            ('official-current:changhua-city-mayor:lin-shih-hsien', '林世賢', '彰化縣彰化市市長選舉', 'experience', '彰化縣議會第18屆縣議員；彰化環保聯盟理事長；賴和文教基金會董事；彰化醫療界聯盟總幹事；翁金珠縣政白皮書執筆；李登輝之友彰化總會長；彰化師範大學實驗動物管理委員；彰化縣動物防疫所公務員；臺灣中社理事、環科召集人；2002年彰化區扁友會總幹事；2004、2008、2012年彰化縣醫療界扁友會、長工會、小英之友會等會總幹事；國考獸醫師', TIMESTAMPTZ '2024-04-16 00:00:00+08', 'official-profile-gap-v1', 'Official current mayor profile'),
            ('official-election:2014-changhua-county-council:lin-shih-hsien', '林世賢', '彰化縣彰化市市長選舉', 'birth_date', '1959-06-01', TIMESTAMPTZ '2014-11-29 00:00:00+08', 'official-election-result-v1', 'Official election commission record'),
            ('official-election:2014-changhua-county-council:lin-shih-hsien', '林世賢', '彰化縣彰化市市長選舉', 'gender', 'male', TIMESTAMPTZ '2014-11-29 00:00:00+08', 'official-election-result-v1', 'Official election commission record'),
            ('official-election:2022-hualien-city-mayor:wei-chia-yen', '魏嘉彥', '花蓮縣花蓮市市長選舉', 'birth_date', '1985-05-22', TIMESTAMPTZ '2022-09-06 00:00:00+08', 'official-election-result-v1', 'Official election commission record'),
            ('official-election:2022-hualien-city-mayor:wei-chia-yen', '魏嘉彥', '花蓮縣花蓮市市長選舉', 'gender', 'male', TIMESTAMPTZ '2022-09-06 00:00:00+08', 'official-election-result-v1', 'Official election commission record')
    ) AS rows(
        source_person_key,
        person_name,
        race_title,
        claim_type,
        claim_value,
        observed_at,
        scoring_version,
        scoring_reason
    )
),
targets AS (
    SELECT DISTINCT claim_rows.*, candidates.person_id
    FROM claim_rows
    JOIN public_candidates candidates
      ON candidates.person_name = claim_rows.person_name
     AND candidates.race_title = claim_rows.race_title
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
    targets.scoring_version,
    jsonb_build_array(targets.scoring_reason),
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
