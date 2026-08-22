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
SET search_path = pg_catalog, published
AS $$
    WITH normalized_query AS (
        SELECT REPLACE(
            REPLACE(
                LOWER(
                    REGEXP_REPLACE(
                        REPLACE(BTRIM(COALESCE(p_query, '')), '臺', '台'),
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
            result.href,
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
            END AS entity_rank
        FROM published.search_results result
        CROSS JOIN normalized_query query
        CROSS JOIN LATERAL (
            SELECT REPLACE(
                REPLACE(
                    LOWER(
                        REGEXP_REPLACE(
                            REPLACE(result.title, '臺', '台'),
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
            SELECT REPLACE(
                REPLACE(result.normalized_search_text, '市市長', '市長'),
                '縣縣長',
                '縣長'
            ) AS value
        ) normalized_result
        WHERE LENGTH(query.value) >= 2
          AND normalized_result.value LIKE '%' || query.value || '%'
    ), limited AS (
        SELECT *
        FROM ranked
        ORDER BY title_rank, entity_rank, title, document_key
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
    ORDER BY limited.title_rank, limited.entity_rank, limited.title, limited.document_key;
$$;

REVOKE ALL ON FUNCTION published.search_public_records(TEXT, INTEGER)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.search_public_records(TEXT, INTEGER)
TO anon, authenticated;

COMMENT ON FUNCTION published.search_public_records(TEXT, INTEGER) IS
    'Returns at most 12 ranked published search matches, including natural county and city mayor title aliases.';

NOTIFY pgrst, 'reload schema';

COMMIT;
