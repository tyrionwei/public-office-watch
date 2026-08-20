BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

CREATE TEMP TABLE _platform_candidate_rebind_20260814 ON COMMIT DROP AS
WITH source_claims AS (
    SELECT
        claim.id AS claim_id,
        claim.candidate_id AS previous_candidate_id,
        person_map.canonical_person_id,
        race_map.canonical_race_id,
        COALESCE(source_candidate.candidate_no, '') AS candidate_no
    FROM public.person_claims AS claim
    JOIN public.candidates AS source_candidate
      ON source_candidate.id = claim.candidate_id
    JOIN public.person_canonical_map AS person_map
      ON person_map.person_id = source_candidate.person_id
    JOIN public.race_canonical_map AS race_map
      ON race_map.race_id = source_candidate.race_id
    WHERE claim.claim_type = 'platform'
      AND claim.candidate_id IS NOT NULL
), candidate_targets AS (
    SELECT
        source.claim_id,
        source.previous_candidate_id,
        COUNT(target.candidate_id) AS target_count,
        MIN(target.candidate_id::TEXT)::UUID AS target_candidate_id
    FROM source_claims AS source
    LEFT JOIN public.public_candidates AS target
      ON target.person_id = source.canonical_person_id
     AND target.race_id = source.canonical_race_id
     AND COALESCE(target.candidate_no, '') = source.candidate_no
    GROUP BY source.claim_id, source.previous_candidate_id
)
SELECT *
FROM candidate_targets;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _platform_candidate_rebind_20260814
        WHERE target_count <> 1
    ) THEN
        RAISE EXCEPTION 'Platform candidate repair found a missing or ambiguous canonical target';
    END IF;
END;
$$;

UPDATE public.person_claims AS claim
SET
    candidate_id = mapping.target_candidate_id,
    claim_json = jsonb_set(
        jsonb_set(
            COALESCE(claim.claim_json, '{}'::JSONB),
            '{electionContext,candidateId}',
            to_jsonb(mapping.target_candidate_id::TEXT),
            true
        ),
        '{candidateLinkRepair}',
        jsonb_build_object(
            'version', 'canonical-platform-candidate-v1',
            'previousCandidateId', mapping.previous_candidate_id,
            'canonicalCandidateId', mapping.target_candidate_id,
            'repairedAt', CURRENT_TIMESTAMP
        ),
        true
    ),
    updated_at = CURRENT_TIMESTAMP
FROM _platform_candidate_rebind_20260814 AS mapping
WHERE claim.id = mapping.claim_id
  AND mapping.target_count = 1
  AND mapping.previous_candidate_id <> mapping.target_candidate_id;

CREATE TEMP TABLE _reviewed_party_claims_20260814 ON COMMIT DROP AS
SELECT
    claim.id AS claim_id,
    claim.claim_key,
    person_map.canonical_person_id AS person_id,
    claim.claim_value AS party_name,
    public.canonical_party_name(claim.claim_value) AS normalized_party,
    CASE
        WHEN claim.source_name LIKE '中央選舉委員會%' THEN 'official_record'
        ELSE 'wiki_record'
    END AS role_context,
    COALESCE(
        election_year.observed_year,
        CASE
            WHEN claim.source_name LIKE '中央選舉委員會%'
            THEN SUBSTRING(claim.claim_key FROM '(19|20)[0-9]{2}')::INTEGER
            ELSE NULL
        END
    ) AS observed_year,
    claim.confidence_level,
    claim.source_name,
    claim.source_url,
    COALESCE(claim.claim_json, '{}'::JSONB) || jsonb_build_object(
        'sourceClaimKey', claim.claim_key,
        'precedence', 'reviewed-claim-without-explicit-date'
    ) AS source_payload,
    claim.updated_at
FROM public.person_claims AS claim
JOIN public.person_canonical_map AS person_map
  ON person_map.person_id = claim.person_id
LEFT JOIN LATERAL (
    SELECT MAX(SUBSTRING(record.value->>'election' FROM '(19|20)[0-9]{2}')::INTEGER) AS observed_year
    FROM jsonb_array_elements(COALESCE(claim.claim_json->'electionRecords', '[]'::JSONB)) AS record(value)
    WHERE public.canonical_party_name(record.value->>'party') = public.canonical_party_name(claim.claim_value)
) AS election_year ON true
WHERE claim.claim_type = 'party_affiliation'
  AND claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public = true
  AND NULLIF(BTRIM(claim.claim_key), '') IS NOT NULL
  AND NULLIF(BTRIM(claim.claim_value), '') IS NOT NULL;

UPDATE public.person_party_affiliations AS affiliation
SET
    person_id = reviewed.person_id,
    affiliation_key = 'party-affiliation:' || reviewed.person_id::TEXT || ':claim:' || reviewed.claim_key,
    party_name = reviewed.party_name,
    normalized_party = reviewed.normalized_party,
    review_status = 'verified',
    is_public = true,
    updated_at = GREATEST(affiliation.updated_at, reviewed.updated_at)
FROM _reviewed_party_claims_20260814 AS reviewed
WHERE affiliation.source_claim_key = reviewed.claim_key;

INSERT INTO public.person_party_affiliations (
    affiliation_key,
    person_id,
    source_person_id,
    source_claim_key,
    party_name,
    normalized_party,
    role_context,
    observed_year,
    observed_date,
    start_date,
    end_date,
    is_current,
    confidence_level,
    review_status,
    source_name,
    source_url,
    source_payload,
    is_public,
    updated_at
)
SELECT
    'party-affiliation:' || reviewed.person_id::TEXT || ':claim:' || reviewed.claim_key,
    reviewed.person_id,
    NULL,
    reviewed.claim_key,
    reviewed.party_name,
    reviewed.normalized_party,
    reviewed.role_context,
    reviewed.observed_year,
    NULL,
    NULL,
    NULL,
    false,
    COALESCE(reviewed.confidence_level, 'C'),
    'verified',
    reviewed.source_name,
    reviewed.source_url,
    reviewed.source_payload,
    true,
    reviewed.updated_at
FROM _reviewed_party_claims_20260814 AS reviewed
WHERE NOT EXISTS (
    SELECT 1
    FROM public.person_party_affiliations AS existing
    WHERE existing.source_claim_key = reviewed.claim_key
);

UPDATE public.person_party_affiliations AS affiliation
SET
    person_id = person_map.canonical_person_id,
    updated_at = GREATEST(affiliation.updated_at, CURRENT_TIMESTAMP)
FROM public.person_canonical_map AS person_map
WHERE person_map.person_id = affiliation.person_id
  AND affiliation.person_id <> person_map.canonical_person_id;

COMMIT;
