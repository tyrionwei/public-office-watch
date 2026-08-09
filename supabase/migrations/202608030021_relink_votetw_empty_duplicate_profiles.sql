SET statement_timeout = 0;

-- Resolve birth-dated VoteTW profiles that were initially attached to one of
-- several same-name public people. A profile is safe only when its exact
-- election history resolves to one canonical candidate, its birth date
-- resolves to one independently verified person, or both anchors agree.
-- Relink only the claims: the original and target people may be genuinely
-- different same-name candidates and therefore must not be merged here.
CREATE FUNCTION pg_temp._votetw_empty_norm_text(value TEXT)
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

CREATE FUNCTION pg_temp._votetw_empty_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN pg_temp._votetw_empty_norm_text(value) IN (
        '無', '無黨', '無黨派', '無黨籍'
    ) THEN '無黨籍'
    WHEN pg_temp._votetw_empty_norm_text(value) IN (
        '台灣基進', '基進黨'
    ) THEN '台灣基進'
    WHEN pg_temp._votetw_empty_norm_text(value) IN (
        '台灣綠黨', '綠黨'
    ) THEN '綠黨'
    ELSE pg_temp._votetw_empty_norm_text(value)
END;

CREATE TEMP TABLE _votetw_empty_profiles AS
SELECT DISTINCT
    COALESCE(
        NULLIF(
            claim.claim_json->'identityResolution'->>'originalPersonId',
            ''
        )::UUID,
        claim.person_id
    ) AS owner_person_id,
    person.name,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key,
    claim.claim_json->'identityMatch'->>'sourceBirthDate' AS source_birth_date
FROM person_claims claim
JOIN people person ON person.id = claim.person_id
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_json->'identityMatch'->>'matchedBy' =
      'unique_birthdated_profile_with_empty_intro_duplicates'
  AND claim.claim_json->'identityMatch'->>'sameNameProfileCount' = '2'
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.claim_json->'identityResolution'->>'version' =
          'votetw-empty-duplicate-safe-relink-v1'
  );

CREATE TEMP TABLE _votetw_empty_records AS
SELECT DISTINCT
    profile.*,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party
FROM _votetw_empty_profiles profile
JOIN person_claims external
  ON external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = profile.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
) record;

CREATE TEMP TABLE _votetw_empty_candidate_matches AS
SELECT DISTINCT
    source.owner_person_id,
    source.source_url,
    source.profile_key,
    source.source_election,
    canonical.canonical_person_id
FROM _votetw_empty_records source
JOIN people candidate_person
  ON candidate_person.name = source.name
 AND candidate_person.source_url = source.source_url
JOIN candidates candidate
  ON candidate.person_id = candidate_person.id
 AND candidate.is_public = TRUE
 AND candidate.source_name = 'VoteTW historical election results'
JOIN races race
  ON race.id = candidate.race_id
 AND race.is_public = TRUE
JOIN elections election
  ON election.id = race.election_id
 AND election.is_public = TRUE
JOIN person_canonical_map canonical
  ON canonical.person_id = candidate.person_id
WHERE SUBSTRING(source.source_election FROM 1 FOR 4) ~ '^[0-9]{4}$'
  AND election.year = SUBSTRING(source.source_election FROM 1 FOR 4)::INT
  AND (
      pg_temp._votetw_empty_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_empty_norm_text(election.name) || '%'
      OR pg_temp._votetw_empty_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_empty_norm_text(race.title) || '%'
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
  AND pg_temp._votetw_empty_norm_party(source.source_party) =
      pg_temp._votetw_empty_norm_party(candidate.party);

CREATE TEMP TABLE _votetw_empty_official_birth_matches AS
SELECT DISTINCT
    profile.owner_person_id,
    profile.source_url,
    profile.profile_key,
    canonical.canonical_person_id
FROM _votetw_empty_profiles profile
JOIN people same_name ON same_name.name = profile.name
JOIN person_canonical_map canonical ON canonical.person_id = same_name.id
JOIN person_claims birth
  ON birth.person_id = same_name.id
 AND birth.claim_type = 'birth_date'
 AND birth.claim_value = profile.source_birth_date
 AND birth.review_status = 'verified'
 AND birth.is_public = TRUE
 AND birth.source_name NOT LIKE 'VoteTW%';

CREATE TEMP TABLE _votetw_empty_summary AS
SELECT
    profile.*,
    COUNT(DISTINCT record.source_election) AS source_records,
    COUNT(DISTINCT candidate.source_election) AS matched_records,
    COUNT(DISTINCT candidate.canonical_person_id) AS candidate_targets,
    (MIN(candidate.canonical_person_id::TEXT))::UUID AS candidate_target_id,
    COUNT(DISTINCT birth.canonical_person_id) AS birth_targets,
    (MIN(birth.canonical_person_id::TEXT))::UUID AS birth_target_id
FROM _votetw_empty_profiles profile
LEFT JOIN _votetw_empty_records record
  ON record.owner_person_id = profile.owner_person_id
 AND record.source_url = profile.source_url
 AND record.profile_key = profile.profile_key
LEFT JOIN _votetw_empty_candidate_matches candidate
  ON candidate.owner_person_id = profile.owner_person_id
 AND candidate.source_url = profile.source_url
 AND candidate.profile_key = profile.profile_key
LEFT JOIN _votetw_empty_official_birth_matches birth
  ON birth.owner_person_id = profile.owner_person_id
 AND birth.source_url = profile.source_url
 AND birth.profile_key = profile.profile_key
GROUP BY
    profile.owner_person_id,
    profile.name,
    profile.source_url,
    profile.profile_key,
    profile.source_birth_date;

CREATE TEMP TABLE _votetw_empty_safe_targets AS
SELECT
    summary.*,
    CASE
        WHEN summary.candidate_targets = 1
            THEN summary.candidate_target_id
        ELSE summary.birth_target_id
    END AS target_person_id
FROM _votetw_empty_summary summary
WHERE (
        summary.candidate_targets = 1
        AND summary.birth_targets = 0
    )
   OR (
        summary.candidate_targets = 1
        AND summary.birth_targets = 1
        AND summary.candidate_target_id = summary.birth_target_id
    )
   OR (
        summary.candidate_targets = 0
        AND summary.birth_targets = 1
    );

CREATE TEMP TABLE _votetw_empty_verified_claims AS
SELECT DISTINCT
    COALESCE(canonical.canonical_person_id, claim.person_id) AS person_id,
    claim.claim_type,
    TRIM(claim.claim_value) AS claim_value
FROM person_claims claim
LEFT JOIN person_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_empty_profiles) <> 46 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate profile count drifted from 46';
    END IF;

    IF (SELECT COUNT(*) FROM _votetw_empty_safe_targets) <> 37 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate safe target count drifted from 37';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_empty_safe_targets profile
        JOIN people owner ON owner.id = profile.owner_person_id
        JOIN public_people target
          ON target.person_id = profile.target_person_id
        WHERE owner.name <> profile.name
           OR target.name <> profile.name
    ) THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate person anchor drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_empty_safe_targets profile
        JOIN person_claims claim
          ON claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
    ) <> 222 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate safe claim count drifted from 222';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_empty_safe_targets profile
        JOIN _votetw_empty_verified_claims verified
          ON verified.person_id = profile.target_person_id
         AND verified.claim_type = 'birth_date'
         AND verified.claim_value <> profile.source_birth_date
    ) THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate target has a verified birth conflict';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_empty_safe_targets profile
        JOIN person_claims claim
          ON claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
        WHERE claim.claim_type IN ('legal_case', 'platform')
    ) THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate relink contains restricted claims';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    person_id = profile.target_person_id,
    claim_json = claim.claim_json ||
        jsonb_build_object(
            'identityResolution',
            jsonb_build_object(
                'version', 'votetw-empty-duplicate-safe-relink-v1',
                'originalPersonId', profile.owner_person_id,
                'targetPersonId', profile.target_person_id,
                'sourceUrl', profile.source_url,
                'reason', 'unique canonical candidate or independent birth-date anchor',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-empty-duplicate-safe-relink-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-empty-duplicate-safe-relink-v1',
                    'reason', 'VoteTW profile relinked without merging same-name people',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_empty_safe_targets profile
WHERE claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND (
      claim.person_id <> profile.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-empty-duplicate-safe-relink-v1'
  );

CREATE TEMP TABLE _votetw_empty_claims AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value,
    claim.review_status,
    claim.visibility,
    claim.is_public,
    EXISTS (
        SELECT 1
        FROM _votetw_empty_records record
        WHERE record.owner_person_id = profile.owner_person_id
          AND record.source_url = profile.source_url
          AND record.profile_key = profile.profile_key
          AND pg_temp._votetw_empty_norm_party(record.source_party) =
              pg_temp._votetw_empty_norm_party(claim.claim_value)
    ) AS party_supported_by_profile
FROM _votetw_empty_safe_targets profile
JOIN person_claims claim
  ON claim.person_id = profile.target_person_id
 AND claim.source_name = 'VoteTW'
 AND claim.source_url = profile.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
WHERE claim.claim_type IN (
    'birth_date', 'gender', 'party_affiliation', 'education', 'experience'
);

CREATE TEMP TABLE _votetw_empty_decisions AS
WITH classified AS (
    SELECT
        candidate.*,
        person.gender,
        person.party,
        person.education,
        EXISTS (
            SELECT 1
            FROM _votetw_empty_verified_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
        ) AS has_verified_type,
        EXISTS (
            SELECT 1
            FROM _votetw_empty_verified_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
              AND verified.claim_value = TRIM(candidate.claim_value)
        ) AS has_exact_verified
    FROM _votetw_empty_claims candidate
    JOIN public_people person ON person.person_id = candidate.person_id
)
SELECT
    classified.*,
    CASE
        WHEN review_status = 'archived'
         AND visibility = 'private'
         AND is_public = FALSE
            THEN 'archive_existing'
        WHEN has_exact_verified
            THEN 'archive_exact_source'
        WHEN claim_type IN ('education', 'experience')
             AND has_verified_type
            THEN 'archive_better_source'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
             AND REPLACE(TRIM(claim_value), '學歷', '') = TRIM(education)
            THEN 'archive_core_duplicate'
        WHEN claim_type = 'birth_date' AND has_verified_type
            THEN 'hold_conflict'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
            THEN 'hold_conflict'
        WHEN claim_type = 'party_affiliation'
             AND NULLIF(TRIM(COALESCE(party, '')), '') IS NOT NULL
             AND pg_temp._votetw_empty_norm_party(claim_value) <>
                 pg_temp._votetw_empty_norm_party(party)
             AND party_supported_by_profile IS NOT TRUE
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
    IF (SELECT COUNT(*) FROM _votetw_empty_decisions) <> 185 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate review count drifted from 185';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_empty_decisions
        WHERE action = 'publish_c'
    ) <> 116 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate publish count drifted from 116';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_empty_decisions
        WHERE action LIKE 'archive_%'
    ) <> 69 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate archive count drifted from 69';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _votetw_empty_decisions
        WHERE action = 'hold_conflict'
    ) THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate review retained a conflict';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-empty-duplicate-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-empty-duplicate-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-empty-duplicate-claim-rereview-v1',
                    'reason', 'VoteTW profile has one safe candidate or birth-date identity anchor and no conflicting public value',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_empty_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-empty-duplicate-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-empty-duplicate-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-empty-duplicate-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-empty-duplicate-claim-rereview-v1',
                    'reason', 'VoteTW value retained as private audit history because it was already archived or a better public value exists',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_empty_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-empty-duplicate-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-empty-duplicate-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-empty-duplicate-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-empty-duplicate-claim-rereview-v1',
                    'reason', 'VoteTW external identifier remains private after profile relinking',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_empty_safe_targets profile
WHERE claim.person_id = profile.target_person_id
  AND claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND claim.claim_type = 'external_id'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-empty-duplicate-claim-rereview-v1'
  );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_empty_safe_targets profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-empty-duplicate-safe-relink-v1'
    ) <> 222 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_empty_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'publish_c'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-empty-duplicate-claim-rereview-v1'
    ) <> 116 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate public state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_empty_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action LIKE 'archive_%'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-empty-duplicate-claim-rereview-v1'
    ) <> 69 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate archived state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_empty_safe_targets profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_type = 'external_id'
         AND claim.review_status = 'archived'
         AND claim.visibility = 'private'
         AND claim.is_public = FALSE
         AND claim.scoring_version =
             'votetw-empty-duplicate-claim-rereview-v1'
    ) <> 37 THEN
        RAISE EXCEPTION 'VoteTW empty-duplicate identifier state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_empty_decisions;
DROP TABLE _votetw_empty_claims;
DROP TABLE _votetw_empty_verified_claims;
DROP TABLE _votetw_empty_safe_targets;
DROP TABLE _votetw_empty_summary;
DROP TABLE _votetw_empty_official_birth_matches;
DROP TABLE _votetw_empty_candidate_matches;
DROP TABLE _votetw_empty_records;
DROP TABLE _votetw_empty_profiles;

RESET statement_timeout;
