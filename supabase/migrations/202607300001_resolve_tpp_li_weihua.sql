BEGIN;

INSERT INTO people (
    id, name, party, position, source_url, is_public, created_at, updated_at
)
VALUES (
    'afd90c3a-4a5e-4eab-829b-63223445dbb3',
    '李偉華',
    '台灣民眾黨',
    '中央評議委員會主任委員',
    'https://www.tpp.org.tw/member/3',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    party = EXCLUDED.party,
    position = EXCLUDED.position,
    source_url = EXCLUDED.source_url,
    is_public = TRUE,
    updated_at = NOW();

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, party, normalized_party, position,
    source_payload, confidence_suggestion, ingest_batch_key, is_public, updated_at
)
VALUES (
    'official-site:tpp:current:16ecc7b88ee3a632',
    'official_site',
    'tpp-current-16ecc7b88ee3a632',
    '台灣民眾黨：現任黨公職',
    'https://www.tpp.org.tw/member/3',
    '李偉華',
    '李偉華',
    '台灣民眾黨',
    '台灣民眾黨',
    '中央評議委員會主任委員',
    jsonb_build_object(
        'categories', '["中央評議委員會"]'::JSONB,
        'roles', '[{"role_context":"party_officer","role_title":"中央評議委員會主任委員","organization_unit":"中央評議委員會","display_order":300}]'::JSONB,
        'education', '["中國政法大學 法學博士"]'::JSONB,
        'experience', '["台灣民眾黨第四屆中央評議委員會主任委員","台灣民眾黨第三屆中央評議委員會主任委員","華威國際創新股份有限公司 董事長","台灣工商企業聯合會 會務顧問","台北市高端醫療健康拹會 秘書長","宜蘭縣經濟暨工商旅遊發展協會 榮譽理事長","宜蘭縣漁民權益暨海洋發展協會 理事長","宜蘭縣都市更新協會 常務理事"]'::JSONB,
        'sourceUrls', '["https://www.tpp.org.tw/member/3"]'::JSONB,
        'observedDate', '2026-07-26',
        'dateSemantics', 'official_roster_observed_date'
    ),
    'A',
    'tpp-official-current-members-20260726',
    TRUE,
    NOW()
)
ON CONFLICT (source_person_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    party = EXCLUDED.party,
    normalized_party = EXCLUDED.normalized_party,
    position = EXCLUDED.position,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO person_identity_matches (
    source_person_id, person_id, match_status, score, match_method, match_reason,
    evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    source.id,
    'afd90c3a-4a5e-4eab-829b-63223445dbb3',
    'auto_matched',
    100,
    'official_current_roster_reviewed_new_person',
    'User review confirmed that the TPP central evaluation committee chair is distinct from both Keelung people with the same name.',
    jsonb_build_object(
        'sourcePersonKey', source.source_person_key,
        'observedDate', '2026-07-26',
        'reviewedDate', '2026-07-30'
    ),
    'user-reviewed:tpp-party-officer',
    NOW(),
    NOW()
FROM source_people source
WHERE source.source_person_key = 'official-site:tpp:current:16ecc7b88ee3a632'
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = NOW();

WITH claim_rows (claim_type, claim_value) AS (
    VALUES
        ('education', '中國政法大學 法學博士'),
        ('experience', '台灣民眾黨第四屆中央評議委員會主任委員；台灣民眾黨第三屆中央評議委員會主任委員；華威國際創新股份有限公司 董事長；台灣工商企業聯合會 會務顧問；台北市高端醫療健康拹會 秘書長；宜蘭縣經濟暨工商旅遊發展協會 榮譽理事長；宜蘭縣漁民權益暨海洋發展協會 理事長；宜蘭縣都市更新協會 常務理事')
)
INSERT INTO person_claims (
    claim_key, person_id, source_person_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, updated_at
)
SELECT
    source.source_person_key || ':' || claim.claim_type,
    'afd90c3a-4a5e-4eab-829b-63223445dbb3',
    source.id,
    claim.claim_type,
    claim.claim_value,
    source.source_payload || jsonb_build_object('field', claim.claim_type),
    'A',
    'verified',
    'public',
    source.source_name,
    source.source_url,
    TIMESTAMPTZ '2026-07-26 00:00:00+08',
    TRUE,
    100,
    'official-party-roster-v1',
    jsonb_build_array('Official party roster and profile snapshot.'),
    NOW(),
    NOW()
FROM claim_rows claim
JOIN source_people source
  ON source.source_person_key = 'official-site:tpp:current:16ecc7b88ee3a632'
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
    updated_at = NOW();

INSERT INTO person_party_affiliations (
    affiliation_key, person_id, source_person_id, party_name, normalized_party,
    role_context, role_title, organization_unit, display_order,
    observed_year, observed_date, is_current, confidence_level, review_status,
    source_name, source_url, source_payload, is_public, created_at, updated_at
)
SELECT
    source.source_person_key || ':role:' || MD5('party_officer:中央評議委員會主任委員:中央評議委員會'),
    'afd90c3a-4a5e-4eab-829b-63223445dbb3',
    source.id,
    '台灣民眾黨',
    '台灣民眾黨',
    'party_officer',
    '中央評議委員會主任委員',
    '中央評議委員會',
    300,
    2026,
    DATE '2026-07-26',
    TRUE,
    'A',
    'verified',
    source.source_name,
    source.source_url,
    source.source_payload || jsonb_build_object(
        'roleTitle', '中央評議委員會主任委員',
        'organizationUnit', '中央評議委員會',
        'dateSemantics', 'official_roster_observed_date'
    ),
    TRUE,
    NOW(),
    NOW()
FROM source_people source
WHERE source.source_person_key = 'official-site:tpp:current:16ecc7b88ee3a632'
ON CONFLICT (affiliation_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    source_person_id = EXCLUDED.source_person_id,
    party_name = EXCLUDED.party_name,
    normalized_party = EXCLUDED.normalized_party,
    role_context = EXCLUDED.role_context,
    role_title = EXCLUDED.role_title,
    organization_unit = EXCLUDED.organization_unit,
    display_order = EXCLUDED.display_order,
    observed_year = EXCLUDED.observed_year,
    observed_date = EXCLUDED.observed_date,
    is_current = EXCLUDED.is_current,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_payload = EXCLUDED.source_payload,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

REFRESH MATERIALIZED VIEW public_people_list_cached;
REFRESH MATERIALIZED VIEW published.party_officers;

COMMIT;
