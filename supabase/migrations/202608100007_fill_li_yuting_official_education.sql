BEGIN;

DO $verify_target$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = '6ef5bf0e-1005-44d9-8a31-8013020c45cb'
          AND name = '李雨庭'
    ) THEN
        RAISE EXCEPTION '李雨庭 target identity drifted';
    END IF;
END
$verify_target$;

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
) VALUES (
    'official-current:councilor:kcc-li-yu-ting-education-20260810',
    'official_officeholder',
    'kcc-current-councilor-li-yu-ting',
    '高雄市議會：第4屆議員李雨庭',
    'https://www.kcc.gov.tw/MemberInfo_New.aspx?msn=2226&n=76&sms=0',
    '李雨庭',
    '李雨庭',
    '高雄市第11區議員',
    'councilor',
    '高雄市第11選舉區',
    '高雄市',
    jsonb_build_object(
        'isCurrent', TRUE,
        'observedDate', '2026-08-10',
        'education', '高雄市立空中大學科技管理學系；國立高雄科技大學財政稅務系碩士',
        'educationDisplayPolicy', 'university_and_above'
    ),
    'A',
    'recent-high-risk-person-audit-20260810',
    TRUE,
    NOW()
)
ON CONFLICT (source_person_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

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
    '6ef5bf0e-1005-44d9-8a31-8013020c45cb',
    'auto_matched',
    100,
    'official_name_region_district',
    '高雄市議會現任議員頁依姓名、選區與職務確認。',
    jsonb_build_object('version', 'recent-high-risk-person-audit-v1'),
    'system:recent-high-risk-person-audit-v1',
    NOW(),
    NOW()
FROM source_people source
WHERE source.source_person_key = 'official-current:councilor:kcc-li-yu-ting-education-20260810'
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at;

UPDATE people
SET
    education = '高雄市立空中大學科技管理學系；國立高雄科技大學財政稅務系碩士',
    updated_at = NOW()
WHERE id = '6ef5bf0e-1005-44d9-8a31-8013020c45cb'
  AND NULLIF(BTRIM(education), '') IS NULL;

INSERT INTO person_claims (
    claim_key, person_id, source_person_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, updated_at
)
SELECT
    'official-current:councilor:kcc-li-yu-ting-education-20260810:education',
    '6ef5bf0e-1005-44d9-8a31-8013020c45cb',
    source.id,
    'education',
    '高雄市立空中大學科技管理學系；國立高雄科技大學財政稅務系碩士',
    source.source_payload || jsonb_build_object('field', 'education'),
    'A', 'verified', 'public', source.source_name, source.source_url,
    TIMESTAMPTZ '2026-08-10 00:00:00+08', TRUE, 100,
    'recent-high-risk-person-audit-v1',
    jsonb_build_array('高雄市議會現任議員資料依姓名、選區與職務確認。'),
    NOW(), NOW()
FROM source_people source
WHERE source.source_person_key = 'official-current:councilor:kcc-li-yu-ting-education-20260810'
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

SELECT published.promote(NULL);

COMMIT;
