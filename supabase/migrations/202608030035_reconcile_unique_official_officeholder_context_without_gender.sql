SET statement_timeout = 0;

-- Some current council sources do not publish gender. Resolve only rows where
-- the complete canonical person graph contains one exact-name identity and the
-- official party, office role and county/city all agree with that identity.
CREATE TEMP TABLE _unique_official_context_targets ON COMMIT DROP AS
WITH source_context AS MATERIALIZED (
    SELECT
        queue.source_person_id,
        source.source_person_key,
        source.source_name,
        source.raw_name,
        CASE
            WHEN regexp_replace(
                replace(COALESCE(source.party, ''), '臺', '台'),
                E'\\s+', '', 'g'
            ) IN ('無', '無黨', '無黨籍') THEN '無黨籍'
            ELSE regexp_replace(
                replace(COALESCE(source.party, ''), '臺', '台'),
                E'\\s+', '', 'g'
            )
        END AS normalized_party,
        CASE
            WHEN source.position LIKE '%總統%' THEN 'president'
            WHEN source.position LIKE '%立法委員%' THEN 'legislator'
            WHEN source.position LIKE '%縣市長%'
              OR source.position LIKE '%市長%' THEN 'mayor'
            WHEN source.position LIKE '%議員%' THEN 'councilor'
            ELSE 'other'
        END AS normalized_role,
        lower(regexp_replace(
            replace(COALESCE(source.position, ''), '臺', '台'),
            E'\\s+', '', 'g'
        )) AS normalized_position,
        COALESCE(
            substring(
                replace(source.district, '臺', '台')
                FROM '^(.+?[縣市])'
            ),
            substring(
                replace(source.position, '臺', '台')
                FROM '^(.+?[縣市])'
            )
        ) AS normalized_region
    FROM identity_unmatched_source_people queue
    JOIN source_people source ON source.id = queue.source_person_id
    WHERE queue.review_status = 'unmatched'
      AND source.source_type = 'official_officeholder'
),
candidate_pairs AS MATERIALIZED (
    SELECT DISTINCT
        source.source_person_id,
        source.source_person_key,
        source.source_name,
        source.raw_name,
        canonical.canonical_person_id AS person_id,
        target.is_public AS target_is_public,
        source.normalized_party = CASE
            WHEN regexp_replace(
                replace(COALESCE(target.party, ''), '臺', '台'),
                E'\\s+', '', 'g'
            ) IN ('無', '無黨', '無黨籍') THEN '無黨籍'
            ELSE regexp_replace(
                replace(COALESCE(target.party, ''), '臺', '台'),
                E'\\s+', '', 'g'
            )
        END AS party_match,
        (
            source.normalized_role <> 'other'
            AND source.normalized_role = CASE
                WHEN target.position LIKE '%總統%' THEN 'president'
                WHEN target.position LIKE '%立法委員%' THEN 'legislator'
                WHEN target.position LIKE '%縣市長%'
                  OR target.position LIKE '%市長%' THEN 'mayor'
                WHEN target.position LIKE '%議員%' THEN 'councilor'
                ELSE 'other'
            END
        ) OR (
            source.normalized_position <> ''
            AND source.normalized_position = lower(regexp_replace(
                replace(COALESCE(target.position, ''), '臺', '台'),
                E'\\s+', '', 'g'
            ))
        ) AS role_match,
        source.normalized_region IS NOT NULL
        AND source.normalized_region = COALESCE(
            substring(
                replace(target.district, '臺', '台')
                FROM '^(.+?[縣市])'
            ),
            substring(
                replace(target.position, '臺', '台')
                FROM '^(.+?[縣市])'
            )
        ) AS region_match
    FROM source_context source
    JOIN people alias ON alias.name = source.raw_name
    JOIN person_canonical_map canonical ON canonical.person_id = alias.id
    JOIN people target ON target.id = canonical.canonical_person_id
),
candidate_counts AS (
    SELECT
        source_person_id,
        COUNT(DISTINCT person_id) AS candidate_count
    FROM candidate_pairs
    GROUP BY source_person_id
),
current_eligible AS (
    SELECT DISTINCT
        candidate.source_person_id,
        candidate.person_id,
        candidate.source_person_key,
        candidate.source_name,
        candidate.raw_name,
        jsonb_build_object(
            'version', 'official-officeholder-unique-context-no-gender-v1',
            'strategy', 'unique_exact_name_party_role_region',
            'genderAvailable', FALSE,
            'sourcePersonKey', candidate.source_person_key,
            'sourceName', candidate.source_name,
            'sourceNameValue', candidate.raw_name,
            'canonicalPersonId', candidate.person_id,
            'matchedSignals', jsonb_build_array(
                'exact_name', 'party', 'role', 'region'
            )
        ) AS desired_evidence_json
    FROM candidate_pairs candidate
    JOIN candidate_counts counts USING (source_person_id)
    WHERE counts.candidate_count = 1
      AND candidate.target_is_public = TRUE
      AND candidate.party_match
      AND candidate.role_match
      AND candidate.region_match
      AND NOT EXISTS (
          SELECT 1
          FROM person_identity_matches rejected
          JOIN person_canonical_map rejected_canonical
            ON rejected_canonical.person_id = rejected.person_id
          WHERE rejected.source_person_id = candidate.source_person_id
            AND rejected.match_status = 'rejected_match'
            AND rejected_canonical.canonical_person_id = candidate.person_id
      )
),
already_processed AS (
    SELECT
        identity_match.source_person_id,
        identity_match.person_id,
        identity_match.evidence_json->>'sourcePersonKey' AS source_person_key,
        identity_match.evidence_json->>'sourceName' AS source_name,
        identity_match.evidence_json->>'sourceNameValue' AS raw_name,
        identity_match.evidence_json AS desired_evidence_json
    FROM person_identity_matches identity_match
    WHERE identity_match.match_status = 'auto_matched'
      AND identity_match.match_method =
          'official_officeholder_unique_context_no_gender_v1'
      AND identity_match.reviewed_by =
          'system:official-officeholder-unique-context-no-gender-v1'
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

ALTER TABLE _unique_official_context_targets
    ADD PRIMARY KEY (source_person_id);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _unique_official_context_targets) <> 182
       OR (
           SELECT COUNT(*)
           FROM person_claims claim
           JOIN _unique_official_context_targets target
             ON target.source_person_id = claim.source_person_id
       ) <> 910
       OR EXISTS (
           SELECT 1
           FROM _unique_official_context_targets target
           JOIN source_people source ON source.id = target.source_person_id
           JOIN people person ON person.id = target.person_id
           LEFT JOIN person_canonical_map canonical
             ON canonical.person_id = target.person_id
           WHERE source.source_type <> 'official_officeholder'
              OR person.is_public <> TRUE
              OR canonical.canonical_person_id IS DISTINCT FROM target.person_id
       )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _unique_official_context_targets target
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
        RAISE EXCEPTION 'Unique official context identity boundary drifted';
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
    96,
    'official_officeholder_unique_context_no_gender_v1',
    'auto-approved: the canonical person graph contains one exact-name identity and the official party, role and region all match; the source does not publish gender',
    target.desired_evidence_json,
    'system:official-officeholder-unique-context-no-gender-v1',
    NOW(),
    NOW()
FROM _unique_official_context_targets target
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
FROM _unique_official_context_targets target
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
FROM _unique_official_context_targets target
WHERE source.id = target.source_person_id
  AND source.is_public = FALSE;

SELECT published.promote(NULL);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _unique_official_context_targets target
        LEFT JOIN person_identity_matches identity_match
          ON identity_match.source_person_id = target.source_person_id
         AND identity_match.person_id = target.person_id
        WHERE identity_match.match_status IS DISTINCT FROM 'auto_matched'
           OR identity_match.score IS DISTINCT FROM 96
           OR identity_match.match_method IS DISTINCT FROM
              'official_officeholder_unique_context_no_gender_v1'
    )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _unique_official_context_targets target
             ON target.source_person_id = claim.source_person_id
           WHERE claim.person_id IS DISTINCT FROM target.person_id
              OR claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
       )
       OR EXISTS (
           SELECT 1
           FROM source_people source
           JOIN _unique_official_context_targets target
             ON target.source_person_id = source.id
           WHERE source.is_public <> TRUE
       )
       OR (
           SELECT COUNT(*)
           FROM identity_unmatched_source_people
           WHERE review_status = 'unmatched'
       ) <> 317 THEN
        RAISE EXCEPTION 'Unique official context identities were not reconciled';
    END IF;
END;
$$;

RESET statement_timeout;
