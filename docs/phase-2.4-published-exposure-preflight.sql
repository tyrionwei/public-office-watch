-- Read-only preflight. Run before and after any reviewed published-schema exposure change.
WITH frontend_roles(role_name) AS (
    VALUES ('anon'::TEXT), ('authenticated'::TEXT)
),
published_relations AS (
    SELECT
        relation.oid,
        relation.relname,
        relation.relkind
    FROM pg_class relation
    JOIN pg_namespace namespace
        ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'published'
      AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
),
relation_privileges AS (
    SELECT
        role.role_name,
        relation.relname,
        relation.relkind,
        has_table_privilege(role.role_name, relation.oid, 'SELECT') AS can_select
    FROM frontend_roles role
    CROSS JOIN published_relations relation
),
schema_privileges AS (
    SELECT
        role_name,
        has_schema_privilege(role_name, 'published', 'USAGE') AS can_use_schema
    FROM frontend_roles
),
summary AS (
    SELECT
        COUNT(*) FILTER (WHERE can_select) AS frontend_select_grant_count,
        COUNT(*) FILTER (
            WHERE can_select
              AND relname NOT IN (
                  'home_region_summary',
                  'home_ticker',
                  'people_directory',
                  'races',
                  'regions',
                  'search_results'
              )
        ) AS unexpected_frontend_select_grant_count,
        COALESCE(
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'role', role_name,
                    'relation', relname,
                    'relkind', relkind,
                    'canSelect', can_select
                )
                ORDER BY role_name, relname
            ),
            '[]'::JSONB
        ) AS relation_privileges
    FROM relation_privileges
)
SELECT JSONB_BUILD_OBJECT(
    'pgrstDbSchemas', current_setting('pgrst.db_schemas', TRUE),
    'publishedConfiguredInSession', COALESCE(current_setting('pgrst.db_schemas', TRUE), '') ~ '(^|,)published(,|$)',
    'schemaPrivileges', (
        SELECT JSONB_OBJECT_AGG(role_name, can_use_schema ORDER BY role_name)
        FROM schema_privileges
    ),
    'frontendSelectGrantCount', summary.frontend_select_grant_count,
    'unexpectedFrontendSelectGrantCount', summary.unexpected_frontend_select_grant_count,
    'relationPrivileges', summary.relation_privileges,
    'promoteExecute', JSONB_BUILD_OBJECT(
        'anon', has_function_privilege('anon', 'published.promote(uuid)', 'EXECUTE'),
        'authenticated', has_function_privilege('authenticated', 'published.promote(uuid)', 'EXECUTE'),
        'serviceRole', has_function_privilege('service_role', 'published.promote(uuid)', 'EXECUTE')
    )
) AS published_exposure_preflight
FROM summary;
