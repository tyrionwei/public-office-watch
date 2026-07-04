CREATE OR REPLACE VIEW person_canonical_map AS
WITH RECURSIVE verified_merges AS (
    SELECT
        duplicate_person_id,
        canonical_person_id,
        id,
        status,
        confidence_level
    FROM person_merge_decisions
    WHERE status = 'verified'
),
merge_walk AS (
    SELECT
        duplicate_person_id AS person_id,
        canonical_person_id AS current_person_id,
        id AS merge_decision_id,
        status AS merge_status,
        confidence_level AS merge_confidence_level,
        ARRAY[duplicate_person_id, canonical_person_id] AS path,
        1 AS depth
    FROM verified_merges

    UNION ALL

    SELECT
        merge_walk.person_id,
        verified_merges.canonical_person_id AS current_person_id,
        merge_walk.merge_decision_id,
        merge_walk.merge_status,
        merge_walk.merge_confidence_level,
        merge_walk.path || verified_merges.canonical_person_id,
        merge_walk.depth + 1
    FROM merge_walk
    JOIN verified_merges
      ON verified_merges.duplicate_person_id = merge_walk.current_person_id
    WHERE merge_walk.depth < 20
      AND NOT verified_merges.canonical_person_id = ANY(merge_walk.path)
),
terminal_merges AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        current_person_id AS canonical_person_id,
        merge_decision_id,
        merge_status,
        merge_confidence_level
    FROM merge_walk
    ORDER BY person_id, depth DESC
)
SELECT
    p.id AS person_id,
    COALESCE(terminal_merges.canonical_person_id, p.id) AS canonical_person_id,
    terminal_merges.merge_decision_id,
    terminal_merges.merge_status,
    terminal_merges.merge_confidence_level
FROM people p
LEFT JOIN terminal_merges ON terminal_merges.person_id = p.id;
