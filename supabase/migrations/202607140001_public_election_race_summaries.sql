CREATE OR REPLACE VIEW public_election_race_summaries AS
SELECT
    election_id,
    COUNT(*)::INTEGER AS race_count,
    ARRAY_AGG(DISTINCT race_type ORDER BY race_type) AS race_types
FROM public_races
GROUP BY election_id;

GRANT SELECT ON public_election_race_summaries TO anon, authenticated;
