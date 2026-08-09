SET statement_timeout = 0;

-- Review already-linked VoteTW profiles when a source election record uniquely
-- matches the current person's published VoteTW candidate history. Local
-- election strings may insert a jurisdiction between the year and election
-- type, so accept either the canonical election name or the complete race title.
-- The current person must also retain the exact VoteTW profile URL.
CREATE TEMP TABLE _votetw_existing_local_context_profiles AS
SELECT DISTINCT
    claim.person_id,
    person.name,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key
FROM person_claims claim
JOIN public_people person ON person.person_id = claim.person_id
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_type IN (
      'birth_date',
      'gender',
      'party_affiliation',
      'education',
      'experience'
  )
  AND claim.claim_json->'identityMatch'->>'matchedBy' =
      'unique_page_profile_with_birth_date'
  AND claim.claim_json->'identityResolution'->>'version' IS NULL
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.scoring_version IN (
          'votetw-existing-local-context-anchor-v1',
          'votetw-existing-local-context-conflict-v1'
      )
  );

CREATE FUNCTION pg_temp._votetw_norm_text(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN REGEXP_REPLACE(
    REPLACE(COALESCE(value, ''), '臺', '台'),
    E'\\s+',
    '',
    'g'
);

CREATE FUNCTION pg_temp._votetw_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN pg_temp._votetw_norm_text(value) IN (
        '無',
        '無黨',
        '無黨派',
        '無黨籍'
    ) THEN '無黨籍'
    WHEN pg_temp._votetw_norm_text(value) IN (
        '台灣基進',
        '基進黨'
    ) THEN '台灣基進'
    WHEN pg_temp._votetw_norm_text(value) IN (
        '台灣綠黨',
        '綠黨'
    ) THEN '綠黨'
    ELSE pg_temp._votetw_norm_text(value)
END;

CREATE TEMP TABLE _votetw_existing_local_context_records AS
SELECT DISTINCT
    pending.person_id AS owner_person_id,
    pending.name,
    pending.source_url,
    pending.profile_key,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party
FROM _votetw_existing_local_context_profiles pending
JOIN person_claims profile
  ON profile.person_id = pending.person_id
 AND profile.source_name = 'VoteTW'
 AND profile.claim_type = 'external_id'
 AND profile.source_url = pending.source_url
 AND profile.claim_json->'identityMatch'->>'sourceProfileKey' =
     pending.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(profile.claim_json->'electionRecords', '[]'::JSONB)
) record;

CREATE TEMP TABLE _votetw_existing_local_context_matches AS
SELECT DISTINCT
    source.owner_person_id,
    source.name,
    source.source_url,
    source.profile_key,
    source.source_election,
    candidate.person_id AS matched_person_id
FROM _votetw_existing_local_context_records source
JOIN public_people same_name ON same_name.name = source.name
JOIN candidates candidate
  ON candidate.person_id = same_name.person_id
 AND candidate.is_public = TRUE
 AND candidate.source_name = 'VoteTW historical election results'
JOIN races race
  ON race.id = candidate.race_id
 AND race.is_public = TRUE
JOIN elections election
  ON election.id = race.election_id
 AND election.is_public = TRUE
WHERE SUBSTRING(source.source_election FROM 1 FOR 4) ~ '^[0-9]{4}$'
  AND election.year = SUBSTRING(source.source_election FROM 1 FOR 4)::INT
  AND (
      pg_temp._votetw_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_norm_text(election.name) || '%'
      OR pg_temp._votetw_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_norm_text(race.title) || '%'
  )
  AND (
      SUBSTRING(race.title FROM '第0*([0-9]+)選舉區') IS NULL
      OR SUBSTRING(
          source.source_election FROM '第0*([0-9]+)選舉區'
      ) = SUBSTRING(race.title FROM '第0*([0-9]+)選舉區')
  )
  AND (
      CASE
          WHEN race.title LIKE '%平地原住民%'
              THEN source.source_election LIKE '%平地原住民%'
          WHEN race.title LIKE '%山地原住民%'
              THEN source.source_election LIKE '%山地原住民%'
          WHEN race.title LIKE '%原住民%'
              THEN source.source_election LIKE '%原住民%'
          ELSE TRUE
      END
  )
  AND pg_temp._votetw_norm_party(source.source_party) =
      pg_temp._votetw_norm_party(candidate.party);

CREATE TEMP TABLE _votetw_existing_local_context_summary AS
SELECT
    pending.*,
    COUNT(DISTINCT match.matched_person_id) AS matched_person_count,
    BOOL_OR(match.matched_person_id = pending.person_id) AS owner_matches
FROM _votetw_existing_local_context_profiles pending
LEFT JOIN _votetw_existing_local_context_matches match
  ON match.owner_person_id = pending.person_id
 AND match.source_url = pending.source_url
 AND match.profile_key = pending.profile_key
GROUP BY
    pending.person_id,
    pending.name,
    pending.source_url,
    pending.profile_key;

CREATE TEMP TABLE _votetw_existing_local_context_eligible AS
SELECT summary.*
FROM _votetw_existing_local_context_summary summary
JOIN people current_person ON current_person.id = summary.person_id
WHERE summary.matched_person_count = 1
  AND summary.owner_matches IS TRUE
  AND current_person.is_public = TRUE
  AND current_person.source_url = summary.source_url
  AND (
      SELECT COUNT(DISTINCT record.source_election)
      FROM _votetw_existing_local_context_records record
      WHERE record.owner_person_id = summary.person_id
        AND record.source_url = summary.source_url
        AND record.profile_key = summary.profile_key
  ) = 1;

CREATE TEMP TABLE _verified_non_votetw_claims AS
SELECT DISTINCT
    COALESCE(canonical.canonical_person_id, claim.person_id) AS person_id,
    claim.claim_type,
    TRIM(claim.claim_value) AS claim_value,
    MD5(TRIM(claim.claim_value)) AS value_hash
FROM person_claims claim
LEFT JOIN person_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

CREATE INDEX _verified_non_votetw_claims_existing_local_context_idx
ON _verified_non_votetw_claims (
    person_id,
    claim_type,
    value_hash
);

ANALYZE _verified_non_votetw_claims;

CREATE TEMP TABLE _votetw_existing_local_context_claims AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
FROM _votetw_existing_local_context_eligible eligible
JOIN person_claims claim
  ON claim.person_id = eligible.person_id
 AND claim.source_url = eligible.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     eligible.profile_key
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_type IN (
      'birth_date',
      'gender',
      'party_affiliation',
      'education',
      'experience'
  )
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.scoring_version IN (
          'votetw-existing-local-context-anchor-v1',
          'votetw-existing-local-context-conflict-v1'
      )
  );

CREATE TEMP TABLE _votetw_existing_local_context_decisions AS
WITH classified AS (
    SELECT
        candidate.*,
        person.gender,
        person.party,
        person.education,
        EXISTS (
            SELECT 1
            FROM _verified_non_votetw_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
        ) AS has_verified_type,
        EXISTS (
            SELECT 1
            FROM _verified_non_votetw_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
              AND verified.value_hash = MD5(TRIM(candidate.claim_value))
              AND verified.claim_value = TRIM(candidate.claim_value)
        ) AS has_exact_verified
    FROM _votetw_existing_local_context_claims candidate
    JOIN public_people person ON person.person_id = candidate.person_id
)
SELECT
    classified.*,
    CASE
        WHEN has_exact_verified
            THEN 'archive_exact_source'
        WHEN claim_type IN ('education', 'experience')
             AND has_verified_type
            THEN 'archive_better_source'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
             AND REPLACE(TRIM(claim_value), '學歷', '') = TRIM(education)
            THEN 'archive_core_duplicate'
        WHEN claim_type = 'party_affiliation'
             AND NULLIF(TRIM(COALESCE(party, '')), '') IS NOT NULL
             AND (
                 pg_temp._votetw_norm_text(claim_value) ~ '黨黨$'
                 OR pg_temp._votetw_norm_text(claim_value) LIKE '現任%'
             )
             AND pg_temp._votetw_norm_party(
                 REGEXP_REPLACE(
                     REGEXP_REPLACE(
                         pg_temp._votetw_norm_text(claim_value),
                         '^現任',
                         ''
                     ),
                     '黨黨$',
                     '黨'
                 )
             ) = pg_temp._votetw_norm_party(party)
            THEN 'archive_core_duplicate'
        WHEN claim_type = 'birth_date'
             AND has_verified_type
            THEN 'hold_conflict'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
            THEN 'hold_conflict'
        WHEN claim_type = 'party_affiliation'
             AND NULLIF(TRIM(COALESCE(party, '')), '') IS NOT NULL
             AND pg_temp._votetw_norm_party(claim_value) <>
                 pg_temp._votetw_norm_party(party)
            THEN 'hold_conflict'
        WHEN claim_type = 'gender'
             AND LOWER(TRIM(COALESCE(gender, ''))) NOT IN ('', 'unknown')
             AND LOWER(TRIM(COALESCE(claim_value, ''))) <>
                 LOWER(TRIM(COALESCE(gender, '')))
            THEN 'hold_conflict'
        ELSE 'publish_c'
    END AS action
FROM classified;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM _votetw_existing_local_context_eligible
    ) <> 241 THEN
        RAISE EXCEPTION
            'VoteTW existing local-context profile count drifted from 241';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_existing_local_context_decisions
    ) <> 1193 THEN
        RAISE EXCEPTION
            'VoteTW existing local-context claim count drifted from 1193';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_existing_local_context_decisions
        WHERE action = 'publish_c'
    ) <> 1114 THEN
        RAISE EXCEPTION
            'VoteTW existing local-context publish count drifted from 1114';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_existing_local_context_decisions
        WHERE action LIKE 'archive_%'
    ) <> 64 THEN
        RAISE EXCEPTION
            'VoteTW existing local-context archive count drifted from 64';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_existing_local_context_decisions
        WHERE action = 'hold_conflict'
    ) <> 15 THEN
        RAISE EXCEPTION
            'VoteTW existing local-context hold count drifted from 15';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-existing-local-context-anchor-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-existing-local-context-anchor-v1',
                'reason', 'VoteTW profile and exact source URL uniquely match the current person through the local election year, complete race title and party',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_existing_local_context_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-existing-local-context-anchor-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-existing-local-context-anchor-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-existing-local-context-anchor-v1',
                'reason', 'VoteTW claim retained as private audit history because an independent or core public value already exists',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_existing_local_context_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-existing-local-context-anchor-v1';

UPDATE person_claims claim
SET
    scoring_version = 'votetw-existing-local-context-conflict-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-existing-local-context-conflict-v1',
                'reason',
                    CASE decision.claim_type
                        WHEN 'education' THEN
                            'VoteTW education level conflicts with the current public person value'
                        WHEN 'party_affiliation' THEN
                            'VoteTW party affiliation differs from the current public person party'
                        ELSE
                            'VoteTW value conflicts with the current public person data'
                    END,
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _votetw_existing_local_context_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_conflict'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-existing-local-context-conflict-v1';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _votetw_existing_local_context_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE (
            decision.action = 'publish_c'
            AND (
                claim.review_status <> 'verified'
                OR claim.visibility <> 'public'
                OR claim.is_public IS NOT TRUE
            )
        )
        OR (
            decision.action LIKE 'archive_%'
            AND (
                claim.review_status <> 'archived'
                OR claim.visibility <> 'private'
                OR claim.is_public IS TRUE
            )
        )
        OR (
            decision.action = 'hold_conflict'
            AND (
                claim.review_status <> 'needs_more_evidence'
                OR claim.scoring_version <>
                    'votetw-existing-local-context-conflict-v1'
            )
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW existing local-context review state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_existing_local_context_decisions;
DROP TABLE _votetw_existing_local_context_claims;
DROP TABLE _verified_non_votetw_claims;
DROP TABLE _votetw_existing_local_context_eligible;
DROP TABLE _votetw_existing_local_context_summary;
DROP TABLE _votetw_existing_local_context_matches;
DROP TABLE _votetw_existing_local_context_records;
DROP TABLE _votetw_existing_local_context_profiles;

RESET statement_timeout;
