SET statement_timeout = 0;

-- The same birth-dated VoteTW profile contains Xu Pi-ken's 2020 legislative
-- and 2022 village-chief candidacies, which were imported as two public people.
-- This is consistent same-source identity evidence, so the merge remains C
-- rather than being treated as independent or official corroboration.
CREATE TEMP TABLE _votetw_xu_piken_merges (
    canonical_external_id TEXT PRIMARY KEY,
    duplicate_external_id TEXT UNIQUE NOT NULL,
    expected_name TEXT NOT NULL,
    source_birth_date DATE NOT NULL,
    canonical_election TEXT NOT NULL,
    canonical_party TEXT NOT NULL,
    duplicate_election TEXT NOT NULL,
    duplicate_party TEXT NOT NULL
);

INSERT INTO _votetw_xu_piken_merges VALUES
    (
        'votetw-person-0f5b4d4d750a1bc6',
        'votetw-person-6c007bf2e4a61972',
        '許丕肯',
        '1965-06-12',
        '2022年金門縣金城鎮南門里里長選舉',
        '無',
        '2020年立法委員選舉金門縣選舉區（區域）',
        '中華新住民黨'
    );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_xu_piken_merges input
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
          ON profile.person_id IN (canonical.id, duplicate.id)
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
    ) <> 1 THEN
        RAISE EXCEPTION
            'VoteTW local cross-year identity evidence drifted from 1 pair';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_xu_piken_merges input
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
            'VoteTW local cross-year identity gained a conflicting merge decision';
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
    'C',
    CONCAT(
        input.expected_name,
        '：同一 VoteTW 生日人物頁中的兩筆參選紀錄，分別對上兩個被拆開的 VoteTW 歷史候選人紀錄。'
    ),
    jsonb_build_object(
        'version', 'votetw-local-cross-year-election-anchor-v1',
        'sourceBirthDate', input.source_birth_date,
        'canonicalElection', input.canonical_election,
        'canonicalParty', input.canonical_party,
        'duplicateElection', input.duplicate_election,
        'duplicateParty', input.duplicate_party
    ),
    'system:votetw-local-cross-year-election-anchor-v1',
    NOW(),
    NOW()
FROM _votetw_xu_piken_merges input
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
                'version', 'votetw-local-cross-year-election-anchor-v1',
                'reason', 'pending claim relinked after a verified VoteTW local cross-year identity merge',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _votetw_xu_piken_merges input
JOIN people canonical
  ON canonical.external_id = input.canonical_external_id
JOIN people duplicate
  ON duplicate.external_id = input.duplicate_external_id
WHERE claim.person_id = duplicate.id
  AND claim.review_status IN ('pending', 'needs_more_evidence');

CREATE TEMP TABLE _votetw_xu_piken_claim_candidates AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
FROM _votetw_xu_piken_merges input
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
          'votetw-local-cross-year-claim-rereview-v1',
          'votetw-local-cross-year-claim-conflict-v1'
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

CREATE TEMP TABLE _votetw_xu_piken_claim_decisions AS
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
    FROM _votetw_xu_piken_claim_candidates candidate
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
    IF (SELECT COUNT(*) FROM _votetw_xu_piken_claim_decisions) <> 5 THEN
        RAISE EXCEPTION 'VoteTW local cross-year claim total drifted from 5';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_xu_piken_claim_decisions
        WHERE action = 'publish_c'
    ) <> 4 THEN
        RAISE EXCEPTION 'VoteTW local cross-year claim publish count drifted from 4';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_xu_piken_claim_decisions
        WHERE action LIKE 'archive_%'
    ) <> 0 THEN
        RAISE EXCEPTION 'VoteTW local cross-year claim archive count drifted from 0';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_xu_piken_claim_decisions
        WHERE action = 'hold_conflict'
    ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW local cross-year claim hold count drifted from 1';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-local-cross-year-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-local-cross-year-claim-rereview-v1',
                'reason', 'VoteTW profile is anchored to two exact cross-year election contexts and has no conflicting value',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_xu_piken_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-local-cross-year-claim-rereview-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-local-cross-year-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-local-cross-year-claim-rereview-v1',
                'reason', 'VoteTW summary retained as private audit history because a better public value already exists',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_xu_piken_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-local-cross-year-claim-rereview-v1';

UPDATE person_claims claim
SET
    scoring_version = 'votetw-local-cross-year-claim-conflict-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-local-cross-year-claim-conflict-v1',
                'reason', 'VoteTW party affiliation differs from the current public person party',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _votetw_xu_piken_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_conflict'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-local-cross-year-claim-conflict-v1';

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_xu_piken_merges input
        JOIN people duplicate
          ON duplicate.external_id = input.duplicate_external_id
        JOIN people canonical
          ON canonical.external_id = input.canonical_external_id
        JOIN person_canonical_map map ON map.person_id = duplicate.id
        WHERE map.canonical_person_id = canonical.id
    ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW local cross-year merge state mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_xu_piken_claim_decisions decision
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
                    'votetw-local-cross-year-claim-conflict-v1'
            )
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW local cross-year claim state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_xu_piken_claim_decisions;
DROP TABLE _verified_non_votetw_claim_types;
DROP TABLE _votetw_xu_piken_claim_candidates;
DROP TABLE _votetw_xu_piken_merges;

RESET statement_timeout;
