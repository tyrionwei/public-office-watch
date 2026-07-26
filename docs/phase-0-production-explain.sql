-- Public Office Watch / Phase 0 production read plans
--
-- This SQL returns all 23 plans in one final JSON result for export.
--
-- Safety boundary:
--   * every measured workload is SELECT / EXPLAIN ANALYZE
--   * measured queries run as the frontend `anon` role
--   * a connection-local temporary table only collects plan JSON
--   * the measured transaction is read-only and ends with ROLLBACK
--   * the temporary table is then dropped explicitly
--
-- If this file errors, run ROLLBACK; RESET ROLE; before retrying.

SET ROLE anon;

CREATE TEMP TABLE phase0_public_read_plans (
  ordinal integer PRIMARY KEY,
  page text NOT NULL,
  label text NOT NULL,
  plan jsonb NOT NULL
) ON COMMIT PRESERVE ROWS;

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '1s';

-- Derive representative public anchors without reading private core tables.
-- The election with the most public candidate rows is intentional: it exposes
-- the current election-detail worst case instead of measuring a tiny election.
SELECT set_config(
  'pow.election_id',
  (
    SELECT election_id::text
    FROM public_candidates
    WHERE election_id IS NOT NULL
    GROUP BY election_id
    ORDER BY count(*) DESC, election_id
    LIMIT 1
  ),
  true
);

SELECT set_config(
  'pow.person_id',
  (
    SELECT person_id::text
    FROM public_candidates
    WHERE person_id IS NOT NULL
    GROUP BY person_id
    ORDER BY count(*) DESC, person_id
    LIMIT 1
  ),
  true
);

SELECT set_config(
  'pow.event_key',
  (
    SELECT event_key
    FROM public_election_race_list
    WHERE election_id = current_setting('pow.election_id')::uuid
    ORDER BY event_key
    LIMIT 1
  ),
  true
);

SELECT set_config(
  'pow.region_name',
  (
    SELECT name
    FROM public_regions
    WHERE region_type IN ('municipality', 'county', 'city')
    ORDER BY display_order NULLS LAST, name
    LIMIT 1
  ),
  true
);

SELECT set_config('pow.search_query', '台北', true);

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_home_election_ticker;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (1, 'home', 'ticker', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_region_election_summary
WHERE region_type IN ('country', 'municipality', 'county', 'city');
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (2, 'home', 'region summaries', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_regions
WHERE region_type IN ('country', 'municipality', 'county', 'city');
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (3, 'home', 'regions', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_races
WHERE status <> 'completed';
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (4, 'home', 'upcoming races', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_parties;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (5, 'home', 'parties', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_party_finance_summaries;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (6, 'home', 'party finance summaries', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_party_company_contribution_summaries;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (7, 'home', 'party company contribution summaries', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_people_list_cached
WHERE district ILIKE current_setting('pow.region_name') || '%'
   OR district ILIKE replace(current_setting('pow.region_name'), '臺', '台') || '%'
   OR district ILIKE replace(current_setting('pow.region_name'), '台', '臺') || '%';
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (8, 'region', 'local office people', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_elections;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (9, 'election-index', 'elections', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_election_race_summaries;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (10, 'election-index', 'race summaries', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_elections
WHERE election_id = current_setting('pow.election_id')::uuid;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (11, 'election-detail', 'election', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_races
WHERE election_id = current_setting('pow.election_id')::uuid;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (12, 'election-detail', 'races', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_candidates
WHERE election_id = current_setting('pow.election_id')::uuid;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (13, 'election-detail', 'candidates', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT *, count(*) OVER () AS __exact_count
FROM public_people_list_cached
WHERE list_is_grassroots = false
ORDER BY list_status_order, list_role_order, name
LIMIT 200;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (14, 'people-index', 'directory block with exact count', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    WITH people_page AS (
  SELECT person_id
  FROM public_people_list_cached
  WHERE list_is_grassroots = false
  ORDER BY list_status_order, list_role_order, name
  LIMIT 200
)
SELECT * FROM public_candidates
WHERE person_id IN (SELECT person_id FROM people_page);
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (15, 'people-index', 'candidate lookup for directory block', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_people_list_cached
WHERE person_id = current_setting('pow.person_id')::uuid;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (16, 'person-detail', 'person', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_candidates
WHERE person_id = current_setting('pow.person_id')::uuid;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (17, 'person-detail', 'candidacies', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_person_claims
WHERE person_id = current_setting('pow.person_id')::uuid;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (18, 'person-detail', 'claims', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_person_party_affiliations
WHERE person_id = current_setting('pow.person_id')::uuid;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (19, 'person-detail', 'party affiliations', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_people_list_cached
WHERE name ILIKE '%' || current_setting('pow.search_query') || '%'
   OR alias ILIKE '%' || current_setting('pow.search_query') || '%'
   OR party ILIKE '%' || current_setting('pow.search_query') || '%'
   OR position ILIKE '%' || current_setting('pow.search_query') || '%'
   OR district ILIKE '%' || current_setting('pow.search_query') || '%'
LIMIT 12;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (20, 'search', 'people search', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_elections
WHERE name ILIKE '%' || current_setting('pow.search_query') || '%'
LIMIT 12;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (21, 'search', 'election search', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT * FROM public_companies
WHERE name ILIKE '%' || current_setting('pow.search_query') || '%'
   OR unified_business_no ILIKE '%' || current_setting('pow.search_query') || '%'
   OR representative_name ILIKE '%' || current_setting('pow.search_query') || '%'
   OR address_region ILIKE '%' || current_setting('pow.search_query') || '%'
LIMIT 12;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (22, 'search', 'company search', captured::jsonb);
END
$capture$;

DO $capture$
DECLARE captured json;
BEGIN
  EXECUTE $query$
    EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
    SELECT *, count(*) OVER () AS __exact_count
FROM public_election_race_list
WHERE event_key = current_setting('pow.event_key')
ORDER BY
  sort_category_order,
  sort_region_order,
  sort_district_order NULLS FIRST,
  region_name NULLS FIRST,
  title,
  race_id
LIMIT 200;
  $query$ INTO captured;

  INSERT INTO phase0_public_read_plans (ordinal, page, label, plan)
  VALUES (23, 'election-event', 'race page block with exact count', captured::jsonb);
END
$capture$;

SELECT jsonb_build_object(
  'database_role', current_user,
  'anchors', jsonb_build_object(
    'region_name', current_setting('pow.region_name'),
    'election_id', current_setting('pow.election_id'),
    'event_key', current_setting('pow.event_key'),
    'person_id', current_setting('pow.person_id'),
    'search_query', current_setting('pow.search_query')
  ),
  'plans', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'ordinal', ordinal,
        'page', page,
        'label', label,
        'plan', plan
      )
      ORDER BY ordinal
    )
    FROM phase0_public_read_plans
  )
) AS phase_0_public_read_plans;

ROLLBACK;
DROP TABLE IF EXISTS phase0_public_read_plans;
RESET ROLE;
