SET statement_timeout = 0;

-- Resolve unique birth-dated VoteTW pages through their exact VoteTW
-- candidate history. Claims may move between same-name people, but the people
-- themselves are not merged. Legal claims remain review-only and existing
-- platform claims retain their review state.
CREATE FUNCTION pg_temp._votetw_unique_birth_norm_text(value TEXT)
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

CREATE FUNCTION pg_temp._votetw_unique_birth_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN pg_temp._votetw_unique_birth_norm_text(value) IN (
        '無', '無黨', '無黨派', '無黨籍'
    ) THEN '無黨籍'
    WHEN pg_temp._votetw_unique_birth_norm_text(value) IN (
        '台灣基進', '基進黨'
    ) THEN '台灣基進'
    WHEN pg_temp._votetw_unique_birth_norm_text(value) IN (
        '台灣綠黨', '綠黨'
    ) THEN '綠黨'
    ELSE pg_temp._votetw_unique_birth_norm_text(value)
END;

CREATE TEMP TABLE _votetw_unique_birth_profiles AS
SELECT
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key,
    claim.claim_json->'identityMatch'->>'sourceBirthDate' AS source_birth_date,
    MIN(person.name) AS name,
    COUNT(DISTINCT claim.person_id) AS current_people,
    (MIN(
        COALESCE(
            NULLIF(
                claim.claim_json->'identityResolution'->>'originalPersonId',
                ''
            )::UUID,
            claim.person_id
        )::TEXT
    ))::UUID AS owner_person_id
FROM person_claims claim
JOIN people person ON person.id = claim.person_id
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_json->'identityMatch'->>'matchedBy' =
      'unique_page_profile_with_birth_date'
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.claim_json->'identityResolution'->>'version' =
          'votetw-unique-birth-candidate-anchor-v1'
  )
GROUP BY
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey',
    claim.claim_json->'identityMatch'->>'sourceBirthDate';

CREATE TEMP TABLE _votetw_unique_birth_records AS
SELECT DISTINCT
    profile.*,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party
FROM _votetw_unique_birth_profiles profile
JOIN person_claims external
  ON external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = profile.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
) record;

CREATE TEMP TABLE _votetw_unique_birth_candidate_matches AS
SELECT DISTINCT
    profile.source_url,
    profile.profile_key,
    record.source_election,
    canonical.canonical_person_id
FROM _votetw_unique_birth_profiles profile
JOIN _votetw_unique_birth_records record
  ON record.source_url = profile.source_url
 AND record.profile_key = profile.profile_key
JOIN people candidate_person
  ON candidate_person.name = profile.name
 AND candidate_person.source_url = profile.source_url
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
JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
WHERE SUBSTRING(record.source_election FROM 1 FOR 4) ~ '^[0-9]{4}$'
  AND election.year = SUBSTRING(record.source_election FROM 1 FOR 4)::INT
  AND (
      pg_temp._votetw_unique_birth_norm_text(record.source_election) LIKE
          '%' || pg_temp._votetw_unique_birth_norm_text(election.name) || '%'
      OR pg_temp._votetw_unique_birth_norm_text(record.source_election) LIKE
          '%' || pg_temp._votetw_unique_birth_norm_text(race.title) || '%'
  )
  AND (
      SUBSTRING(race.title FROM '第0*([0-9]+)選舉區') IS NULL
      OR SUBSTRING(
          record.source_election FROM '第0*([0-9]+)選舉區'
      ) = SUBSTRING(race.title FROM '第0*([0-9]+)選舉區')
  )
  AND (
      CASE
          WHEN race.title LIKE '%平地原住民%'
              THEN record.source_election LIKE '%平地原住民%'
          WHEN race.title LIKE '%山地原住民%'
              THEN record.source_election LIKE '%山地原住民%'
          WHEN race.title LIKE '%原住民%'
              THEN record.source_election LIKE '%原住民%'
          ELSE TRUE
      END
  )
  AND pg_temp._votetw_unique_birth_norm_party(record.source_party) =
      pg_temp._votetw_unique_birth_norm_party(candidate.party);

CREATE TEMP TABLE _votetw_unique_birth_matches AS
SELECT DISTINCT
    profile.source_url,
    profile.profile_key,
    canonical.canonical_person_id
FROM _votetw_unique_birth_profiles profile
JOIN people same_name ON same_name.name = profile.name
JOIN person_canonical_map canonical ON canonical.person_id = same_name.id
JOIN person_claims birth
  ON birth.person_id = same_name.id
 AND birth.claim_type = 'birth_date'
 AND birth.claim_value = profile.source_birth_date
 AND birth.review_status = 'verified'
 AND birth.is_public = TRUE
 AND birth.source_name NOT LIKE 'VoteTW%';

CREATE TEMP TABLE _votetw_unique_birth_summary AS
SELECT
    profile.*,
    COUNT(DISTINCT record.source_election) AS source_records,
    COUNT(DISTINCT candidate.source_election) AS matched_records,
    COUNT(DISTINCT candidate.canonical_person_id) AS candidate_targets,
    (MIN(candidate.canonical_person_id::TEXT))::UUID AS candidate_target_id,
    COUNT(DISTINCT birth.canonical_person_id) AS birth_targets,
    (MIN(birth.canonical_person_id::TEXT))::UUID AS birth_target_id
FROM _votetw_unique_birth_profiles profile
LEFT JOIN _votetw_unique_birth_records record
  ON record.source_url = profile.source_url
 AND record.profile_key = profile.profile_key
LEFT JOIN _votetw_unique_birth_candidate_matches candidate
  ON candidate.source_url = profile.source_url
 AND candidate.profile_key = profile.profile_key
LEFT JOIN _votetw_unique_birth_matches birth
  ON birth.source_url = profile.source_url
 AND birth.profile_key = profile.profile_key
GROUP BY
    profile.source_url,
    profile.profile_key,
    profile.source_birth_date,
    profile.name,
    profile.current_people,
    profile.owner_person_id;

CREATE TEMP TABLE _votetw_unique_birth_safe_targets AS
SELECT
    summary.*,
    summary.candidate_target_id AS target_person_id
FROM _votetw_unique_birth_summary summary
WHERE summary.candidate_targets = 1
  AND (
      summary.birth_targets = 0
      OR (
          summary.birth_targets = 1
          AND summary.birth_target_id = summary.candidate_target_id
      )
  );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_unique_birth_profiles) <> 302
       OR (SELECT COUNT(*) FROM _votetw_unique_birth_records) <> 330
       OR (SELECT COUNT(*) FROM _votetw_unique_birth_candidate_matches) <> 291
       OR (SELECT COUNT(*) FROM _votetw_unique_birth_matches) <> 8 THEN
        RAISE EXCEPTION 'VoteTW unique-birth source boundary drifted';
    END IF;

    IF (SELECT COUNT(*) FROM _votetw_unique_birth_safe_targets) <> 256 THEN
        RAISE EXCEPTION 'VoteTW unique-birth safe target count drifted from 256';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_unique_birth_safe_targets profile
        JOIN people owner ON owner.id = profile.owner_person_id
        JOIN public_people target
          ON target.person_id = profile.target_person_id
        WHERE profile.current_people <> 1
           OR owner.name <> profile.name
           OR target.name <> profile.name
    ) THEN
        RAISE EXCEPTION 'VoteTW unique-birth person anchor drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_safe_targets profile
        JOIN person_claims claim
          ON claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
    ) <> 1540 THEN
        RAISE EXCEPTION 'VoteTW unique-birth safe claim count drifted from 1540';
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
                'version', 'votetw-unique-birth-candidate-anchor-v1',
                'originalPersonId', profile.owner_person_id,
                'targetPersonId', profile.target_person_id,
                'sourceUrl', profile.source_url,
                'reason', 'unique exact VoteTW candidate-history anchor',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-unique-birth-candidate-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-unique-birth-candidate-anchor-v1',
                    'reason', 'VoteTW profile relinked without merging same-name people',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_unique_birth_safe_targets profile
WHERE claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND (
      claim.person_id <> profile.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-unique-birth-candidate-anchor-v1'
  );

CREATE TEMP TABLE _votetw_unique_birth_verified_claims AS
SELECT DISTINCT
    COALESCE(canonical.canonical_person_id, claim.person_id) AS person_id,
    claim.claim_type,
    TRIM(claim.claim_value) AS claim_value
FROM person_claims claim
LEFT JOIN person_canonical_map canonical ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

CREATE TEMP TABLE _votetw_unique_birth_claims AS
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
        FROM _votetw_unique_birth_records record
        WHERE record.source_url = profile.source_url
          AND record.profile_key = profile.profile_key
          AND pg_temp._votetw_unique_birth_norm_party(record.source_party) =
              pg_temp._votetw_unique_birth_norm_party(claim.claim_value)
    ) AS party_supported_by_profile
FROM _votetw_unique_birth_safe_targets profile
JOIN person_claims claim
  ON claim.person_id = profile.target_person_id
 AND claim.source_name = 'VoteTW'
 AND claim.source_url = profile.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
WHERE claim.claim_type IN (
    'birth_date', 'gender', 'party_affiliation', 'education', 'experience'
);

CREATE TEMP TABLE _votetw_unique_birth_decisions AS
WITH classified AS (
    SELECT
        candidate.*,
        person.gender,
        person.party,
        person.education,
        EXISTS (
            SELECT 1
            FROM _votetw_unique_birth_verified_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
        ) AS has_verified_type,
        EXISTS (
            SELECT 1
            FROM _votetw_unique_birth_verified_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
              AND verified.claim_value = TRIM(candidate.claim_value)
        ) AS has_exact_verified
    FROM _votetw_unique_birth_claims candidate
    JOIN public_people person ON person.person_id = candidate.person_id
)
SELECT
    classified.*,
    CASE
        WHEN review_status = 'archived'
         AND visibility = 'private'
         AND is_public = FALSE
            THEN 'archive_existing'
        WHEN has_exact_verified THEN 'archive_exact_source'
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
             AND pg_temp._votetw_unique_birth_norm_party(claim_value) <>
                 pg_temp._votetw_unique_birth_norm_party(party)
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
    IF (SELECT COUNT(*) FROM _votetw_unique_birth_decisions) <> 1280 THEN
        RAISE EXCEPTION 'VoteTW unique-birth review count drifted from 1280';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_unique_birth_decisions
        WHERE action = 'publish_c'
    ) <> 940 THEN
        RAISE EXCEPTION 'VoteTW unique-birth publish count drifted from 940';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_unique_birth_decisions
        WHERE action LIKE 'archive_%'
    ) <> 286 THEN
        RAISE EXCEPTION 'VoteTW unique-birth archive count drifted from 286';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_unique_birth_decisions
        WHERE action = 'hold_conflict'
    ) <> 54 THEN
        RAISE EXCEPTION 'VoteTW unique-birth hold count drifted from 54';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-unique-birth-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-unique-birth-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-unique-birth-claim-rereview-v1',
                    'reason', 'VoteTW profile has one exact candidate-history identity and no conflicting public value',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_unique_birth_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-unique-birth-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-unique-birth-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-unique-birth-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-unique-birth-claim-rereview-v1',
                    'reason', 'VoteTW value retained as private audit history because it was already archived or a better public value exists',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_unique_birth_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-unique-birth-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-unique-birth-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-unique-birth-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-unique-birth-claim-rereview-v1',
                    'reason', 'VoteTW external identifier remains private after profile relinking',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_unique_birth_safe_targets profile
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
          'votetw-unique-birth-claim-rereview-v1'
  );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_safe_targets profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-unique-birth-candidate-anchor-v1'
    ) <> 1540 THEN
        RAISE EXCEPTION 'VoteTW unique-birth relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'publish_c'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-unique-birth-claim-rereview-v1'
    ) <> 940 THEN
        RAISE EXCEPTION 'VoteTW unique-birth public state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action LIKE 'archive_%'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-unique-birth-claim-rereview-v1'
    ) <> 286 THEN
        RAISE EXCEPTION 'VoteTW unique-birth archived state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'hold_conflict'
          AND claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
    ) <> 54 THEN
        RAISE EXCEPTION 'VoteTW unique-birth hold state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_safe_targets profile
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
             'votetw-unique-birth-claim-rereview-v1'
    ) <> 256 THEN
        RAISE EXCEPTION 'VoteTW unique-birth identifier state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_safe_targets profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_type = 'legal_case'
         AND claim.review_status = 'needs_more_evidence'
         AND claim.visibility = 'review_only'
         AND claim.is_public = FALSE
    ) <> 3 THEN
        RAISE EXCEPTION 'VoteTW unique-birth legal review state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_birth_safe_targets profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_type = 'platform'
         AND claim.review_status = 'verified'
         AND claim.visibility = 'public'
         AND claim.is_public = TRUE
    ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW unique-birth platform state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_unique_birth_decisions;
DROP TABLE _votetw_unique_birth_claims;
DROP TABLE _votetw_unique_birth_verified_claims;
DROP TABLE _votetw_unique_birth_safe_targets;
DROP TABLE _votetw_unique_birth_summary;
DROP TABLE _votetw_unique_birth_matches;
DROP TABLE _votetw_unique_birth_candidate_matches;
DROP TABLE _votetw_unique_birth_records;
DROP TABLE _votetw_unique_birth_profiles;

RESET statement_timeout;
