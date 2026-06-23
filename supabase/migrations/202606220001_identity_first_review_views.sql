DROP VIEW IF EXISTS person_claim_review_queue;

CREATE OR REPLACE VIEW person_claim_review_queue AS
SELECT
    pc.id AS claim_id,
    pc.person_id,
    pc.source_person_id,
    sp.raw_name,
    sp.normalized_name,
    pc.claim_type,
    pc.claim_value,
    pc.claim_json,
    pc.confidence_level,
    pc.review_score,
    pc.review_status,
    pc.visibility,
    pc.source_name,
    pc.source_url,
    pc.scoring_version,
    pc.scoring_reasons,
    pc.updated_at
FROM person_claims pc
LEFT JOIN source_people sp ON sp.id = pc.source_person_id
WHERE pc.review_status IN ('pending', 'needs_more_evidence')
ORDER BY pc.review_score DESC, pc.updated_at DESC;

DROP VIEW IF EXISTS person_duplicate_review_queue;

CREATE OR REPLACE VIEW person_duplicate_review_queue AS
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
        p.education,
        p.experience,
        p.updated_at,
        lower(regexp_replace(replace(p.name, '臺', '台'), E'\\s+', '', 'g')) AS normalized_name,
        lower(regexp_replace(replace(COALESCE(NULLIF(p.party, ''), '未知政黨'), '臺', '台'), E'\\s+', '', 'g')) AS normalized_party,
        lower(regexp_replace(replace(COALESCE(NULLIF(p.district, ''), '未知選區'), '臺', '台'), E'\\s+', '', 'g')) AS normalized_district,
        (
            CASE WHEN p.position IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN p.district IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN p.gender IS NOT NULL AND p.gender <> 'unknown' THEN 1 ELSE 0 END +
            CASE WHEN p.education IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN p.experience IS NOT NULL THEN 1 ELSE 0 END
        ) AS profile_score
    FROM people p
    LEFT JOIN verified_birth_dates birth_dates ON birth_dates.person_id = p.id
    WHERE p.is_public = TRUE
),
verified_external_ids AS (
    SELECT DISTINCT
        pc.person_id,
        lower(COALESCE(
            pc.claim_value,
            CASE
                WHEN pc.claim_json ? 'wikidataQid' THEN 'wikidata:' || (pc.claim_json->>'wikidataQid')
                ELSE NULL
            END
        )) AS external_id
    FROM person_claims pc
    WHERE pc.claim_type = 'external_id'
      AND pc.review_status = 'verified'
      AND pc.visibility = 'public'
      AND pc.is_public = TRUE
      AND pc.claim_value IS NOT NULL
),
pair_candidates AS (
    SELECT
        LEAST(left_ids.person_id, right_ids.person_id) AS left_person_id,
        GREATEST(left_ids.person_id, right_ids.person_id) AS right_person_id,
        'same verified external ID' AS reason,
        'A'::TEXT AS confidence_level,
        100::NUMERIC AS score,
        jsonb_build_object('externalId', left_ids.external_id) AS evidence_json
    FROM verified_external_ids left_ids
    JOIN verified_external_ids right_ids
      ON right_ids.external_id = left_ids.external_id
     AND right_ids.person_id > left_ids.person_id

    UNION ALL

    SELECT
        LEAST(left_person.id, right_person.id) AS left_person_id,
        GREATEST(left_person.id, right_person.id) AS right_person_id,
        'same normalized name, gender, and birth date' AS reason,
        'A'::TEXT AS confidence_level,
        95::NUMERIC AS score,
        jsonb_build_object(
            'normalizedName', left_person.normalized_name,
            'gender', left_person.gender,
            'birthDate', left_person.birth_date
        ) AS evidence_json
    FROM public_people_base left_person
    JOIN public_people_base right_person
      ON right_person.normalized_name = left_person.normalized_name
     AND right_person.gender = left_person.gender
     AND right_person.birth_date = left_person.birth_date
     AND right_person.id > left_person.id
    WHERE left_person.gender IS NOT NULL
      AND left_person.gender <> 'unknown'
      AND left_person.birth_date IS NOT NULL

    UNION ALL

    SELECT
        LEAST(left_person.id, right_person.id) AS left_person_id,
        GREATEST(left_person.id, right_person.id) AS right_person_id,
        'same normalized name with contextual overlap' AS reason,
        'D'::TEXT AS confidence_level,
        55::NUMERIC AS score,
        jsonb_build_object(
            'normalizedName', left_person.normalized_name,
            'normalizedParty', CASE
                WHEN left_person.normalized_party = right_person.normalized_party THEN left_person.normalized_party
                ELSE NULL
            END,
            'normalizedDistrict', CASE
                WHEN left_person.normalized_district = right_person.normalized_district THEN left_person.normalized_district
                ELSE NULL
            END,
            'note', 'party and district are context only; they are not stable identity fields'
        ) AS evidence_json
    FROM public_people_base left_person
    JOIN public_people_base right_person
      ON right_person.normalized_name = left_person.normalized_name
     AND right_person.id > left_person.id
    WHERE (
        left_person.normalized_party = right_person.normalized_party
        OR left_person.normalized_district = right_person.normalized_district
    )
      AND NOT (
          left_person.gender IS NOT NULL
          AND right_person.gender IS NOT NULL
          AND left_person.gender <> 'unknown'
          AND right_person.gender <> 'unknown'
          AND left_person.gender <> right_person.gender
      )
),
deduped_pairs AS (
    SELECT DISTINCT ON (left_person_id, right_person_id)
        left_person_id,
        right_person_id,
        reason,
        confidence_level,
        score,
        evidence_json
    FROM pair_candidates
    ORDER BY left_person_id, right_person_id, score DESC
),
ranked_pairs AS (
    SELECT
        pair.*,
        left_person.profile_score AS left_score,
        right_person.profile_score AS right_score,
        CASE
            WHEN right_person.profile_score > left_person.profile_score THEN right_person.id
            ELSE left_person.id
        END AS suggested_canonical_person_id,
        CASE
            WHEN right_person.profile_score > left_person.profile_score THEN left_person.id
            ELSE right_person.id
        END AS suggested_duplicate_person_id
    FROM deduped_pairs pair
    JOIN public_people_base left_person ON left_person.id = pair.left_person_id
    JOIN public_people_base right_person ON right_person.id = pair.right_person_id
)
SELECT
    suggested_duplicate_person_id AS duplicate_person_id,
    duplicate_person.name AS duplicate_person_name,
    duplicate_person.party AS duplicate_person_party,
    duplicate_person.position AS duplicate_person_position,
    duplicate_person.district AS duplicate_person_district,
    suggested_canonical_person_id AS canonical_person_id,
    canonical_person.name AS canonical_person_name,
    canonical_person.party AS canonical_person_party,
    canonical_person.position AS canonical_person_position,
    canonical_person.district AS canonical_person_district,
    reason,
    confidence_level,
    score,
    evidence_json
FROM ranked_pairs
JOIN public_people_base duplicate_person ON duplicate_person.id = ranked_pairs.suggested_duplicate_person_id
JOIN public_people_base canonical_person ON canonical_person.id = ranked_pairs.suggested_canonical_person_id
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions decision
    WHERE decision.status IN ('verified', 'rejected', 'archived')
      AND (
          (
              decision.duplicate_person_id = ranked_pairs.suggested_duplicate_person_id
              AND decision.canonical_person_id = ranked_pairs.suggested_canonical_person_id
          )
          OR (
              decision.duplicate_person_id = ranked_pairs.suggested_canonical_person_id
              AND decision.canonical_person_id = ranked_pairs.suggested_duplicate_person_id
          )
      )
)
AND NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions verified_decision
    WHERE verified_decision.status = 'verified'
      AND verified_decision.duplicate_person_id = ranked_pairs.suggested_duplicate_person_id
)
ORDER BY score DESC, duplicate_person_name, canonical_person_name;
