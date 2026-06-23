CREATE TABLE IF NOT EXISTS person_merge_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duplicate_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    canonical_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (
        status IN (
            'suggested',
            'verified',
            'rejected',
            'archived'
        )
    ),
    confidence_level TEXT NOT NULL DEFAULT 'C' CHECK (confidence_level IN ('A', 'B', 'C', 'D')),
    reason TEXT,
    evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (duplicate_person_id <> canonical_person_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_merge_decisions_duplicate_active
    ON person_merge_decisions(duplicate_person_id)
    WHERE status IN ('suggested', 'verified');

CREATE INDEX IF NOT EXISTS idx_person_merge_decisions_canonical
    ON person_merge_decisions(canonical_person_id);

CREATE INDEX IF NOT EXISTS idx_person_merge_decisions_status
    ON person_merge_decisions(status, updated_at DESC);

ALTER TABLE person_merge_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_manage_person_merge_decisions
    ON person_merge_decisions
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE OR REPLACE VIEW person_canonical_map AS
SELECT
    p.id AS person_id,
    COALESCE(m.canonical_person_id, p.id) AS canonical_person_id,
    m.id AS merge_decision_id,
    m.status AS merge_status,
    m.confidence_level AS merge_confidence_level
FROM people p
LEFT JOIN person_merge_decisions m
    ON m.duplicate_person_id = p.id
   AND m.status = 'verified';

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

WITH ranked_auto_merges AS (
    SELECT DISTINCT ON (duplicate_person_id)
        duplicate_person_id,
        canonical_person_id,
        confidence_level,
        reason,
        evidence_json
    FROM person_duplicate_review_queue
    WHERE confidence_level = 'A'
    ORDER BY duplicate_person_id, score DESC, canonical_person_id
)
INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at
)
SELECT
    duplicate_person_id,
    canonical_person_id,
    'verified',
    confidence_level,
    reason,
    evidence_json,
    'system:canonical-auto-merge',
    NOW()
FROM ranked_auto_merges queue
WHERE NOT EXISTS (
      SELECT 1
      FROM person_merge_decisions decision
      WHERE (
          decision.duplicate_person_id = queue.duplicate_person_id
          AND decision.canonical_person_id = queue.canonical_person_id
      )
      OR (
          decision.duplicate_person_id = queue.canonical_person_id
          AND decision.canonical_person_id = queue.duplicate_person_id
      )
  );

CREATE OR REPLACE VIEW public_people AS
WITH mapped_people AS (
    SELECT
        cm.canonical_person_id,
        p.*
    FROM people p
    JOIN person_canonical_map cm ON cm.person_id = p.id
    WHERE p.is_public = TRUE
),
canonical_people AS (
    SELECT p.*
    FROM people p
    WHERE p.is_public = TRUE
)
SELECT
    canonical.id AS person_id,
    canonical.name,
    COALESCE(canonical.alias, (array_remove(array_agg(mapped.alias ORDER BY mapped.updated_at DESC), NULL))[1]) AS alias,
    COALESCE(canonical.party, (array_remove(array_agg(mapped.party ORDER BY mapped.updated_at DESC), NULL))[1]) AS party,
    COALESCE(canonical.position, (array_remove(array_agg(mapped.position ORDER BY mapped.updated_at DESC), NULL))[1]) AS position,
    COALESCE(canonical.election_year, (array_remove(array_agg(mapped.election_year ORDER BY mapped.updated_at DESC), NULL))[1]) AS election_year,
    COALESCE(canonical.district, (array_remove(array_agg(mapped.district ORDER BY mapped.updated_at DESC), NULL))[1]) AS district,
    MAX(mapped.updated_at) AS updated_at,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.source_name AS photo_source_name,
    ph.source_url AS photo_source_url,
    ph.license_type AS photo_license_type,
    ph.license_url AS photo_license_url,
    ph.attribution AS photo_attribution,
    COALESCE(NULLIF(canonical.gender, 'unknown'), (array_remove(array_agg(NULLIF(mapped.gender, 'unknown') ORDER BY mapped.updated_at DESC), NULL))[1], canonical.gender) AS gender,
    COALESCE(canonical.education, (array_remove(array_agg(mapped.education ORDER BY mapped.updated_at DESC), NULL))[1]) AS education,
    COALESCE(canonical.experience, (array_remove(array_agg(mapped.experience ORDER BY mapped.updated_at DESC), NULL))[1]) AS experience
FROM mapped_people mapped
JOIN canonical_people canonical ON canonical.id = mapped.canonical_person_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = canonical.id
GROUP BY
    canonical.id,
    canonical.name,
    canonical.alias,
    canonical.party,
    canonical.position,
    canonical.election_year,
    canonical.district,
    canonical.gender,
    canonical.education,
    canonical.experience,
    ph.photo_url,
    ph.thumbnail_url,
    ph.source_name,
    ph.source_url,
    ph.license_type,
    ph.license_url,
    ph.attribution;

CREATE OR REPLACE VIEW public_candidates AS
WITH canonical_candidates AS (
    SELECT DISTINCT ON (cm.canonical_person_id, c.race_id, COALESCE(c.candidate_no, ''))
        c.*,
        cm.canonical_person_id
    FROM candidates c
    JOIN person_canonical_map cm ON cm.person_id = c.person_id
    ORDER BY cm.canonical_person_id, c.race_id, COALESCE(c.candidate_no, ''), c.updated_at DESC
)
SELECT
    c.id AS candidate_id,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    r.id AS race_id,
    r.title AS race_title,
    e.id AS election_id,
    e.name AS election_name,
    rg.id AS region_id,
    rg.name AS region_name,
    c.party,
    c.candidate_no,
    c.registration_status,
    c.source_name,
    c.source_url,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.attribution AS photo_attribution,
    ph.license_type AS photo_license_type
FROM canonical_candidates c
JOIN people p ON p.id = c.canonical_person_id AND p.is_public = TRUE
JOIN races r ON r.id = c.race_id AND r.is_public = TRUE
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE c.is_public = TRUE
  AND (r.region_id IS NULL OR rg.is_public = TRUE);

CREATE OR REPLACE VIEW public_person_claims AS
SELECT
    pc.id AS claim_id,
    cm.canonical_person_id AS person_id,
    pc.claim_type,
    pc.claim_value,
    pc.claim_json,
    pc.confidence_level,
    pc.review_score,
    pc.source_name,
    pc.source_url,
    pc.observed_at,
    pc.updated_at
FROM person_claims pc
JOIN person_canonical_map cm ON cm.person_id = pc.person_id
JOIN people p ON p.id = cm.canonical_person_id AND p.is_public = TRUE
WHERE pc.review_status = 'verified'
  AND pc.visibility = 'public'
  AND pc.is_public = TRUE;

CREATE OR REPLACE VIEW public_relation_details AS
SELECT
    r.id AS relation_id,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    p.district AS person_district,
    c.id AS company_id,
    c.name AS company_name,
    c.unified_business_no,
    r.relation_type,
    r.confidence_level,
    r.evidence_text,
    sd.id AS source_document_id,
    sd.source_name,
    sd.source_url,
    r.verification_status,
    r.created_at AS relation_created_at,
    r.updated_at AS relation_updated_at
FROM person_company_relations r
JOIN person_canonical_map cm ON cm.person_id = r.person_id
JOIN people p ON p.id = cm.canonical_person_id
JOIN companies c ON c.id = r.company_id
LEFT JOIN source_documents sd ON sd.id = r.evidence_source_id AND sd.is_public = TRUE
WHERE r.verification_status = 'verified'
  AND r.is_public = TRUE
  AND p.is_public = TRUE
  AND c.is_public = TRUE;

CREATE OR REPLACE VIEW public_person_identity_sources AS
SELECT
    sp.id AS identity_source_id,
    p.id AS person_id,
    p.name AS person_name,
    sp.source_type,
    sp.source_name,
    sp.source_url,
    sp.raw_name,
    sp.normalized_name,
    sp.party,
    sp.position,
    sp.district,
    sp.election_year,
    m.match_status,
    m.score AS match_score,
    sp.confidence_suggestion,
    sp.updated_at
FROM person_identity_matches m
JOIN source_people sp ON sp.id = m.source_person_id AND sp.is_public = TRUE
JOIN person_canonical_map cm ON cm.person_id = m.person_id
JOIN people p ON p.id = cm.canonical_person_id AND p.is_public = TRUE
WHERE m.match_status = 'auto_matched';
