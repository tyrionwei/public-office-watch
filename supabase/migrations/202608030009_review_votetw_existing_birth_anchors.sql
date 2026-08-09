SET statement_timeout = 0;

-- Review same-name VoteTW profiles when the currently linked public person is
-- the only same-name person with an independently verified exact birth date.
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

CREATE TEMP TABLE _votetw_existing_birth_profiles AS
SELECT DISTINCT
    claim.person_id,
    person.name,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key,
    claim.claim_json->'identityMatch'->>'sourceBirthDate' AS source_birth_date
FROM person_claims claim
JOIN public_people person ON person.person_id = claim.person_id
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
      OR claim.scoring_version IN (
          'votetw-existing-birth-claim-rereview-v1',
          'votetw-existing-birth-claim-conflict-v1'
      )
  );

CREATE TEMP TABLE _votetw_existing_birth_eligible AS
SELECT profile.*
FROM _votetw_existing_birth_profiles profile
WHERE EXISTS (
    SELECT 1
    FROM _verified_non_votetw_claims verified
    WHERE verified.person_id = profile.person_id
      AND verified.claim_type = 'birth_date'
      AND verified.value_hash = MD5(profile.source_birth_date)
      AND verified.claim_value = profile.source_birth_date
)
  AND (
      SELECT COUNT(DISTINCT same_name.person_id)
      FROM public_people same_name
      JOIN _verified_non_votetw_claims verified
        ON verified.person_id = same_name.person_id
       AND verified.claim_type = 'birth_date'
       AND verified.value_hash = MD5(profile.source_birth_date)
       AND verified.claim_value = profile.source_birth_date
      WHERE same_name.name = profile.name
  ) = 1
  AND (
      SELECT COUNT(DISTINCT verified.claim_value)
      FROM _verified_non_votetw_claims verified
      WHERE verified.person_id = profile.person_id
        AND verified.claim_type = 'birth_date'
  ) = 1;

CREATE TEMP TABLE _votetw_existing_birth_candidates AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
FROM _votetw_existing_birth_eligible eligible
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
          'votetw-existing-birth-claim-rereview-v1',
          'votetw-existing-birth-claim-conflict-v1'
      )
  );

CREATE TEMP TABLE _votetw_existing_birth_decisions AS
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
    FROM _votetw_existing_birth_candidates candidate
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
                 REGEXP_REPLACE(
                     REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                     E'\\s+',
                     '',
                     'g'
                 ) ~ '黨黨$'
                 OR REGEXP_REPLACE(
                     REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                     E'\\s+',
                     '',
                     'g'
                 ) LIKE '現任%'
             )
             AND REGEXP_REPLACE(
                 REGEXP_REPLACE(
                     REGEXP_REPLACE(
                         REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     ),
                     '^現任',
                     ''
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
                     ) IN (
                         '台灣基進',
                         '基進黨'
                     )
                         THEN '台灣基進'
                     WHEN REGEXP_REPLACE(
                         REPLACE(COALESCE(claim_value, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     ) IN (
                         '台灣綠黨',
                         '綠黨'
                     )
                         THEN '綠黨'
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
                     ) IN (
                         '台灣基進',
                         '基進黨'
                     )
                         THEN '台灣基進'
                     WHEN REGEXP_REPLACE(
                         REPLACE(COALESCE(party, ''), '臺', '台'),
                         E'\\s+',
                         '',
                         'g'
                     ) IN (
                         '台灣綠黨',
                         '綠黨'
                     )
                         THEN '綠黨'
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
    IF (SELECT COUNT(*) FROM _votetw_existing_birth_eligible) <> 100 THEN
        RAISE EXCEPTION
            'VoteTW existing birth profile count drifted from 100';
    END IF;

    IF (SELECT COUNT(*) FROM _votetw_existing_birth_decisions) <> 286 THEN
        RAISE EXCEPTION
            'VoteTW existing birth claim total drifted from 286';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_existing_birth_decisions
        WHERE action = 'publish_c'
    ) <> 132 THEN
        RAISE EXCEPTION
            'VoteTW existing birth publish count drifted from 132';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_existing_birth_decisions
        WHERE action LIKE 'archive_%'
    ) <> 148 THEN
        RAISE EXCEPTION
            'VoteTW existing birth archive count drifted from 148';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_existing_birth_decisions
        WHERE action = 'hold_conflict'
    ) <> 6 THEN
        RAISE EXCEPTION
            'VoteTW existing birth hold count drifted from 6';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-existing-birth-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-existing-birth-claim-rereview-v1',
                'reason', 'VoteTW profile birth date uniquely matches the currently linked public person and the value has no conflict',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_existing_birth_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-existing-birth-claim-rereview-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-existing-birth-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-existing-birth-claim-rereview-v1',
                'reason', 'VoteTW claim retained as private audit history because an independent or core public value already exists',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_existing_birth_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-existing-birth-claim-rereview-v1';

UPDATE person_claims claim
SET
    scoring_version = 'votetw-existing-birth-claim-conflict-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-existing-birth-claim-conflict-v1',
                'reason', 'VoteTW party affiliation differs from the current public person party',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _votetw_existing_birth_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_conflict'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-existing-birth-claim-conflict-v1';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _votetw_existing_birth_decisions decision
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
                    'votetw-existing-birth-claim-conflict-v1'
            )
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW existing birth claim state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_existing_birth_decisions;
DROP TABLE _votetw_existing_birth_candidates;
DROP TABLE _votetw_existing_birth_eligible;
DROP TABLE _votetw_existing_birth_profiles;
DROP TABLE _verified_non_votetw_claims;

RESET statement_timeout;
