-- Read-only capacity preview for the production-shaped Supabase database.
-- This file only reports counts, relation sizes, and foreign-key effects.
-- It deliberately performs no INSERT, UPDATE, DELETE, TRUNCATE, or DDL.

BEGIN TRANSACTION READ ONLY;

SELECT
    current_database() AS database_name,
    pg_database_size(current_database()) AS database_bytes,
    pg_size_pretty(pg_database_size(current_database())) AS database_size,
    500::BIGINT * 1024 * 1024 AS free_plan_limit_bytes,
    pg_size_pretty(GREATEST(
        500::BIGINT * 1024 * 1024 - pg_database_size(current_database()),
        0
    )) AS nominal_headroom;

WITH runtime_claims AS MATERIALIZED (
    SELECT id, source_person_id
    FROM public.person_claims
    WHERE is_public = TRUE
      AND visibility = 'public'
      AND review_status = 'verified'
      AND claim_type IN (
          'education',
          'experience',
          'platform',
          'family_relation',
          'legal_case',
          'office'
      )
),
runtime_affiliations AS MATERIALIZED (
    SELECT id, source_person_id
    FROM public.person_party_affiliations
    WHERE is_public = TRUE
      AND review_status = 'verified'
),
provenance_source_people AS MATERIALIZED (
    SELECT source_person_id AS id
    FROM runtime_claims
    WHERE source_person_id IS NOT NULL
    UNION
    SELECT source_person_id AS id
    FROM runtime_affiliations
    WHERE source_person_id IS NOT NULL
    UNION
    SELECT id
    FROM public.source_people
    WHERE source_person_key LIKE 'reviewed-family-relative:%'
),
metrics AS (
    SELECT
        10 AS display_order,
        'source_people'::TEXT AS relation_name,
        COUNT(*)::BIGINT AS total_rows,
        COUNT(*) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM provenance_source_people retained
                WHERE retained.id = source.id
            )
        )::BIGINT AS retain_rows
    FROM public.source_people source

    UNION ALL

    SELECT
        20,
        'person_identity_matches',
        COUNT(*)::BIGINT,
        0::BIGINT
    FROM public.person_identity_matches

    UNION ALL

    SELECT
        30,
        'candidate_status_history',
        COUNT(*)::BIGINT,
        0::BIGINT
    FROM public.candidate_status_history

    UNION ALL

    SELECT
        40,
        'person_claims',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (
            WHERE is_public = TRUE
              AND visibility = 'public'
              AND review_status = 'verified'
              AND claim_type IN (
                  'education',
                  'experience',
                  'platform',
                  'family_relation',
                  'legal_case',
                  'office'
              )
        )::BIGINT
    FROM public.person_claims

    UNION ALL

    SELECT
        50,
        'person_media',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (
            WHERE is_public = TRUE
              AND verification_status = 'verified'
        )::BIGINT
    FROM public.person_media

    UNION ALL

    SELECT
        60,
        'person_company_relations',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (
            WHERE is_public = TRUE
              AND verification_status = 'verified'
        )::BIGINT
    FROM public.person_company_relations

    UNION ALL

    SELECT
        70,
        'person_party_affiliations',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (
            WHERE is_public = TRUE
              AND review_status = 'verified'
        )::BIGINT
    FROM public.person_party_affiliations

    UNION ALL

    SELECT
        80,
        'person_party_events',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (
            WHERE is_public = TRUE
              AND review_status = 'verified'
        )::BIGINT
    FROM public.person_party_events

    UNION ALL

    SELECT
        90,
        'parties',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE is_public = TRUE)::BIGINT
    FROM public.parties

    UNION ALL

    SELECT
        100,
        'companies',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE is_public = TRUE)::BIGINT
    FROM public.companies

    UNION ALL

    SELECT
        105,
        'party_annual_finance_filings',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE is_public = TRUE)::BIGINT
    FROM public.party_annual_finance_filings

    UNION ALL

    SELECT
        110,
        'party_finance_summaries',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE is_public = TRUE)::BIGINT
    FROM public.party_finance_summaries

    UNION ALL

    SELECT
        120,
        'party_company_contribution_summaries',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE is_public = TRUE)::BIGINT
    FROM public.party_company_contribution_summaries

    UNION ALL

    SELECT
        130,
        'region_issues',
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE is_public = TRUE)::BIGINT
    FROM public.region_issues
)
SELECT
    relation_name,
    total_rows,
    retain_rows,
    total_rows - retain_rows AS compaction_candidate_rows,
    CASE relation_name
        WHEN 'source_people'
            THEN 'Retain sources referenced by public runtime claims or affiliations plus reviewed family-relative release sources.'
        WHEN 'person_identity_matches'
            THEN 'Internal identity review data; archive only after migrations A, B, and D have completed.'
        WHEN 'candidate_status_history'
            THEN 'Not used by the current public runtime; archive candidate after backup.'
        WHEN 'person_claims'
            THEN 'Retention predicate exactly matches the production rehearsal whitelist.'
        ELSE 'Retention predicate exactly matches the production rehearsal whitelist.'
    END AS policy_note
FROM metrics
ORDER BY display_order;

WITH runtime_claims AS MATERIALIZED (
    SELECT id, source_person_id
    FROM public.person_claims
    WHERE is_public = TRUE
      AND visibility = 'public'
      AND review_status = 'verified'
      AND claim_type IN (
          'education',
          'experience',
          'platform',
          'family_relation',
          'legal_case',
          'office'
      )
),
runtime_affiliations AS MATERIALIZED (
    SELECT id, source_person_id
    FROM public.person_party_affiliations
    WHERE is_public = TRUE
      AND review_status = 'verified'
),
provenance_source_people AS MATERIALIZED (
    SELECT source_person_id AS id
    FROM runtime_claims
    WHERE source_person_id IS NOT NULL
    UNION
    SELECT source_person_id AS id
    FROM runtime_affiliations
    WHERE source_person_id IS NOT NULL
    UNION
    SELECT id
    FROM public.source_people
    WHERE source_person_key LIKE 'reviewed-family-relative:%'
),
source_compaction_candidates AS MATERIALIZED (
    SELECT source.id
    FROM public.source_people source
    WHERE NOT EXISTS (
        SELECT 1
        FROM provenance_source_people retained
        WHERE retained.id = source.id
    )
)
SELECT
    'person_identity_matches'::TEXT AS referencing_relation,
    'CASCADE'::TEXT AS on_delete,
    COUNT(*)::BIGINT AS affected_rows,
    'Rows removed automatically if their source person is archived.'::TEXT AS effect
FROM public.person_identity_matches identity_match
JOIN source_compaction_candidates candidate
  ON candidate.id = identity_match.source_person_id

UNION ALL

SELECT
    'person_claims',
    'SET NULL',
    COUNT(*)::BIGINT,
    'Non-retained claims lose source_person_id; source_name and source_url remain on the claim.'
FROM public.person_claims claim
JOIN source_compaction_candidates candidate
  ON candidate.id = claim.source_person_id

UNION ALL

SELECT
    'retained_person_claims',
    'MUST REMAIN 0',
    COUNT(*)::BIGINT,
    'Guard: every retained public claim source must be included in provenance_source_people.'
FROM runtime_claims claim
JOIN source_compaction_candidates candidate
  ON candidate.id = claim.source_person_id

UNION ALL

SELECT
    'legal_record_leads',
    'SET NULL',
    COUNT(*)::BIGINT,
    'Internal legal research leads retain the lead but lose the archived source-person link.'
FROM public.legal_record_leads lead
JOIN source_compaction_candidates candidate
  ON candidate.id = lead.matched_source_person_id

UNION ALL

SELECT
    'person_party_affiliations',
    'SET NULL',
    COUNT(*)::BIGINT,
    'Non-retained affiliations lose source_person_id; public retained affiliations are guarded below.'
FROM public.person_party_affiliations affiliation
JOIN source_compaction_candidates candidate
  ON candidate.id = affiliation.source_person_id

UNION ALL

SELECT
    'retained_person_party_affiliations',
    'MUST REMAIN 0',
    COUNT(*)::BIGINT,
    'Guard: every retained public affiliation source must be included in provenance_source_people.'
FROM runtime_affiliations affiliation
JOIN source_compaction_candidates candidate
  ON candidate.id = affiliation.source_person_id
ORDER BY referencing_relation;

WITH runtime_claims AS MATERIALIZED (
    SELECT source_person_id
    FROM public.person_claims
    WHERE is_public = TRUE
      AND visibility = 'public'
      AND review_status = 'verified'
      AND claim_type IN (
          'education',
          'experience',
          'platform',
          'family_relation',
          'legal_case',
          'office'
      )
),
runtime_affiliations AS MATERIALIZED (
    SELECT source_person_id
    FROM public.person_party_affiliations
    WHERE is_public = TRUE
      AND review_status = 'verified'
),
provenance_source_people AS MATERIALIZED (
    SELECT source_person_id AS id
    FROM runtime_claims
    WHERE source_person_id IS NOT NULL
    UNION
    SELECT source_person_id AS id
    FROM runtime_affiliations
    WHERE source_person_id IS NOT NULL
    UNION
    SELECT id
    FROM public.source_people
    WHERE source_person_key LIKE 'reviewed-family-relative:%'
),
source_compaction_candidates AS MATERIALIZED (
    SELECT source.*
    FROM public.source_people source
    WHERE NOT EXISTS (
        SELECT 1
        FROM provenance_source_people retained
        WHERE retained.id = source.id
    )
)
SELECT
    COUNT(*)::BIGINT AS source_compaction_candidate_rows,
    COALESCE(SUM(pg_column_size(source_payload)), 0)::BIGINT AS source_payload_candidate_bytes,
    pg_size_pretty(COALESCE(SUM(pg_column_size(source_payload)), 0)::BIGINT)
        AS source_payload_candidate_size
FROM source_compaction_candidates;

SELECT
    schemaname,
    relname,
    pg_total_relation_size(relid) AS total_bytes,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_catalog.pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
      'source_people',
      'person_identity_matches',
      'candidate_status_history',
      'person_claims',
      'person_media',
      'person_company_relations',
      'person_party_affiliations',
      'person_party_events'
  )
ORDER BY total_bytes DESC;

COMMIT;
