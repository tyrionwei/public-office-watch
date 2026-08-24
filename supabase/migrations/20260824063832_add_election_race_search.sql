BEGIN;

CREATE OR REPLACE FUNCTION published.election_race_page(
    p_event_key TEXT,
    p_election_ids UUID[],
    p_race_types TEXT[] DEFAULT NULL,
    p_region_key TEXT DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE (
    items JSONB,
    total BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, published
AS $$
DECLARE
    v_election_count INTEGER;
    v_race_type_count INTEGER;
    v_query TEXT := LOWER(
        REGEXP_REPLACE(
            REPLACE(BTRIM(COALESCE(p_query, '')), '臺', '台'),
            '[[:space:]]+',
            '',
            'g'
        )
    );
BEGIN
    SELECT COUNT(DISTINCT input.election_id)
    INTO v_election_count
    FROM UNNEST(COALESCE(p_election_ids, ARRAY[]::UUID[])) AS input(election_id)
    WHERE input.election_id IS NOT NULL;

    IF v_election_count > 500 THEN
        RAISE EXCEPTION 'election_race_page accepts at most 500 election ids';
    END IF;
    IF NULLIF(BTRIM(p_event_key), '') IS NULL OR CHAR_LENGTH(BTRIM(p_event_key)) > 120 THEN
        RAISE EXCEPTION 'election_race_page requires an event key of at most 120 characters';
    END IF;

    SELECT COUNT(DISTINCT input.race_type)
    INTO v_race_type_count
    FROM UNNEST(COALESCE(p_race_types, ARRAY[]::TEXT[])) AS input(race_type)
    WHERE NULLIF(BTRIM(input.race_type), '') IS NOT NULL;

    IF v_race_type_count > 32 THEN
        RAISE EXCEPTION 'election_race_page accepts at most 32 race types';
    END IF;
    IF p_region_key IS NOT NULL AND CHAR_LENGTH(BTRIM(p_region_key)) > 100 THEN
        RAISE EXCEPTION 'election_race_page region key must be at most 100 characters';
    END IF;
    IF p_query IS NOT NULL AND CHAR_LENGTH(BTRIM(p_query)) > 100 THEN
        RAISE EXCEPTION 'election_race_page query must be at most 100 characters';
    END IF;
    IF p_page IS NULL OR p_page < 1 OR p_page > 10000 THEN
        RAISE EXCEPTION 'election_race_page page must be between 1 and 10000';
    END IF;
    IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 20 THEN
        RAISE EXCEPTION 'election_race_page page size must be between 1 and 20';
    END IF;

    RETURN QUERY
    WITH target_elections AS MATERIALIZED (
        SELECT
            election.id,
            election.name
        FROM (
            SELECT DISTINCT input.election_id
            FROM UNNEST(COALESCE(p_election_ids, ARRAY[]::UUID[])) AS input(election_id)
            WHERE input.election_id IS NOT NULL
        ) requested
        JOIN public.elections election
          ON election.id = requested.election_id
         AND election.is_public
        WHERE NOT EXISTS (
                SELECT 1
                FROM public.election_merge_decisions decision
                WHERE decision.duplicate_election_id = election.id
                  AND decision.status = 'verified'
                  AND decision.relation_type = 'same_election'
            )
          AND (
                COALESCE(EXTRACT(YEAR FROM election.voting_date)::INTEGER::TEXT, election.year::TEXT, 'unknown')
                || '-' || COALESCE(election.voting_date::TEXT, 'undated')
                || '-' || CASE
                    WHEN election.election_type::TEXT IN ('presidential', 'president', 'legislative', 'legislator') THEN 'national'
                    WHEN election.election_type::TEXT IN ('local', 'local_chief', 'councilor', 'township_representative', 'village_chief') THEN 'local'
                    WHEN election.election_type::TEXT = 'referendum' THEN 'referendum'
                    WHEN election.election_type::TEXT = 'recall' THEN 'recall'
                    WHEN election.election_type::TEXT = 'by_election' THEN 'by_election'
                    ELSE 'other'
                END
              ) = BTRIM(p_event_key)
    ),
    filtered_keys AS MATERIALIZED (
        SELECT
            race.id AS race_id,
            race.election_id,
            race.region_id,
            region.name AS region_name,
            race.title,
            CASE race.race_type::TEXT
                WHEN 'president' THEN 10
                WHEN 'vice_president' THEN 10
                WHEN 'municipality_mayor' THEN 20
                WHEN 'county_mayor' THEN 20
                WHEN 'local_chief' THEN 20
                WHEN 'legislator' THEN 30
                WHEN 'legislative_district' THEN 30
                WHEN 'party_list_legislator' THEN 30
                WHEN 'city_councilor' THEN 40
                WHEN 'county_councilor' THEN 40
                WHEN 'councilor_district' THEN 40
                WHEN 'township_mayor' THEN 50
                WHEN 'township_representative' THEN 60
                WHEN 'township_representative_district' THEN 60
                WHEN 'village_chief' THEN 70
                WHEN 'referendum' THEN 80
                WHEN 'recall' THEN 90
                WHEN 'indigenous' THEN 100
                ELSE 999
            END AS sort_category_order,
            CASE normalized.region_key
                WHEN 'national' THEN -1
                WHEN '臺北市' THEN 0
                WHEN '新北市' THEN 1
                WHEN '桃園市' THEN 2
                WHEN '臺中市' THEN 3
                WHEN '臺南市' THEN 4
                WHEN '高雄市' THEN 5
                WHEN '基隆市' THEN 6
                WHEN '新竹市' THEN 7
                WHEN '嘉義市' THEN 8
                WHEN '宜蘭縣' THEN 9
                WHEN '新竹縣' THEN 10
                WHEN '苗栗縣' THEN 11
                WHEN '彰化縣' THEN 12
                WHEN '南投縣' THEN 13
                WHEN '雲林縣' THEN 14
                WHEN '嘉義縣' THEN 15
                WHEN '屏東縣' THEN 16
                WHEN '臺東縣' THEN 17
                WHEN '花蓮縣' THEN 18
                WHEN '澎湖縣' THEN 19
                WHEN '金門縣' THEN 20
                WHEN '連江縣' THEN 21
                WHEN '未指定區域' THEN 23
                ELSE 22
            END AS sort_region_order,
            (
                REGEXP_MATCH(
                    COALESCE(region.name, '') || ' ' || race.title,
                    '(?:第[[:space:]]*)?0*([0-9]+)[[:space:]]*(?:選舉區|選區)'
                )
            )[1]::INTEGER AS sort_district_order
        FROM target_elections election
        JOIN public.races race
          ON race.election_id = election.id
         AND race.is_public
        LEFT JOIN public.regions region
          ON region.id = race.region_id
        CROSS JOIN LATERAL (
            SELECT CASE
                WHEN race.race_type::TEXT IN ('president', 'vice_president', 'party_list_legislator', 'referendum')
                    OR region.name IN ('全國', '臺灣', '台灣') THEN 'national'
                ELSE COALESCE(
                    CASE
                        WHEN region.name LIKE '臺北市%' THEN '臺北市'
                        WHEN region.name LIKE '新北市%' THEN '新北市'
                        WHEN region.name LIKE '桃園市%' THEN '桃園市'
                        WHEN region.name LIKE '臺中市%' THEN '臺中市'
                        WHEN region.name LIKE '臺南市%' THEN '臺南市'
                        WHEN region.name LIKE '高雄市%' THEN '高雄市'
                        WHEN region.name LIKE '基隆市%' THEN '基隆市'
                        WHEN region.name LIKE '新竹市%' THEN '新竹市'
                        WHEN region.name LIKE '嘉義市%' THEN '嘉義市'
                        WHEN region.name LIKE '宜蘭縣%' THEN '宜蘭縣'
                        WHEN region.name LIKE '新竹縣%' THEN '新竹縣'
                        WHEN region.name LIKE '苗栗縣%' THEN '苗栗縣'
                        WHEN region.name LIKE '彰化縣%' THEN '彰化縣'
                        WHEN region.name LIKE '南投縣%' THEN '南投縣'
                        WHEN region.name LIKE '雲林縣%' THEN '雲林縣'
                        WHEN region.name LIKE '嘉義縣%' THEN '嘉義縣'
                        WHEN region.name LIKE '屏東縣%' THEN '屏東縣'
                        WHEN region.name LIKE '臺東縣%' THEN '臺東縣'
                        WHEN region.name LIKE '花蓮縣%' THEN '花蓮縣'
                        WHEN region.name LIKE '澎湖縣%' THEN '澎湖縣'
                        WHEN region.name LIKE '金門縣%' THEN '金門縣'
                        WHEN region.name LIKE '連江縣%' THEN '連江縣'
                    END,
                    region.name,
                    '未指定區域'
                )
            END AS region_key
        ) normalized
        WHERE (race.region_id IS NULL OR region.is_public)
          AND (
                v_race_type_count = 0
                OR race.race_type::TEXT = ANY(p_race_types)
              )
          AND (
                NULLIF(BTRIM(p_region_key), '') IS NULL
                OR normalized.region_key = BTRIM(p_region_key)
              )
          AND (
                v_query = ''
                OR STRPOS(
                    LOWER(
                        REGEXP_REPLACE(
                            REPLACE(
                                COALESCE(region.name, '') || ' ' || race.title,
                                '臺',
                                '台'
                            ),
                            '[[:space:]]+',
                            '',
                            'g'
                        )
                    ),
                    v_query
                ) > 0
              )
          AND NOT EXISTS (
                SELECT 1
                FROM public.race_merge_decisions decision
                WHERE decision.duplicate_race_id = race.id
                  AND decision.status = 'verified'
                  AND decision.relation_type = 'same_race'
            )
    ),
    page_keys AS MATERIALIZED (
        SELECT filtered.*
        FROM filtered_keys filtered
        ORDER BY
            filtered.sort_category_order,
            filtered.sort_region_order,
            filtered.sort_district_order NULLS FIRST,
            filtered.region_name NULLS FIRST,
            filtered.title,
            filtered.race_id
        OFFSET ((p_page - 1) * p_page_size)
        LIMIT p_page_size
    ),
    totals AS (
        SELECT COUNT(*) AS total
        FROM filtered_keys
    )
    SELECT
        COALESCE(
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'race_id', race.id,
                    'election_id', election.id,
                    'election_name', election.name,
                    'region_id', region.id,
                    'region_name', region.name,
                    'region_slug', region.slug,
                    'race_type', race.race_type,
                    'title', race.title,
                    'voting_date', race.voting_date,
                    'status', race.status,
                    'source_name', race.source_name,
                    'source_url', race.source_url
                )
                ORDER BY
                    page.sort_category_order,
                    page.sort_region_order,
                    page.sort_district_order NULLS FIRST,
                    page.region_name NULLS FIRST,
                    page.title,
                    page.race_id
            ) FILTER (WHERE race.id IS NOT NULL),
            '[]'::JSONB
        ),
        totals.total
    FROM totals
    LEFT JOIN page_keys page ON TRUE
    LEFT JOIN public.races race ON race.id = page.race_id
    LEFT JOIN target_elections election ON election.id = page.election_id
    LEFT JOIN public.regions region ON region.id = page.region_id
    GROUP BY totals.total;
END;
$$;

REVOKE ALL ON FUNCTION published.election_race_page(TEXT, UUID[], TEXT[], TEXT, INTEGER, INTEGER)
FROM PUBLIC, anon, authenticated;
DROP FUNCTION published.election_race_page(TEXT, UUID[], TEXT[], TEXT, INTEGER, INTEGER);

REVOKE ALL ON FUNCTION published.election_race_page(TEXT, UUID[], TEXT[], TEXT, TEXT, INTEGER, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.election_race_page(TEXT, UUID[], TEXT[], TEXT, TEXT, INTEGER, INTEGER)
TO anon, authenticated, service_role;

COMMENT ON FUNCTION published.election_race_page(TEXT, UUID[], TEXT[], TEXT, TEXT, INTEGER, INTEGER) IS
    'Bounded event race page with county and normalized township, village, or district keyword filtering.';

NOTIFY pgrst, 'reload schema';

COMMIT;
