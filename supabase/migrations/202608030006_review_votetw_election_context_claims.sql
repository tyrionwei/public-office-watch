SET statement_timeout = 0;

-- Review VoteTW profiles that resolve to exactly one same-name profile through
-- a matching election year, position, district, and party. Conflicting facts
-- remain in the manual queue.
CREATE TEMP TABLE _votetw_election_context_candidates AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
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
  AND claim.claim_json->'identityMatch'->>'status' = 'matched'
  AND claim.claim_json->'identityMatch'->>'matchedBy' =
      'unique_election_context'
  AND claim.claim_json->'publicationGate'
      ->'electionContextMatch'->>'score' = '3'
  AND claim.claim_json->'publicationGate'
      ->'electionContextMatch'->'signals'->>'position' = 'true'
  AND claim.claim_json->'publicationGate'
      ->'electionContextMatch'->'signals'->>'district' = 'true'
  AND claim.claim_json->'publicationGate'
      ->'electionContextMatch'->'signals'->>'party' = 'true'
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.scoring_version IN (
          'votetw-election-context-rereview-v1',
          'votetw-election-context-conflict-v1'
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

CREATE TEMP TABLE _votetw_election_context_decisions AS
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
    FROM _votetw_election_context_candidates candidate
    JOIN public_people person ON person.person_id = candidate.person_id
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
    IF (SELECT COUNT(*) FROM _votetw_election_context_decisions) <> 400 THEN
        RAISE EXCEPTION 'VoteTW election-context review total drifted from 400';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_election_context_decisions
        WHERE action = 'publish_c'
    ) <> 332 THEN
        RAISE EXCEPTION 'VoteTW election-context publish count drifted from 332';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_election_context_decisions
        WHERE action LIKE 'archive_%'
    ) <> 21 THEN
        RAISE EXCEPTION 'VoteTW election-context archive count drifted from 21';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_election_context_decisions
        WHERE action = 'hold_conflict'
    ) <> 47 THEN
        RAISE EXCEPTION 'VoteTW election-context hold count drifted from 47';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-election-context-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-election-context-rereview-v1',
                'reason', 'VoteTW profile uniquely matches the person election year, position, district, and party and has no conflicting value',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_election_context_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-election-context-rereview-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-election-context-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-election-context-rereview-v1',
                'reason', 'VoteTW summary retained as private audit history because a better public value already exists',
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_election_context_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-election-context-rereview-v1';

UPDATE person_claims claim
SET
    scoring_version = 'votetw-election-context-conflict-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'votetw-election-context-conflict-v1',
                'reason',
                    CASE decision.claim_type
                        WHEN 'birth_date' THEN
                            'VoteTW birth date conflicts with another verified public source'
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
FROM _votetw_election_context_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_conflict'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-election-context-conflict-v1';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _votetw_election_context_decisions decision
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
                    'votetw-election-context-conflict-v1'
            )
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW election-context review state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_election_context_decisions;
DROP TABLE _verified_non_votetw_claim_types;
DROP TABLE _votetw_election_context_candidates;

RESET statement_timeout;
