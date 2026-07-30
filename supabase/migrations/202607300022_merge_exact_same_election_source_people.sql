CREATE TEMP TABLE _exact_same_election_person_merges ON COMMIT DROP AS
WITH verified_birth_dates AS (
    SELECT
        claim.person_id,
        MIN(NULLIF(TRIM(COALESCE(claim.claim_value, claim.claim_json->>'value')), '')) AS birth_date
    FROM person_claims claim
    WHERE claim.claim_type = 'birth_date'
      AND claim.review_status = 'verified'
      AND claim.is_public = TRUE
    GROUP BY claim.person_id
),
matched_sources AS MATERIALIZED (
    SELECT
        source.source_id,
        source.source_person_key,
        source.raw_name,
        source.election_year,
        source.party,
        source.position,
        source.district,
        COALESCE(canonical.canonical_person_id, identity_match.person_id) AS person_id,
        lower(regexp_replace(
            replace(replace(replace(source.raw_name, '臺', '台'), '羣', '群'), '黄', '黃'),
            E'[\\s‧·．・･•]+',
            '',
            'g'
        )) AS canonical_name,
        CASE
            WHEN regexp_replace(replace(COALESCE(source.party, ''), '臺', '台'), E'\\s+', '', 'g') IN ('無', '無黨', '無黨籍') THEN '無黨籍'
            ELSE regexp_replace(replace(COALESCE(source.party, ''), '臺', '台'), E'\\s+', '', 'g')
        END AS canonical_party,
        CASE
            WHEN geography.raw_value IN ('台北縣', '新北市') THEN '新北市'
            WHEN geography.raw_value IN ('桃園縣', '桃園市') THEN '桃園市'
            WHEN geography.raw_value IN ('台中縣', '台中市') THEN '台中市'
            WHEN geography.raw_value IN ('台南縣', '台南市') THEN '台南市'
            WHEN geography.raw_value IN ('高雄縣', '高雄市') THEN '高雄市'
            ELSE geography.raw_value
        END AS canonical_geography,
        COALESCE(
            NULLIF(NULLIF(source.source_payload->>'districtCode', '')::INTEGER, 0),
            (regexp_match(public.normalize_election_district_label(source.district), '第([0-9]+)(選舉區|選區)'))[1]::INTEGER
        ) AS district_number,
        CASE
            WHEN concat_ws(' ', source.district, source.position) LIKE '%山地原住民%' THEN 'mountain_indigenous'
            WHEN concat_ws(' ', source.district, source.position) LIKE '%平地原住民%' THEN 'plain_indigenous'
            WHEN concat_ws(' ', source.district, source.position) LIKE '%原住民%' THEN 'indigenous'
            ELSE 'regional'
        END AS canonical_seat_type,
        CASE
            WHEN source.position LIKE '%總統%' THEN 'president'
            WHEN source.position LIKE '%立法委員%' THEN 'legislator'
            WHEN source.position LIKE '%縣市長%' OR source.position LIKE '%市長%' OR source.position LIKE '%地方首長%' THEN 'mayor'
            WHEN source.position LIKE '%議員%' THEN 'councilor'
            ELSE 'other'
        END AS canonical_role
    FROM source_people source
    JOIN person_identity_matches identity_match
      ON identity_match.source_person_id = source.id
     AND identity_match.match_status = 'auto_matched'
    LEFT JOIN person_canonical_map canonical ON canonical.person_id = identity_match.person_id
    CROSS JOIN LATERAL (
        SELECT COALESCE(
            substring(replace(source.district, '臺', '台') FROM '^(.+?[縣市])'),
            substring(replace(source.position, '臺', '台') FROM '^(.+?[縣市])')
        ) AS raw_value
    ) geography
    WHERE source.source_id IN ('cec-2024-votedata', 'votetw-election-history')
      AND source.election_year IS NOT NULL
),
same_election_groups AS (
    SELECT
        canonical_name,
        election_year,
        canonical_party,
        canonical_geography,
        district_number,
        canonical_role,
        canonical_seat_type,
        (MIN(person_id::TEXT) FILTER (WHERE source_id = 'cec-2024-votedata'))::UUID AS canonical_person_id,
        (MIN(person_id::TEXT) FILTER (WHERE source_id = 'votetw-election-history'))::UUID AS duplicate_person_id,
        MIN(source_person_key) FILTER (WHERE source_id = 'cec-2024-votedata') AS cec_source_person_key,
        MIN(source_person_key) FILTER (WHERE source_id = 'votetw-election-history') AS votetw_source_person_key,
        COUNT(DISTINCT person_id) AS person_count,
        COUNT(DISTINCT person_id) FILTER (WHERE source_id = 'cec-2024-votedata') AS cec_person_count,
        COUNT(DISTINCT person_id) FILTER (WHERE source_id = 'votetw-election-history') AS votetw_person_count
    FROM matched_sources
    WHERE canonical_geography IS NOT NULL
      AND canonical_role <> 'other'
    GROUP BY
        canonical_name,
        election_year,
        canonical_party,
        canonical_geography,
        district_number,
        canonical_role,
        canonical_seat_type
),
eligible_groups AS (
    SELECT
        grouped.*,
        canonical.name AS canonical_name_display,
        duplicate.name AS duplicate_name_display,
        canonical.external_id AS canonical_external_id,
        duplicate.external_id AS duplicate_external_id,
        canonical_birth.birth_date AS canonical_birth_date,
        duplicate_birth.birth_date AS duplicate_birth_date
    FROM same_election_groups grouped
    JOIN people canonical ON canonical.id = grouped.canonical_person_id
    JOIN people duplicate ON duplicate.id = grouped.duplicate_person_id
    LEFT JOIN verified_birth_dates canonical_birth ON canonical_birth.person_id = grouped.canonical_person_id
    LEFT JOIN verified_birth_dates duplicate_birth ON duplicate_birth.person_id = grouped.duplicate_person_id
    WHERE grouped.person_count = 2
      AND grouped.cec_person_count = 1
      AND grouped.votetw_person_count = 1
      AND grouped.canonical_person_id <> grouped.duplicate_person_id
      AND (canonical.external_id LIKE 'cec-%' OR canonical.external_id LIKE 'ly-%')
      AND duplicate.external_id LIKE 'votetw-person-%'
      AND (
          canonical_birth.birth_date IS NULL
          OR duplicate_birth.birth_date IS NULL
          OR canonical_birth.birth_date = duplicate_birth.birth_date
      )
      AND NOT EXISTS (
          SELECT 1
          FROM person_merge_decisions existing
          WHERE existing.duplicate_person_id = grouped.duplicate_person_id
            AND existing.status IN ('suggested', 'verified')
      )
)
SELECT * FROM eligible_groups;

INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    eligible.duplicate_person_id,
    eligible.canonical_person_id,
    'verified',
    'A',
    CONCAT(
        eligible.canonical_name_display,
        '：CEC 與 VoteTW 的同一屆參選紀錄在姓名、年份、黨籍、縣市、選區、職位及席次類型完全一致。'
    ),
    jsonb_build_object(
        'version', 'exact-same-election-source-merge-v1',
        'observedDate', '2026-07-30',
        'electionYear', eligible.election_year,
        'party', eligible.canonical_party,
        'geography', eligible.canonical_geography,
        'districtNumber', eligible.district_number,
        'role', eligible.canonical_role,
        'seatType', eligible.canonical_seat_type,
        'cecSourcePersonKey', eligible.cec_source_person_key,
        'voteTwSourcePersonKey', eligible.votetw_source_person_key,
        'canonicalExternalId', eligible.canonical_external_id,
        'duplicateExternalId', eligible.duplicate_external_id,
        'canonicalBirthDate', eligible.canonical_birth_date,
        'duplicateBirthDate', eligible.duplicate_birth_date
    ),
    'system:exact-same-election-source-merge-v1',
    NOW(),
    NOW()
FROM _exact_same_election_person_merges eligible;

SELECT published.promote(NULL);

SELECT * FROM public.process_historical_anchor_identities();
SELECT * FROM public.process_high_confidence_identity_reviews();
SELECT * FROM public.process_context_disambiguated_identities();
SELECT * FROM public.process_unique_career_progression_identities();
