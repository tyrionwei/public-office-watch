BEGIN;

CREATE OR REPLACE FUNCTION published.election_party_performance(
    p_event_key TEXT,
    p_election_ids UUID[],
    p_race_types TEXT[] DEFAULT NULL,
    p_region_key TEXT DEFAULT NULL
)
RETURNS TABLE (
    party_name TEXT,
    candidate_count INTEGER,
    elected_count INTEGER,
    pending_count INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, published
AS $$
    SELECT
        COALESCE(
            public.canonical_party_name(NULLIF(BTRIM(COALESCE(candidate.party, candidate.person_party)), '')),
            '無黨籍'
        ) AS party_name,
        COUNT(*)::INTEGER AS candidate_count,
        COUNT(*) FILTER (
            WHERE candidate.is_elected IS TRUE OR candidate.election_result = 'elected'
        )::INTEGER AS elected_count,
        COUNT(*) FILTER (WHERE candidate.election_result = 'pending')::INTEGER AS pending_count
    FROM published.candidate_facts candidate
    JOIN published.races race ON race.race_id = candidate.race_id
    WHERE p_event_key IS NOT NULL
      AND BTRIM(p_event_key) <> ''
      AND COALESCE(CARDINALITY(p_election_ids), 0) BETWEEN 1 AND 500
      AND race.event_key = BTRIM(p_event_key)
      AND candidate.election_id = ANY (p_election_ids)
      AND (p_race_types IS NULL OR race.race_type = ANY (p_race_types))
      AND (p_region_key IS NULL OR race.region_key = p_region_key)
    GROUP BY 1
    ORDER BY candidate_count DESC, elected_count DESC, party_name
    LIMIT 50;
$$;

REVOKE ALL ON FUNCTION published.election_party_performance(TEXT, UUID[], TEXT[], TEXT)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published.election_party_performance(TEXT, UUID[], TEXT[], TEXT)
TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
