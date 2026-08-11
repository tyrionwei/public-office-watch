-- Production runtime snapshot contains seven fewer superseded evidence rows
-- than the full local warehouse. Keep the same deterministic archive rules.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

-- Resolve every merged identity to its terminal canonical person. Verified
-- merge chains currently reach four levels, so a one-hop mapping is not
-- sufficient for a safe duplicate comparison.
CREATE TEMP TABLE _profile_claim_canonical_map
ON COMMIT DROP
AS
WITH RECURSIVE verified_edges AS (
    SELECT duplicate_person_id, canonical_person_id
    FROM person_merge_decisions
    WHERE status = 'verified'
),
merge_walk AS (
    SELECT
        duplicate_person_id AS start_id,
        canonical_person_id AS current_id,
        1 AS depth,
        ARRAY[duplicate_person_id, canonical_person_id] AS path
    FROM verified_edges

    UNION ALL

    SELECT
        walk.start_id,
        edge.canonical_person_id,
        walk.depth + 1,
        array_append(walk.path, edge.canonical_person_id)
    FROM merge_walk walk
    JOIN verified_edges edge
      ON edge.duplicate_person_id = walk.current_id
    WHERE walk.depth < 20
      AND NOT edge.canonical_person_id = ANY(walk.path)
),
terminal_people AS (
    SELECT DISTINCT ON (walk.start_id)
        walk.start_id,
        walk.current_id AS canonical_person_id,
        walk.depth
    FROM merge_walk walk
    LEFT JOIN verified_edges edge
      ON edge.duplicate_person_id = walk.current_id
    WHERE edge.duplicate_person_id IS NULL
    ORDER BY walk.start_id, walk.depth DESC
)
SELECT
    person.id AS person_id,
    COALESCE(terminal.canonical_person_id, person.id) AS canonical_person_id
FROM people person
LEFT JOIN terminal_people terminal
  ON terminal.start_id = person.id;

ALTER TABLE _profile_claim_canonical_map
    ADD PRIMARY KEY (person_id);

-- Preserve the exact public fact/source projection before archiving. The
-- post-update guard below requires this set to remain unchanged.
CREATE TEMP TABLE _profile_claim_expected_public_facts
ON COMMIT DROP
AS
SELECT DISTINCT
    canonical.canonical_person_id,
    claim.claim_type,
    claim.claim_value,
    claim.source_name,
    claim.source_url
FROM person_claims claim
JOIN _profile_claim_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public
  AND claim.claim_type IN ('education', 'experience');

CREATE TEMP TABLE _profile_claim_ranked
ON COMMIT DROP
AS
SELECT
    claim.id AS claim_id,
    canonical.canonical_person_id,
    claim.claim_type,
    claim.claim_value,
    claim.source_name,
    claim.source_url,
    ROW_NUMBER() OVER (
        PARTITION BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url
        ORDER BY
            (
                jsonb_typeof(claim.claim_json->'items') = 'array'
                AND jsonb_array_length(claim.claim_json->'items') > 0
            ) DESC,
            (claim.claim_json ? 'reviewDecision') DESC,
            (claim.claim_json ? 'publicationGate') DESC,
            (claim.claim_json ? 'identityMatch') DESC,
            (claim.claim_json ? 'sourceId') DESC,
            claim.review_score DESC NULLS LAST,
            claim.updated_at DESC,
            claim.id
    ) AS keep_rank,
    COUNT(*) OVER (
        PARTITION BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url
    ) AS group_size,
    FIRST_VALUE(claim.id) OVER (
        PARTITION BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url
        ORDER BY
            (
                jsonb_typeof(claim.claim_json->'items') = 'array'
                AND jsonb_array_length(claim.claim_json->'items') > 0
            ) DESC,
            (claim.claim_json ? 'reviewDecision') DESC,
            (claim.claim_json ? 'publicationGate') DESC,
            (claim.claim_json ? 'identityMatch') DESC,
            (claim.claim_json ? 'sourceId') DESC,
            claim.review_score DESC NULLS LAST,
            claim.updated_at DESC,
            claim.id
    ) AS survivor_claim_id
FROM person_claims claim
JOIN _profile_claim_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public
  AND claim.claim_type IN ('education', 'experience');

CREATE TEMP TABLE _profile_claim_archive_targets
ON COMMIT DROP
AS
SELECT *
FROM _profile_claim_ranked
WHERE group_size > 1
  AND keep_rank > 1;

ALTER TABLE _profile_claim_archive_targets
    ADD PRIMARY KEY (claim_id);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _profile_claim_archive_targets) <> 921 THEN
        RAISE EXCEPTION 'Profile claim archive target drifted: expected 921, got %',
            (SELECT COUNT(*) FROM _profile_claim_archive_targets);
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _profile_claim_ranked
        WHERE group_size > 1
          AND keep_rank = 1
    ) <> 813 THEN
        RAISE EXCEPTION 'Profile claim duplicate partition count drifted: expected 813, got %',
            (
                SELECT COUNT(*)
                FROM _profile_claim_ranked
                WHERE group_size > 1
                  AND keep_rank = 1
            );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _profile_claim_ranked ranked
        JOIN person_claims claim ON claim.id = ranked.claim_id
        WHERE ranked.group_size > 1
        GROUP BY
            ranked.canonical_person_id,
            ranked.claim_type,
            ranked.claim_value,
            ranked.source_name,
            ranked.source_url
        HAVING COUNT(DISTINCT COALESCE(
            (claim.claim_json->'items')::TEXT,
            ''
        )) > 1
    ) THEN
        RAISE EXCEPTION 'Structured profile claim content drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _profile_claim_archive_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE claim.claim_type NOT IN ('education', 'experience')
           OR claim.review_status <> 'verified'
           OR claim.visibility <> 'public'
           OR NOT claim.is_public
           OR target.survivor_claim_id = target.claim_id
    ) THEN
        RAISE EXCEPTION 'Profile claim archive boundary contains an unsafe row';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'canonical-profile-claim-dedup-archive-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'canonical-profile-claim-dedup-archive-v1',
                'reason', 'Archived duplicate public education or experience claim while retaining the same canonical fact and source URL',
                'survivorClaimId', target.survivor_claim_id,
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _profile_claim_archive_targets target
WHERE claim.id = target.claim_id;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _profile_claim_archive_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND NOT claim.is_public
          AND claim.scoring_version =
              'canonical-profile-claim-dedup-archive-v1'
    ) <> 921 THEN
        RAISE EXCEPTION 'Profile claim archive state mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _profile_claim_archive_targets target
        JOIN person_claims survivor
          ON survivor.id = target.survivor_claim_id
        WHERE survivor.review_status <> 'verified'
           OR survivor.visibility <> 'public'
           OR NOT survivor.is_public
    ) THEN
        RAISE EXCEPTION 'Profile claim survivor was not retained publicly';
    END IF;

    IF EXISTS (
        (
            SELECT *
            FROM _profile_claim_expected_public_facts
            EXCEPT
            SELECT DISTINCT
                canonical.canonical_person_id,
                claim.claim_type,
                claim.claim_value,
                claim.source_name,
                claim.source_url
            FROM person_claims claim
            JOIN _profile_claim_canonical_map canonical
              ON canonical.person_id = claim.person_id
            WHERE claim.review_status = 'verified'
              AND claim.visibility = 'public'
              AND claim.is_public
              AND claim.claim_type IN ('education', 'experience')
        )

        UNION ALL

        (
            SELECT DISTINCT
                canonical.canonical_person_id,
                claim.claim_type,
                claim.claim_value,
                claim.source_name,
                claim.source_url
            FROM person_claims claim
            JOIN _profile_claim_canonical_map canonical
              ON canonical.person_id = claim.person_id
            WHERE claim.review_status = 'verified'
              AND claim.visibility = 'public'
              AND claim.is_public
              AND claim.claim_type IN ('education', 'experience')
            EXCEPT
            SELECT *
            FROM _profile_claim_expected_public_facts
        )
    ) THEN
        RAISE EXCEPTION 'Public profile fact/source projection changed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims claim
        JOIN _profile_claim_canonical_map canonical
          ON canonical.person_id = claim.person_id
        WHERE claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public
          AND claim.claim_type IN ('education', 'experience')
        GROUP BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate exact-source profile claims remain';
    END IF;
END;
$$;

COMMIT;
