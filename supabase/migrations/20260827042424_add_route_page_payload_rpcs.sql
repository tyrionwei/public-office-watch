BEGIN;

CREATE OR REPLACE FUNCTION published.region_page_for(p_region_slug TEXT)
RETURNS TABLE(payload JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH release AS MATERIALIZED (
    SELECT state.release_id, state.published_at
    FROM published.release_state state
    WHERE state.state_key = 'current'
    LIMIT 1
),
selected_region AS MATERIALIZED (
    SELECT
        region.region_id,
        region.name,
        region.slug,
        region.region_type,
        region.parent_region_id,
        region.official_code,
        region.map_code,
        region.display_order
    FROM published.regions region
    WHERE region.slug = pg_catalog.btrim(p_region_slug)
    ORDER BY region.region_id
    LIMIT 1
),
summary_rows AS MATERIALIZED (
    SELECT
        summary.region_id,
        summary.region_name,
        summary.region_slug,
        summary.region_type,
        summary.next_election_id,
        summary.next_election_name,
        summary.next_voting_date,
        summary.upcoming_race_count
    FROM published.home_region_summary summary
    JOIN selected_region region ON region.region_id = summary.region_id
    ORDER BY summary.region_id
    LIMIT 1
),
child_region_rows AS MATERIALIZED (
    SELECT
        child.region_id,
        child.name,
        child.slug,
        child.region_type,
        child.parent_region_id,
        child.official_code,
        child.map_code,
        child.display_order
    FROM published.regions child
    JOIN selected_region region ON child.parent_region_id = region.region_id
    ORDER BY child.display_order, child.name, child.region_id
    LIMIT 65
),
race_rows AS MATERIALIZED (
    SELECT
        race.race_id,
        race.election_id,
        race.election_name,
        race.region_id,
        race.region_name,
        race.region_slug,
        race.race_type,
        race.title,
        race.voting_date,
        race.status
    FROM published.races race
    JOIN selected_region region ON race.region_slug = region.slug
    WHERE race.status IN (
        'announced',
        'upcoming',
        'registration_open',
        'candidates_announced',
        'voting'
    )
    ORDER BY race.voting_date, race.title, race.race_id
    LIMIT 25
)
SELECT pg_catalog.jsonb_build_object(
    'api_version', 1,
    'release_id', (SELECT release.release_id FROM release),
    'published_at', (SELECT release.published_at FROM release),
    'region_row', (SELECT pg_catalog.to_jsonb(region) FROM selected_region region),
    'summary_row', (SELECT pg_catalog.to_jsonb(summary) FROM summary_rows summary),
    'child_region_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(child) ORDER BY child.display_order, child.name, child.region_id)
        FROM child_region_rows child
    ), '[]'::JSONB),
    'race_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(race) ORDER BY race.voting_date, race.title, race.race_id)
        FROM race_rows race
    ), '[]'::JSONB)
) AS payload;
$$;

CREATE OR REPLACE FUNCTION published.election_index_page()
RETURNS TABLE(payload JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH release AS MATERIALIZED (
    SELECT state.release_id, state.published_at
    FROM published.release_state state
    WHERE state.state_key = 'current'
    LIMIT 1
),
election_rows AS MATERIALIZED (
    SELECT
        election.election_id,
        election.name,
        election.year,
        election.election_type,
        election.voting_date,
        election.status,
        election.source_name,
        election.source_url
    FROM published.elections election
    ORDER BY
        election.year DESC NULLS LAST,
        election.voting_date DESC NULLS LAST,
        election.name,
        election.election_id
    LIMIT 501
),
race_summary_rows AS MATERIALIZED (
    SELECT
        summary.election_id,
        summary.race_count,
        summary.race_types
    FROM published.election_race_summaries summary
    JOIN election_rows election ON election.election_id = summary.election_id
    ORDER BY summary.election_id
    LIMIT 501
)
SELECT pg_catalog.jsonb_build_object(
    'api_version', 1,
    'release_id', (SELECT release.release_id FROM release),
    'published_at', (SELECT release.published_at FROM release),
    'election_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.to_jsonb(election)
            ORDER BY election.year DESC NULLS LAST, election.voting_date DESC NULLS LAST, election.name, election.election_id
        )
        FROM election_rows election
    ), '[]'::JSONB),
    'race_summary_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(summary) ORDER BY summary.election_id)
        FROM race_summary_rows summary
    ), '[]'::JSONB)
) AS payload;
$$;

CREATE OR REPLACE FUNCTION published.race_page_for(p_race_id UUID)
RETURNS TABLE(payload JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH release AS MATERIALIZED (
    SELECT state.release_id, state.published_at
    FROM published.release_state state
    WHERE state.state_key = 'current'
    LIMIT 1
),
selected_race AS MATERIALIZED (
    SELECT
        race.race_id,
        race.election_id,
        race.election_name,
        race.region_id,
        race.region_name,
        race.region_slug,
        race.race_type,
        race.title,
        race.voting_date,
        race.status,
        race.source_name,
        race.source_url
    FROM published.races race
    WHERE race.race_id = p_race_id
    LIMIT 1
),
election_rows AS MATERIALIZED (
    SELECT
        election.election_id,
        election.name,
        election.year,
        election.election_type,
        election.voting_date,
        election.status,
        election.source_name,
        election.source_url
    FROM published.elections election
    WHERE election.election_id = (SELECT race.election_id FROM selected_race race)
    LIMIT 1
),
candidate_rows AS MATERIALIZED (
    SELECT
        candidate.candidate_id,
        candidate.person_id,
        candidate.person_name,
        candidate.person_party,
        candidate.person_position,
        candidate.race_id,
        candidate.race_title,
        candidate.election_id,
        candidate.election_name,
        candidate.region_id,
        candidate.region_name,
        candidate.party,
        candidate.candidate_no,
        candidate.registration_status,
        candidate.vote_count,
        candidate.vote_rate,
        candidate.is_elected,
        candidate.is_incumbent,
        candidate.election_year,
        candidate.candidacy_status,
        candidate.election_result,
        candidate.status_updated_at,
        candidate.candidate_updated_at,
        candidate.source_name,
        candidate.source_url,
        candidate.primary_photo_url,
        candidate.primary_photo_thumbnail_url,
        candidate.photo_attribution,
        candidate.photo_license_type
    FROM published.candidates candidate
    WHERE candidate.race_id = p_race_id
    ORDER BY candidate.candidate_no NULLS LAST, candidate.person_name, candidate.candidate_id
    LIMIT 101
),
party_affiliation_rows AS MATERIALIZED (
    SELECT
        affiliation.affiliation_id,
        affiliation.affiliation_key,
        affiliation.person_id,
        affiliation.person_name,
        affiliation.source_claim_key,
        affiliation.party_name,
        affiliation.role_context,
        affiliation.role_title,
        affiliation.organization_unit,
        affiliation.display_order,
        affiliation.role_tier,
        affiliation.observed_year,
        affiliation.observed_date,
        affiliation.start_date,
        affiliation.end_date,
        affiliation.is_current,
        affiliation.confidence_level,
        affiliation.source_name,
        affiliation.source_url,
        affiliation.updated_at
    FROM published.person_party_affiliations affiliation
    WHERE affiliation.person_id = ANY(ARRAY(
        SELECT DISTINCT candidate.person_id
        FROM candidate_rows candidate
        WHERE candidate.person_id IS NOT NULL
    ))
    ORDER BY affiliation.person_id, affiliation.observed_year DESC NULLS LAST, affiliation.affiliation_id
    LIMIT 1001
),
question_rows AS MATERIALIZED (
    SELECT
        question.question_id,
        question.race_id,
        question.election_id,
        question.referendum_type,
        question.case_number,
        question.jurisdiction_name,
        question.proposal_text,
        question.result_status,
        question.eligible_voters,
        question.total_votes,
        question.valid_votes,
        question.invalid_votes,
        question.turnout_rate,
        question.approval_rule,
        question.source_name,
        question.source_url,
        question.source_document_url,
        question.updated_at
    FROM published.referendum_questions question
    WHERE question.race_id = p_race_id
    LIMIT 1
),
option_rows AS MATERIALIZED (
    SELECT
        option.option_id,
        option.question_id,
        option.race_id,
        option.option_code,
        option.label,
        option.vote_count,
        option.vote_rate,
        option.display_order,
        option.updated_at
    FROM published.referendum_options option
    WHERE option.question_id = (SELECT question.question_id FROM question_rows question)
    ORDER BY option.display_order
    LIMIT 3
),
region_result_rows AS MATERIALIZED (
    SELECT
        result.result_id,
        result.question_id,
        result.race_id,
        result.region_id,
        result.region_name,
        result.region_slug,
        result.eligible_voters,
        result.yes_votes,
        result.no_votes,
        result.invalid_votes,
        result.turnout_rate,
        result.source_name,
        result.source_url,
        result.updated_at
    FROM published.referendum_region_results result
    WHERE result.question_id = (SELECT question.question_id FROM question_rows question)
    ORDER BY result.region_name
    LIMIT 65
)
SELECT pg_catalog.jsonb_build_object(
    'api_version', 1,
    'release_id', (SELECT release.release_id FROM release),
    'published_at', (SELECT release.published_at FROM release),
    'race_row', (SELECT pg_catalog.to_jsonb(race) FROM selected_race race),
    'election_row', (SELECT pg_catalog.to_jsonb(election) FROM election_rows election),
    'candidate_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(candidate) ORDER BY candidate.candidate_no NULLS LAST, candidate.person_name, candidate.candidate_id)
        FROM candidate_rows candidate
    ), '[]'::JSONB),
    'party_affiliation_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(affiliation) ORDER BY affiliation.person_id, affiliation.observed_year DESC NULLS LAST, affiliation.affiliation_id)
        FROM party_affiliation_rows affiliation
    ), '[]'::JSONB),
    'referendum_question_row', (SELECT pg_catalog.to_jsonb(question) FROM question_rows question),
    'referendum_option_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(option) ORDER BY option.display_order)
        FROM option_rows option
    ), '[]'::JSONB),
    'referendum_region_result_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(result) ORDER BY result.region_name)
        FROM region_result_rows result
    ), '[]'::JSONB)
) AS payload;
$$;

CREATE OR REPLACE FUNCTION published.person_profiles_for(p_person_ids UUID[])
RETURNS TABLE(payload JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH release AS MATERIALIZED (
    SELECT state.release_id, state.published_at
    FROM published.release_state state
    WHERE state.state_key = 'current'
    LIMIT 1
),
requested_people AS MATERIALIZED (
    SELECT DISTINCT input.person_id
    FROM pg_catalog.unnest(COALESCE(p_person_ids, ARRAY[]::UUID[])) AS input(person_id)
    WHERE input.person_id IS NOT NULL
      AND pg_catalog.cardinality(COALESCE(p_person_ids, ARRAY[]::UUID[])) BETWEEN 1 AND 4
),
person_rows AS MATERIALIZED (
    SELECT
        person.person_id,
        person.name,
        person.alias,
        person.gender,
        person.party,
        person.position,
        person.current_office_label,
        person.upcoming_candidate_label,
        person.election_year,
        person.district,
        person.education,
        person.experience,
        person.updated_at,
        person.primary_photo_url,
        person.primary_photo_thumbnail_url,
        person.photo_source_name,
        person.photo_source_url,
        person.photo_license_type,
        person.photo_license_url,
        person.photo_attribution,
        person.list_role,
        person.list_status,
        person.list_is_grassroots,
        person.list_is_party_only,
        person.list_status_order,
        person.list_role_order,
        person.candidate_count,
        person.primary_region_id,
        person.primary_region_name
    FROM requested_people requested
    CROSS JOIN LATERAL (
        SELECT source.*
        FROM published.people source
        WHERE source.person_id = requested.person_id
        LIMIT 1
    ) person
    ORDER BY person.person_id
    LIMIT 5
),
candidate_rows AS MATERIALIZED (
    SELECT
        candidate.candidate_id,
        candidate.person_id,
        candidate.person_name,
        candidate.person_party,
        candidate.person_position,
        candidate.race_id,
        candidate.race_title,
        candidate.election_id,
        candidate.election_name,
        candidate.region_id,
        candidate.region_name,
        candidate.party,
        candidate.candidate_no,
        candidate.registration_status,
        candidate.vote_count,
        candidate.vote_rate,
        candidate.is_elected,
        candidate.is_incumbent,
        candidate.election_year,
        candidate.candidacy_status,
        candidate.election_result,
        candidate.status_updated_at,
        candidate.candidate_updated_at,
        candidate.source_name,
        candidate.source_url,
        candidate.primary_photo_url,
        candidate.primary_photo_thumbnail_url,
        candidate.photo_attribution,
        candidate.photo_license_type
    FROM requested_people requested
    CROSS JOIN LATERAL (
        SELECT source.*
        FROM published.candidates source
        WHERE source.person_id = requested.person_id
        ORDER BY source.election_year DESC NULLS LAST, source.race_id, source.candidate_id
        LIMIT 101
    ) candidate
    ORDER BY candidate.person_id, candidate.election_year DESC NULLS LAST, candidate.race_id, candidate.candidate_id
    LIMIT 101
),
claim_rows AS MATERIALIZED (
    SELECT claim.*
    FROM published.person_claims_for(ARRAY(
        SELECT requested.person_id
        FROM requested_people requested
        ORDER BY requested.person_id
    )) claim
    LIMIT 401
),
party_affiliation_rows AS MATERIALIZED (
    SELECT
        affiliation.affiliation_id,
        affiliation.affiliation_key,
        affiliation.person_id,
        affiliation.person_name,
        affiliation.source_claim_key,
        affiliation.party_name,
        affiliation.role_context,
        affiliation.role_title,
        affiliation.organization_unit,
        affiliation.display_order,
        affiliation.role_tier,
        affiliation.observed_year,
        affiliation.observed_date,
        affiliation.start_date,
        affiliation.end_date,
        affiliation.is_current,
        affiliation.confidence_level,
        affiliation.source_name,
        affiliation.source_url,
        affiliation.updated_at
    FROM requested_people requested
    CROSS JOIN LATERAL (
        SELECT source.*
        FROM published.person_party_affiliations source
        WHERE source.person_id = requested.person_id
        ORDER BY
            source.is_current DESC,
            source.observed_year DESC NULLS LAST,
            source.display_order NULLS LAST,
            source.affiliation_id
        LIMIT 101
    ) affiliation
    ORDER BY
        affiliation.person_id,
        affiliation.is_current DESC,
        affiliation.observed_year DESC NULLS LAST,
        affiliation.display_order NULLS LAST,
        affiliation.affiliation_id
    LIMIT 101
)
SELECT pg_catalog.jsonb_build_object(
    'api_version', 1,
    'release_id', (SELECT release.release_id FROM release),
    'published_at', (SELECT release.published_at FROM release),
    'person_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(person) ORDER BY person.person_id)
        FROM person_rows person
    ), '[]'::JSONB),
    'candidate_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(candidate) ORDER BY candidate.person_id, candidate.election_year DESC NULLS LAST, candidate.race_id, candidate.candidate_id)
        FROM candidate_rows candidate
    ), '[]'::JSONB),
    'claim_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(claim) ORDER BY claim.person_id, claim.observed_at DESC NULLS LAST, claim.claim_id)
        FROM claim_rows claim
    ), '[]'::JSONB),
    'party_affiliation_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.to_jsonb(affiliation)
            ORDER BY affiliation.person_id, affiliation.is_current DESC, affiliation.observed_year DESC NULLS LAST, affiliation.display_order NULLS LAST, affiliation.affiliation_id
        )
        FROM party_affiliation_rows affiliation
    ), '[]'::JSONB)
) AS payload;
$$;

REVOKE ALL ON FUNCTION published.region_page_for(TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.election_index_page()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.race_page_for(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.person_profiles_for(UUID[])
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.region_page_for(TEXT)
TO anon, authenticated, service_role, admin_role;
GRANT EXECUTE ON FUNCTION published.election_index_page()
TO anon, authenticated, service_role, admin_role;
GRANT EXECUTE ON FUNCTION published.race_page_for(UUID)
TO anon, authenticated, service_role, admin_role;
GRANT EXECUTE ON FUNCTION published.person_profiles_for(UUID[])
TO anon, authenticated, service_role, admin_role;

COMMENT ON FUNCTION published.region_page_for(TEXT) IS
    'Returns one bounded region-detail payload from reviewed published fields.';
COMMENT ON FUNCTION published.election_index_page() IS
    'Returns one bounded election-index payload from reviewed published fields.';
COMMENT ON FUNCTION published.race_page_for(UUID) IS
    'Returns one bounded race-detail payload from reviewed published fields.';
COMMENT ON FUNCTION published.person_profiles_for(UUID[]) IS
    'Returns one bounded payload for at most four reviewed public person profiles.';

NOTIFY pgrst, 'reload schema';

COMMIT;
