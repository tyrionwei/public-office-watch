BEGIN;

CREATE OR REPLACE FUNCTION published.home_page_for(p_region_slug TEXT DEFAULT NULL)
RETURNS TABLE(payload JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH params AS (
    SELECT NULLIF(pg_catalog.btrim(p_region_slug), '') AS region_selector
),
selected_region AS MATERIALIZED (
    SELECT region.*
    FROM published.regions region
    CROSS JOIN params
    WHERE pg_catalog.lower(COALESCE(params.region_selector, 'national'))
          NOT IN ('national', 'taiwan', 'region-taiwan')
      AND (
          region.slug = params.region_selector
          OR region.region_id::TEXT = params.region_selector
      )
      AND region.region_type IN ('municipality', 'county', 'city')
    ORDER BY region.display_order, region.name, region.region_id
    LIMIT 1
),
region_rows AS MATERIALIZED (
    SELECT region.*
    FROM published.regions region
    WHERE region.region_type IN ('country', 'municipality', 'county', 'city')
    ORDER BY region.display_order, region.name, region.region_id
    LIMIT 33
),
region_summary_rows AS MATERIALIZED (
    SELECT summary.*
    FROM published.home_region_summary summary
    ORDER BY summary.region_name, summary.region_id
    LIMIT 33
),
race_rows AS MATERIALIZED (
    SELECT race.*
    FROM published.races race
    WHERE race.status IN (
        'announced',
        'upcoming',
        'registration_open',
        'candidates_announced',
        'voting'
    )
      AND (
          (
              NOT EXISTS (SELECT 1 FROM selected_region)
              AND race.region_key = 'national'
          )
          OR race.region_slug = (SELECT slug FROM selected_region)
      )
    ORDER BY race.voting_date, race.title, race.race_id
    LIMIT 25
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
        core.source_name,
        core.source_url,
        photo.photo_url AS primary_photo_url,
        photo.thumbnail_url AS primary_photo_thumbnail_url,
        photo.attribution AS photo_attribution,
        photo.license_type AS photo_license_type,
        person.gender,
        CASE
            WHEN demographic.birth_date IS NULL THEN NULL
            WHEN EXTRACT(YEAR FROM pg_catalog.age(
                CURRENT_DATE, demographic.birth_date
            )) < 40 THEN 'under-40'
            WHEN EXTRACT(YEAR FROM pg_catalog.age(
                CURRENT_DATE, demographic.birth_date
            )) < 50 THEN '40-49'
            WHEN EXTRACT(YEAR FROM pg_catalog.age(
                CURRENT_DATE, demographic.birth_date
            )) < 60 THEN '50-59'
            ELSE '60-plus'
        END AS age_group
    FROM race_rows race
    JOIN published.candidate_facts candidate
      ON candidate.race_id = race.race_id
    LEFT JOIN public.candidates core
      ON core.id = candidate.candidate_id
    LEFT JOIN public.public_person_primary_photos photo
      ON photo.person_id = candidate.person_id
    LEFT JOIN published.people_directory person
      ON person.person_id = candidate.person_id
    LEFT JOIN published.person_demographics demographic
      ON demographic.person_id = candidate.person_id
    ORDER BY
        candidate.race_id,
        candidate.candidate_no NULLS LAST,
        candidate.person_name,
        candidate.candidate_id
    LIMIT 401
),
local_seat_rows AS MATERIALIZED (
    SELECT
        public.canonical_party_name(person.party) AS party_name,
        pg_catalog.count(*)::INTEGER AS seat_count
    FROM published.people_directory person
    CROSS JOIN selected_region region
    WHERE person.list_status = 'current'
      AND person.list_role = 'councilor'
      AND (
          person.district ILIKE region.name || '%'
          OR person.district ILIKE pg_catalog.replace(region.name, '臺', '台') || '%'
      )
    GROUP BY public.canonical_party_name(person.party)
),
seat_rows AS MATERIALIZED (
    SELECT summary.party_name, summary.legislator_count AS seat_count
    FROM published.current_legislator_party_summary summary
    WHERE NOT EXISTS (SELECT 1 FROM selected_region)

    UNION ALL

    SELECT local.party_name, local.seat_count
    FROM local_seat_rows local
    WHERE EXISTS (SELECT 1 FROM selected_region)

    ORDER BY seat_count DESC, party_name
    LIMIT 21
),
release AS (
    SELECT state.release_id, state.published_at
    FROM published.release_state state
    WHERE state.state_key = 'current'
    LIMIT 1
)
SELECT pg_catalog.jsonb_build_object(
    'api_version', 1,
    'release_id', (SELECT release.release_id FROM release),
    'published_at', (SELECT release.published_at FROM release),
    'ticker_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'election_id', ticker.election_id,
                'election_name', ticker.election_name,
                'voting_date', ticker.voting_date
            )
            ORDER BY ticker.voting_date, ticker.election_id
        )
        FROM (
            SELECT home.election_id, home.election_name, home.voting_date
            FROM published.home_ticker home
            ORDER BY home.voting_date, home.election_id
            LIMIT 1
        ) ticker
    ), '[]'::JSONB),
    'region_summary_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'region_id', summary.region_id,
                'region_name', summary.region_name,
                'region_slug', summary.region_slug,
                'region_type', summary.region_type,
                'next_election_id', summary.next_election_id,
                'next_election_name', summary.next_election_name,
                'next_voting_date', summary.next_voting_date,
                'upcoming_race_count', summary.upcoming_race_count
            )
            ORDER BY summary.region_name, summary.region_id
        )
        FROM region_summary_rows summary
    ), '[]'::JSONB),
    'region_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'region_id', region.region_id,
                'name', region.name,
                'slug', region.slug,
                'region_type', region.region_type,
                'parent_region_id', region.parent_region_id,
                'official_code', region.official_code,
                'map_code', region.map_code,
                'display_order', region.display_order
            )
            ORDER BY region.display_order, region.name, region.region_id
        )
        FROM region_rows region
    ), '[]'::JSONB),
    'race_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'race_id', race.race_id,
                'election_id', race.election_id,
                'election_name', race.election_name,
                'region_id', race.region_id,
                'region_name', race.region_name,
                'region_slug', race.region_slug,
                'race_type', race.race_type,
                'title', race.title,
                'voting_date', race.voting_date,
                'status', race.status
            )
            ORDER BY race.voting_date, race.title, race.race_id
        )
        FROM race_rows race
    ), '[]'::JSONB),
    'candidate_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.to_jsonb(candidate)
            ORDER BY
                candidate.race_id,
                candidate.candidate_no NULLS LAST,
                candidate.person_name,
                candidate.candidate_id
        )
        FROM candidate_rows candidate
    ), '[]'::JSONB),
    'seat_rows', COALESCE((
        SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'party_name', seat.party_name,
                'seat_count', seat.seat_count
            )
            ORDER BY seat.seat_count DESC, seat.party_name
        )
        FROM seat_rows seat
    ), '[]'::JSONB)
) AS payload;
$$;

REVOKE ALL ON FUNCTION published.home_page_for(TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.home_page_for(TEXT)
TO anon, authenticated, service_role, admin_role;

COMMENT ON FUNCTION published.home_page_for(TEXT) IS
    'Returns one bounded homepage payload for a national or top-level region view without exposing exact birth dates.';

NOTIFY pgrst, 'reload schema';

COMMIT;
