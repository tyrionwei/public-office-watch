-- Person claim duplicate/capacity preview.
--
-- Read-only by design. This script never updates or deletes data.
-- Run against local or rehearsal Supabase before preparing a compaction migration.

SELECT
    'claim_population' AS section,
    COUNT(*) AS total_claims,
    COUNT(*) FILTER (
        WHERE review_status = 'verified'
          AND visibility = 'public'
          AND is_public
    ) AS verified_public_claims,
    COUNT(*) FILTER (
        WHERE review_status = 'verified'
          AND visibility = 'public'
          AND is_public
          AND person_id IS NOT NULL
    ) AS linked_verified_public_claims,
    COUNT(*) FILTER (
        WHERE review_status = 'verified'
          AND visibility = 'public'
          AND is_public
          AND person_id IS NULL
    ) AS unlinked_verified_public_claims
FROM public.person_claims;

WITH RECURSIVE verified_edges AS (
    SELECT duplicate_person_id, canonical_person_id
    FROM public.person_merge_decisions
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
)
SELECT
    'merge_topology' AS section,
    COALESCE(MAX(depth), 0) AS maximum_verified_merge_depth,
    COUNT(*) FILTER (WHERE depth = 20) AS depth_limit_hits,
    (
        SELECT COUNT(*)
        FROM (
            SELECT duplicate_person_id
            FROM verified_edges
            GROUP BY duplicate_person_id
            HAVING COUNT(DISTINCT canonical_person_id) > 1
        ) conflicts
    ) AS duplicate_people_with_multiple_verified_targets
FROM merge_walk;

WITH RECURSIVE verified_edges AS (
    SELECT duplicate_person_id, canonical_person_id
    FROM public.person_merge_decisions
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
),
duplicate_groups AS (
    SELECT
        COALESCE(terminal.canonical_person_id, claim.person_id) AS canonical_person_id,
        claim.claim_type,
        claim.claim_value,
        claim.source_name,
        COUNT(*) AS claim_count
    FROM public.person_claims claim
    LEFT JOIN terminal_people terminal
      ON terminal.start_id = claim.person_id
    WHERE claim.person_id IS NOT NULL
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 1
)
SELECT
    'all_linked_public_semantic_duplicates' AS section,
    COUNT(*) AS duplicate_groups,
    SUM(claim_count) AS claims_in_duplicate_groups,
    SUM(claim_count - 1) AS surplus_claims
FROM duplicate_groups;

WITH RECURSIVE verified_edges AS (
    SELECT duplicate_person_id, canonical_person_id
    FROM public.person_merge_decisions
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
),
runtime_claims AS (
    SELECT
        claim.*,
        COALESCE(terminal.canonical_person_id, claim.person_id) AS canonical_person_id
    FROM public.person_claims claim
    LEFT JOIN terminal_people terminal
      ON terminal.start_id = claim.person_id
    WHERE claim.person_id IS NOT NULL
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public
      AND claim.claim_type IN (
          'education',
          'experience',
          'platform',
          'family_relation',
          'legal_case',
          'office'
      )
),
duplicate_groups AS (
    SELECT
        canonical_person_id,
        claim_type,
        claim_value,
        source_name,
        COUNT(*) AS claim_count,
        COUNT(DISTINCT COALESCE(source_url, '')) AS source_url_count
    FROM runtime_claims
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 1
)
SELECT
    'production_runtime_duplicates' AS section,
    claim_type,
    COUNT(*) AS duplicate_groups,
    SUM(claim_count) AS claims_in_duplicate_groups,
    SUM(claim_count - 1) AS surplus_claims,
    SUM(claim_count - 1) FILTER (
        WHERE claim_type IN ('education', 'experience')
          AND source_url_count = 1
    ) AS single_url_semantic_group_surplus
FROM duplicate_groups
GROUP BY claim_type
ORDER BY surplus_claims DESC;

-- These exact-URL partitions are the only proposed automatic phase-2 scope:
-- same canonical person, education/experience, exact value, source and URL.
-- The query assigns a deterministic survivor but does not change any row.
WITH RECURSIVE verified_edges AS (
    SELECT duplicate_person_id, canonical_person_id
    FROM public.person_merge_decisions
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
),
ranked_claims AS (
    SELECT
        claim.id AS claim_id,
        COALESCE(terminal.canonical_person_id, claim.person_id) AS canonical_person_id,
        claim.claim_type,
        claim.claim_value,
        claim.source_name,
        claim.source_url,
        ROW_NUMBER() OVER (
            PARTITION BY
                COALESCE(terminal.canonical_person_id, claim.person_id),
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
                COALESCE(terminal.canonical_person_id, claim.person_id),
                claim.claim_type,
                claim.claim_value,
                claim.source_name,
                claim.source_url
        ) AS group_size
    FROM public.person_claims claim
    LEFT JOIN terminal_people terminal
      ON terminal.start_id = claim.person_id
    WHERE claim.person_id IS NOT NULL
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public
      AND claim.claim_type IN ('education', 'experience')
)
SELECT
    'automatic_phase_2_preview' AS section,
    claim_type,
    source_name,
    COUNT(DISTINCT (canonical_person_id, claim_type, claim_value, source_name, source_url)) AS duplicate_groups,
    COUNT(*) FILTER (WHERE keep_rank > 1) AS claims_to_archive
FROM ranked_claims
WHERE group_size > 1
GROUP BY claim_type, source_name
ORDER BY claims_to_archive DESC, claim_type, source_name;

-- Manual-only exceptions: multiple URLs, family relations, platform, legal cases
-- or office claims. They are intentionally excluded from automatic phase 2.
WITH RECURSIVE verified_edges AS (
    SELECT duplicate_person_id, canonical_person_id
    FROM public.person_merge_decisions
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
),
manual_groups AS (
    SELECT
        COALESCE(terminal.canonical_person_id, claim.person_id) AS canonical_person_id,
        claim.claim_type,
        claim.claim_value,
        claim.source_name,
        COUNT(*) AS claim_count,
        COUNT(DISTINCT COALESCE(claim.source_url, '')) AS source_url_count,
        array_agg(DISTINCT COALESCE(claim.source_url, '(null)')) AS source_urls
    FROM public.person_claims claim
    LEFT JOIN terminal_people terminal
      ON terminal.start_id = claim.person_id
    WHERE claim.person_id IS NOT NULL
      AND claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public
      AND claim.claim_type IN (
          'education',
          'experience',
          'platform',
          'family_relation',
          'legal_case',
          'office'
      )
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 1
)
SELECT
    'manual_only_exceptions' AS section,
    person.name,
    grouped.canonical_person_id,
    grouped.claim_type,
    grouped.claim_value,
    grouped.source_name,
    grouped.claim_count,
    grouped.source_url_count,
    grouped.source_urls
FROM manual_groups grouped
LEFT JOIN public.people person
  ON person.id = grouped.canonical_person_id
WHERE grouped.claim_type NOT IN ('education', 'experience')
   OR grouped.source_url_count > 1
ORDER BY grouped.claim_type, person.name, grouped.claim_value;
