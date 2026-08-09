SET statement_timeout = 0;

-- Finish the nine birth-dated VoteTW profiles left after the generic safe
-- pass. Each profile has an explicit official-person or exact election-history
-- anchor. Four same-page cross-year candidate splits are merged at confidence
-- C; Chen Ou-po's claims are relinked without merging the broader identities.
CREATE TEMP TABLE _votetw_final_empty_profiles (
    owner_person_id UUID PRIMARY KEY,
    target_person_id UUID NOT NULL,
    name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    source_birth_date TEXT NOT NULL,
    expected_records INTEGER NOT NULL
);

INSERT INTO _votetw_final_empty_profiles VALUES
    ('0d156b19-a3d3-4e94-be8c-c0c1d458aff9', '0d156b19-a3d3-4e94-be8c-c0c1d458aff9', '宋國鼎', 'https://votetw.com/wiki/%E5%AE%8B%E5%9C%8B%E9%BC%8E', '宋國鼎:1981-01-22', '1981-01-22', 2),
    ('6bc54045-f1f5-4ae0-b57f-b084f2dc8985', '6bc54045-f1f5-4ae0-b57f-b084f2dc8985', '林為洲', 'https://votetw.com/wiki/%E6%9E%97%E7%82%BA%E6%B4%B2', '林為洲:1961-07-25', '1961-07-25', 2),
    ('01e2cf19-cec6-47e6-a1b0-8c5a599674a4', '01e2cf19-cec6-47e6-a1b0-8c5a599674a4', '林義豐', 'https://votetw.com/wiki/%E6%9E%97%E7%BE%A9%E8%B1%90', '林義豐:1948-02-04', '1948-02-04', 2),
    ('4b505c18-bf74-41a8-b3e0-eee1c075f038', '4b505c18-bf74-41a8-b3e0-eee1c075f038', '柯建銘', 'https://votetw.com/wiki/%E6%9F%AF%E5%BB%BA%E9%8A%98', '柯建銘:1951-09-08', '1951-09-08', 2),
    ('9b12f5b0-f0ad-4a3a-9719-a7c2a87f6e6c', '9b12f5b0-f0ad-4a3a-9719-a7c2a87f6e6c', '楊鎮浯', 'https://votetw.com/wiki/%E6%A5%8A%E9%8E%AE%E6%B5%AF', '楊鎮浯:1972-06-26', '1972-06-26', 1),
    ('c3ecb240-97a5-4f19-909d-a1533fae3c78', 'c3ecb240-97a5-4f19-909d-a1533fae3c78', '王永慶', 'https://votetw.com/wiki/%E7%8E%8B%E6%B0%B8%E6%85%B6', '王永慶:1962-10-24', '1962-10-24', 1),
    ('170e047f-8ea5-4e62-aa31-ea60a26fbf35', '170e047f-8ea5-4e62-aa31-ea60a26fbf35', '邱鎮軍', 'https://votetw.com/wiki/%E9%82%B1%E9%8E%AE%E8%BB%8D', '邱鎮軍:1971-12-07', '1971-12-07', 2),
    ('446f9b0b-acf2-4c50-acd6-313a20072fde', 'a56ce4cf-bb1d-4e0b-b9e3-d4524694dd2d', '陳歐珀', 'https://votetw.com/wiki/%E9%99%B3%E6%AD%90%E7%8F%80', '陳歐珀:1962-10-12', '1962-10-12', 1),
    ('03eb53f0-cbf8-433b-a228-9a20d8a3e8d7', '03eb53f0-cbf8-433b-a228-9a20d8a3e8d7', '黄玉芬', 'https://votetw.com/wiki/%E9%BB%84%E7%8E%89%E8%8A%AC', '黄玉芬:1982-11-10', '1982-11-10', 2);

CREATE TEMP TABLE _votetw_final_empty_merges (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    name TEXT NOT NULL,
    earlier_year INTEGER NOT NULL,
    later_year INTEGER NOT NULL,
    geography TEXT NOT NULL
);

INSERT INTO _votetw_final_empty_merges VALUES
    ('d7d1439e-a867-4352-9355-97b1276db759', '6bc54045-f1f5-4ae0-b57f-b084f2dc8985', '林為洲', 2020, 2022, '新竹縣'),
    ('09709cc8-d847-4401-877a-03a1fd03fc87', '01e2cf19-cec6-47e6-a1b0-8c5a599674a4', '林義豐', 2020, 2022, '臺南市'),
    ('1b0b02a8-8fa1-4286-bdd0-c67aef9b2ac5', '170e047f-8ea5-4e62-aa31-ea60a26fbf35', '邱鎮軍', 2022, 2024, '苗栗'),
    ('757b38c5-e335-4682-8be4-30316d134db6', '03eb53f0-cbf8-433b-a228-9a20d8a3e8d7', '黄玉芬', 2020, 2022, '彰化縣');

CREATE TEMP TABLE _votetw_final_empty_records AS
SELECT DISTINCT
    profile.*,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party
FROM _votetw_final_empty_profiles profile
JOIN person_claims external
  ON external.person_id IN (
      profile.owner_person_id,
      profile.target_person_id
  )
 AND external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = profile.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
) record;

CREATE FUNCTION pg_temp._votetw_final_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN REGEXP_REPLACE(
        REPLACE(COALESCE(value, ''), '臺', '台'), E'\\s+', '', 'g'
    ) IN ('無', '無黨', '無黨派', '無黨籍') THEN '無黨籍'
    ELSE REGEXP_REPLACE(
        REPLACE(COALESCE(value, ''), '臺', '台'), E'\\s+', '', 'g'
    )
END;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_final_empty_profiles) <> 9
       OR (SELECT COUNT(*) FROM _votetw_final_empty_records) <> 15 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_final_empty_profiles profile
        JOIN people owner ON owner.id = profile.owner_person_id
        JOIN public_people target
          ON target.person_id = profile.target_person_id
        WHERE owner.name <> profile.name
           OR target.name <> profile.name
    ) THEN
        RAISE EXCEPTION 'VoteTW final empty-profile person anchor drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_final_empty_profiles profile
        LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT record.source_election) AS record_count
            FROM _votetw_final_empty_records record
            WHERE record.owner_person_id = profile.owner_person_id
        ) records ON TRUE
        WHERE records.record_count <> profile.expected_records
    ) THEN
        RAISE EXCEPTION 'VoteTW final empty-profile record count drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_final_empty_profiles profile
        JOIN person_claims claim
          ON claim.person_id IN (
              profile.owner_person_id,
              profile.target_person_id
          )
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
    ) <> 54 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile claim count drifted from 54';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_final_empty_profiles profile
        JOIN person_claims claim
          ON claim.person_id IN (
              profile.owner_person_id,
              profile.target_person_id
          )
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
        WHERE claim.claim_json->'identityMatch'->>'sourceBirthDate' <>
              profile.source_birth_date
           OR claim.claim_type IN ('legal_case', 'platform')
    ) THEN
        RAISE EXCEPTION 'VoteTW final empty-profile claim anchor drifted';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM people person
        JOIN person_claims claim ON claim.person_id = person.id
        WHERE person.id = '4b505c18-bf74-41a8-b3e0-eee1c075f038'::UUID
          AND person.name = '柯建銘'
          AND person.party = '民主進步黨'
          AND person.source_url = 'https://data.ly.gov.tw/getds.action?id=16'
          AND claim.source_name LIKE '立法院開放資料%'
          AND claim.review_status = 'verified'
          AND claim.is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Ko Chien-ming official person anchor drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_final_empty_merges proposed
        JOIN people duplicate ON duplicate.id = proposed.duplicate_person_id
        JOIN people canonical ON canonical.id = proposed.canonical_person_id
        WHERE duplicate.name <> proposed.name
           OR canonical.name <> proposed.name
    ) THEN
        RAISE EXCEPTION 'VoteTW final cross-year merge name drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_final_empty_merges proposed
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = proposed.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> proposed.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'VoteTW final cross-year merge conflicts with an existing decision';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_final_empty_merges proposed
        WHERE NOT EXISTS (
            SELECT 1
            FROM candidates earlier_candidate
            JOIN races earlier_race ON earlier_race.id = earlier_candidate.race_id
            JOIN elections earlier_election
              ON earlier_election.id = earlier_race.election_id
            JOIN people earlier_person
              ON earlier_person.id = earlier_candidate.person_id
            JOIN person_canonical_map earlier_canonical
              ON earlier_canonical.person_id = earlier_person.id
            WHERE earlier_canonical.canonical_person_id IN (
                proposed.duplicate_person_id,
                proposed.canonical_person_id
            )
              AND earlier_person.source_url = (
                  SELECT profile.source_url
                  FROM _votetw_final_empty_profiles profile
                  WHERE profile.name = proposed.name
              )
              AND earlier_candidate.source_name =
                  'VoteTW historical election results'
              AND earlier_election.year = proposed.earlier_year
              AND earlier_race.title LIKE '%' || proposed.geography || '%'
        )
           OR NOT EXISTS (
            SELECT 1
            FROM candidates later_candidate
            JOIN races later_race ON later_race.id = later_candidate.race_id
            JOIN elections later_election
              ON later_election.id = later_race.election_id
            JOIN people later_person ON later_person.id = later_candidate.person_id
            JOIN person_canonical_map later_canonical
              ON later_canonical.person_id = later_person.id
            WHERE later_canonical.canonical_person_id IN (
                proposed.duplicate_person_id,
                proposed.canonical_person_id
            )
              AND later_person.source_url = (
                  SELECT profile.source_url
                  FROM _votetw_final_empty_profiles profile
                  WHERE profile.name = proposed.name
              )
              AND later_candidate.source_name =
                  'VoteTW historical election results'
              AND later_election.year = proposed.later_year
              AND later_race.title LIKE '%' || proposed.geography || '%'
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW final cross-year election evidence drifted';
    END IF;
END;
$$;

INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    proposed.duplicate_person_id,
    proposed.canonical_person_id,
    'verified',
    'C',
    proposed.name || '：同一 VoteTW 生日人物頁的跨年參選紀錄指向被拆開的候選人。',
    jsonb_build_object(
        'version', 'votetw-final-empty-profile-cross-year-v1',
        'earlierYear', proposed.earlier_year,
        'laterYear', proposed.later_year,
        'geography', proposed.geography
    ),
    'system:votetw-final-empty-profile-cross-year-v1',
    NOW(),
    NOW()
FROM _votetw_final_empty_merges proposed
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = proposed.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);

UPDATE person_claims claim
SET
    person_id = profile.target_person_id,
    claim_json = claim.claim_json ||
        jsonb_build_object(
            'identityResolution',
            jsonb_build_object(
                'version', 'votetw-final-empty-profile-anchor-v1',
                'originalPersonId', profile.owner_person_id,
                'targetPersonId', profile.target_person_id,
                'sourceUrl', profile.source_url,
                'reason', 'explicit official person or exact cross-year election anchor',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-final-empty-profile-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-final-empty-profile-anchor-v1',
                    'reason', 'VoteTW profile resolved by an explicit official person or exact election anchor',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_final_empty_profiles profile
WHERE claim.person_id IN (
      profile.owner_person_id,
      profile.target_person_id
  )
  AND claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND (
      claim.person_id <> profile.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-final-empty-profile-anchor-v1'
  );

CREATE TEMP TABLE _votetw_final_verified_claims AS
SELECT DISTINCT
    COALESCE(canonical.canonical_person_id, claim.person_id) AS person_id,
    claim.claim_type,
    TRIM(claim.claim_value) AS claim_value
FROM person_claims claim
LEFT JOIN person_canonical_map canonical ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

CREATE TEMP TABLE _votetw_final_claims AS
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
        FROM _votetw_final_empty_records record
        WHERE record.owner_person_id = profile.owner_person_id
          AND pg_temp._votetw_final_norm_party(record.source_party) =
              pg_temp._votetw_final_norm_party(claim.claim_value)
    ) AS party_supported_by_profile
FROM _votetw_final_empty_profiles profile
JOIN person_claims claim
  ON claim.person_id = profile.target_person_id
 AND claim.source_name = 'VoteTW'
 AND claim.source_url = profile.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
WHERE claim.claim_type IN (
    'birth_date', 'gender', 'party_affiliation', 'education', 'experience'
);

CREATE TEMP TABLE _votetw_final_decisions AS
WITH classified AS (
    SELECT
        candidate.*,
        person.gender,
        person.party,
        person.education,
        EXISTS (
            SELECT 1
            FROM _votetw_final_verified_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
        ) AS has_verified_type,
        EXISTS (
            SELECT 1
            FROM _votetw_final_verified_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
              AND verified.claim_value = TRIM(candidate.claim_value)
        ) AS has_exact_verified
    FROM _votetw_final_claims candidate
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
             AND pg_temp._votetw_final_norm_party(claim_value) <>
                 pg_temp._votetw_final_norm_party(party)
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
    IF (SELECT COUNT(*) FROM _votetw_final_decisions) <> 45 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile review count drifted from 45';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_final_decisions
        WHERE action = 'publish_c'
    ) <> 30 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile publish count drifted from 30';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_final_decisions
        WHERE action LIKE 'archive_%'
    ) <> 15 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile archive count drifted from 15';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _votetw_final_decisions
        WHERE action = 'hold_conflict'
    ) THEN
        RAISE EXCEPTION 'VoteTW final empty-profile review retained a conflict';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-final-empty-profile-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-final-empty-profile-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-final-empty-profile-rereview-v1',
                    'reason', 'VoteTW profile resolved by explicit official or election evidence and has no conflicting public value',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_final_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-final-empty-profile-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-final-empty-profile-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-final-empty-profile-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-final-empty-profile-rereview-v1',
                    'reason', 'VoteTW value remains private because it was already archived or an equal or better source exists',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_final_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-final-empty-profile-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-final-empty-profile-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-final-empty-profile-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-final-empty-profile-rereview-v1',
                    'reason', 'VoteTW external identifier remains private after profile review',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_final_empty_profiles profile
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
          'votetw-final-empty-profile-rereview-v1'
  );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _votetw_final_empty_merges proposed
        JOIN person_canonical_map canonical
          ON canonical.person_id = proposed.duplicate_person_id
        WHERE canonical.canonical_person_id <> proposed.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'VoteTW final cross-year canonical state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_final_empty_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-final-empty-profile-anchor-v1'
    ) <> 54 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_final_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'publish_c'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-final-empty-profile-rereview-v1'
    ) <> 30 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile public state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_final_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action LIKE 'archive_%'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-final-empty-profile-rereview-v1'
    ) <> 15 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile archived state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_final_empty_profiles profile
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
             'votetw-final-empty-profile-rereview-v1'
    ) <> 9 THEN
        RAISE EXCEPTION 'VoteTW final empty-profile identifier state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_final_decisions;
DROP TABLE _votetw_final_claims;
DROP TABLE _votetw_final_verified_claims;
DROP TABLE _votetw_final_empty_records;
DROP TABLE _votetw_final_empty_merges;
DROP TABLE _votetw_final_empty_profiles;

RESET statement_timeout;
