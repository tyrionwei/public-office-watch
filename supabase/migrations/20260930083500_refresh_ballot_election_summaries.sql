BEGIN;
SET LOCAL statement_timeout = '5min';

-- Ballot race corrections changed the live catalog. The election index reads
-- this materialized summary, so refresh it before generating the release SEO.
REFRESH MATERIALIZED VIEW published.election_race_summaries;
REFRESH MATERIALIZED VIEW published.election_race_facets;
REFRESH MATERIALIZED VIEW published.event_summaries;

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
  IF EXISTS (
    WITH actual AS (
      SELECT election_id, race_type, region_key,
             CASE WHEN region_key = 'national' THEN '全國' ELSE region_key END AS region_label,
             count(*)::integer AS race_count
      FROM published.races GROUP BY election_id, race_type, region_key
    )
    SELECT 1 FROM (
      (TABLE actual EXCEPT SELECT election_id,race_type,region_key,region_label,race_count FROM published.election_race_facets)
      UNION ALL
      (SELECT election_id,race_type,region_key,region_label,race_count FROM published.election_race_facets EXCEPT TABLE actual)
    ) difference
  ) THEN
    RAISE EXCEPTION 'Election race facets disagree with the public race catalog';
  END IF;
  IF EXISTS (
    WITH actual AS (
      SELECT event_key, min(voting_date) AS voting_date,
             array_agg(DISTINCT election_id ORDER BY election_id) AS election_ids,
             array_agg(DISTINCT election_name ORDER BY election_name) AS election_names,
             count(*)::integer AS race_count
      FROM published.races GROUP BY event_key
    )
    SELECT 1 FROM (
      (TABLE actual EXCEPT SELECT event_key,voting_date,election_ids,election_names,race_count FROM published.event_summaries)
      UNION ALL
      (SELECT event_key,voting_date,election_ids,election_names,race_count FROM published.event_summaries EXCEPT TABLE actual)
    ) difference
  ) THEN
    RAISE EXCEPTION 'Event summaries disagree with the public race catalog';
  END IF;
END;
$check$;
COMMIT;
