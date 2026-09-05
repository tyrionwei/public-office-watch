BEGIN;


CREATE OR REPLACE FUNCTION published.region_page_for(p_region_slug TEXT)
RETURNS TABLE(payload JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH release AS MATERIALIZED (
    SELECT state.release_id, state.published_at
    FROM published.release_state state
    WHERE state.state_key = 'current'
    LIMIT 1
),
selected_region AS MATERIALIZED (
    SELECT
        region.region_id,
        region.name,
        region.slug,
        region.region_type,
        region.parent_region_id,
        region.official_code,
        region.map_code,
        region.display_order
    FROM published.regions region
    WHERE region.slug = pg_catalog.btrim(p_region_slug)
    ORDER BY region.region_id
    LIMIT 1
),
summary_rows AS MATERIALIZED (
    SELECT
        summary.region_id,
        summary.region_name,
        summary.region_slug,
        summary.region_type,
        summary.next_election_id,
        summary.next_election_name,
        summary.next_voting_date,
        summary.upcoming_race_count
    FROM published.home_region_summary summary
    JOIN selected_region region ON region.region_id = summary.region_id
    ORDER BY summary.region_id
    LIMIT 1
),
child_region_rows AS MATERIALIZED (
    SELECT
        child.region_id,
        child.name,
        child.slug,
        child.region_type,
        child.parent_region_id,
        child.official_code,
        child.map_code,
        child.display_order
    FROM published.regions child
    JOIN selected_region region ON child.parent_region_id = region.region_id
    ORDER BY child.display_order, child.name, child.region_id
    LIMIT 65
),
race_rows AS MATERIALIZED (
    SELECT
        race.race_id,
        race.election_id,
        race.election_name,
        race.region_id,
        race.region_name,
        race.region_slug,
        race.race_type,
        race.title,
        race.voting_date,
        race.status
    FROM published.races race
    JOIN selected_region region ON race.region_slug = region.slug
    WHERE race.status IN (
        'announced',
        'upcoming',
        'registration_open',
        'candidates_announced',
        'voting'
    )
    ORDER BY
        CASE race.race_type
            WHEN 'municipality_mayor' THEN 10
            WHEN 'county_mayor' THEN 10
            WHEN 'local_chief' THEN 10
            WHEN 'city_councilor' THEN 20
            WHEN 'county_councilor' THEN 20
            WHEN 'councilor_district' THEN 20
            ELSE 30
        END,
        race.voting_date,
        race.title,
        race.race_id
    LIMIT 25
)
SELECT pg_catalog.jsonb_build_object(
    'api_version', 1,
    'release_id', (SELECT release.release_id FROM release),
    'published_at', (SELECT release.published_at FROM release),
    'region_row', (SELECT pg_catalog.to_jsonb(region) FROM selected_region region),
    'summary_row', (SELECT pg_catalog.to_jsonb(summary) FROM summary_rows summary),
    'child_region_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(child) ORDER BY child.display_order, child.name, child.region_id)
        FROM child_region_rows child
    ), '[]'::JSONB),
    'race_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(race) ORDER BY race.voting_date, race.title, race.race_id)
        FROM race_rows race
    ), '[]'::JSONB)
) AS payload;
$$;

REVOKE ALL ON FUNCTION published.region_page_for(TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.region_page_for(TEXT)
TO anon, authenticated, service_role, admin_role;

COMMENT ON FUNCTION published.region_page_for(TEXT) IS
    'Returns one bounded region-detail payload with county and council races prioritized.';

NOTIFY pgrst, 'reload schema';

COMMIT;
