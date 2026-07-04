CREATE OR REPLACE VIEW person_canonical_map AS
WITH RECURSIVE canonical_walk AS (
    SELECT
        p.id AS person_id,
        p.id AS current_person_id,
        ARRAY[p.id] AS path,
        0 AS depth
    FROM people p

    UNION ALL

    SELECT
        canonical_walk.person_id,
        decision.canonical_person_id AS current_person_id,
        canonical_walk.path || decision.canonical_person_id,
        canonical_walk.depth + 1
    FROM canonical_walk
    JOIN person_merge_decisions decision
      ON decision.duplicate_person_id = canonical_walk.current_person_id
     AND decision.status = 'verified'
    WHERE canonical_walk.depth < 20
      AND NOT decision.canonical_person_id = ANY(canonical_walk.path)
),
terminal_people AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        current_person_id AS canonical_person_id
    FROM canonical_walk
    ORDER BY person_id, depth DESC
),
direct_merges AS (
    SELECT
        duplicate_person_id,
        id,
        status,
        confidence_level
    FROM person_merge_decisions
    WHERE status = 'verified'
)
SELECT
    p.id AS person_id,
    terminal_people.canonical_person_id,
    direct_merges.id AS merge_decision_id,
    direct_merges.status AS merge_status,
    direct_merges.confidence_level AS merge_confidence_level
FROM people p
JOIN terminal_people ON terminal_people.person_id = p.id
LEFT JOIN direct_merges ON direct_merges.duplicate_person_id = p.id;
