SET statement_timeout = 0;

-- Repair VoteTW claims attached to the wrong same-name person. This is a
-- same-source consistency repair, not independent corroboration: the target
-- person's source URL must be the exact VoteTW profile URL, and the profile's
-- two election records must have exactly one locally matchable person across
-- the published VoteTW historical candidate records. Published values remain
-- capped at confidence C.
CREATE TEMP TABLE _votetw_multi_election_profiles AS
SELECT DISTINCT
    CASE
        WHEN claim.claim_json->'identityResolution'->>'version' =
             'votetw-multi-election-source-anchor-v1'
            THEN (
                claim.claim_json->'identityResolution'->>'originalPersonId'
            )::UUID
        ELSE claim.person_id
    END AS owner_person_id,
    claim.person_id AS current_person_id,
    person.name,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key,
    claim.claim_json->'identityMatch'->>'sourceBirthDate' AS source_birth_date
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
          'votetw-multi-election-source-anchor-v1'
  );

CREATE FUNCTION pg_temp._votetw_single_norm_text(value TEXT)
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

CREATE FUNCTION pg_temp._votetw_single_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN pg_temp._votetw_single_norm_text(value) IN (
        '無', '無黨', '無黨派', '無黨籍'
    ) THEN '無黨籍'
    WHEN pg_temp._votetw_single_norm_text(value) IN (
        '台灣基進', '基進黨'
    ) THEN '台灣基進'
    WHEN pg_temp._votetw_single_norm_text(value) IN (
        '台灣綠黨', '綠黨'
    ) THEN '綠黨'
    ELSE pg_temp._votetw_single_norm_text(value)
END;

CREATE TEMP TABLE _votetw_multi_election_records AS
SELECT DISTINCT
    profile.owner_person_id,
    profile.current_person_id,
    profile.name,
    profile.source_url,
    profile.profile_key,
    profile.source_birth_date,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party
FROM _votetw_multi_election_profiles profile
JOIN person_claims external
  ON external.person_id IN (
      profile.owner_person_id,
      profile.current_person_id
  )
 AND external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = profile.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
) record;

CREATE TEMP TABLE _votetw_multi_election_matches AS
SELECT DISTINCT
    source.owner_person_id,
    source.current_person_id,
    source.name,
    source.source_url,
    source.profile_key,
    source.source_birth_date,
    candidate.person_id AS target_person_id
FROM _votetw_multi_election_records source
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
  AND pg_temp._votetw_single_norm_text(source.source_election) LIKE '%' ||
      pg_temp._votetw_single_norm_text(election.name) || '%'
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
  AND pg_temp._votetw_single_norm_party(source.source_party) =
      pg_temp._votetw_single_norm_party(candidate.party);

CREATE TEMP TABLE _votetw_multi_election_summary AS
SELECT
    profile.*,
    (
        SELECT COUNT(DISTINCT record.source_election)
        FROM _votetw_multi_election_records record
        WHERE record.owner_person_id = profile.owner_person_id
          AND record.source_url = profile.source_url
          AND record.profile_key = profile.profile_key
    ) AS source_record_count,
    COUNT(DISTINCT match.target_person_id) AS target_count,
    BOOL_OR(match.target_person_id = profile.owner_person_id) AS owner_matches,
    (MIN(match.target_person_id::TEXT))::UUID AS target_person_id
FROM _votetw_multi_election_profiles profile
LEFT JOIN _votetw_multi_election_matches match
  ON match.owner_person_id = profile.owner_person_id
 AND match.source_url = profile.source_url
 AND match.profile_key = profile.profile_key
GROUP BY
    profile.owner_person_id,
    profile.current_person_id,
    profile.name,
    profile.source_url,
    profile.profile_key,
    profile.source_birth_date;

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

CREATE INDEX _verified_non_votetw_claims_single_election_idx
ON _verified_non_votetw_claims (person_id, claim_type, value_hash);
ANALYZE _verified_non_votetw_claims;

CREATE TEMP TABLE _votetw_multi_election_relinks AS
SELECT summary.*
FROM _votetw_multi_election_summary summary
JOIN people target ON target.id = summary.target_person_id
WHERE summary.source_record_count = 2
  AND summary.target_count = 1
  AND summary.owner_matches IS FALSE
  AND summary.target_person_id <> summary.owner_person_id
  AND target.is_public = TRUE
  AND target.source_url = summary.source_url
  AND NOT EXISTS (
      SELECT 1
      FROM _verified_non_votetw_claims verified
      WHERE verified.person_id = summary.target_person_id
        AND verified.claim_type = 'birth_date'
        AND verified.claim_value <> summary.source_birth_date
  )
  AND NOT EXISTS (
      SELECT 1
      FROM person_claims gender_claim
      WHERE gender_claim.person_id IN (
          summary.owner_person_id,
          summary.current_person_id,
          summary.target_person_id
      )
        AND gender_claim.source_name = 'VoteTW'
        AND gender_claim.source_url = summary.source_url
        AND gender_claim.claim_json->'identityMatch'->>'sourceProfileKey' =
            summary.profile_key
        AND gender_claim.claim_type = 'gender'
        AND LOWER(TRIM(COALESCE(target.gender, ''))) NOT IN ('', 'unknown')
        AND LOWER(TRIM(gender_claim.claim_value)) <>
            LOWER(TRIM(target.gender))
  );

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM _votetw_multi_election_relinks
    ) <> 27 THEN
        RAISE EXCEPTION
            'VoteTW multi-election relink count drifted from 27';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_multi_election_relinks relink
        JOIN person_claims claim
          ON claim.person_id IN (
              relink.owner_person_id,
              relink.target_person_id
          )
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
        WHERE claim.source_name = 'VoteTW'
    ) <> 164 THEN
        RAISE EXCEPTION
            'VoteTW multi-election profile claim count drifted from 164';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_multi_election_relinks relink
        JOIN person_claims source_claim
          ON source_claim.person_id = relink.owner_person_id
         AND source_claim.source_url = relink.source_url
         AND source_claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
         AND source_claim.claim_type = 'platform'
        JOIN person_claims duplicate
          ON duplicate.person_id = relink.target_person_id
         AND duplicate.claim_type = source_claim.claim_type
         AND duplicate.claim_value = source_claim.claim_value
         AND duplicate.id <> source_claim.id
    ) THEN
        RAISE EXCEPTION
            'VoteTW multi-election relink would duplicate a platform claim';
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
                'version', 'votetw-multi-election-source-anchor-v1',
                'originalPersonId', relink.owner_person_id,
                'targetPersonId', relink.target_person_id,
                'sourceUrl', relink.source_url,
                'reason', 'exact VoteTW person source URL and a unique locally matchable person across two election records',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-multi-election-source-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-multi-election-source-anchor-v1',
                    'reason', 'VoteTW profile relinked to the same-name person whose exact source URL and locally matchable election history agree',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_multi_election_relinks relink
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
          'votetw-multi-election-source-anchor-v1'
  );

CREATE TEMP TABLE _votetw_multi_election_claims AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
FROM _votetw_multi_election_relinks relink
JOIN person_claims claim
  ON claim.person_id = relink.target_person_id
 AND claim.source_url = relink.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     relink.profile_key
WHERE claim.source_name = 'VoteTW'
  AND claim.claim_type IN (
      'birth_date', 'gender', 'party_affiliation', 'education', 'experience'
  )
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.scoring_version IN (
          'votetw-multi-election-claim-rereview-v1',
          'votetw-multi-election-claim-conflict-v1'
      )
  );

CREATE TEMP TABLE _votetw_multi_election_decisions AS
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
    FROM _votetw_multi_election_claims candidate
    JOIN public_people person ON person.person_id = candidate.person_id
)
SELECT
    classified.*,
    CASE
        WHEN has_exact_verified THEN 'archive_exact_source'
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
                 pg_temp._votetw_single_norm_text(claim_value) ~ '黨黨$'
                 OR pg_temp._votetw_single_norm_text(claim_value) LIKE
                    '現任%'
             )
             AND pg_temp._votetw_single_norm_party(
                 REGEXP_REPLACE(
                     REGEXP_REPLACE(
                         pg_temp._votetw_single_norm_text(claim_value),
                         '^現任',
                         ''
                     ),
                     '黨黨$',
                     '黨'
                 )
             ) = pg_temp._votetw_single_norm_party(party)
            THEN 'archive_core_duplicate'
        WHEN claim_type = 'birth_date' AND has_verified_type
            THEN 'hold_conflict'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
            THEN 'hold_conflict'
        WHEN claim_type = 'party_affiliation'
             AND NULLIF(TRIM(COALESCE(party, '')), '') IS NOT NULL
             AND pg_temp._votetw_single_norm_party(claim_value) <>
                 pg_temp._votetw_single_norm_party(party)
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
        SELECT COUNT(*) FROM _votetw_multi_election_decisions
    ) <> 114 THEN
        RAISE EXCEPTION
            'VoteTW multi-election review count drifted from 114';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_multi_election_decisions
        WHERE action = 'publish_c'
    ) <> 104 THEN
        RAISE EXCEPTION
            'VoteTW multi-election publish count drifted from 104';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_multi_election_decisions
        WHERE action LIKE 'archive_%'
    ) <> 0 THEN
        RAISE EXCEPTION
            'VoteTW multi-election archive count drifted from 0';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_multi_election_decisions
        WHERE action = 'hold_conflict'
    ) <> 10 THEN
        RAISE EXCEPTION
            'VoteTW multi-election hold count drifted from 10';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-multi-election-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-multi-election-claim-rereview-v1',
                'reason', 'VoteTW claim is attached to the person with the exact source URL and a unique locally matchable election history',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_multi_election_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-multi-election-claim-rereview-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-multi-election-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-multi-election-claim-rereview-v1',
                'reason', 'VoteTW claim retained as private audit history because the target person already has the same core value',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_multi_election_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-multi-election-claim-rereview-v1';

UPDATE person_claims claim
SET
    scoring_version = 'votetw-multi-election-claim-conflict-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-multi-election-claim-conflict-v1',
                'reason', 'VoteTW party value differs from the target person current core party and needs temporal review',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _votetw_multi_election_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_conflict'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-multi-election-claim-conflict-v1';

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_multi_election_relinks relink
        JOIN person_claims claim
          ON claim.person_id = relink.target_person_id
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-multi-election-source-anchor-v1'
        WHERE claim.source_name = 'VoteTW'
    ) <> 164 THEN
        RAISE EXCEPTION 'VoteTW multi-election relink state mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_multi_election_decisions decision
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
                    'votetw-multi-election-claim-conflict-v1'
            )
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW multi-election claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_multi_election_relinks relink
        JOIN person_claims claim
          ON claim.person_id = relink.target_person_id
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
        WHERE claim.claim_type = 'legal_case'
          AND claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
    ) <> 1 THEN
        RAISE EXCEPTION
            'VoteTW multi-election legal claim state drifted from 1';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_multi_election_relinks relink
        JOIN person_claims claim
          ON claim.person_id = relink.target_person_id
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
        WHERE claim.claim_type = 'platform'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
    ) <> 1 THEN
        RAISE EXCEPTION
            'VoteTW multi-election platform claim state drifted from 1';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_multi_election_decisions;
DROP TABLE _votetw_multi_election_claims;
DROP TABLE _votetw_multi_election_relinks;
DROP TABLE _verified_non_votetw_claims;
DROP TABLE _votetw_multi_election_summary;
DROP TABLE _votetw_multi_election_matches;
DROP TABLE _votetw_multi_election_records;
DROP TABLE _votetw_multi_election_profiles;

RESET statement_timeout;
