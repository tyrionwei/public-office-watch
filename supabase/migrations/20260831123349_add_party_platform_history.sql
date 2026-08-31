BEGIN;

CREATE FUNCTION published.party_platform_history_for(p_party_id UUID)
RETURNS TABLE (
    result_id UUID,
    race_id UUID,
    election_id UUID,
    election_year INTEGER,
    election_name TEXT,
    race_title TEXT,
    voting_date DATE,
    party_ballot_number SMALLINT,
    vote_count BIGINT,
    vote_rate DOUBLE PRECISION,
    allocated_seats SMALLINT,
    source_name TEXT,
    source_url TEXT,
    platform_source_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        result.result_id,
        race.id AS race_id,
        election.id AS election_id,
        election.year AS election_year,
        election.name AS election_name,
        race.title AS race_title,
        election.voting_date,
        result.party_ballot_number,
        result.vote_count,
        CASE
            WHEN totals.valid_votes > 0
            THEN pg_catalog.round(result.vote_count::NUMERIC * 100 / totals.valid_votes, 4)::DOUBLE PRECISION
            ELSE NULL
        END AS vote_rate,
        result.allocated_seats,
        result.source_name,
        result.source_url,
        result.platform_source_url
    FROM public.party_list_race_results AS result
    JOIN public.races AS race ON race.id = result.race_id
    JOIN public.elections AS election ON election.id = race.election_id
    CROSS JOIN LATERAL (
        SELECT pg_catalog.sum(peer.vote_count)::NUMERIC AS valid_votes
        FROM public.party_list_race_results AS peer
        WHERE peer.race_id = result.race_id
          AND peer.is_public = TRUE
    ) AS totals
    WHERE result.party_id = p_party_id
      AND result.is_public = TRUE
      AND result.platform_items_reviewed_at IS NOT NULL
      AND race.is_public = TRUE
      AND election.is_public = TRUE
      AND race.race_type = 'party_list_legislator'
    ORDER BY election.year DESC, election.voting_date DESC, result.result_id
    LIMIT 16;
$function$;

REVOKE ALL ON FUNCTION published.party_platform_history_for(UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.party_platform_history_for(UUID)
TO anon, authenticated, service_role, admin_role;

COMMENT ON FUNCTION published.party_platform_history_for(UUID) IS
    'Returns a bounded public history of reviewed party-list platform targets for one party.';

NOTIFY pgrst, 'reload schema';

COMMIT;
