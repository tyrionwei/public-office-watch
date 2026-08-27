BEGIN;

CREATE OR REPLACE FUNCTION published.seo_catalog_page(
    p_dataset TEXT,
    p_offset INTEGER DEFAULT 0,
    p_page_size INTEGER DEFAULT 1000
)
RETURNS TABLE(items JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_dataset NOT IN (
        'people_directory',
        'parties',
        'regions',
        'elections',
        'races'
    ) THEN
        RAISE EXCEPTION 'Unsupported SEO catalog dataset';
    END IF;
    IF p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN
        RAISE EXCEPTION 'SEO catalog offset must be between 0 and 100000';
    END IF;
    IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 1000 THEN
        RAISE EXCEPTION 'SEO catalog page size must be between 1 and 1000';
    END IF;

    RETURN QUERY
    SELECT CASE p_dataset
        WHEN 'people_directory' THEN (
            SELECT COALESCE(
                jsonb_agg(to_jsonb(page) ORDER BY page.person_id),
                '[]'::JSONB
            )
            FROM (
                SELECT
                    person.person_id,
                    person.name,
                    person.party,
                    person.position,
                    person.current_office_label,
                    person.updated_at
                FROM published.people_directory person
                ORDER BY person.person_id
                LIMIT p_page_size
                OFFSET p_offset
            ) page
        )
        WHEN 'parties' THEN (
            SELECT COALESCE(
                jsonb_agg(to_jsonb(page) ORDER BY page.party_id),
                '[]'::JSONB
            )
            FROM (
                SELECT
                    party.party_id,
                    party.name,
                    party.short_name,
                    party.slug,
                    party.updated_at
                FROM published.parties party
                ORDER BY party.party_id
                LIMIT p_page_size
                OFFSET p_offset
            ) page
        )
        WHEN 'regions' THEN (
            SELECT COALESCE(
                jsonb_agg(to_jsonb(page) ORDER BY page.region_id),
                '[]'::JSONB
            )
            FROM (
                SELECT
                    region.region_id,
                    region.name,
                    region.slug,
                    region.region_type
                FROM published.regions region
                WHERE region.region_type IN (
                    'country',
                    'municipality',
                    'county',
                    'city'
                )
                ORDER BY region.region_id
                LIMIT p_page_size
                OFFSET p_offset
            ) page
        )
        WHEN 'elections' THEN (
            SELECT COALESCE(
                jsonb_agg(to_jsonb(page) ORDER BY page.election_id),
                '[]'::JSONB
            )
            FROM (
                SELECT
                    election.election_id,
                    election.name,
                    election.year,
                    election.election_type,
                    election.voting_date,
                    election.status
                FROM published.elections election
                ORDER BY election.election_id
                LIMIT p_page_size
                OFFSET p_offset
            ) page
        )
        WHEN 'races' THEN (
            SELECT COALESCE(
                jsonb_agg(to_jsonb(page) ORDER BY page.race_id),
                '[]'::JSONB
            )
            FROM (
                SELECT
                    race.race_id,
                    race.title,
                    race.election_name,
                    race.region_name,
                    race.voting_date,
                    race.status
                FROM published.races race
                ORDER BY race.race_id
                LIMIT p_page_size
                OFFSET p_offset
            ) page
        )
    END;
END;
$$;

REVOKE ALL ON FUNCTION published.seo_catalog_page(TEXT, INTEGER, INTEGER)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published.seo_catalog_page(TEXT, INTEGER, INTEGER)
TO anon, authenticated;

COMMIT;
