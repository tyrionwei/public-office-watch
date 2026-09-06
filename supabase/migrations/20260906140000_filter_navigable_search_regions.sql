BEGIN;

CREATE OR REPLACE FUNCTION published.search_public_records(
    p_query TEXT,
    p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
    document_key TEXT,
    entity_type TEXT,
    entity_id UUID,
    title TEXT,
    normalized_search_text TEXT,
    party_name TEXT,
    href TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH normalized_query AS (
        SELECT pg_catalog.replace(
            pg_catalog.replace(
                pg_catalog.lower(
                    pg_catalog.regexp_replace(
                        pg_catalog.replace(pg_catalog.btrim(COALESCE(p_query, '')), '臺', '台'),
                        '[[:space:]]+',
                        '',
                        'g'
                    )
                ),
                '市市長',
                '市長'
            ),
            '縣縣長',
            '縣長'
        ) AS value
    ), ranked AS (
        SELECT
            result.document_key,
            result.entity_type,
            result.entity_id,
            result.title,
            result.normalized_search_text,
            CASE
                WHEN result.entity_type = 'region'
                    THEN '/regions/' || region_row.slug
                ELSE result.href
            END AS href,
            normalized_title.value AS normalized_title,
            CASE
                WHEN normalized_title.value = query.value THEN 0
                WHEN normalized_title.value LIKE query.value || '%' THEN 1
                WHEN normalized_title.value LIKE '%' || query.value || '%' THEN 2
                ELSE 3
            END AS title_rank,
            CASE result.entity_type
                WHEN 'party' THEN 0
                WHEN 'election' THEN 1
                WHEN 'region' THEN 2
                WHEN 'person' THEN 3
                WHEN 'company' THEN 4
                ELSE 5
            END AS entity_rank,
            CASE region_row.region_type
                WHEN 'country' THEN 0
                WHEN 'municipality' THEN 1
                WHEN 'county' THEN 1
                WHEN 'city' THEN 1
                WHEN 'district' THEN 2
                WHEN 'village' THEN 3
                ELSE 4
            END AS region_rank,
            CASE
                WHEN region_row.slug LIKE 'historical-%' THEN 1
                ELSE 0
            END AS historical_region_rank
        FROM published.search_results result
        CROSS JOIN normalized_query query
        LEFT JOIN published.regions region_row
          ON result.entity_type = 'region'
         AND region_row.region_id = result.entity_id
        CROSS JOIN LATERAL (
            SELECT pg_catalog.replace(
                pg_catalog.replace(
                    pg_catalog.lower(
                        pg_catalog.regexp_replace(
                            pg_catalog.replace(result.title, '臺', '台'),
                            '[[:space:]]+',
                            '',
                            'g'
                        )
                    ),
                    '市市長',
                    '市長'
                ),
                '縣縣長',
                '縣長'
            ) AS value
        ) normalized_title
        CROSS JOIN LATERAL (
            SELECT pg_catalog.replace(
                pg_catalog.replace(result.normalized_search_text, '市市長', '市長'),
                '縣縣長',
                '縣長'
            ) AS value
        ) normalized_result
        WHERE pg_catalog.length(query.value) >= 2
          AND normalized_result.value LIKE '%' || query.value || '%'
          AND (
              result.entity_type <> 'region'
              OR (
                  region_row.slug IS NOT NULL
                  AND region_row.region_type IN (
                      'country',
                      'municipality',
                      'county',
                      'city',
                      'district',
                      'village'
                  )
              )
          )
    ), marked_regions AS (
        SELECT
            ranked.*,
            pg_catalog.max(
                CASE
                    WHEN ranked.entity_type = 'region'
                     AND ranked.historical_region_rank = 0
                        THEN 1
                    ELSE 0
                END
            ) OVER (PARTITION BY ranked.normalized_title) AS has_current_region_name
        FROM ranked
    ), positioned AS (
        SELECT
            marked.*,
            pg_catalog.row_number() OVER (
                PARTITION BY marked.entity_type
                ORDER BY
                    marked.title_rank,
                    marked.region_rank,
                    marked.title,
                    marked.document_key
            ) AS entity_position
        FROM marked_regions marked
        WHERE marked.entity_type <> 'region'
           OR marked.historical_region_rank = 0
           OR marked.has_current_region_name = 0
    ), eligible AS (
        SELECT
            positioned.*,
            CASE positioned.entity_type
                WHEN 'party' THEN 2
                WHEN 'election' THEN 3
                WHEN 'region' THEN 4
                WHEN 'person' THEN 4
                WHEN 'company' THEN 2
                ELSE 1
            END AS preferred_type_limit
        FROM positioned
        WHERE positioned.entity_type <> 'region'
           OR positioned.entity_position <= 4
    ), limited AS (
        SELECT *
        FROM eligible
        ORDER BY
            CASE
                WHEN eligible.entity_position <= eligible.preferred_type_limit THEN 0
                ELSE 1
            END,
            eligible.title_rank,
            eligible.entity_rank,
            eligible.region_rank,
            eligible.title,
            eligible.document_key
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 12)
    )
    SELECT
        limited.document_key,
        limited.entity_type,
        limited.entity_id,
        limited.title,
        limited.normalized_search_text,
        person_row.party AS party_name,
        limited.href
    FROM limited
    LEFT JOIN published.people_directory person_row
      ON limited.entity_type = 'person'
     AND person_row.person_id = limited.entity_id
    ORDER BY
        CASE
            WHEN limited.entity_position <= limited.preferred_type_limit THEN 0
            ELSE 1
        END,
        limited.title_rank,
        limited.entity_rank,
        limited.region_rank,
        limited.title,
        limited.document_key;
$$;

COMMENT ON FUNCTION published.search_public_records(TEXT, INTEGER) IS
    'Returns balanced public search matches and only links regions that have navigable canonical region pages.';

NOTIFY pgrst, 'reload schema';

COMMIT;
