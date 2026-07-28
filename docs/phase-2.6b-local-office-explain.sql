-- Read-only validation for the local-office summary path.
-- Taipei is the largest current published local-office result set.

SELECT
    region.name,
    COUNT(person.person_id) AS row_count,
    COUNT(*) FILTER (WHERE person.list_role = 'councilor') AS councilors,
    COUNT(*) FILTER (WHERE person.list_role = 'agency_head') AS agency_heads
FROM published.regions region
LEFT JOIN published.people_directory person
  ON REPLACE(person.district, '臺', '台') LIKE REPLACE(region.name, '臺', '台') || '%'
 AND person.list_status = 'current'
 AND person.list_role IN ('local_chief', 'local_deputy', 'agency_head', 'councilor')
WHERE region.region_type IN ('municipality', 'county', 'city')
GROUP BY region.region_id, region.name
ORDER BY row_count DESC, region.name;

-- Legacy client requests: the helper issues these two offset pages.
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.public_people_list_cached
WHERE district ILIKE '臺北市%' OR district ILIKE '台北市%'
OFFSET 0 LIMIT 1000;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.public_people_list_cached
WHERE district ILIKE '臺北市%' OR district ILIKE '台北市%'
OFFSET 1000 LIMIT 1000;

-- Bounded published replacement.
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    person_id, name, alias, gender, party, position, current_office_label,
    upcoming_candidate_label, election_year, district, updated_at,
    primary_photo_thumbnail_url, list_role, list_status, list_is_grassroots,
    list_is_party_only, list_status_order, list_role_order
FROM published.people_directory
WHERE list_status = 'current'
  AND list_role IN ('local_chief', 'local_deputy', 'agency_head', 'councilor')
  AND (district ILIKE '臺北市%' OR district ILIKE '台北市%')
ORDER BY list_role_order, name, person_id
LIMIT 201;

-- Role-level parity for the representative region.
WITH public_counts AS (
    SELECT list_role, COUNT(*) AS row_count
    FROM public.public_people_directory
    WHERE list_status = 'current'
      AND list_role IN ('local_chief', 'local_deputy', 'agency_head', 'councilor')
      AND (district ILIKE '臺北市%' OR district ILIKE '台北市%')
    GROUP BY list_role
),
published_counts AS (
    SELECT list_role, COUNT(*) AS row_count
    FROM published.people_directory
    WHERE list_status = 'current'
      AND list_role IN ('local_chief', 'local_deputy', 'agency_head', 'councilor')
      AND (district ILIKE '臺北市%' OR district ILIKE '台北市%')
    GROUP BY list_role
)
SELECT
    COALESCE(public_counts.list_role, published_counts.list_role) AS list_role,
    public_counts.row_count AS public_count,
    published_counts.row_count AS published_count
FROM public_counts
FULL JOIN published_counts USING (list_role)
ORDER BY list_role;
