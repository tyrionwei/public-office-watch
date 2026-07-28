-- Run after migration 202607280001. This script creates only session-local
-- objects and records concise plans for the measured production hot paths.

CREATE TEMP TABLE published_hot_path_plan_results (
    query_name TEXT PRIMARY KEY,
    execution_ms NUMERIC NOT NULL,
    planning_ms NUMERIC NOT NULL,
    result_rows BIGINT NOT NULL,
    max_node_rows BIGINT NOT NULL,
    shared_hit_blocks BIGINT NOT NULL,
    shared_read_blocks BIGINT NOT NULL,
    temp_read_blocks BIGINT NOT NULL,
    temp_written_blocks BIGINT NOT NULL,
    root_node TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.capture_published_hot_path_plan(
    p_query_name TEXT,
    p_query TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    explain_result JSONB;
    root_plan JSONB;
    maximum_node_rows BIGINT;
BEGIN
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || p_query
        INTO explain_result;
    root_plan := explain_result -> 0 -> 'Plan';

    WITH RECURSIVE plan_nodes AS (
        SELECT root_plan AS node
        UNION ALL
        SELECT child.node
        FROM plan_nodes parent
        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(
            COALESCE(parent.node -> 'Plans', '[]'::JSONB)
        ) AS child(node)
    )
    SELECT COALESCE(MAX(
        COALESCE((node ->> 'Actual Rows')::NUMERIC, 0)
        * COALESCE((node ->> 'Actual Loops')::NUMERIC, 0)
    ), 0)::BIGINT
    INTO maximum_node_rows
    FROM plan_nodes;

    INSERT INTO published_hot_path_plan_results (
        query_name,
        execution_ms,
        planning_ms,
        result_rows,
        max_node_rows,
        shared_hit_blocks,
        shared_read_blocks,
        temp_read_blocks,
        temp_written_blocks,
        root_node
    ) VALUES (
        p_query_name,
        (explain_result -> 0 ->> 'Execution Time')::NUMERIC,
        (explain_result -> 0 ->> 'Planning Time')::NUMERIC,
        COALESCE((root_plan ->> 'Actual Rows')::BIGINT, 0),
        maximum_node_rows,
        COALESCE((root_plan ->> 'Shared Hit Blocks')::BIGINT, 0),
        COALESCE((root_plan ->> 'Shared Read Blocks')::BIGINT, 0),
        COALESCE((root_plan ->> 'Temp Read Blocks')::BIGINT, 0),
        COALESCE((root_plan ->> 'Temp Written Blocks')::BIGINT, 0),
        root_plan ->> 'Node Type'
    );
END;
$$;

SELECT pg_temp.capture_published_hot_path_plan(
    'people_directory_default',
    $query$
        SELECT person.*
        FROM published.people_directory person
        WHERE person.list_is_grassroots = FALSE
          AND person.list_is_party_only = FALSE
        ORDER BY
            person.list_status_order,
            person.list_role_order,
            person.name,
            person.person_id
        LIMIT 20
    $query$
);

SELECT pg_temp.capture_published_hot_path_plan(
    'people_directory_name_search',
    $query$
        SELECT person.*
        FROM published.people_directory person
        WHERE person.name ILIKE '%國昌%'
        ORDER BY
            person.list_status_order,
            person.list_role_order,
            person.name,
            person.person_id
        LIMIT 20
    $query$
);

DO $$
DECLARE
    target_event_key TEXT;
BEGIN
    SELECT event_key INTO target_event_key
    FROM published.event_summaries
    ORDER BY race_count DESC, event_key
    LIMIT 1;

    PERFORM pg_temp.capture_published_hot_path_plan(
        'event_races_page',
        FORMAT($query$
            SELECT race.*
            FROM published.races race
            WHERE race.event_key = %L
            ORDER BY
                race.sort_category_order,
                race.sort_region_order,
                race.sort_district_order ASC NULLS FIRST,
                race.region_name,
                race.title,
                race.race_id
            LIMIT 20
        $query$, target_event_key)
    );
END
$$;

DO $$
DECLARE
    target_election_id UUID;
BEGIN
    SELECT election_id INTO target_election_id
    FROM published.election_race_summaries
    ORDER BY race_count DESC, election_id
    LIMIT 1;

    PERFORM pg_temp.capture_published_hot_path_plan(
        'election_races_page',
        FORMAT($query$
            SELECT race.*
            FROM published.races race
            WHERE race.election_id = %L::UUID
            ORDER BY
                race.sort_category_order,
                race.sort_region_order,
                race.sort_district_order ASC NULLS FIRST,
                race.region_name,
                race.title,
                race.race_id
            LIMIT 20
        $query$, target_election_id)
    );
END
$$;

SELECT pg_temp.capture_published_hot_path_plan(
    'search_taipei',
    $query$
        SELECT result.*
        FROM published.search_results result
        WHERE result.normalized_search_text LIKE '%台北%'
        ORDER BY
            result.normalized_search_text <-> '台北',
            result.entity_type,
            result.title,
            result.document_key
        LIMIT 20
    $query$
);

SELECT *
FROM published_hot_path_plan_results
ORDER BY execution_ms DESC, query_name;
