CREATE TEMP TABLE _miaoli_final_councilor_claims_batch_12 (
    person_id UUID NOT NULL,
    person_name TEXT NOT NULL,
    position TEXT NOT NULL,
    district TEXT NOT NULL,
    region TEXT NOT NULL,
    election_year INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    supporting_source_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
    observed_at DATE NOT NULL,
    claim_type TEXT NOT NULL,
    claim_value TEXT NOT NULL,
    PRIMARY KEY (person_id, claim_type)
) ON COMMIT DROP;

INSERT INTO _miaoli_final_councilor_claims_batch_12 VALUES
    (
        'edd5e882-2d44-49a7-8fad-25d490cb08da',
        '曾美露',
        '苗栗縣第1區議員',
        '苗栗縣第1選舉區',
        '苗栗縣',
        2022,
        'official_site',
        'gongguan-council-21st-term-meeting-record-zeng-meilu-education',
        '苗栗縣公館鄉民代表會：第21屆第4次定期會暨延會議事錄',
        'https://webws.miaoli.gov.tw/Download.ashx?n=56ysMjHlsYbnrKw05qyh5a6a5pyf5pyD44CB56ysMTDjgIExMeOAgTEy5qyh6Ieo5pmC5pyD6K2w5LqL6YyELnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvNDU5L3JlbGZpbGUvOTI5Ni8zODUwLzk0ODkxM2ZhLWJiMmItNDY3Yy1hYWRhLTcxZGRjZjFiNjFmZS5wZGY%3D',
        '["https://web.cec.gov.tw/api/file/08128523-9c27-4206-9f30-851dd49517f7.pdf"]'::JSONB,
        DATE '2026-07-22',
        'education',
        '商科；育達學校行銷管理系就讀'
    ),
    (
        'edd5e882-2d44-49a7-8fad-25d490cb08da',
        '曾美露',
        '苗栗縣第1區議員',
        '苗栗縣第1選舉區',
        '苗栗縣',
        2022,
        'official_site',
        'miaoli-local-office-history-zeng-meilu',
        '苗栗縣議會、苗栗縣政府：曾美露歷屆公職資料',
        'https://www.mcc.gov.tw/iframimgtxt_list.php?menu=2581&print=1&typeid=2622',
        '["https://www.miaoli.gov.tw/News_Content2.aspx?n=275&s=421685"]'::JSONB,
        DATE '2026-07-22',
        'experience',
        '苗栗縣議會第16屆議員；公館鄉鄉長'
    ),
    (
        '3f08fe96-5fe2-4933-a9b2-2e55f974ef5e',
        '周玉滿',
        '苗栗縣第3區議員',
        '苗栗縣第3選舉區',
        '苗栗縣',
        2014,
        'official_election',
        'cec-2014-miaoli-councilor-bulletin-district-3-5',
        '中央選舉委員會：2014年苗栗縣議員選舉第3、5選舉區公報',
        'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/103%E5%B9%B4/10%E8%8B%97%E6%A0%97%E7%B8%A3/%E8%8B%97%E6%A0%97%E7%B8%A3%E7%AC%AC3%E3%80%815%E9%81%B8%E8%88%89%E5%8D%80%E8%AD%B0%E5%93%A1.pdf',
        '["https://www.mcc.gov.tw/iframimgtxt_list.php?menu=7&print=1&typeid=2619"]'::JSONB,
        DATE '2014-11-29',
        'education',
        '親民工商專校企管系畢業'
    );

INSERT INTO source_people (
    source_person_key, source_type, source_id, source_name, source_url,
    raw_name, normalized_name, position, normalized_role, district,
    normalized_region, election_year, external_record_id, source_payload,
    confidence_suggestion, ingest_batch_key, is_public, updated_at
)
SELECT
    'official-profile:' || claim.source_id || ':' || claim.person_id,
    claim.source_type,
    claim.source_id,
    claim.source_name,
    claim.source_url,
    claim.person_name,
    claim.person_name,
    claim.position,
    'councilor',
    claim.district,
    claim.region,
    claim.election_year,
    claim.source_id || ':' || claim.person_name,
    jsonb_build_object(
        'field', claim.claim_type,
        'value', claim.claim_value,
        'supportingSourceUrls', claim.supporting_source_urls,
        'roleOrigin', CASE WHEN claim.source_type = 'official_election' THEN 'candidate' ELSE 'officeholder_history' END,
        'observedAt', claim.observed_at
    ),
    'A',
    'official-councilor-profile-gap-20260722-batch-12',
    TRUE,
    NOW()
FROM _miaoli_final_councilor_claims_batch_12 claim
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
    election_year = EXCLUDED.election_year,
    external_record_id = EXCLUDED.external_record_id,
    source_payload = source_people.source_payload || EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH identity_rows AS (
    SELECT claim.person_id, claim.source_type, source.id AS source_person_id, source.source_person_key
    FROM _miaoli_final_councilor_claims_batch_12 claim
    JOIN people person ON person.id = claim.person_id AND person.name = claim.person_name
    JOIN source_people source
      ON source.source_person_key = 'official-profile:' || claim.source_id || ':' || claim.person_id
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
    CASE
        WHEN source_type = 'official_election' THEN 'official_historical_election_identity'
        ELSE 'official_name_region_office_history'
    END,
    CASE
        WHEN source_type = 'official_election'
            THEN 'Official election bulletin matched by verified name, region, and electoral district.'
        ELSE 'Official local-government records matched by verified name, region, and public-office history.'
    END,
    jsonb_build_object('version', 'official-miaoli-final-councilor-profiles-v12', 'sourcePersonKey', source_person_key),
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

INSERT INTO person_claims (
    claim_key, person_id, source_person_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url,
    observed_at, is_public, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, updated_at
)
SELECT
    source.source_person_key || ':' || claim.claim_type,
    claim.person_id,
    source.id,
    claim.claim_type,
    claim.claim_value,
    source.source_payload || jsonb_build_object('sourcePersonKey', source.source_person_key),
    'A',
    'verified',
    'public',
    source.source_name,
    source.source_url,
    claim.observed_at::TIMESTAMPTZ,
    TRUE,
    100,
    'official-miaoli-final-councilor-profiles-v12',
    jsonb_build_array(
        CASE
            WHEN claim.source_type = 'official_election'
                THEN 'Official election bulletin matched by verified name, region, and electoral district.'
            ELSE 'Official local-government records matched by verified name, region, and public-office history.'
        END
    ),
    NOW(),
    NOW()
FROM _miaoli_final_councilor_claims_batch_12 claim
JOIN people person ON person.id = claim.person_id AND person.name = claim.person_name
JOIN source_people source
  ON source.source_person_key = 'official-profile:' || claim.source_id || ':' || claim.person_id
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
