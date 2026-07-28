-- Read-only verification for the production published-provider cutover.
WITH expected_relations(name) AS (
    VALUES
        ('candidates'),
        ('election_race_facets'),
        ('election_race_summaries'),
        ('elections'),
        ('home_region_summary'),
        ('home_ticker'),
        ('parties'),
        ('party_company_contribution_summaries'),
        ('party_finance_summaries'),
        ('party_officers'),
        ('people'),
        ('people_directory'),
        ('person_party_affiliations'),
        ('races'),
        ('regions'),
        ('search_results')
),
published_relations AS (
    SELECT relation.relname
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'published'
      AND relation.relkind IN ('r', 'v', 'm', 'p', 'f')
)
SELECT jsonb_build_object(
    'databaseBytes', pg_database_size(current_database()),
    'migration002Present', EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '202607280002'
    ),
    'migration003Present', EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '202607280003'
    ),
    'migration004Present', EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '202607280004'
    ),
    'peopleRows', (SELECT count(*) FROM published.people_directory),
    'searchRows', (SELECT count(*) FROM published.search_results),
    'pgrstDbSchemas', current_setting('pgrst.db_schemas', true),
    'anonSchemaUsage', has_schema_privilege('anon', 'published', 'USAGE'),
    'missingAnonSelects', (
        SELECT count(*)
        FROM expected_relations expected
        WHERE NOT has_table_privilege(
            'anon',
            format('published.%I', expected.name),
            'SELECT'
        )
    ),
    'unexpectedAnonSelects', (
        SELECT count(*)
        FROM published_relations relation
        WHERE has_table_privilege(
            'anon',
            format('published.%I', relation.relname),
            'SELECT'
        )
          AND relation.relname NOT IN (SELECT name FROM expected_relations)
    ),
    'anonElectionRacePage', CASE
        WHEN to_regprocedure(
            'published.election_race_page(text,uuid[],text[],text,integer,integer)'
        ) IS NULL THEN false
        ELSE has_function_privilege(
            'anon',
            to_regprocedure(
                'published.election_race_page(text,uuid[],text[],text,integer,integer)'
            ),
            'EXECUTE'
        )
    END,
    'anonPersonClaims', CASE
        WHEN to_regprocedure('published.person_claims_for(uuid[])') IS NULL THEN false
        ELSE has_function_privilege(
            'anon',
            to_regprocedure('published.person_claims_for(uuid[])'),
            'EXECUTE'
        )
    END,
    'anonPromote', has_function_privilege(
        'anon', 'published.promote(uuid)', 'EXECUTE'
    )
) AS published_cutover_verification;
