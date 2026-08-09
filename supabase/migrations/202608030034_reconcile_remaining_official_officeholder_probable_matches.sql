SET statement_timeout = 0;

-- Finish the remaining official-officeholder probable matches. Council and
-- mayor rows are allowed to differ from historical party labels when exact
-- name, gender, role and region identify one canonical person. Appointed
-- officials require the source-derived external id and exact office context.
CREATE TEMP TABLE _remaining_official_probable_targets ON COMMIT DROP AS
WITH current_match_rows AS MATERIALIZED (
    SELECT
        queue.source_person_id,
        source.source_person_key,
        source.source_name,
        source.position AS source_position,
        source.district AS source_district,
        match_row.person_id AS matched_person_id,
        canonical.canonical_person_id AS person_id,
        match_row.score AS original_score,
        match_row.match_reason AS previous_match_reason,
        match_row.evidence_json AS previous_match_evidence,
        target.external_id AS target_external_id,
        target.position AS target_position,
        target.district AS target_district,
        COUNT(*) OVER (PARTITION BY queue.source_person_id) AS candidate_count
    FROM identity_unmatched_source_people queue
    JOIN source_people source ON source.id = queue.source_person_id
    JOIN person_identity_matches match_row
      ON match_row.source_person_id = queue.source_person_id
     AND match_row.match_status IN ('probable_match', 'possible_match')
    JOIN people matched_person ON matched_person.id = match_row.person_id
    JOIN person_canonical_map canonical
      ON canonical.person_id = matched_person.id
    JOIN people target ON target.id = canonical.canonical_person_id
    WHERE queue.review_status = 'probable_match'
      AND source.source_type = 'official_officeholder'
      AND target.is_public = TRUE
      AND lower(regexp_replace(
          replace(target.name, '臺', '台'), E'\\s+', '', 'g'
      )) = queue.normalized_name
      AND source.gender IS NOT NULL
      AND source.gender <> 'unknown'
      AND source.gender = target.gender
),
current_eligible AS (
    SELECT
        match_row.source_person_id,
        match_row.person_id,
        match_row.matched_person_id,
        match_row.original_score,
        CASE
            WHEN match_row.original_score = 85
                THEN 'unique_identity_with_current_context'
            ELSE 'source_derived_external_id_and_exact_office'
        END AS resolution_strategy,
        jsonb_build_object(
            'version', 'official-officeholder-remaining-probable-v1',
            'strategy', CASE
                WHEN match_row.original_score = 85
                    THEN 'unique_identity_with_current_context'
                ELSE 'source_derived_external_id_and_exact_office'
            END,
            'originalScore', match_row.original_score,
            'sourcePersonKey', match_row.source_person_key,
            'sourceName', match_row.source_name,
            'sourcePosition', match_row.source_position,
            'sourceDistrict', match_row.source_district,
            'matchedPersonId', match_row.matched_person_id,
            'canonicalPersonId', match_row.person_id,
            'previousMatchReason', match_row.previous_match_reason,
            'previousMatchEvidence', match_row.previous_match_evidence
        ) AS desired_evidence_json
    FROM current_match_rows match_row
    WHERE match_row.candidate_count = 1
      AND (
          match_row.original_score = 85
          OR (
              match_row.original_score = 75
              AND match_row.target_external_id =
                  'official-appointed:' || match_row.source_person_key
              AND match_row.target_position = match_row.source_position
              AND match_row.target_district = match_row.source_district
          )
      )
      AND NOT EXISTS (
          SELECT 1
          FROM person_identity_matches rejected
          JOIN person_canonical_map rejected_canonical
            ON rejected_canonical.person_id = rejected.person_id
          WHERE rejected.source_person_id = match_row.source_person_id
            AND rejected.match_status = 'rejected_match'
            AND rejected_canonical.canonical_person_id = match_row.person_id
      )
),
already_processed AS (
    SELECT
        match_row.source_person_id,
        match_row.person_id,
        COALESCE(
            NULLIF(match_row.evidence_json->>'matchedPersonId', '')::UUID,
            match_row.person_id
        ) AS matched_person_id,
        (match_row.evidence_json->>'originalScore')::NUMERIC AS original_score,
        match_row.evidence_json->>'strategy' AS resolution_strategy,
        match_row.evidence_json AS desired_evidence_json
    FROM person_identity_matches match_row
    WHERE match_row.match_status = 'auto_matched'
      AND match_row.match_method =
          'official_officeholder_remaining_probable_v1'
      AND match_row.reviewed_by =
          'system:official-officeholder-remaining-probable-v1'
)
SELECT * FROM current_eligible
UNION ALL
SELECT processed.*
FROM already_processed processed
WHERE NOT EXISTS (
    SELECT 1
    FROM current_eligible current_row
    WHERE current_row.source_person_id = processed.source_person_id
);

ALTER TABLE _remaining_official_probable_targets
    ADD PRIMARY KEY (source_person_id);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _remaining_official_probable_targets) <> 25
       OR (
           SELECT COUNT(*)
           FROM _remaining_official_probable_targets
           WHERE resolution_strategy =
                 'unique_identity_with_current_context'
       ) <> 22
       OR (
           SELECT COUNT(*)
           FROM _remaining_official_probable_targets
           WHERE resolution_strategy =
                 'source_derived_external_id_and_exact_office'
       ) <> 3
       OR (
           SELECT COUNT(*)
           FROM person_claims claim
           JOIN _remaining_official_probable_targets target
             ON target.source_person_id = claim.source_person_id
       ) <> 153
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _remaining_official_probable_targets target
             ON target.source_person_id = claim.source_person_id
           LEFT JOIN person_canonical_map canonical
             ON canonical.person_id = claim.person_id
           WHERE claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
              OR (
                  claim.person_id IS NOT NULL
                  AND canonical.canonical_person_id IS DISTINCT FROM target.person_id
              )
       ) THEN
        RAISE EXCEPTION 'Remaining official probable-match boundary drifted';
    END IF;
END;
$$;

INSERT INTO person_identity_matches (
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
    target.source_person_id,
    target.person_id,
    'auto_matched',
    100,
    'official_officeholder_remaining_probable_v1',
    CASE target.resolution_strategy
        WHEN 'unique_identity_with_current_context'
            THEN 'auto-approved: exact name and gender identify one canonical officeholder in the same role and region; current official party context may differ from history'
        ELSE 'auto-approved: exact name, gender, source-derived external id and office context identify one canonical appointed official'
    END,
    target.desired_evidence_json,
    'system:official-officeholder-remaining-probable-v1',
    NOW(),
    NOW()
FROM _remaining_official_probable_targets target
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at
WHERE person_identity_matches.match_status IS DISTINCT FROM EXCLUDED.match_status
   OR person_identity_matches.score IS DISTINCT FROM EXCLUDED.score
   OR person_identity_matches.match_method IS DISTINCT FROM EXCLUDED.match_method
   OR person_identity_matches.match_reason IS DISTINCT FROM EXCLUDED.match_reason
   OR person_identity_matches.evidence_json IS DISTINCT FROM EXCLUDED.evidence_json
   OR person_identity_matches.reviewed_by IS DISTINCT FROM EXCLUDED.reviewed_by;

UPDATE person_claims claim
SET
    person_id = target.person_id,
    updated_at = NOW()
FROM _remaining_official_probable_targets target
WHERE claim.source_person_id = target.source_person_id
  AND claim.person_id IS DISTINCT FROM target.person_id
  AND (
      claim.person_id IS NULL
      OR EXISTS (
          SELECT 1
          FROM person_canonical_map canonical
          WHERE canonical.person_id = claim.person_id
            AND canonical.canonical_person_id = target.person_id
      )
  );

UPDATE source_people source
SET
    is_public = TRUE,
    updated_at = NOW()
FROM _remaining_official_probable_targets target
WHERE source.id = target.source_person_id
  AND source.is_public = FALSE;

SELECT published.promote(NULL);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _remaining_official_probable_targets target
        LEFT JOIN person_identity_matches identity_match
          ON identity_match.source_person_id = target.source_person_id
         AND identity_match.person_id = target.person_id
        WHERE identity_match.match_status IS DISTINCT FROM 'auto_matched'
           OR identity_match.score IS DISTINCT FROM 100
           OR identity_match.match_method IS DISTINCT FROM
              'official_officeholder_remaining_probable_v1'
    )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _remaining_official_probable_targets target
             ON target.source_person_id = claim.source_person_id
           WHERE claim.person_id IS DISTINCT FROM target.person_id
              OR claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
       )
       OR EXISTS (
           SELECT 1
           FROM source_people source
           JOIN _remaining_official_probable_targets target
             ON target.source_person_id = source.id
           WHERE source.is_public <> TRUE
       )
       OR EXISTS (
           SELECT 1
           FROM identity_unmatched_source_people
           WHERE review_status = 'probable_match'
       )
       OR (
           SELECT COUNT(*)
           FROM identity_unmatched_source_people
           WHERE review_status = 'unmatched'
       ) <> 499 THEN
        RAISE EXCEPTION 'Remaining official probable matches were not reconciled';
    END IF;
END;
$$;

RESET statement_timeout;
