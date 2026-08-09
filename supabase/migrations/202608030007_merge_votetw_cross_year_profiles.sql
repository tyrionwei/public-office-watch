SET statement_timeout = 0;

-- One birth-dated VoteTW profile can provide a conservative cross-year
-- identity anchor when two official candidate contexts on that same profile
-- exactly match two surviving public people.
CREATE TEMP TABLE _votetw_cross_year_merges (
    canonical_external_id TEXT PRIMARY KEY,
    duplicate_external_id TEXT UNIQUE NOT NULL,
    expected_name TEXT NOT NULL,
    source_birth_date DATE NOT NULL,
    canonical_election TEXT NOT NULL,
    canonical_party TEXT NOT NULL,
    duplicate_election TEXT NOT NULL,
    duplicate_party TEXT NOT NULL
);

INSERT INTO _votetw_cross_year_merges VALUES
    (
        'votetw-person-2001f711422f4e1c',
        'votetw-person-a658058ee29e2891',
        '丁學忠',
        '1970-06-28',
        '2024年立法委員選舉雲林縣第1選舉區（區域）',
        '中國國民黨',
        '2022年雲林縣虎尾鎮鎮長選舉',
        '無'
    ),
    (
        'votetw-person-7b2e7854c679a346',
        'votetw-person-4c471c3069dc0d3f',
        '張臺勝',
        '1956-08-31',
        '2024年立法委員選舉臺北市第1選舉區（區域）',
        '人民最大黨',
        '2022年臺北市北投區永欣里里長選舉',
        '人民最大黨'
    ),
    (
        'votetw-person-aed21eb5010bec08',
        'votetw-person-8a68103081b5f4fb',
        '莊銘淵',
        '1973-06-25',
        '2024年立法委員選舉新北市第9選舉區（區域）',
        '民主進步黨',
        '2022年新北市永和區後溪里里長選舉',
        '民主進步黨'
    ),
    (
        'votetw-person-e9c0c2cbb418d593',
        'votetw-person-d43195e0f00097a0',
        '許盛鋒',
        '1948-11-27',
        '2024年立法委員選舉臺北市第1選舉區（區域）',
        '無',
        '2022年臺北市北投區溫泉里里長選舉',
        '無'
    ),
    (
        'votetw-person-634be123217f4381',
        'votetw-person-c523d340dfd987b0',
        '陳癸佑',
        '1968-09-15',
        '2024年立法委員選舉南投縣第2選舉區（區域）',
        '無',
        '2022年南投縣鹿谷鄉鄉長選舉',
        '無'
    );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_cross_year_merges input
        JOIN people canonical
          ON canonical.external_id = input.canonical_external_id
         AND canonical.name = input.expected_name
         AND canonical.is_public = TRUE
        JOIN people duplicate
          ON duplicate.external_id = input.duplicate_external_id
         AND duplicate.name = input.expected_name
         AND duplicate.is_public = TRUE
         AND duplicate.id <> canonical.id
        JOIN person_claims profile
          ON profile.person_id = canonical.id
         AND profile.source_name = 'VoteTW'
         AND profile.claim_type = 'external_id'
         AND profile.claim_json->'identityMatch'->>'matchedBy' =
             'unique_page_profile_with_birth_date'
         AND profile.claim_json->'identityMatch'->>'sourceBirthDate' =
             input.source_birth_date::TEXT
         AND profile.claim_json->'electionRecords' @>
             jsonb_build_array(
                 jsonb_build_object(
                     'election', input.canonical_election,
                     'party', input.canonical_party
                 )
             )
         AND profile.claim_json->'electionRecords' @>
             jsonb_build_array(
                 jsonb_build_object(
                     'election', input.duplicate_election,
                     'party', input.duplicate_party
                 )
             )
        WHERE LOWER(COALESCE(canonical.gender, 'unknown')) = 'unknown'
           OR LOWER(COALESCE(duplicate.gender, 'unknown')) = 'unknown'
           OR LOWER(duplicate.gender) = LOWER(canonical.gender)
    ) <> 5 THEN
        RAISE EXCEPTION
            'VoteTW cross-year identity evidence drifted from 5 pairs';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_cross_year_merges input
        JOIN people duplicate
          ON duplicate.external_id = input.duplicate_external_id
        JOIN people canonical
          ON canonical.external_id = input.canonical_external_id
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = duplicate.id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> canonical.id
    ) THEN
        RAISE EXCEPTION
            'VoteTW cross-year identity gained a conflicting merge decision';
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
    duplicate.id,
    canonical.id,
    'verified',
    'B',
    CONCAT(
        input.expected_name,
        '：同一 VoteTW 生日人物頁中的兩筆參選紀錄，分別精確對上兩個年份的選舉、選區與黨籍。'
    ),
    jsonb_build_object(
        'version', 'votetw-cross-year-election-anchor-v1',
        'sourceBirthDate', input.source_birth_date,
        'canonicalElection', input.canonical_election,
        'canonicalParty', input.canonical_party,
        'duplicateElection', input.duplicate_election,
        'duplicateParty', input.duplicate_party
    ),
    'system:votetw-cross-year-election-anchor-v1',
    NOW(),
    NOW()
FROM _votetw_cross_year_merges input
JOIN people canonical
  ON canonical.external_id = input.canonical_external_id
JOIN people duplicate
  ON duplicate.external_id = input.duplicate_external_id
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = duplicate.id
      AND existing.status IN ('suggested', 'verified')
);

UPDATE person_claims claim
SET
    person_id = canonical.id,
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-cross-year-election-anchor-v1',
                'reason', 'pending claim relinked after a verified VoteTW cross-year identity merge',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _votetw_cross_year_merges input
JOIN people canonical
  ON canonical.external_id = input.canonical_external_id
JOIN people duplicate
  ON duplicate.external_id = input.duplicate_external_id
WHERE claim.person_id = duplicate.id
  AND claim.review_status IN ('pending', 'needs_more_evidence');

CREATE TEMP TABLE _votetw_cross_year_claim_candidates AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
FROM _votetw_cross_year_merges input
JOIN people canonical
  ON canonical.external_id = input.canonical_external_id
JOIN person_claims claim
  ON claim.person_id = canonical.id
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
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.scoring_version IN (
          'votetw-cross-year-claim-rereview-v1',
          'votetw-cross-year-claim-conflict-v1'
      )
  );

CREATE TEMP TABLE _verified_non_votetw_claim_types AS
SELECT DISTINCT
    COALESCE(canonical.canonical_person_id, claim.person_id) AS person_id,
    claim.claim_type
FROM person_claims claim
LEFT JOIN person_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

CREATE INDEX _verified_non_votetw_claim_types_idx
ON _verified_non_votetw_claim_types (person_id, claim_type);

ANALYZE _verified_non_votetw_claim_types;

CREATE TEMP TABLE _votetw_cross_year_claim_decisions AS
WITH classified AS (
    SELECT
        candidate.*,
        person.gender,
        person.party,
        person.education,
        EXISTS (
            SELECT 1
            FROM _verified_non_votetw_claim_types verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
        ) AS has_verified_type
    FROM _votetw_cross_year_claim_candidates candidate
    JOIN people person ON person.id = candidate.person_id
)
SELECT
    classified.*,
    CASE
        WHEN claim_type IN ('education', 'experience')
             AND has_verified_type
            THEN 'archive_better_source'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
             AND REPLACE(TRIM(claim_value), '學歷', '') = TRIM(education)
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
    IF (SELECT COUNT(*) FROM _votetw_cross_year_claim_decisions) <> 15 THEN
        RAISE EXCEPTION 'VoteTW cross-year claim total drifted from 15';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_cross_year_claim_decisions
        WHERE action = 'publish_c'
    ) <> 12 THEN
        RAISE EXCEPTION 'VoteTW cross-year claim publish count drifted from 12';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_cross_year_claim_decisions
        WHERE action LIKE 'archive_%'
    ) <> 2 THEN
        RAISE EXCEPTION 'VoteTW cross-year claim archive count drifted from 2';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_cross_year_claim_decisions
        WHERE action = 'hold_conflict'
    ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW cross-year claim hold count drifted from 1';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-cross-year-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-cross-year-claim-rereview-v1',
                'reason', 'VoteTW profile is anchored to two exact cross-year election contexts and has no conflicting value',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_cross_year_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-cross-year-claim-rereview-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-cross-year-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-cross-year-claim-rereview-v1',
                'reason', 'VoteTW summary retained as private audit history because a better public value already exists',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_cross_year_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-cross-year-claim-rereview-v1';

UPDATE person_claims claim
SET
    scoring_version = 'votetw-cross-year-claim-conflict-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-cross-year-claim-conflict-v1',
                'reason', 'VoteTW party affiliation differs from the current public person party',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _votetw_cross_year_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_conflict'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-cross-year-claim-conflict-v1';

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_cross_year_merges input
        JOIN people duplicate
          ON duplicate.external_id = input.duplicate_external_id
        JOIN people canonical
          ON canonical.external_id = input.canonical_external_id
        JOIN person_canonical_map map ON map.person_id = duplicate.id
        WHERE map.canonical_person_id = canonical.id
    ) <> 5 THEN
        RAISE EXCEPTION 'VoteTW cross-year merge state mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_cross_year_claim_decisions decision
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
                    'votetw-cross-year-claim-conflict-v1'
            )
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW cross-year claim state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_cross_year_claim_decisions;
DROP TABLE _verified_non_votetw_claim_types;
DROP TABLE _votetw_cross_year_claim_candidates;
DROP TABLE _votetw_cross_year_merges;

RESET statement_timeout;
