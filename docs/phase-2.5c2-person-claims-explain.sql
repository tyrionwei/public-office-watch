-- Read-only Phase 2.5C2 canonical person-claims validation.
-- The representative UUID has the local maximum of 79 published claims.

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    claim_id,
    person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_score,
    source_name,
    source_url,
    observed_at,
    updated_at
FROM published.person_claims
WHERE person_id = '19d1a17e-aa25-4de6-89b9-b4f2204c0a1f'
ORDER BY person_id, observed_at DESC NULLS LAST, claim_id
LIMIT 401;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM published.person_claims_for(
    ARRAY['19d1a17e-aa25-4de6-89b9-b4f2204c0a1f'::UUID]
);

-- Exhaustive semantic comparison of the targeted reverse walk with the
-- existing published view. This intentionally expands all roots once for
-- validation; the RPC itself accepts at most four roots.
WITH RECURSIVE roots AS (
    SELECT person_id
    FROM published.people
),
member_ids(canonical_person_id, source_person_id, path, depth) AS (
    SELECT person_id, person_id, ARRAY[person_id], 0
    FROM roots

    UNION ALL

    SELECT
        member.canonical_person_id,
        decision.duplicate_person_id,
        member.path || decision.duplicate_person_id,
        member.depth + 1
    FROM member_ids member
    JOIN public.person_merge_decisions decision
      ON decision.canonical_person_id = member.source_person_id
     AND decision.status = 'verified'
    WHERE member.depth < 20
      AND NOT decision.duplicate_person_id = ANY(member.path)
),
targeted AS (
    SELECT claim.id AS claim_id, member.canonical_person_id AS person_id
    FROM member_ids member
    JOIN public.people canonical
      ON canonical.id = member.canonical_person_id
     AND canonical.is_public
    JOIN public.person_claims claim
      ON claim.person_id = member.source_person_id
    WHERE claim.review_status = 'verified'
      AND claim.visibility = 'public'
      AND claim.is_public
),
existing AS (
    SELECT claim_id, person_id
    FROM published.person_claims
)
SELECT
    (SELECT COUNT(*) FROM existing) AS existing_count,
    (SELECT COUNT(*) FROM targeted) AS targeted_count,
    (
        SELECT COUNT(*)
        FROM (SELECT * FROM existing EXCEPT SELECT * FROM targeted) missing
    ) AS missing_count,
    (
        SELECT COUNT(*)
        FROM (SELECT * FROM targeted EXCEPT SELECT * FROM existing) extra
    ) AS extra_count;

-- Highest-cardinality four-person endpoint comparison.
WITH ids AS (
    SELECT ARRAY_AGG(person_id ORDER BY claim_count DESC, person_id) AS person_ids
    FROM (
        SELECT person_id, COUNT(*) AS claim_count
        FROM published.person_claims
        GROUP BY person_id
        ORDER BY claim_count DESC, person_id
        LIMIT 4
    ) ranked
),
expected AS (
    SELECT claim_id, person_id
    FROM published.person_claims
    WHERE person_id = ANY((SELECT person_ids FROM ids)::UUID[])
),
actual AS (
    SELECT result.claim_id, result.person_id
    FROM ids
    CROSS JOIN LATERAL published.person_claims_for(ids.person_ids) result
)
SELECT
    (SELECT COUNT(*) FROM expected) AS expected_count,
    (SELECT COUNT(*) FROM actual) AS actual_count,
    (
        SELECT COUNT(*)
        FROM (SELECT * FROM expected EXCEPT SELECT * FROM actual) missing
    ) AS missing_count,
    (
        SELECT COUNT(*)
        FROM (SELECT * FROM actual EXCEPT SELECT * FROM expected) extra
    ) AS extra_count;

SELECT
    has_function_privilege(
        'anon',
        'published.person_claims_for(uuid[])',
        'EXECUTE'
    ) AS anon_execute,
    has_function_privilege(
        'authenticated',
        'published.person_claims_for(uuid[])',
        'EXECUTE'
    ) AS authenticated_execute,
    has_function_privilege(
        'service_role',
        'published.person_claims_for(uuid[])',
        'EXECUTE'
    ) AS service_execute;

-- Expected to fail with "accepts at most 4 person ids":
-- SELECT COUNT(*)
-- FROM published.person_claims_for(
--     ARRAY(SELECT person_id FROM published.people ORDER BY person_id LIMIT 5)
-- );
