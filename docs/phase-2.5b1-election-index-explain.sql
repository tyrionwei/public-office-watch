-- Read-only Phase 2.5B1 query-plan preflight.
-- event_summaries is used only to supply a representative 200-ID test array;
-- the frontend adapter does not read that relation.

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    election_id,
    name,
    year,
    election_type,
    voting_date,
    status,
    source_name,
    source_url
FROM published.elections
ORDER BY
    year DESC NULLS LAST,
    voting_date DESC NULLS LAST,
    name,
    election_id
LIMIT 500;

EXPLAIN (ANALYZE, BUFFERS)
SELECT election_id, race_count, race_types
FROM published.election_race_summaries
WHERE election_id IN (
    SELECT UNNEST(election_ids[1:200])
    FROM published.event_summaries
    WHERE event_key = '2022-2022-11-26-local'
)
ORDER BY election_id
LIMIT 200;

EXPLAIN (ANALYZE, BUFFERS)
SELECT election_id, race_type, region_key, region_label, race_count
FROM published.election_race_facets
WHERE election_id IN (
    SELECT UNNEST(election_ids[1:200])
    FROM published.event_summaries
    WHERE event_key = '2022-2022-11-26-local'
)
ORDER BY election_id, race_type, region_key
LIMIT 1000;

-- Deferred race-page diagnostic. These two plans are intentionally not an
-- approved adapter contract under the current storage and refresh budget.
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    race_id,
    election_id,
    election_name,
    region_id,
    region_name,
    region_slug,
    race_type,
    title,
    voting_date,
    status
FROM published.races
WHERE event_key = '2018-2018-11-24-local'
  AND race_type IN ('village_chief')
  AND region_key = '新北市'
ORDER BY
    sort_category_order,
    sort_region_order,
    sort_district_order NULLS FIRST,
    region_name NULLS FIRST,
    title,
    race_id
LIMIT 20 OFFSET 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM published.races
WHERE event_key = '2018-2018-11-24-local'
  AND race_type IN ('village_chief')
  AND region_key = '新北市';

-- Compact row-payload estimate only. This excludes heap/index overhead and
-- refresh-time peak duplication.
SELECT
    COUNT(*) AS row_count,
    ROUND(AVG(PG_COLUMN_SIZE(compact_row))) AS average_row_bytes,
    PG_SIZE_PRETTY(SUM(PG_COLUMN_SIZE(compact_row))::BIGINT) AS row_payload_size
FROM (
    SELECT ROW(
        race_id,
        election_id,
        election_name,
        region_id,
        region_name,
        region_slug,
        race_type,
        title,
        voting_date,
        status,
        event_key,
        region_key,
        sort_category_order,
        sort_region_order,
        sort_district_order
    ) AS compact_row
    FROM published.races
) estimate;
