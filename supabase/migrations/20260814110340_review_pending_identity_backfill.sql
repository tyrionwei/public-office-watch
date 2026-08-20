-- Resolve identity proposals that already have exactly one context-scored target.
-- This only links private review data; it does not publish sources or claims.
WITH unique_context_proposals AS MATERIALIZED (
    SELECT
        review.source_person_id,
        MIN(identity_match.person_id::TEXT)::UUID AS person_id
    FROM public.person_identity_review_queue review
    JOIN public.person_identity_matches identity_match
      ON identity_match.source_person_id = review.source_person_id
     AND identity_match.match_status = 'probable_match'
     AND identity_match.match_method = 'name_party_role_scoring'
     AND identity_match.score >= 75
    GROUP BY review.source_person_id
    HAVING COUNT(DISTINCT identity_match.person_id) = 1
)
UPDATE public.person_identity_matches identity_match
SET
    match_status = 'auto_matched',
    evidence_json = COALESCE(identity_match.evidence_json, '{}'::jsonb) || jsonb_build_object(
        'approval', jsonb_build_object(
            'version', 'unique-context-proposal-review-v1',
            'reason', 'Exactly one existing context-scored proposal remained after same-name candidate review',
            'approvedAt', NOW()
        )
    ),
    reviewed_by = 'system:unique-context-proposal-review-v1',
    reviewed_at = NOW(),
    updated_at = NOW()
FROM unique_context_proposals proposal
WHERE identity_match.source_person_id = proposal.source_person_id
  AND identity_match.person_id = proposal.person_id;

-- Resolve historical elected-office records against the already imported CEC
-- candidate result for the same person, year, region and elected outcome.
WITH official_election_candidates AS MATERIALIZED (
    SELECT DISTINCT
        review.source_person_id,
        canonical_map.canonical_person_id AS person_id,
        candidate.election_year,
        candidate.election_name,
        candidate.race_title,
        candidate.region_name,
        candidate.source_name
    FROM public.person_identity_review_queue review
    JOIN public.source_people source ON source.id = review.source_person_id
    JOIN public.public_candidates candidate
      ON lower(regexp_replace(replace(candidate.person_name, '臺', '台'), E'[\\s‧·．・･•]+', '', 'g')) = source.normalized_name
     AND candidate.election_year = source.election_year
     AND candidate.is_elected = TRUE
     AND candidate.source_name LIKE '中央選舉委員會%'
     AND lower(regexp_replace(replace(COALESCE(candidate.region_name, ''), '臺', '台'), E'\\s+', '', 'g')) = source.normalized_region
    JOIN public.person_canonical_map canonical_map ON canonical_map.person_id = candidate.person_id
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-election-database'
),
unique_official_election_candidates AS (
    SELECT
        source_person_id,
        MIN(person_id::TEXT)::UUID AS person_id,
        MIN(election_year) AS election_year,
        MIN(election_name) AS election_name,
        MIN(race_title) AS race_title,
        MIN(region_name) AS region_name,
        MIN(source_name) AS source_name
    FROM official_election_candidates
    GROUP BY source_person_id
    HAVING COUNT(DISTINCT person_id) = 1
)
INSERT INTO public.person_identity_matches (
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
    candidate.source_person_id,
    candidate.person_id,
    'auto_matched',
    100,
    'official_cec_exact_elected_race_v1',
    'auto-approved: official CEC name, election year, region and elected result identify one canonical person',
    jsonb_build_object(
        'version', 'official-cec-exact-elected-race-v1',
        'electionYear', candidate.election_year,
        'electionName', candidate.election_name,
        'raceTitle', candidate.race_title,
        'regionName', candidate.region_name,
        'sourceName', candidate.source_name
    ),
    'system:official-cec-exact-elected-race-v1',
    NOW(),
    NOW()
FROM unique_official_election_candidates candidate
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at;

-- Resolve a current official officeholder only when CEC elected results leave
-- one same-name person in the same region and office category.
WITH official_officeholder_candidates AS MATERIALIZED (
    SELECT DISTINCT
        review.source_person_id,
        canonical_map.canonical_person_id AS person_id,
        candidate.election_year,
        candidate.election_name,
        candidate.race_title,
        candidate.region_name,
        candidate.source_name
    FROM public.person_identity_review_queue review
    JOIN public.source_people source ON source.id = review.source_person_id
    JOIN public.public_candidates candidate
      ON lower(regexp_replace(replace(candidate.person_name, '臺', '台'), E'[\\s‧·．・･•]+', '', 'g')) = source.normalized_name
     AND candidate.is_elected = TRUE
     AND candidate.source_name LIKE '中央選舉委員會%'
     AND lower(regexp_replace(replace(COALESCE(candidate.region_name, ''), '臺', '台'), E'\\s+', '', 'g')) = source.normalized_region
     AND source.normalized_role = CASE
            WHEN candidate.race_title LIKE '%總統%' THEN 'president'
            WHEN candidate.race_title LIKE '%立法委員%' THEN 'legislator'
            WHEN candidate.race_title LIKE '%縣長%' OR candidate.race_title LIKE '%市長%' THEN 'local_chief'
            WHEN candidate.race_title LIKE '%議員%' THEN 'councilor'
            ELSE 'other'
         END
    JOIN public.person_canonical_map canonical_map ON canonical_map.person_id = candidate.person_id
    WHERE source.source_type = 'official_officeholder'
),
unique_official_officeholder_candidates AS (
    SELECT
        source_person_id,
        MIN(person_id::TEXT)::UUID AS person_id,
        MIN(election_year) AS election_year,
        MIN(election_name) AS election_name,
        MIN(race_title) AS race_title,
        MIN(region_name) AS region_name,
        MIN(source_name) AS source_name
    FROM official_officeholder_candidates
    GROUP BY source_person_id
    HAVING COUNT(DISTINCT person_id) = 1
)
INSERT INTO public.person_identity_matches (
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
    candidate.source_person_id,
    candidate.person_id,
    'auto_matched',
    100,
    'official_officeholder_elected_region_crosscheck_v1',
    'auto-approved: current official officeholder matches one same-name CEC-elected person in the same region and office category',
    jsonb_build_object(
        'version', 'official-officeholder-elected-region-crosscheck-v1',
        'electionYear', candidate.election_year,
        'electionName', candidate.election_name,
        'raceTitle', candidate.race_title,
        'regionName', candidate.region_name,
        'sourceName', candidate.source_name
    ),
    'system:official-officeholder-elected-region-crosscheck-v1',
    NOW(),
    NOW()
FROM unique_official_officeholder_candidates candidate
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at;

WITH reviewed_identity_targets AS (
    SELECT
        identity_match.source_person_id,
        MIN(canonical_map.canonical_person_id::TEXT)::UUID AS person_id
    FROM public.person_identity_matches identity_match
    JOIN public.person_canonical_map canonical_map ON canonical_map.person_id = identity_match.person_id
    WHERE identity_match.match_status = 'auto_matched'
      AND identity_match.reviewed_by IN (
          'system:unique-context-proposal-review-v1',
          'system:official-cec-exact-elected-race-v1',
          'system:official-officeholder-elected-region-crosscheck-v1'
      )
    GROUP BY identity_match.source_person_id
    HAVING COUNT(DISTINCT canonical_map.canonical_person_id) = 1
)
UPDATE public.person_claims claim
SET
    person_id = target.person_id,
    updated_at = NOW()
FROM reviewed_identity_targets target
WHERE claim.source_person_id = target.source_person_id
  AND claim.person_id IS NULL
  AND claim.review_status NOT IN ('rejected', 'archived');
