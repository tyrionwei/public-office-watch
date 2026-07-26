-- Run after published.promote() against a warmed shadow dataset.
-- This script records concise plan metrics without changing persistent data.

CREATE TEMP TABLE published_plan_results (
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

CREATE OR REPLACE FUNCTION pg_temp.capture_published_plan(
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

    INSERT INTO published_plan_results (
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

SELECT pg_temp.capture_published_plan(
    'home_ticker',
    $query$
        SELECT *
        FROM published.home_ticker
        ORDER BY voting_date, election_id
        LIMIT 5
    $query$
);

SELECT pg_temp.capture_published_plan(
    'home_region_summary',
    $query$
        SELECT *
        FROM published.home_region_summary
        ORDER BY region_type, region_name, region_id
    $query$
);

SELECT pg_temp.capture_published_plan(
    'elections_page',
    $query$
        SELECT election.*, summary.race_count, summary.race_types
        FROM published.elections election
        LEFT JOIN published.election_race_summaries summary
          ON summary.election_id = election.election_id
        ORDER BY election.voting_date DESC NULLS LAST, election.election_id
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

    PERFORM pg_temp.capture_published_plan(
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

    PERFORM pg_temp.capture_published_plan(
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

DO $$
DECLARE
    target_race_id UUID;
BEGIN
    SELECT race_id INTO target_race_id
    FROM published.candidates
    GROUP BY race_id
    ORDER BY COUNT(*) DESC, race_id
    LIMIT 1;

    PERFORM pg_temp.capture_published_plan(
        'race_candidates_page',
        FORMAT($query$
            SELECT candidate.*
            FROM published.candidates candidate
            WHERE candidate.race_id = %L::UUID
            ORDER BY candidate.candidate_no, candidate.person_name, candidate.candidate_id
            LIMIT 20
        $query$, target_race_id)
    );
END
$$;

SELECT pg_temp.capture_published_plan(
    'people_directory_page',
    $query$
        SELECT person.*
        FROM published.people person
        ORDER BY
            person.list_is_grassroots,
            person.list_is_party_only,
            person.list_status_order,
            person.list_role_order,
            person.name,
            person.person_id
        LIMIT 20
    $query$
);

DO $$
DECLARE
    target_person_id UUID;
BEGIN
    SELECT person_id INTO target_person_id
    FROM published.people
    ORDER BY candidate_count DESC, person_id
    LIMIT 1;

    PERFORM pg_temp.capture_published_plan(
        'person_candidacies',
        FORMAT($query$
            SELECT candidate.*
            FROM published.candidates candidate
            WHERE candidate.person_id = %L::UUID
            ORDER BY candidate.election_year DESC NULLS LAST, candidate.race_id
            LIMIT 20
        $query$, target_person_id)
    );
END
$$;

DO $$
DECLARE
    target_region_id UUID;
BEGIN
    SELECT primary_region_id INTO target_region_id
    FROM published.local_office_people
    GROUP BY primary_region_id
    ORDER BY COUNT(*) DESC, primary_region_id
    LIMIT 1;

    PERFORM pg_temp.capture_published_plan(
        'local_office_people_page',
        FORMAT($query$
            SELECT person.*
            FROM published.local_office_people person
            WHERE person.primary_region_id = %L::UUID
            ORDER BY person.list_role_order, person.name, person.person_id
            LIMIT 20
        $query$, target_region_id)
    );
END
$$;

SELECT pg_temp.capture_published_plan(
    'search_taipei',
    $query$
        SELECT document.*
        FROM published.search_documents document
        WHERE document.normalized_search_text LIKE '%台北%'
        ORDER BY
            document.normalized_search_text <-> '台北',
            document.entity_type,
            document.title,
            document.document_key
        LIMIT 20
    $query$
);

SELECT *
FROM published_plan_results
ORDER BY execution_ms DESC, query_name;
