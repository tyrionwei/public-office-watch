BEGIN;
SET LOCAL statement_timeout = '5min';

-- Ballot race corrections changed the live catalog. The election index reads
-- this materialized summary, so refresh it before generating the release SEO.
REFRESH MATERIALIZED VIEW published.election_race_summaries;

DO $check$
BEGIN
  IF EXISTS (
    WITH actual AS (
      SELECT election_id, count(*)::integer AS race_count,
             array_agg(DISTINCT race_type ORDER BY race_type) AS race_types
      FROM published.races
      GROUP BY election_id
    )
    SELECT 1
    FROM actual a
    FULL JOIN published.election_race_summaries s USING (election_id)
    WHERE a.election_id IS NULL OR s.election_id IS NULL
       OR a.race_count IS DISTINCT FROM s.race_count
       OR a.race_types IS DISTINCT FROM s.race_types
  ) THEN
    RAISE EXCEPTION 'Election race summaries disagree with the public race catalog';
  END IF;
END;
$check$;
COMMIT;
