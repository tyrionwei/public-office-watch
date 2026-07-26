BEGIN;

CREATE INDEX races_election_order_idx
    ON published.races (
        election_id,
        sort_category_order,
        sort_region_order,
        sort_district_order ASC NULLS FIRST,
        region_name,
        title,
        race_id
    );

DROP INDEX published.search_documents_normalized_trgm_idx;

CREATE INDEX search_documents_normalized_gist_idx
    ON published.search_documents
    USING GIST (normalized_search_text extensions.gist_trgm_ops);

ANALYZE published.races;
ANALYZE published.search_documents;

COMMENT ON INDEX published.races_election_order_idx IS
    'Supports stable 20-row race pagination for an election without sorting the full election graph.';

COMMENT ON INDEX published.search_documents_normalized_gist_idx IS
    'Supports trigram distance ordering with bounded result work for normalized global search.';

COMMIT;
