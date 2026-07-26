BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE MATERIALIZED VIEW published.home_ticker AS
SELECT
    election_id,
    name AS election_name,
    voting_date,
    election_type,
    status,
    source_name,
    source_url,
    published_at
FROM published.elections
WHERE status IN ('announced', 'upcoming', 'active')
  AND voting_date IS NOT NULL
WITH NO DATA;

CREATE MATERIALIZED VIEW published.home_region_summary AS
WITH ranked_races AS (
    SELECT
        region.region_id,
        region.name AS region_name,
        region.slug AS region_slug,
        region.region_type,
        election.election_id,
        election.name AS election_name,
        race.voting_date,
        COUNT(race.race_id) FILTER (
            WHERE race.status IN (
                'announced',
                'upcoming',
                'registration_open',
                'candidates_announced',
                'voting'
            )
        ) OVER (PARTITION BY region.region_id) AS upcoming_race_count,
        ROW_NUMBER() OVER (
            PARTITION BY region.region_id
            ORDER BY race.voting_date ASC NULLS LAST, election.name, race.title
        ) AS row_number,
        region.published_at
    FROM published.regions region
    LEFT JOIN published.races race
        ON race.region_id = region.region_id
       AND race.status IN (
            'announced',
            'upcoming',
            'registration_open',
            'candidates_announced',
            'voting'
       )
    LEFT JOIN published.elections election
        ON election.election_id = race.election_id
    WHERE region.region_type IN ('municipality', 'county', 'city')
)
SELECT
    region_id,
    region_name,
    region_slug,
    region_type,
    election_id AS next_election_id,
    election_name AS next_election_name,
    voting_date AS next_voting_date,
    COALESCE(upcoming_race_count, 0)::INTEGER AS upcoming_race_count,
    published_at
FROM ranked_races
WHERE row_number = 1
WITH NO DATA;

CREATE MATERIALIZED VIEW published.election_race_summaries AS
SELECT
    election_id,
    COUNT(*)::INTEGER AS race_count,
    ARRAY_AGG(DISTINCT race_type ORDER BY race_type) AS race_types,
    MAX(published_at) AS published_at
FROM published.races
GROUP BY election_id
WITH NO DATA;

CREATE MATERIALIZED VIEW published.election_race_facets AS
SELECT
    election_id,
    race_type,
    region_key,
    CASE WHEN region_key = 'national' THEN '全國' ELSE region_key END AS region_label,
    COUNT(*)::INTEGER AS race_count,
    MAX(published_at) AS published_at
FROM published.races
GROUP BY election_id, race_type, region_key
WITH NO DATA;

CREATE MATERIALIZED VIEW published.event_summaries AS
SELECT
    event_key,
    MIN(voting_date) AS voting_date,
    ARRAY_AGG(DISTINCT election_id ORDER BY election_id) AS election_ids,
    ARRAY_AGG(DISTINCT election_name ORDER BY election_name) AS election_names,
    COUNT(*)::INTEGER AS race_count,
    MAX(published_at) AS published_at
FROM published.races
GROUP BY event_key
WITH NO DATA;

CREATE MATERIALIZED VIEW published.local_office_people AS
SELECT *
FROM published.people
WHERE current_office_label IS NOT NULL
  AND primary_region_id IS NOT NULL
WITH NO DATA;

CREATE MATERIALIZED VIEW published.party_officers AS
SELECT
    affiliation.affiliation_id,
    affiliation.person_id,
    person.name AS person_name,
    party.party_id,
    party.name AS party_name,
    affiliation.role_title,
    affiliation.organization_unit,
    affiliation.display_order,
    affiliation.start_date,
    affiliation.observed_date,
    person.current_office_label,
    person.primary_photo_thumbnail_url,
    affiliation.source_name,
    affiliation.source_url,
    affiliation.updated_at,
    affiliation.role_tier,
    affiliation.published_at
FROM published.person_party_affiliations affiliation
JOIN published.people person ON person.person_id = affiliation.person_id
JOIN published.parties party
  ON party.normalized_name = affiliation.normalized_party
WHERE affiliation.role_context = 'party_officer'
  AND affiliation.is_current = TRUE
WITH NO DATA;

CREATE MATERIALIZED VIEW published.region_issue_results AS
SELECT
    issue.*,
    NOW() AS published_at
FROM public.public_region_issue_results issue
WITH NO DATA;

CREATE MATERIALIZED VIEW published.search_documents AS
WITH documents AS (
    SELECT
        'person:' || person_id::TEXT AS document_key,
        'person'::TEXT AS entity_type,
        person_id AS entity_id,
        name AS title,
        CONCAT_WS(' · ', party, current_office_label, upcoming_candidate_label, position) AS subtitle,
        CONCAT_WS(' ', name, alias, party, position, district, current_office_label, upcoming_candidate_label) AS search_text,
        '/people/' || person_id::TEXT AS href,
        published_at
    FROM published.people

    UNION ALL

    SELECT
        'election:' || election_id::TEXT,
        'election',
        election_id,
        name,
        CONCAT_WS(' · ', year::TEXT, election_type, status),
        CONCAT_WS(' ', name, year::TEXT, election_type, status),
        '/elections/' || election_id::TEXT,
        published_at
    FROM published.elections

    UNION ALL

    SELECT
        'company:' || company_id::TEXT,
        'company',
        company_id,
        name,
        CONCAT_WS(' · ', unified_business_no, representative_name, address_region),
        CONCAT_WS(' ', name, unified_business_no, representative_name, address_region),
        NULL::TEXT,
        published_at
    FROM published.companies

    UNION ALL

    SELECT
        'party:' || party_id::TEXT,
        'party',
        party_id,
        name,
        CONCAT_WS(' · ', short_name, status),
        CONCAT_WS(' ', name, short_name, status),
        '/parties/' || slug,
        published_at
    FROM published.parties

    UNION ALL

    SELECT
        'region:' || region_id::TEXT,
        'region',
        region_id,
        name,
        region_type,
        CONCAT_WS(' ', name, slug, official_code, region_type),
        '/regions/' || region_id::TEXT,
        published_at
    FROM published.regions
)
SELECT
    document_key,
    entity_type,
    entity_id,
    title,
    subtitle,
    search_text,
    LOWER(
        REGEXP_REPLACE(
            REPLACE(search_text, '臺', '台'),
            '[[:space:]]+',
            '',
            'g'
        )
    ) AS normalized_search_text,
    href,
    published_at
FROM documents
WITH NO DATA;

CREATE UNIQUE INDEX home_ticker_election_idx
    ON published.home_ticker (election_id);
CREATE UNIQUE INDEX home_region_summary_region_idx
    ON published.home_region_summary (region_id);
CREATE UNIQUE INDEX election_race_summaries_election_idx
    ON published.election_race_summaries (election_id);
CREATE UNIQUE INDEX election_race_facets_key_idx
    ON published.election_race_facets (election_id, race_type, region_key);
CREATE UNIQUE INDEX event_summaries_event_idx
    ON published.event_summaries (event_key);
CREATE UNIQUE INDEX local_office_people_person_idx
    ON published.local_office_people (person_id);
CREATE INDEX local_office_people_region_idx
    ON published.local_office_people (primary_region_id, list_role_order, name, person_id);
CREATE UNIQUE INDEX party_officers_affiliation_idx
    ON published.party_officers (affiliation_id);
CREATE INDEX party_officers_party_order_idx
    ON published.party_officers (party_id, role_tier, display_order, person_name);
CREATE UNIQUE INDEX region_issue_results_issue_idx
    ON published.region_issue_results (issue_id);
CREATE UNIQUE INDEX search_documents_key_idx
    ON published.search_documents (document_key);
CREATE INDEX search_documents_normalized_trgm_idx
    ON published.search_documents
    USING GIN (normalized_search_text extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION published.promote(p_source_sync_run_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, published, extensions
AS $$
DECLARE
    v_release_id UUID := gen_random_uuid();
    v_published_at TIMESTAMPTZ := NOW();
    v_expected_count BIGINT;
    v_actual_count BIGINT;
    v_low_level_race_count BIGINT;
    v_validated_counts JSONB;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('public-office-watch:published-promote', 0));

    IF p_source_sync_run_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM public.data_sync_runs
            WHERE id = p_source_sync_run_id
              AND mode = 'write'
              AND status = 'ok'
       ) THEN
        RAISE EXCEPTION 'Source sync run % is not a successful write run', p_source_sync_run_id;
    END IF;

    TRUNCATE TABLE
        published.party_company_contribution_summaries,
        published.party_finance_summaries,
        published.relation_details,
        published.person_identity_sources,
        published.person_party_events,
        published.person_party_affiliations,
        published.person_claims,
        published.candidates,
        published.races,
        published.people,
        published.parties,
        published.companies,
        published.elections,
        published.regions,
        published.release_state;

    INSERT INTO published.regions
    SELECT source.*, v_published_at, core.updated_at
    FROM public.public_regions source
    JOIN public.regions core ON core.id = source.region_id;

    INSERT INTO published.elections
    SELECT source.*, v_published_at, core.updated_at
    FROM public.public_elections source
    JOIN public.elections core ON core.id = source.election_id;

    INSERT INTO published.people
    SELECT
        source.*,
        0::BIGINT,
        NULL::JSONB,
        NULL::UUID,
        NULL::TEXT,
        NULL::TEXT,
        v_published_at,
        source.updated_at
    FROM public.public_people_directory source;

    INSERT INTO published.companies
    SELECT source.*, v_published_at, source.updated_at
    FROM public.public_companies source;

    INSERT INTO published.parties
    SELECT
        source.*,
        LOWER(REGEXP_REPLACE(REPLACE(source.name, '臺', '台'), '[[:space:]]+', '', 'g')),
        v_published_at,
        source.updated_at
    FROM public.public_parties source;

    INSERT INTO published.races
    SELECT source.*, v_published_at, core.updated_at
    FROM public.public_election_race_list source
    JOIN public.races core ON core.id = source.race_id;

    INSERT INTO published.candidates
    SELECT source.*, v_published_at, source.candidate_updated_at
    FROM public.public_candidates source;

    WITH ranked_candidates AS (
        SELECT
            candidate.*,
            COUNT(*) OVER (PARTITION BY candidate.person_id) AS candidate_count,
            ROW_NUMBER() OVER (
                PARTITION BY candidate.person_id
                ORDER BY
                    candidate.election_year DESC NULLS LAST,
                    candidate.candidate_updated_at DESC NULLS LAST,
                    candidate.race_id,
                    candidate.candidate_id
            ) AS candidate_rank
        FROM published.candidates candidate
    ),
    latest_candidates AS (
        SELECT *
        FROM ranked_candidates
        WHERE candidate_rank = 1
    )
    UPDATE published.people person
    SET
        candidate_count = latest.candidate_count,
        latest_candidacy = JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
            'candidateId', latest.candidate_id,
            'raceId', latest.race_id,
            'raceTitle', latest.race_title,
            'electionId', latest.election_id,
            'electionName', latest.election_name,
            'electionYear', latest.election_year,
            'party', latest.party,
            'candidateNo', latest.candidate_no,
            'registrationStatus', latest.registration_status,
            'candidacyStatus', latest.candidacy_status,
            'electionResult', latest.election_result,
            'isElected', latest.is_elected
        )),
        primary_region_id = latest.region_id,
        primary_region_name = latest.region_name,
        primary_region_slug = region.slug
    FROM latest_candidates latest
    LEFT JOIN published.regions region ON region.region_id = latest.region_id
    WHERE person.person_id = latest.person_id;

    INSERT INTO published.person_claims
    SELECT source.*, v_published_at, source.updated_at
    FROM public.public_person_claims source;

    INSERT INTO published.person_party_affiliations (
        affiliation_id,
        affiliation_key,
        person_id,
        person_name,
        source_claim_key,
        party_name,
        role_context,
        role_title,
        organization_unit,
        display_order,
        observed_year,
        observed_date,
        start_date,
        end_date,
        is_current,
        confidence_level,
        source_name,
        source_url,
        updated_at,
        role_tier,
        normalized_party,
        published_at,
        source_updated_at
    )
    SELECT
        source.affiliation_id,
        source.affiliation_key,
        canonical.canonical_person_id,
        person.name,
        source.source_claim_key,
        source.party_name,
        source.role_context,
        source.role_title,
        source.organization_unit,
        source.display_order,
        source.observed_year,
        source.observed_date,
        source.start_date,
        source.end_date,
        source.is_current,
        source.confidence_level,
        source.source_name,
        source.source_url,
        source.updated_at,
        source.role_tier,
        LOWER(REGEXP_REPLACE(REPLACE(source.party_name, '臺', '台'), '[[:space:]]+', '', 'g')),
        v_published_at,
        source.updated_at
    FROM public.public_person_party_affiliations source
    JOIN public.person_canonical_map canonical
      ON canonical.person_id = source.person_id
    JOIN published.people person
      ON person.person_id = canonical.canonical_person_id;

    INSERT INTO published.person_party_events (
        event_id,
        event_key,
        person_id,
        person_name,
        party_name,
        event_type,
        event_date,
        end_date,
        summary,
        confidence_level,
        source_name,
        source_url,
        updated_at,
        published_at,
        source_updated_at
    )
    SELECT
        source.event_id,
        source.event_key,
        canonical.canonical_person_id,
        person.name,
        source.party_name,
        source.event_type,
        source.event_date,
        source.end_date,
        source.summary,
        source.confidence_level,
        source.source_name,
        source.source_url,
        source.updated_at,
        v_published_at,
        source.updated_at
    FROM public.public_person_party_events source
    JOIN public.person_canonical_map canonical
      ON canonical.person_id = source.person_id
    JOIN published.people person
      ON person.person_id = canonical.canonical_person_id;

    INSERT INTO published.person_identity_sources
    SELECT DISTINCT ON (source.identity_source_id)
        source.*,
        source.election_year,
        v_published_at,
        source.updated_at
    FROM public.public_person_identity_sources source
    ORDER BY
        source.identity_source_id,
        source.match_score DESC NULLS LAST,
        source.updated_at DESC NULLS LAST,
        source.person_id;

    INSERT INTO published.relation_details
    SELECT source.*, v_published_at, source.relation_updated_at
    FROM public.public_relation_details source;

    INSERT INTO published.party_finance_summaries
    SELECT source.*, v_published_at, source.updated_at
    FROM public.public_party_finance_summaries source;

    INSERT INTO published.party_company_contribution_summaries
    SELECT source.*, v_published_at, core.updated_at
    FROM public.public_party_company_contribution_summaries source
    JOIN public.party_company_contribution_summaries core
      ON core.party_id = source.party_id
     AND core.company_id = source.company_id
     AND core.report_year = source.report_year;

    SELECT COUNT(*) INTO v_expected_count FROM public.public_regions;
    SELECT COUNT(*) INTO v_actual_count FROM published.regions;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'Region parity failed: expected %, got %', v_expected_count, v_actual_count;
    END IF;

    SELECT COUNT(*) INTO v_expected_count FROM public.public_elections;
    SELECT COUNT(*) INTO v_actual_count FROM published.elections;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'Election parity failed: expected %, got %', v_expected_count, v_actual_count;
    END IF;

    SELECT COUNT(*) INTO v_expected_count FROM public.public_election_race_list;
    SELECT COUNT(*) INTO v_actual_count FROM published.races;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'Race parity failed: expected %, got %', v_expected_count, v_actual_count;
    END IF;

    SELECT COUNT(*) INTO v_expected_count FROM public.public_candidates;
    SELECT COUNT(*) INTO v_actual_count FROM published.candidates;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'Candidate parity failed: expected %, got %', v_expected_count, v_actual_count;
    END IF;

    SELECT COUNT(*) INTO v_expected_count FROM public.public_people_directory;
    SELECT COUNT(*) INTO v_actual_count FROM published.people;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'People parity failed: expected %, got %', v_expected_count, v_actual_count;
    END IF;

    SELECT COUNT(*) INTO v_expected_count
    FROM public.public_election_race_list
    WHERE race_type::TEXT IN (
        'township_mayor',
        'township_representative',
        'township_representative_district',
        'village_chief',
        'indigenous',
        'special'
    );
    SELECT COUNT(*) INTO v_low_level_race_count
    FROM published.races
    WHERE race_type::TEXT IN (
        'township_mayor',
        'township_representative',
        'township_representative_district',
        'village_chief',
        'indigenous',
        'special'
    );
    IF v_expected_count <> v_low_level_race_count THEN
        RAISE EXCEPTION 'Lower-level race parity failed: expected %, got %',
            v_expected_count,
            v_low_level_race_count;
    END IF;

    REFRESH MATERIALIZED VIEW published.home_ticker;
    REFRESH MATERIALIZED VIEW published.home_region_summary;
    REFRESH MATERIALIZED VIEW published.election_race_summaries;
    REFRESH MATERIALIZED VIEW published.election_race_facets;
    REFRESH MATERIALIZED VIEW published.event_summaries;
    REFRESH MATERIALIZED VIEW published.local_office_people;
    REFRESH MATERIALIZED VIEW published.party_officers;
    REFRESH MATERIALIZED VIEW published.region_issue_results;
    REFRESH MATERIALIZED VIEW published.search_documents;

    v_validated_counts := JSONB_BUILD_OBJECT(
        'regions', (SELECT COUNT(*) FROM published.regions),
        'elections', (SELECT COUNT(*) FROM published.elections),
        'races', (SELECT COUNT(*) FROM published.races),
        'lowerLevelRaces', v_low_level_race_count,
        'candidates', (SELECT COUNT(*) FROM published.candidates),
        'people', (SELECT COUNT(*) FROM published.people),
        'companies', (SELECT COUNT(*) FROM published.companies),
        'parties', (SELECT COUNT(*) FROM published.parties),
        'searchDocuments', (SELECT COUNT(*) FROM published.search_documents)
    );

    INSERT INTO published.release_state (
        state_key,
        release_id,
        promoted_at,
        source_sync_run_id,
        schema_version,
        validated_row_counts,
        published_at
    ) VALUES (
        'current',
        v_release_id,
        v_published_at,
        p_source_sync_run_id,
        '202607260008',
        v_validated_counts,
        v_published_at
    );

    RETURN v_release_id;
END;
$$;

REVOKE ALL ON FUNCTION published.promote(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.promote(UUID) TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA published FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    ON ALL TABLES IN SCHEMA published TO service_role;

COMMENT ON FUNCTION published.promote(UUID) IS
    'Atomically rebuilds and validates the complete reviewed published snapshot, then refreshes all published materialized views.';

SELECT published.promote(NULL);

COMMIT;
