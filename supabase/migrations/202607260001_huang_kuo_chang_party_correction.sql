-- Correct a stale canonical party value retained from the 2016 election import.
UPDATE people
SET
    party = '台灣民眾黨',
    updated_at = NOW()
WHERE id = 'cf930cc4-febd-4bb7-969b-5b473b7bf588'
  AND name = '黃國昌'
  AND party IS DISTINCT FROM '台灣民眾黨';

UPDATE person_party_affiliations
SET
    is_current = FALSE,
    updated_at = NOW()
WHERE person_id = 'cf930cc4-febd-4bb7-969b-5b473b7bf588'
  AND normalized_party <> '台灣民眾黨'
  AND is_current = TRUE;

INSERT INTO person_party_affiliations (
    affiliation_key,
    person_id,
    party_name,
    normalized_party,
    role_context,
    observed_year,
    observed_date,
    start_date,
    is_current,
    confidence_level,
    review_status,
    source_name,
    source_url,
    source_payload,
    is_public,
    created_at,
    updated_at
)
VALUES
(
    'cec:2016-legislator:new-taipei-12:huang-kuo-chang:new-power-party',
    'cf930cc4-febd-4bb7-969b-5b473b7bf588',
    '時代力量',
    '時代力量',
    'candidate',
    2016,
    DATE '2015-11-24',
    NULL,
    FALSE,
    'A',
    'verified',
    '中央選舉委員會',
    'https://web.cec.gov.tw/api/file/e676acea-bb28-4214-8c0c-d1d92546e4c3.pdf',
    jsonb_build_object(
        'office', '第9屆立法委員',
        'district', '新北市第12選舉區',
        'recordType', 'candidate_registration'
    ),
    TRUE,
    NOW(),
    NOW()
),
(
    'tpp:2025-chair:huang-kuo-chang',
    'cf930cc4-febd-4bb7-969b-5b473b7bf588',
    '台灣民眾黨',
    '台灣民眾黨',
    'party_officer',
    2026,
    DATE '2026-04-22',
    DATE '2025-02-19',
    TRUE,
    'A',
    'verified',
    '台灣民眾黨',
    'https://www.tpp.org.tw/newsdetail/4552',
    jsonb_build_object(
        'role', '第2屆黨主席',
        'recordType', 'official_party_announcement',
        'inaugurationSourceUrl', 'https://www.tpp.org.tw/newsdetail/3789'
    ),
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (affiliation_key) DO UPDATE SET
    party_name = EXCLUDED.party_name,
    normalized_party = EXCLUDED.normalized_party,
    role_context = EXCLUDED.role_context,
    observed_year = EXCLUDED.observed_year,
    observed_date = EXCLUDED.observed_date,
    start_date = EXCLUDED.start_date,
    is_current = EXCLUDED.is_current,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_payload = EXCLUDED.source_payload,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

REFRESH MATERIALIZED VIEW public_people_list_cached;
