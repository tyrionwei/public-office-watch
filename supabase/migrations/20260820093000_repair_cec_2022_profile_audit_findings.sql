-- Repair official 2022 bulletin fields that were linked to the wrong profile
-- card or misread by OCR, then resynchronize reviewed official fields.
BEGIN;

CREATE TEMP TABLE _cec_2022_profile_corrections (
    claim_key TEXT PRIMARY KEY,
    claim_value TEXT NOT NULL,
    source_page INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO _cec_2022_profile_corrections (claim_key, claim_value, source_page)
VALUES
    ('cec-2022-councilor-profile-ocr:c9fc67ae-efa1-4145-8e4e-aadc433dbda4:birth_date', '1985-07-16', 1),
    ('cec-2022-councilor-profile-ocr:81e0bc7a-c9c2-4d00-824d-5b900dd03239:birth_date', '1954-10-20', 1),
    ('cec-2022-councilor-profile-ocr:9e126312-18fc-4e43-81c2-19dce69b71ad:birth_date', '1990-03-13', 1),
    ('cec-2022-councilor-profile-ocr:8a7f0a81-5ffa-4980-b120-a7ea633e0bcc:birth_date', '1954-09-15', 2),
    ('cec-2022-councilor-profile-ocr:8a7f0a81-5ffa-4980-b120-a7ea633e0bcc:gender', '男', 2),
    ('cec-2022-councilor-profile-ocr:8a7f0a81-5ffa-4980-b120-a7ea633e0bcc:education', '宜蘭縣立員山初級中學畢業', 2),
    ('cec-2022-councilor-profile-ocr:8a7f0a81-5ffa-4980-b120-a7ea633e0bcc:experience', E'宜蘭縣議會議員\n宜蘭市農會理事長\n宜蘭市市民代表會副主席', 2),
    ('cec-2022-councilor-profile-ocr:78ff22f8-d695-4f1d-89be-e958be668ec9:birth_date', '1951-10-10', 2),
    ('cec-2022-councilor-profile-ocr:78ff22f8-d695-4f1d-89be-e958be668ec9:gender', '男', 2),
    ('cec-2022-councilor-profile-ocr:78ff22f8-d695-4f1d-89be-e958be668ec9:education', E'花蓮縣新城國小\n花蓮縣私立四維中學初中部\n花蓮縣私立中華工商高級部', 2),
    ('cec-2022-councilor-profile-ocr:78ff22f8-d695-4f1d-89be-e958be668ec9:experience', E'亞洲水泥花蓮廠服務三十年\n新城鄉民代表會第18屆代表\n新城鄉民代表會第19屆、第20屆代表主席\n花蓮縣第19屆議員', 2),
    ('cec-2022-councilor-profile-ocr:63d5b769-61c5-40b2-8bb2-80e6f38c9ee5:birth_date', '1954-03-16', 2),
    ('cec-2022-councilor-profile-ocr:63d5b769-61c5-40b2-8bb2-80e6f38c9ee5:gender', '女', 2),
    ('cec-2022-councilor-profile-ocr:63d5b769-61c5-40b2-8bb2-80e6f38c9ee5:education', E'北埔國小\n花蓮女中\n花蓮高工', 2),
    ('cec-2022-councilor-profile-ocr:63d5b769-61c5-40b2-8bb2-80e6f38c9ee5:experience', E'新城鄉婦女會理事長\n新城鄉生活美學協會理事長\n婦聯青溪新城支會主任委員\n國民黨新城鄉黨部主任委員\n國民黨花蓮縣黨部委員\n花工校友會會長\n花蓮縣議會第19屆縣議員', 2);

DO $$
DECLARE
    matched_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO matched_count
    FROM public.person_claims claim
    JOIN _cec_2022_profile_corrections correction
      ON correction.claim_key = claim.claim_key;

    IF matched_count <> 15 THEN
        RAISE EXCEPTION 'Expected 15 official profile claims to repair, found %', matched_count;
    END IF;
END;
$$;

UPDATE public.person_claims claim
SET
    claim_value = correction.claim_value,
    claim_json = jsonb_set(
        jsonb_set(
            jsonb_set(
                claim.claim_json,
                '{value}',
                to_jsonb(correction.claim_value),
                TRUE
            ),
            '{sourceDocument,page}',
            to_jsonb(correction.source_page),
            TRUE
        ),
        '{sourceDocument,extractionMethod}',
        to_jsonb('manual_official_bulletin_transcription'::TEXT),
        TRUE
    ) || jsonb_build_object(
        'manualOfficialBulletinReview',
        jsonb_build_object(
            'status', 'corrected_after_visual_comparison',
            'reviewedAt', NOW(),
            'reason', 'Automatic OCR selected an adjacent profile card or misread the ROC birth year.'
        )
    ),
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    review_score = 100,
    scoring_version = 'manual-official-bulletin-correction-v1',
    auto_reviewed_at = NOW(),
    updated_at = NOW()
FROM _cec_2022_profile_corrections correction
WHERE claim.claim_key = correction.claim_key;

UPDATE public.people person
SET
    gender = CASE correction.claim_value
        WHEN '男' THEN 'male'
        WHEN '女' THEN 'female'
        ELSE person.gender
    END,
    updated_at = NOW()
FROM _cec_2022_profile_corrections correction
JOIN public.person_claims claim ON claim.claim_key = correction.claim_key
JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
WHERE correction.claim_key LIKE '%:gender'
  AND person.id = person_map.canonical_person_id;

UPDATE public.people person
SET
    education = correction.claim_value,
    updated_at = NOW()
FROM _cec_2022_profile_corrections correction
JOIN public.person_claims claim ON claim.claim_key = correction.claim_key
JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
WHERE correction.claim_key LIKE '%:education'
  AND person.id = person_map.canonical_person_id;

UPDATE public.people person
SET
    experience = correction.claim_value,
    updated_at = NOW()
FROM _cec_2022_profile_corrections correction
JOIN public.person_claims claim ON claim.claim_key = correction.claim_key
JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
WHERE correction.claim_key LIKE '%:experience'
  AND person.id = person_map.canonical_person_id;

-- Some official claims were manually approved after the previous backfill.
-- Copy only a unique verified CEC value into still-empty canonical fields.
CREATE TEMP TABLE _reviewed_2022_profile_targets ON COMMIT DROP AS
WITH elected_2022_councilors AS (
    SELECT DISTINCT person_map.canonical_person_id AS person_id
    FROM public.candidates candidate
    JOIN public.person_canonical_map person_map ON person_map.person_id = candidate.person_id
    JOIN public.races race ON race.id = candidate.race_id
    JOIN public.elections election ON election.id = race.election_id
    WHERE election.year = 2022
      AND race.race_type IN ('city_councilor', 'county_councilor', 'councilor_district')
      AND COALESCE(candidate.is_elected, FALSE) = TRUE
),
missing_fields AS (
    SELECT cohort.person_id, field.claim_type
    FROM elected_2022_councilors cohort
    JOIN public.people person ON person.id = cohort.person_id
    CROSS JOIN LATERAL (
        VALUES
            ('education'::TEXT, person.education),
            ('experience'::TEXT, person.experience)
    ) AS field(claim_type, current_value)
    WHERE NULLIF(BTRIM(field.current_value), '') IS NULL
),
official_values AS (
    SELECT
        missing.person_id,
        missing.claim_type,
        MIN(BTRIM(claim.claim_value)) AS claim_value
    FROM missing_fields missing
    JOIN public.person_canonical_map person_map
      ON person_map.canonical_person_id = missing.person_id
    JOIN public.person_claims claim
      ON claim.person_id = person_map.person_id
     AND claim.claim_type = missing.claim_type
    WHERE claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE
      AND NULLIF(BTRIM(claim.claim_value), '') IS NOT NULL
      AND claim.source_name ILIKE '中央選舉委員會：2022%公報%'
    GROUP BY missing.person_id, missing.claim_type
    HAVING COUNT(DISTINCT BTRIM(claim.claim_value)) = 1
)
SELECT person_id, claim_type, claim_value
FROM official_values;

UPDATE public.people person
SET education = target.claim_value, updated_at = NOW()
FROM _reviewed_2022_profile_targets target
WHERE person.id = target.person_id
  AND target.claim_type = 'education'
  AND NULLIF(BTRIM(person.education), '') IS NULL;

UPDATE public.people person
SET experience = target.claim_value, updated_at = NOW()
FROM _reviewed_2022_profile_targets target
WHERE person.id = target.person_id
  AND target.claim_type = 'experience'
  AND NULLIF(BTRIM(person.experience), '') IS NULL;

-- Fall back to a unique verified current-council profile only when the CEC
-- bulletin field is still absent. This preserves official provenance without
-- choosing among conflicting values.
CREATE TEMP TABLE _official_current_profile_targets ON COMMIT DROP AS
WITH elected_2022_councilors AS (
    SELECT DISTINCT person_map.canonical_person_id AS person_id
    FROM public.candidates candidate
    JOIN public.person_canonical_map person_map ON person_map.person_id = candidate.person_id
    JOIN public.races race ON race.id = candidate.race_id
    JOIN public.elections election ON election.id = race.election_id
    WHERE election.year = 2022
      AND race.race_type IN ('city_councilor', 'county_councilor', 'councilor_district')
      AND COALESCE(candidate.is_elected, FALSE) = TRUE
),
missing_fields AS (
    SELECT cohort.person_id, field.claim_type
    FROM elected_2022_councilors cohort
    JOIN public.public_people person ON person.person_id = cohort.person_id
    CROSS JOIN LATERAL (
        VALUES
            ('education'::TEXT, person.education),
            ('experience'::TEXT, person.experience)
    ) AS field(claim_type, current_value)
    WHERE NULLIF(BTRIM(field.current_value), '') IS NULL
),
official_values AS (
    SELECT
        missing.person_id,
        missing.claim_type,
        MIN(BTRIM(claim.claim_value)) AS claim_value
    FROM missing_fields missing
    JOIN public.person_canonical_map person_map
      ON person_map.canonical_person_id = missing.person_id
    JOIN public.person_claims claim
      ON claim.person_id = person_map.person_id
     AND claim.claim_type = missing.claim_type
    WHERE claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public = TRUE
      AND claim.claim_key LIKE 'official-profile:%current-councilors:%'
      AND NULLIF(BTRIM(claim.claim_value), '') IS NOT NULL
    GROUP BY missing.person_id, missing.claim_type
    HAVING COUNT(DISTINCT BTRIM(claim.claim_value)) = 1
)
SELECT person_id, claim_type, claim_value
FROM official_values;

UPDATE public.people person
SET education = target.claim_value, updated_at = NOW()
FROM _official_current_profile_targets target
WHERE person.id = target.person_id
  AND target.claim_type = 'education'
  AND NULLIF(BTRIM(person.education), '') IS NULL;

UPDATE public.people person
SET experience = target.claim_value, updated_at = NOW()
FROM _official_current_profile_targets target
WHERE person.id = target.person_id
  AND target.claim_type = 'experience'
  AND NULLIF(BTRIM(person.experience), '') IS NULL;

-- The Taipei special layout merged 陳政忠's profile into the platform crop.
-- Publish the visually checked profile field and replace the platform with the
-- complete text-layer transcription from the same official page.
INSERT INTO public.person_claims (
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
    candidate_id
)
SELECT
    'cec-2022-councilor-profile-manual:3589446a-b4ef-48f6-bc2c-57daaba0c0c3:experience',
    platform.person_id,
    platform.source_person_id,
    'experience',
    E'台北市議會第5-13屆議員\n財團法人台北市陳安文教基金會董事長\n德明科技大學講師\n育達商職教師\n國際青年商會世界總會參議員\n國際青年商會亞太大會主委\n台北市民委會召集人暨黨團書記長\n政治大學公共行政研究所',
    jsonb_build_object(
        'value', E'台北市議會第5-13屆議員\n財團法人台北市陳安文教基金會董事長\n德明科技大學講師\n育達商職教師\n國際青年商會世界總會參議員\n國際青年商會亞太大會主委\n台北市民委會召集人暨黨團書記長\n政治大學公共行政研究所',
        'profileSource', 'cec_election_bulletin_manual',
        'electionYear', 2022,
        'candidateId', platform.candidate_id,
        'sourceDocument', platform.claim_json->'sourceDocument',
        'manualOfficialBulletinReview', jsonb_build_object(
            'status', 'transcribed_after_visual_comparison',
            'reason', 'Taipei special layout merged the profile and platform columns.'
        )
    ),
    'A',
    'verified',
    'public',
    platform.source_name,
    platform.source_url,
    platform.observed_at,
    TRUE,
    100,
    'manual-official-bulletin-correction-v1',
    platform.scoring_reasons,
    NOW(),
    platform.candidate_id
FROM public.person_claims platform
WHERE platform.claim_key = 'cec-platform:2022:votetw-candidate-ebb87cef74634742'
ON CONFLICT (claim_key) DO UPDATE SET
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    review_score = 100,
    updated_at = NOW();

UPDATE public.people person
SET
    experience = claim.claim_value,
    updated_at = NOW()
FROM public.person_claims claim
JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
WHERE claim.claim_key = 'cec-2022-councilor-profile-manual:3589446a-b4ef-48f6-bc2c-57daaba0c0c3:experience'
  AND person.id = person_map.canonical_person_id;

UPDATE public.person_claims claim
SET
    claim_value = E'一、持續推動捷運外環線北環段：1.蘆洲、社子、後港地區連結至士林捷運站。2.泰北高中連結至文湖線，繁榮士林、北投、社子交通。\n二、推動社子島開發：1.以最優惠之拆遷補助方案，落實戶戶配售公有住宅。2.打造社子島成為市民的生態城市綠洲。\n三、4年內全力協助全市國中小轉型為100%雙語學校；優化公共托育及提升育兒、托嬰各項補助，改善青年家庭負擔。\n四、保障青年就業：提高與放寬青年創業貸款額度；擴大企業與學界之建教合作與實習機會。廣建青年住宅：降低首購門檻，青年輕鬆圓夢成家。\n五、增設樂齡照護發放敬老年金：推動65歲長者免繳交健保費、完善長照機制，增加日照中心並擴大敬老卡使用範圍，確保4年內敬老年金不中斷。\n六、照顧弱勢族群：保障身心障礙人士就業機會，全市全面增設無障礙空間，扶持變故家庭提供即時急難救助；輔導外籍配偶職訓與就業機會，提供諮詢與全面協助。\n七、再創樂活經濟園區確保居民居住權益：推動關渡平原連結北士科，蘊藏寫意經濟動脈；修改陽明山不合理之都市計畫，制定陽明山特別地區條例，確保當地居民居住權益。\n八、健全工業宅條例推動合法工業住宅：配合產業發展重點地區及在地居住使用需求，推動工業宅條例調整變更，確保居住權益。',
    claim_json = jsonb_set(
        jsonb_set(
            claim.claim_json,
            '{platformText}',
            to_jsonb(E'一、持續推動捷運外環線北環段：1.蘆洲、社子、後港地區連結至士林捷運站。2.泰北高中連結至文湖線，繁榮士林、北投、社子交通。\n二、推動社子島開發：1.以最優惠之拆遷補助方案，落實戶戶配售公有住宅。2.打造社子島成為市民的生態城市綠洲。\n三、4年內全力協助全市國中小轉型為100%雙語學校；優化公共托育及提升育兒、托嬰各項補助，改善青年家庭負擔。\n四、保障青年就業：提高與放寬青年創業貸款額度；擴大企業與學界之建教合作與實習機會。廣建青年住宅：降低首購門檻，青年輕鬆圓夢成家。\n五、增設樂齡照護發放敬老年金：推動65歲長者免繳交健保費、完善長照機制，增加日照中心並擴大敬老卡使用範圍，確保4年內敬老年金不中斷。\n六、照顧弱勢族群：保障身心障礙人士就業機會，全市全面增設無障礙空間，扶持變故家庭提供即時急難救助；輔導外籍配偶職訓與就業機會，提供諮詢與全面協助。\n七、再創樂活經濟園區確保居民居住權益：推動關渡平原連結北士科，蘊藏寫意經濟動脈；修改陽明山不合理之都市計畫，制定陽明山特別地區條例，確保當地居民居住權益。\n八、健全工業宅條例推動合法工業住宅：配合產業發展重點地區及在地居住使用需求，推動工業宅條例調整變更，確保居住權益。'::TEXT),
            TRUE
        ),
        '{value}',
        to_jsonb(E'一、持續推動捷運外環線北環段：1.蘆洲、社子、後港地區連結至士林捷運站。2.泰北高中連結至文湖線，繁榮士林、北投、社子交通。\n二、推動社子島開發：1.以最優惠之拆遷補助方案，落實戶戶配售公有住宅。2.打造社子島成為市民的生態城市綠洲。\n三、4年內全力協助全市國中小轉型為100%雙語學校；優化公共托育及提升育兒、托嬰各項補助，改善青年家庭負擔。\n四、保障青年就業：提高與放寬青年創業貸款額度；擴大企業與學界之建教合作與實習機會。廣建青年住宅：降低首購門檻，青年輕鬆圓夢成家。\n五、增設樂齡照護發放敬老年金：推動65歲長者免繳交健保費、完善長照機制，增加日照中心並擴大敬老卡使用範圍，確保4年內敬老年金不中斷。\n六、照顧弱勢族群：保障身心障礙人士就業機會，全市全面增設無障礙空間，扶持變故家庭提供即時急難救助；輔導外籍配偶職訓與就業機會，提供諮詢與全面協助。\n七、再創樂活經濟園區確保居民居住權益：推動關渡平原連結北士科，蘊藏寫意經濟動脈；修改陽明山不合理之都市計畫，制定陽明山特別地區條例，確保當地居民居住權益。\n八、健全工業宅條例推動合法工業住宅：配合產業發展重點地區及在地居住使用需求，推動工業宅條例調整變更，確保居住權益。'::TEXT),
        TRUE
    ) || jsonb_build_object(
        'manualOfficialBulletinReview',
        jsonb_build_object('status', 'corrected_after_visual_comparison')
    ),
    updated_at = NOW()
WHERE claim.claim_key = 'cec-platform:2022:votetw-candidate-ebb87cef74634742';

-- Strip profile columns only when an exact standalone 政見 header leaves a
-- substantial candidate-specific body.
UPDATE public.person_claims claim
SET
    claim_value = BTRIM(SPLIT_PART(claim.claim_value, E'\n政見\n', 2)),
    claim_json = jsonb_set(
        jsonb_set(
            claim.claim_json,
            '{platformText}',
            to_jsonb(BTRIM(SPLIT_PART(claim.claim_value, E'\n政見\n', 2))),
            TRUE
        ),
        '{value}',
        to_jsonb(BTRIM(SPLIT_PART(claim.claim_value, E'\n政見\n', 2))),
        TRUE
    ) || jsonb_build_object(
        'manualOfficialBulletinReview',
        jsonb_build_object('status', 'profile_prefix_removed')
    ),
    updated_at = NOW()
WHERE claim.claim_key IN (
    'cec-platform:2022:votetw-candidate-d6fcc56fc3dff1b0',
    'cec-platform:2022:votetw-candidate-6c2321e7d8f28346',
    'cec-platform:2022:votetw-candidate-8486edebbe9ac7dd',
    'cec-platform:2022:votetw-candidate-7e69bf971e649e7c',
    'cec-platform:2022:votetw-candidate-31df6796ce4fc182'
)
  AND LENGTH(BTRIM(SPLIT_PART(claim.claim_value, E'\n政見\n', 2))) >= 100;

-- These Taipei text-layer crops contain only profile fields or a neighboring
-- candidate. Keep the source evidence private for image/manual recovery.
UPDATE public.person_claims claim
SET
    review_status = 'needs_more_evidence',
    visibility = 'private',
    is_public = FALSE,
    claim_json = claim.claim_json || jsonb_build_object(
        'publicationGate',
        jsonb_build_object(
            'status', 'private_manual_transcription_required',
            'reason', 'The official bulletin crop contains profile fields or a neighboring candidate instead of this candidacy platform.'
        )
    ),
    updated_at = NOW()
WHERE claim.claim_key IN (
    'cec-platform:2022:votetw-candidate-2dc25cd451b5d2ac',
    'cec-platform:2022:votetw-candidate-597a55452c5fe998',
    'cec-platform:2022:votetw-candidate-0c213f5efb13e949',
    'cec-platform:2022:votetw-candidate-de3eb31e853ca5af',
    'cec-platform:2022:votetw-candidate-345fbbea6f58b0e4'
);


DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.person_claims claim
        JOIN _cec_2022_profile_corrections correction
          ON correction.claim_key = claim.claim_key
        WHERE claim.claim_value IS DISTINCT FROM correction.claim_value
    ) THEN
        RAISE EXCEPTION 'One or more official profile corrections were not applied';
    END IF;
END;
$$;

SELECT published.promote(NULL);

COMMIT;
