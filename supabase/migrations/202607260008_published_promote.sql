BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE MATERIALIZED VIEW published.person_candidate_summaries AS
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
    FROM published.candidate_facts candidate
)
SELECT
    candidate.person_id,
    candidate.candidate_count,
    candidate.candidate_id AS latest_candidate_id,
    candidate.region_id AS primary_region_id,
    NOW() AS published_at
FROM ranked_candidates candidate
WHERE candidate.candidate_rank = 1
WITH NO DATA;

CREATE UNIQUE INDEX person_candidate_summaries_person_idx
    ON published.person_candidate_summaries (person_id);
CREATE INDEX person_candidate_summaries_region_idx
    ON published.person_candidate_summaries (primary_region_id, person_id);

CREATE VIEW published.people WITH (security_barrier = true) AS
SELECT
    person.*,
    (
        EXISTS (
            SELECT 1
            FROM public.person_party_affiliations affiliation
            WHERE affiliation.person_id = person.person_id
              AND affiliation.role_context = 'party_officer'
              AND affiliation.is_current = TRUE
              AND affiliation.is_public = TRUE
              AND affiliation.review_status = 'verified'
        )
        AND person.current_office_label IS NULL
        AND person.upcoming_candidate_label IS NULL
        AND summary.person_id IS NULL
    ) AS list_is_party_only,
    COALESCE(summary.candidate_count, 0)::BIGINT AS candidate_count,
    CASE
        WHEN latest.candidate_id IS NULL THEN NULL
        ELSE JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
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
        ))
    END AS latest_candidacy,
    summary.primary_region_id,
    latest.region_name AS primary_region_name,
    region.slug AS primary_region_slug,
    summary.published_at
FROM public.public_people_list_cached person
LEFT JOIN published.person_candidate_summaries summary
  ON summary.person_id = person.person_id
LEFT JOIN published.candidate_facts latest
  ON latest.candidate_id = summary.latest_candidate_id
LEFT JOIN published.regions region
  ON region.region_id = summary.primary_region_id;

CREATE VIEW published.local_office_people WITH (security_barrier = true) AS
SELECT *
FROM published.people
WHERE current_office_label IS NOT NULL
  AND primary_region_id IS NOT NULL;

CREATE MATERIALIZED VIEW published.home_ticker AS
SELECT
    election_id,
    name AS election_name,
    voting_date,
    election_type,
    status,
    source_name,
    source_url,
    NOW() AS published_at
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
        ) AS row_number
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
    NOW() AS published_at
FROM ranked_races
WHERE row_number = 1
WITH NO DATA;

CREATE MATERIALIZED VIEW published.election_race_summaries AS
SELECT
    election_id,
    COUNT(*)::INTEGER AS race_count,
    ARRAY_AGG(DISTINCT race_type ORDER BY race_type) AS race_types,
    NOW() AS published_at
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
    NOW() AS published_at
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
    NOW() AS published_at
FROM published.races
GROUP BY event_key
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
    NOW() AS published_at
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

CREATE VIEW published.search_documents WITH (security_barrier = true) AS
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
        NOW()
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
        NOW()
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
        NOW()
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
        NOW()
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
FROM documents;

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
CREATE UNIQUE INDEX party_officers_affiliation_idx
    ON published.party_officers (affiliation_id);
CREATE INDEX party_officers_party_order_idx
    ON published.party_officers (party_id, role_tier, display_order, person_name);
CREATE UNIQUE INDEX region_issue_results_issue_idx
    ON published.region_issue_results (issue_id);

CREATE OR REPLACE FUNCTION published.promote(p_source_sync_run_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, published, extensions
SET work_mem = '64MB'
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

    TRUNCATE TABLE published.candidate_facts, published.release_state;

    INSERT INTO published.candidate_facts
    SELECT
        candidate_id,
        person_id,
        person_name,
        person_party,
        person_position,
        race_id,
        race_title,
        election_id,
        election_name,
        region_id,
        region_name,
        party,
        candidate_no,
        registration_status,
        vote_count,
        vote_rate,
        is_elected,
        is_incumbent,
        election_year,
        candidacy_status,
        election_result,
        status_updated_at,
        candidate_updated_at
    FROM public.public_candidates;

    SELECT COUNT(*) INTO v_expected_count FROM public.public_candidates;
    SELECT COUNT(*) INTO v_actual_count FROM published.candidate_facts;
    IF v_expected_count <> v_actual_count THEN
        RAISE EXCEPTION 'Candidate parity failed: expected %, got %', v_expected_count, v_actual_count;
    END IF;

    REFRESH MATERIALIZED VIEW published.person_candidate_summaries;

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
    REFRESH MATERIALIZED VIEW published.party_officers;
    REFRESH MATERIALIZED VIEW published.region_issue_results;

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
        '202607260008-compact-hybrid',
        v_validated_counts,
        v_published_at
    );

    RETURN v_release_id;
END;
$$;

REVOKE ALL ON FUNCTION published.promote(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.promote(UUID) TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA published FROM PUBLIC, anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA published TO service_role;

COMMENT ON FUNCTION published.promote(UUID) IS
    'Atomically refreshes the compact candidate snapshot and small published aggregates, then records validated release metadata.';

SELECT published.promote(NULL);

COMMIT;
