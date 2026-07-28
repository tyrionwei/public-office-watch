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
    href TEXT
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, published
AS $$
    WITH normalized_query AS (
        SELECT LOWER(
            REGEXP_REPLACE(
                REPLACE(BTRIM(COALESCE(p_query, '')), '臺', '台'),
                '[[:space:]]+',
                '',
                'g'
            )
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
            SELECT LOWER(
                REGEXP_REPLACE(
                    REPLACE(result.title, '臺', '台'),
                    '[[:space:]]+',
                    '',
                    'g'
                )
            ) AS value
        ) normalized_title
        WHERE LENGTH(query.value) >= 2
          AND result.normalized_search_text LIKE '%' || query.value || '%'
    )
    SELECT
        ranked.document_key,
        ranked.entity_type,
        ranked.entity_id,
        ranked.title,
        ranked.normalized_search_text,
        ranked.href
    FROM ranked
    ORDER BY ranked.title_rank, ranked.entity_rank, ranked.title, ranked.document_key
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 12);
$$;

REVOKE ALL ON FUNCTION published.search_public_records(TEXT, INTEGER)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.search_public_records(TEXT, INTEGER)
TO anon, authenticated;

COMMENT ON FUNCTION published.search_public_records(TEXT, INTEGER) IS
    'Returns at most 12 normalized published search matches, prioritizing visible title matches and stable entity order.';

NOTIFY pgrst, 'reload schema';

COMMIT;

