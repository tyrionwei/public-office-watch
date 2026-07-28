BEGIN;

CREATE MATERIALIZED VIEW published.people_directory AS
SELECT
    person_id,
    name,
    alias,
    gender,
    party,
    position,
    current_office_label,
    upcoming_candidate_label,
    election_year,
    district,
    updated_at,
    primary_photo_thumbnail_url,
    list_role,
    list_status,
    list_is_grassroots,
    list_is_party_only,
    list_status_order,
    list_role_order
FROM published.people
WITH NO DATA;

CREATE UNIQUE INDEX people_directory_person_idx
    ON published.people_directory (person_id);
CREATE INDEX people_directory_order_idx
    ON published.people_directory (
        list_is_grassroots,
        list_is_party_only,
        list_status_order,
        list_role_order,
        name,
        person_id
    );

CREATE MATERIALIZED VIEW published.search_results AS
SELECT
    document_key,
    entity_type,
    entity_id,
    title,
    normalized_search_text,
    href
FROM published.search_documents
WITH NO DATA;

ALTER FUNCTION published.promote(UUID) RENAME TO promote_compact_base;

REVOKE ALL ON FUNCTION published.promote_compact_base(UUID)
    FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION published.promote(p_source_sync_run_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, published, extensions
SET work_mem = '64MB'
AS $$
DECLARE
    v_release_id UUID;
    v_expected_count BIGINT;
    v_actual_count BIGINT;
BEGIN
    v_release_id := published.promote_compact_base(p_source_sync_run_id);

    REFRESH MATERIALIZED VIEW published.people_directory;
    REFRESH MATERIALIZED VIEW published.search_results;

    SELECT COUNT(*) INTO v_expected_count FROM published.people;
    SELECT COUNT(*) INTO v_actual_count FROM published.people_directory;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'People directory parity failed: expected %, got %',
            v_expected_count,
            v_actual_count;
    END IF;

    SELECT COUNT(*) INTO v_expected_count FROM published.search_documents;
    SELECT COUNT(*) INTO v_actual_count FROM published.search_results;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'Search result parity failed: expected %, got %',
            v_expected_count,
            v_actual_count;
    END IF;

    SELECT COUNT(DISTINCT document_key)
    INTO v_actual_count
    FROM published.search_results;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'Search result key uniqueness failed: expected %, got %',
            v_expected_count,
            v_actual_count;
    END IF;

    UPDATE published.release_state
    SET
        schema_version = '202607280001-people-search-surfaces',
        validated_row_counts = validated_row_counts || JSONB_BUILD_OBJECT(
            'peopleDirectory', (SELECT COUNT(*) FROM published.people_directory),
            'searchResults', (SELECT COUNT(*) FROM published.search_results)
        )
    WHERE state_key = 'current';

    RETURN v_release_id;
END;
$$;

REVOKE ALL ON FUNCTION published.promote(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.promote(UUID) TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA published FROM PUBLIC, anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA published TO service_role;

COMMENT ON MATERIALIZED VIEW published.people_directory IS
    'Narrow indexed people-list surface; full person detail remains in published.people.';
COMMENT ON MATERIALIZED VIEW published.search_results IS
    'Compact global search surface; sequential scan is cheaper than a 12 MB trigram index at the current row count.';
COMMENT ON FUNCTION published.promote(UUID) IS
    'Atomically refreshes the compact base release plus storage-bounded people and search surfaces.';

SELECT published.promote(NULL);

COMMIT;
