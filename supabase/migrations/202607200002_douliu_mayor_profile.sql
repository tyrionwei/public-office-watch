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
VALUES (
    'official-current:douliu-city-mayor:lin-sheng-jue',
    'official_officeholder',
    'douliu-city-government-mayor-profile',
    '雲林縣斗六市公所：市長介紹',
    'https://dl.yunlin.gov.tw/cp.aspx?n=2800',
    '林聖爵',
    '林聖爵',
    '雲林縣斗六市市長',
    'local_chief',
    '雲林縣斗六市',
    '雲林縣斗六市',
    jsonb_build_object(
        'isCurrent', TRUE,
        'observedDate', '2026-07-17',
        'education', jsonb_build_array(
            '環球科技大學企業管理系',
            '樹德工業專科學校',
            '雲林縣斗六市梅林國民小學'
        ),
        'experience', jsonb_build_array(
            '雲林縣議會議員（第17屆）',
            '斗六市公所機要秘書',
            '斗六市民代表會代表（第8屆）',
            '梅林耕心協會理事長',
            '梅林、湖山守望相助隊大隊長',
            '雲林縣啟智協會顧問',
            '莿桐青商會會長（2007年）'
        )
    ),
    'A',
    'official-profile-gap-20260720',
    TRUE,
    NOW()
)
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

WITH target AS (
    SELECT DISTINCT pc.person_id
    FROM public_candidates pc
    WHERE pc.person_name = '林聖爵'
      AND pc.race_title = '雲林縣斗六市市長選舉'
      AND pc.election_year = 2022
      AND (pc.is_elected = TRUE OR pc.registration_status = 'elected')
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
    target.person_id,
    'auto_matched',
    100,
    'official_name_office_election',
    'Official current mayor profile matched to the elected 2022 Douliu mayor candidate.',
    jsonb_build_object(
        'version', 'official-name-office-election-v1',
        'electionYear', 2022,
        'raceTitle', '雲林縣斗六市市長選舉'
    ),
    'system:official-profile-gap',
    NOW(),
    NOW()
FROM source_people source
CROSS JOIN target
WHERE source.source_person_key = 'official-current:douliu-city-mayor:lin-sheng-jue'
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
    SELECT DISTINCT pc.person_id
    FROM public_candidates pc
    WHERE pc.person_name = '林聖爵'
      AND pc.race_title = '雲林縣斗六市市長選舉'
      AND pc.election_year = 2022
      AND (pc.is_elected = TRUE OR pc.registration_status = 'elected')
)
UPDATE people person
SET
    education = '環球科技大學企業管理系；樹德工業專科學校；雲林縣斗六市梅林國民小學',
    experience = '雲林縣議會議員（第17屆）；斗六市公所機要秘書；斗六市民代表會代表（第8屆）；梅林耕心協會理事長；梅林、湖山守望相助隊大隊長；雲林縣啟智協會顧問；莿桐青商會會長（2007年）',
    source_url = 'https://dl.yunlin.gov.tw/cp.aspx?n=2800',
    updated_at = NOW()
FROM target
WHERE person.id = target.person_id
  AND person.name = '林聖爵'
  AND (
      NULLIF(BTRIM(person.experience), '') IS NULL
      OR NULLIF(BTRIM(person.education), '') IS NULL
      OR person.education = '大學'
  );

WITH target AS (
    SELECT DISTINCT pc.person_id
    FROM public_candidates pc
    WHERE pc.person_name = '林聖爵'
      AND pc.race_title = '雲林縣斗六市市長選舉'
      AND pc.election_year = 2022
      AND (pc.is_elected = TRUE OR pc.registration_status = 'elected')
),
claim_values AS (
    SELECT *
    FROM (
        VALUES
            (
                'education',
                '環球科技大學企業管理系；樹德工業專科學校；雲林縣斗六市梅林國民小學'
            ),
            (
                'experience',
                '雲林縣議會議員（第17屆）；斗六市公所機要秘書；斗六市民代表會代表（第8屆）；梅林耕心協會理事長；梅林、湖山守望相助隊大隊長；雲林縣啟智協會顧問；莿桐青商會會長（2007年）'
            )
    ) AS values_table(claim_type, claim_value)
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
    source.source_person_key || ':' || claim_values.claim_type,
    target.person_id,
    source.id,
    claim_values.claim_type,
    claim_values.claim_value,
    source.source_payload || jsonb_build_object(
        'sourcePersonKey', source.source_person_key,
        'field', claim_values.claim_type
    ),
    'A',
    'verified',
    'public',
    source.source_name,
    source.source_url,
    TIMESTAMPTZ '2026-07-17 00:00:00+08',
    TRUE,
    100,
    'official-profile-gap-v1',
    jsonb_build_array('Official current mayor profile'),
    NOW(),
    NOW()
FROM source_people source
CROSS JOIN target
CROSS JOIN claim_values
WHERE source.source_person_key = 'official-current:douliu-city-mayor:lin-sheng-jue'
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
