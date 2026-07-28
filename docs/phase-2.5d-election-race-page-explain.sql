-- Phase 2.5D local validation for the bounded election-event race page.
-- Read-only except for SET ROLE. Run after applying migration 202607280003 locally.

\pset pager off

-- Representative totals and deterministic page order against the existing view.
WITH test_cases(case_name, event_key, race_types, region_key, page_number) AS (
    VALUES
        ('2022 largest type', '2022-2022-11-26-local', ARRAY['village_chief']::TEXT[], NULL::TEXT, 2),
        ('2018 New Taipei', '2018-2018-11-24-local', ARRAY['village_chief']::TEXT[], '新北市'::TEXT, 2),
        ('2022 all types', '2022-2022-11-26-local', NULL::TEXT[], NULL::TEXT, 1)
),
results AS (
    SELECT test.*, result.items, result.total
    FROM test_cases test
    JOIN published.event_summaries summary USING (event_key)
    CROSS JOIN LATERAL published.election_race_page(
        test.event_key,
        summary.election_ids,
        test.race_types,
        test.region_key,
        test.page_number,
        20
    ) result
),
expected AS (
    SELECT
        result.case_name,
        COUNT(*) AS total,
        ARRAY(
            SELECT page.race_id::TEXT
            FROM public.public_election_race_list page
            WHERE page.event_key = result.event_key
              AND (result.race_types IS NULL OR page.race_type::TEXT = ANY(result.race_types))
              AND (result.region_key IS NULL OR page.region_key = result.region_key)
            ORDER BY page.sort_category_order, page.sort_region_order,
                page.sort_district_order NULLS FIRST, page.region_name NULLS FIRST,
                page.title, page.race_id
            OFFSET ((result.page_number - 1) * 20)
            LIMIT 20
        ) AS race_ids
    FROM results result
    JOIN public.public_election_race_list old
      ON old.event_key = result.event_key
     AND (result.race_types IS NULL OR old.race_type::TEXT = ANY(result.race_types))
     AND (result.region_key IS NULL OR old.region_key = result.region_key)
    GROUP BY result.case_name, result.event_key, result.race_types, result.region_key, result.page_number
),
actual AS (
    SELECT
        result.case_name,
        result.total,
        ARRAY(
            SELECT item.value ->> 'race_id'
            FROM JSONB_ARRAY_ELEMENTS(result.items) WITH ORDINALITY item(value, position)
            ORDER BY item.position
        ) AS race_ids
    FROM results result
)
SELECT
    actual.case_name,
    actual.total AS actual_total,
    expected.total AS expected_total,
    actual.total = expected.total AS total_matches,
    actual.race_ids = expected.race_ids AS page_order_matches,
    CARDINALITY(actual.race_ids) AS page_rows
FROM actual
JOIN expected USING (case_name)
ORDER BY actual.case_name;

-- Exhaustive total parity for every existing event/type/region group.
WITH expected AS (
    SELECT event_key, race_type::TEXT AS race_type, region_key, COUNT(*) AS total
    FROM public.public_election_race_list
    GROUP BY event_key, race_type::TEXT, region_key
),
actual AS (
    SELECT expected.*, result.total AS actual_total
    FROM expected
    JOIN published.event_summaries summary USING (event_key)
    CROSS JOIN LATERAL published.election_race_page(
        expected.event_key,
        summary.election_ids,
        ARRAY[expected.race_type],
        expected.region_key,
        1,
        1
    ) result
)
SELECT COUNT(*) AS mismatched_groups
FROM actual
WHERE total <> actual_total;

-- The private phase exposes execution only to the service role.
SELECT rolname, has_function_privilege(
    rolname,
    'published.election_race_page(text,uuid[],text[],text,integer,integer)',
    'EXECUTE'
) AS can_execute
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY rolname;

-- Worst local event/type combination.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT result.total, JSONB_ARRAY_LENGTH(result.items) AS page_rows
FROM published.event_summaries summary
CROSS JOIN LATERAL published.election_race_page(
    summary.event_key,
    summary.election_ids,
    ARRAY['village_chief']::TEXT[],
    NULL,
    2,
    20
) result
WHERE summary.event_key = '2022-2022-11-26-local';

-- Representative large region filter.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT result.total, JSONB_ARRAY_LENGTH(result.items) AS page_rows
FROM published.event_summaries summary
CROSS JOIN LATERAL published.election_race_page(
    summary.event_key,
    summary.election_ids,
    ARRAY['village_chief']::TEXT[],
    '新北市',
    2,
    20
) result
WHERE summary.event_key = '2018-2018-11-24-local';

-- Server-boundary examples; run separately because the expected exception aborts a batch.
-- SELECT * FROM published.election_race_page('event', ARRAY[]::UUID[], NULL, NULL, 1, 21);
-- SELECT * FROM published.election_race_page('event', ARRAY[]::UUID[], NULL, NULL, NULL, 20);
