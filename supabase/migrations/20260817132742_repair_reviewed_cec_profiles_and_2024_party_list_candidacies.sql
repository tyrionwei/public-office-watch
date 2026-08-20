-- Reconcile reviewed CEC bulletin profiles with canonical people and restore the
-- elected 2024 party-list candidacies. All source rows must already be verified,
-- public, and linked through the canonical person map.
BEGIN;

CREATE TEMP TABLE _repair_2022_profile_targets ON COMMIT DROP AS
WITH elected_2022_councilors AS (
    SELECT DISTINCT person_map.canonical_person_id AS person_id
    FROM public.candidates candidate
    JOIN public.person_canonical_map person_map
      ON person_map.person_id = candidate.person_id
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
      AND NULLIF(BTRIM(claim.claim_value), '') IS NOT NULL
      AND claim.source_name ILIKE '中央選舉委員會：2022%公報%'
    GROUP BY missing.person_id, missing.claim_type
    HAVING COUNT(DISTINCT BTRIM(claim.claim_value)) = 1
)
SELECT person_id, claim_type, claim_value
FROM official_values;

UPDATE public.people person
SET
    education = target.claim_value,
    updated_at = NOW()
FROM _repair_2022_profile_targets target
WHERE target.person_id = person.id
  AND target.claim_type = 'education'
  AND NULLIF(BTRIM(person.education), '') IS NULL;

UPDATE public.people person
SET
    experience = target.claim_value,
    updated_at = NOW()
FROM _repair_2022_profile_targets target
WHERE target.person_id = person.id
  AND target.claim_type = 'experience'
  AND NULLIF(BTRIM(person.experience), '') IS NULL;

-- 林倩綺的學歷被版面擷取併入經歷；以同一份官方公報的頁面與身分
-- 中繼資料建立缺少的學歷聲明，並修正經歷。
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
    REGEXP_REPLACE(claim.claim_key, ':experience$', ':education'),
    claim.person_id,
    claim.source_person_id,
    'education',
    '華盛頓大學博士、波士頓音樂學院碩士。',
    claim.claim_json || jsonb_build_object(
        'value', '華盛頓大學博士、波士頓音樂學院碩士。',
        'items', jsonb_build_array('華盛頓大學博士、波士頓音樂學院碩士。'),
        'extractionMethod', 'manual_official_bulletin_transcription',
        'extractionNote', 'Corrected after visual comparison found column or adjacent-section overflow in the automatic extraction.'
    ),
    claim.confidence_level,
    'verified',
    'public',
    claim.source_name,
    claim.source_url,
    claim.observed_at,
    TRUE,
    100,
    claim.scoring_version,
    claim.scoring_reasons,
    NOW(),
    claim.candidate_id
FROM public.person_claims claim
WHERE claim.claim_key = 'official-profile:cec-2024-election-bulletins:party-list:2dfa2413856622dd:experience'
ON CONFLICT (claim_key) DO UPDATE SET
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    review_score = 100,
    updated_at = NOW();

UPDATE public.person_claims claim
SET
    claim_value = '新北市政府文化局、原民局局長。高雄縣政府文化局局長。考試院典試委員。南華大學助理教授。',
    claim_json = claim.claim_json || jsonb_build_object(
        'value', '新北市政府文化局、原民局局長。高雄縣政府文化局局長。考試院典試委員。南華大學助理教授。',
        'items', jsonb_build_array('新北市政府文化局、原民局局長。高雄縣政府文化局局長。考試院典試委員。南華大學助理教授。'),
        'extractionMethod', 'manual_official_bulletin_transcription',
        'extractionNote', 'Corrected after visual comparison found column or adjacent-section overflow in the automatic extraction.'
    ),
    updated_at = NOW()
WHERE claim.claim_key = 'official-profile:cec-2024-election-bulletins:party-list:2dfa2413856622dd:experience';

UPDATE public.people person
SET
    education = '華盛頓大學博士、波士頓音樂學院碩士。',
    experience = '新北市政府文化局、原民局局長。高雄縣政府文化局局長。考試院典試委員。南華大學助理教授。',
    updated_at = NOW()
FROM public.person_claims claim
JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
WHERE claim.claim_key = 'official-profile:cec-2024-election-bulletins:party-list:2dfa2413856622dd:experience'
  AND person.id = person_map.canonical_person_id;

CREATE TEMP TABLE _cec_2024_party_list_elected ON COMMIT DROP AS
SELECT DISTINCT ON (person_map.canonical_person_id)
    person_map.canonical_person_id AS person_id,
    claim.claim_json->>'party' AS party,
    claim.claim_json->>'candidateNo' AS candidate_no,
    claim.claim_json->>'officialExternalId' AS external_id,
    claim.source_name,
    claim.source_url
FROM public.person_claims claim
JOIN public.person_canonical_map person_map ON person_map.person_id = claim.person_id
WHERE claim.claim_type = 'experience'
  AND claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public = TRUE
  AND claim.claim_json->>'profileSource' = 'cec_election_bulletin'
  AND claim.claim_json->>'electionYear' = '2024'
  AND claim.claim_json->>'raceTitle' = '全國不分區及僑居國外國民立法委員選舉'
  AND NULLIF(claim.claim_json->>'party', '') IS NOT NULL
  AND NULLIF(claim.claim_json->>'candidateNo', '') IS NOT NULL
  AND NULLIF(claim.claim_json->>'officialExternalId', '') IS NOT NULL
ORDER BY person_map.canonical_person_id, claim.claim_key;

DO $$
DECLARE
    profile_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM _cec_2024_party_list_elected;
    IF profile_count NOT IN (0, 34) THEN
        RAISE EXCEPTION 'Expected either 0 or 34 reviewed 2024 party-list profiles, found %', profile_count;
    END IF;
END;
$$;

INSERT INTO public.races (
    election_id,
    region_id,
    race_type,
    title,
    voting_date,
    status,
    source_name,
    source_url,
    is_public,
    external_id
)
SELECT
    election.id,
    NULL,
    'party_list_legislator',
    '全國不分區及僑居國外國民立法委員選舉',
    DATE '2024-01-13',
    'completed',
    '中央選舉委員會：2024年第11屆全國不分區及僑居國外國民立法委員選舉公報',
    (SELECT source_url FROM _cec_2024_party_list_elected ORDER BY source_url LIMIT 1),
    TRUE,
    'cec-2024-legislative-party-list'
FROM public.elections election
WHERE election.external_id = 'cec-2024-legislative-yuan'
  AND (SELECT COUNT(*) FROM _cec_2024_party_list_elected) = 34
ON CONFLICT (external_id) DO UPDATE SET
    election_id = EXCLUDED.election_id,
    race_type = EXCLUDED.race_type,
    title = EXCLUDED.title,
    voting_date = EXCLUDED.voting_date,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = TRUE,
    updated_at = NOW();

UPDATE public.candidates candidate
SET
    party = profile.party,
    candidate_no = profile.candidate_no,
    registration_status = 'elected',
    source_name = profile.source_name,
    source_url = profile.source_url,
    is_public = TRUE,
    external_id = profile.external_id,
    is_elected = TRUE,
    candidacy_status = 'qualified',
    election_result = 'elected',
    status_updated_at = NOW(),
    updated_at = NOW()
FROM _cec_2024_party_list_elected profile
JOIN public.races race ON race.external_id = 'cec-2024-legislative-party-list'
WHERE candidate.person_id = profile.person_id
  AND candidate.race_id = race.id;

INSERT INTO public.candidates (
    person_id,
    race_id,
    party,
    candidate_no,
    registration_status,
    source_name,
    source_url,
    is_public,
    external_id,
    is_elected,
    candidacy_status,
    election_result,
    status_updated_at
)
SELECT
    profile.person_id,
    race.id,
    profile.party,
    profile.candidate_no,
    'elected',
    profile.source_name,
    profile.source_url,
    TRUE,
    profile.external_id,
    TRUE,
    'qualified',
    'elected',
    NOW()
FROM _cec_2024_party_list_elected profile
JOIN public.races race ON race.external_id = 'cec-2024-legislative-party-list'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.candidates existing
    WHERE existing.person_id = profile.person_id
      AND existing.race_id = race.id
)
ON CONFLICT (external_id) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    race_id = EXCLUDED.race_id,
    party = EXCLUDED.party,
    candidate_no = EXCLUDED.candidate_no,
    registration_status = 'elected',
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = TRUE,
    is_elected = TRUE,
    candidacy_status = 'qualified',
    election_result = 'elected',
    status_updated_at = NOW(),
    updated_at = NOW();

DO $$
DECLARE
    profile_count INTEGER;
    candidate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM _cec_2024_party_list_elected;
    IF profile_count = 34 THEN
        SELECT COUNT(*) INTO candidate_count
        FROM public.candidates candidate
        JOIN public.races race ON race.id = candidate.race_id
        JOIN _cec_2024_party_list_elected profile ON profile.person_id = candidate.person_id
        WHERE race.external_id = 'cec-2024-legislative-party-list'
          AND candidate.is_public = TRUE
          AND candidate.is_elected = TRUE;

        IF candidate_count <> 34 THEN
            RAISE EXCEPTION 'Expected 34 published elected 2024 party-list candidacies, found %', candidate_count;
        END IF;
    END IF;
END;
$$;

SELECT published.promote(NULL);

COMMIT;
