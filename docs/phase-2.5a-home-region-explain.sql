-- Read-only Phase 2.5A query-plan preflight.
-- Replace :region_slug and :region_id with a representative production region.

EXPLAIN (ANALYZE, BUFFERS)
SELECT election_id, election_name, voting_date
FROM published.home_ticker
ORDER BY voting_date, election_id
LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    region_id,
    region_name,
    region_slug,
    region_type,
    next_election_id,
    next_election_name,
    next_voting_date,
    upcoming_race_count
FROM published.home_region_summary
ORDER BY region_name, region_id
LIMIT 32;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    region_id,
    name,
    slug,
    region_type,
    parent_region_id,
    official_code,
    map_code,
    display_order
FROM published.regions
WHERE region_type IN ('country', 'municipality', 'county', 'city')
ORDER BY display_order, name, region_id
LIMIT 32;

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
WHERE status IN (
    'announced',
    'upcoming',
    'registration_open',
    'candidates_announced',
    'voting'
)
ORDER BY voting_date, title, race_id
LIMIT 24;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    region_id,
    name,
    slug,
    region_type,
    parent_region_id,
    official_code,
    map_code,
    display_order
FROM published.regions
WHERE slug = :'region_slug'
ORDER BY region_id
LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    region_id,
    region_name,
    region_slug,
    region_type,
    next_election_id,
    next_election_name,
    next_voting_date,
    upcoming_race_count
FROM published.home_region_summary
WHERE region_slug = :'region_slug'
ORDER BY region_id
LIMIT 1;

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
WHERE region_slug = :'region_slug'
  AND status IN (
      'announced',
      'upcoming',
      'registration_open',
      'candidates_announced',
      'voting'
  )
ORDER BY voting_date, title, race_id
LIMIT 24;

EXPLAIN (ANALYZE, BUFFERS)
SELECT region_id, name, slug, region_type, parent_region_id, official_code, map_code, display_order
FROM published.regions
WHERE parent_region_id = :'region_id'
ORDER BY display_order, name, region_id
LIMIT 64;
