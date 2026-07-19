-- Exclude verified duplicate people from identity review candidates.
CREATE OR REPLACE VIEW person_identity_review_queue AS
WITH verified_birth_dates AS (
    SELECT
        pc.person_id,
        MIN(NULLIF(TRIM(COALESCE(pc.claim_value, pc.claim_json->>'value')), '')) AS birth_date
    FROM person_claims pc
    WHERE pc.claim_type = 'birth_date'
      AND pc.review_status = 'verified'
      AND pc.visibility = 'public'
      AND pc.is_public = TRUE
    GROUP BY pc.person_id
),
public_people_base AS (
    SELECT
        p.id,
        p.name,
        p.party,
        p.position,
        p.district,
        p.gender,
        birth_dates.birth_date,
        lower(regexp_replace(replace(p.name, '臺', '台'), E'[\\s‧·．・･•]+', '', 'g')) AS normalized_name,
        lower(regexp_replace(replace(COALESCE(NULLIF(p.party, ''), '未知政黨'), '臺', '台'), E'\\s+', '', 'g')) AS normalized_party,
        lower(regexp_replace(replace(COALESCE(NULLIF(p.district, ''), '未知選區'), '臺', '台'), E'\\s+', '', 'g')) AS normalized_district,
        CASE
            WHEN p.position LIKE '%總統%' THEN 'president'
            WHEN p.position LIKE '%立法委員%' THEN 'legislator'
            WHEN p.position LIKE '%縣市長%' OR p.position LIKE '%市長%' THEN 'mayor'
            WHEN p.position LIKE '%議員%' THEN 'councilor'
            ELSE 'other'
        END AS normalized_role
    FROM people p
    JOIN person_canonical_map canonical ON canonical.person_id = p.id AND canonical.canonical_person_id = p.id
    LEFT JOIN verified_birth_dates birth_dates ON birth_dates.person_id = p.id
    WHERE p.is_public = TRUE
),
reviewable_source_people AS (
    SELECT sp.*
    FROM source_people sp
    WHERE sp.source_type IN ('official_election', 'official_officeholder', 'government_open_data', 'official_site')
      AND NOT EXISTS (
        SELECT 1
        FROM person_identity_matches confirmed
        WHERE confirmed.source_person_id = sp.id
          AND confirmed.match_status = 'auto_matched'
    )
      AND NOT EXISTS (
        SELECT 1
        FROM person_claims existing_claim
        WHERE existing_claim.person_id IS NOT NULL
          AND existing_claim.source_person_id = sp.id
          AND existing_claim.review_status NOT IN ('rejected', 'archived')
    )
      AND NOT EXISTS (
        SELECT 1
        FROM person_claims existing_claim
        WHERE existing_claim.person_id IS NOT NULL
          AND existing_claim.claim_json->>'sourcePersonKey' = sp.source_person_key
          AND existing_claim.review_status NOT IN ('rejected', 'archived')
    )
),
candidate_pairs AS (
    SELECT
        sp.id AS source_person_id,
        candidate.id AS candidate_person_id,
        candidate.name,
        candidate.party,
        candidate.position,
        candidate.district,
        candidate.gender,
        candidate.birth_date,
        match_row.match_status,
        match_row.score AS existing_match_score,
        match_row.match_reason,
        match_row.evidence_json,
        (
            45
            + CASE
                WHEN sp.gender IS NOT NULL AND sp.gender <> 'unknown' AND candidate.gender = sp.gender THEN 20
                ELSE 0
              END
            + CASE
                WHEN sp.normalized_party IS NOT NULL AND sp.normalized_party = candidate.normalized_party THEN 10
                ELSE 0
              END
            + CASE
                WHEN sp.normalized_role IS NOT NULL AND sp.normalized_role <> 'other' AND sp.normalized_role = candidate.normalized_role THEN 10
                ELSE 0
              END
            + CASE
                WHEN sp.normalized_region IS NOT NULL AND candidate.normalized_district LIKE '%' || LEFT(sp.normalized_region, 3) || '%' THEN 5
                ELSE 0
              END
        )::NUMERIC AS heuristic_score
    FROM reviewable_source_people sp
    JOIN public_people_base candidate ON candidate.normalized_name = sp.normalized_name
    LEFT JOIN person_identity_matches match_row
      ON match_row.source_person_id = sp.id
     AND match_row.person_id = candidate.id
    WHERE NOT EXISTS (
        SELECT 1
        FROM person_identity_matches rejected
        WHERE rejected.source_person_id = sp.id
          AND rejected.person_id = candidate.id
          AND rejected.match_status = 'rejected_match'
    )
),
ranked_source_people AS (
    SELECT
        sp.id AS source_person_id,
        sp.source_person_key,
        sp.source_type,
        sp.source_name,
        sp.source_url,
        sp.raw_name,
        sp.normalized_name,
        sp.gender,
        sp.party,
        sp.position,
        sp.district,
        sp.election_year,
        sp.birth_date_text,
        sp.confidence_suggestion,
        COUNT(candidate_pairs.candidate_person_id) AS candidate_count,
        COALESCE(MAX(COALESCE(candidate_pairs.existing_match_score, candidate_pairs.heuristic_score)), 0) AS best_match_score,
        jsonb_agg(
            jsonb_build_object(
                'personId', candidate_pairs.candidate_person_id,
                'name', candidate_pairs.name,
                'party', candidate_pairs.party,
                'position', candidate_pairs.position,
                'district', candidate_pairs.district,
                'gender', candidate_pairs.gender,
                'birthDate', candidate_pairs.birth_date,
                'matchStatus', COALESCE(candidate_pairs.match_status, 'unreviewed_same_name'),
                'score', COALESCE(candidate_pairs.existing_match_score, candidate_pairs.heuristic_score),
                'reason', candidate_pairs.match_reason,
                'evidence', candidate_pairs.evidence_json
            )
            ORDER BY COALESCE(candidate_pairs.existing_match_score, candidate_pairs.heuristic_score) DESC, candidate_pairs.name
        ) FILTER (WHERE candidate_pairs.candidate_person_id IS NOT NULL) AS candidates,
        sp.updated_at
    FROM reviewable_source_people sp
    LEFT JOIN candidate_pairs ON candidate_pairs.source_person_id = sp.id
    GROUP BY
        sp.id,
        sp.source_person_key,
        sp.source_type,
        sp.source_name,
        sp.source_url,
        sp.raw_name,
        sp.normalized_name,
        sp.gender,
        sp.party,
        sp.position,
        sp.district,
        sp.election_year,
        sp.birth_date_text,
        sp.confidence_suggestion,
        sp.updated_at
)
SELECT
    source_person_id,
    source_person_key,
    source_type,
    source_name,
    source_url,
    raw_name,
    normalized_name,
    gender,
    party,
    position,
    district,
    election_year,
    birth_date_text,
    confidence_suggestion,
    candidate_count,
    best_match_score,
    CASE
        WHEN candidate_count = 0 THEN 'needs_new_person_review'
        WHEN best_match_score >= 75 THEN 'probable_match'
        ELSE 'needs_identity_review'
    END AS review_status,
    COALESCE(candidates, '[]'::jsonb) AS candidates,
    updated_at
FROM ranked_source_people
ORDER BY best_match_score DESC, raw_name, source_name;
