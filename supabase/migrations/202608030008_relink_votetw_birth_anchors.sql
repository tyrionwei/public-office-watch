SET statement_timeout = 0;

-- Some unique VoteTW pages were initially attached to the wrong same-name
-- person. Relink only when one public person has the exact birth date from an
-- independently verified non-VoteTW source. Do not merge the two people.
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

CREATE INDEX _verified_non_votetw_claims_idx
ON _verified_non_votetw_claims (
    person_id,
    claim_type,
    value_hash
);

ANALYZE _verified_non_votetw_claims;

CREATE TEMP TABLE _votetw_birth_profiles AS
SELECT DISTINCT
    CASE
        WHEN claim.claim_json->'identityResolution'->>'version' =
             'votetw-independent-birth-anchor-v1'
            THEN (
                claim.claim_json->'identityResolution'->>'originalPersonId'
            )::UUID
        ELSE claim.person_id
    END AS owner_person_id,
    person.name,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key,
    claim.claim_json->'identityMatch'->>'sourceBirthDate' AS source_birth_date
FROM person_claims claim
JOIN people person ON person.id = claim.person_id
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_json->'identityMatch'->>'matchedBy' =
      'unique_page_profile_with_birth_date'
  AND claim.claim_json->'identityMatch'->>'sourceBirthDate' IS NOT NULL
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.claim_json->'identityResolution'->>'version' =
          'votetw-independent-birth-anchor-v1'
  );

CREATE TEMP TABLE _votetw_birth_relinks AS
WITH birth_targets AS (
    SELECT
        profile.owner_person_id,
        profile.name,
        profile.source_url,
        profile.profile_key,
        profile.source_birth_date,
        target.person_id AS target_person_id
    FROM _votetw_birth_profiles profile
    JOIN public_people target ON target.name = profile.name
    JOIN _verified_non_votetw_claims birth
      ON birth.person_id = target.person_id
     AND birth.claim_type = 'birth_date'
     AND birth.value_hash = MD5(profile.source_birth_date)
     AND birth.claim_value = profile.source_birth_date
),
unique_targets AS (
    SELECT
        owner_person_id,
        name,
        source_url,
        profile_key,
        source_birth_date,
        (MIN(target_person_id::TEXT))::UUID AS target_person_id
    FROM birth_targets
    GROUP BY
        owner_person_id,
        name,
        source_url,
        profile_key,
        source_birth_date
    HAVING COUNT(DISTINCT target_person_id) = 1
)
SELECT target.*
FROM unique_targets target
WHERE target.target_person_id <> target.owner_person_id
  AND (
      SELECT COUNT(DISTINCT verified.claim_value)
      FROM _verified_non_votetw_claims verified
      WHERE verified.person_id = target.target_person_id
        AND verified.claim_type = 'birth_date'
  ) = 1;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_birth_relinks) <> 28 THEN
        RAISE EXCEPTION
            'VoteTW independent birth relink count drifted from 28';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_birth_relinks relink
        JOIN person_claims claim
          ON claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
         AND claim.person_id IN (
             relink.owner_person_id,
             relink.target_person_id
         )
        WHERE claim.source_name = 'VoteTW'
    ) <> 169 THEN
        RAISE EXCEPTION
            'VoteTW independent birth profile claim count drifted from 169';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    person_id = relink.target_person_id,
    claim_json = claim.claim_json ||
        jsonb_build_object(
            'identityResolution',
            jsonb_build_object(
                'version', 'votetw-independent-birth-anchor-v1',
                'originalPersonId', relink.owner_person_id,
                'targetPersonId', relink.target_person_id,
                'sourceBirthDate', relink.source_birth_date,
                'reason', 'unique same-name public person with an independently verified exact birth date',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-independent-birth-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-independent-birth-anchor-v1',
                    'reason', 'VoteTW profile relinked to the unique same-name person with an independently verified exact birth date',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_birth_relinks relink
WHERE claim.source_name = 'VoteTW'
  AND claim.source_url = relink.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      relink.profile_key
  AND claim.person_id IN (
      relink.owner_person_id,
      relink.target_person_id
  )
  AND (
      claim.person_id <> relink.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-independent-birth-anchor-v1'
  );

CREATE TEMP TABLE _votetw_birth_claim_candidates AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
FROM _votetw_birth_relinks relink
JOIN person_claims claim
  ON claim.person_id = relink.target_person_id
 AND claim.source_url = relink.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     relink.profile_key
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
      OR claim.scoring_version =
          'votetw-independent-birth-claim-rereview-v1'
  );

CREATE TEMP TABLE _votetw_birth_claim_decisions AS
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
    FROM _votetw_birth_claim_candidates candidate
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
             AND REGEXP_REPLACE(
                 REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                 E'\\s+',
                 '',
                 'g'
             ) ~ '黨黨$'
             AND REGEXP_REPLACE(
                 REGEXP_REPLACE(
                     REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                     E'\\s+',
                     '',
                     'g'
                 ),
                 '黨黨$',
                 '黨'
             ) = REGEXP_REPLACE(
                 REPLACE(COALESCE(party, ''), '臺', '台'),
                 E'\\s+',
                 '',
                 'g'
             )
            THEN 'archive_core_duplicate'
        WHEN claim_type = 'birth_date'
             AND has_verified_type
            THEN 'hold_conflict'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
            THEN 'hold_conflict'
        WHEN claim_type = 'party_affiliation'
             AND NULLIF(TRIM(COALESCE(party, '')), '') IS NOT NULL
             AND (
                 CASE
                     WHEN REGEXP_REPLACE(
                         REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     ) IN ('無', '無黨', '無黨派', '無黨籍')
                         THEN '無黨籍'
                     WHEN REGEXP_REPLACE(
                         REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     ) IN ('台灣基進', '基進黨')
                         THEN '台灣基進'
                     ELSE REGEXP_REPLACE(
                         REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     )
                 END
             ) <> (
                 CASE
                     WHEN REGEXP_REPLACE(
                         REPLACE(COALESCE(party, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     ) IN ('無', '無黨', '無黨派', '無黨籍')
                         THEN '無黨籍'
                     WHEN REGEXP_REPLACE(
                         REPLACE(COALESCE(party, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     ) IN ('台灣基進', '基進黨')
                         THEN '台灣基進'
                     ELSE REGEXP_REPLACE(
                         REPLACE(COALESCE(party, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     )
                 END
             )
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
    IF (SELECT COUNT(*) FROM _votetw_birth_claim_decisions) <> 137 THEN
        RAISE EXCEPTION
            'VoteTW independent birth claim total drifted from 137';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_birth_claim_decisions
        WHERE action = 'publish_c'
    ) <> 33 THEN
        RAISE EXCEPTION
            'VoteTW independent birth publish count drifted from 33';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_birth_claim_decisions
        WHERE action LIKE 'archive_%'
    ) <> 104 THEN
        RAISE EXCEPTION
            'VoteTW independent birth archive count drifted from 104';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _votetw_birth_claim_decisions
        WHERE action = 'hold_conflict'
    ) THEN
        RAISE EXCEPTION
            'VoteTW independent birth claims gained an unexpected conflict';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-independent-birth-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-independent-birth-claim-rereview-v1',
                'reason', 'VoteTW profile is linked by an independently verified exact birth date and has no conflicting public value',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_birth_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-independent-birth-claim-rereview-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-independent-birth-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-independent-birth-claim-rereview-v1',
                'reason', 'VoteTW claim retained as private audit history because an independent or core public value already exists',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_birth_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-independent-birth-claim-rereview-v1';

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_birth_relinks relink
        JOIN person_claims claim
          ON claim.person_id = relink.target_person_id
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-independent-birth-anchor-v1'
        WHERE claim.source_name = 'VoteTW'
    ) <> 169 THEN
        RAISE EXCEPTION 'VoteTW independent birth relink state mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_birth_claim_decisions decision
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
    ) THEN
        RAISE EXCEPTION
            'VoteTW independent birth claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_birth_relinks relink
        JOIN person_claims claim
          ON claim.person_id = relink.target_person_id
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
        WHERE claim.source_name = 'VoteTW'
          AND claim.claim_type = 'legal_case'
          AND claim.review_status = 'needs_more_evidence'
          AND claim.is_public = FALSE
    ) <> 1 THEN
        RAISE EXCEPTION
            'VoteTW legal claim was not preserved for manual review';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_birth_claim_decisions;
DROP TABLE _votetw_birth_claim_candidates;
DROP TABLE _votetw_birth_relinks;
DROP TABLE _votetw_birth_profiles;
DROP TABLE _verified_non_votetw_claims;

RESET statement_timeout;
