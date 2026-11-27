\set ON_ERROR_STOP on
-- Only checks; it does not adopt or approve a row.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';
DO $$
DECLARE stage jsonb; stations jsonb; m jsonb;
BEGIN
    SELECT body INTO STRICT stage FROM pow_release_20261127.input WHERE kind='candidates';
    SELECT body INTO STRICT stations FROM pow_release_20261127.input WHERE kind='polling';
    SELECT body INTO STRICT m FROM pow_release_20261127.input WHERE kind='provenance';
    IF (SELECT release_id::text FROM published.release_state WHERE state_key='current')
             IS DISTINCT FROM m->>'candidate_published_baseline'
       OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=m->>'candidate_baseline_schema')
       OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version>m->>'candidate_baseline_schema'
                  AND version<>'20261127055704')
       OR EXISTS (SELECT 1 FROM pow_release_20261127.receipt)
    THEN RAISE EXCEPTION 'Baseline or release receipt differs; stop for review'; END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(stage) x(cid uuid,pid uuid,rid uuid,eid uuid,name text,ballot int,kind text)
      LEFT JOIN public.candidates c ON c.id=x.cid
      LEFT JOIN public.races r ON r.id=c.race_id
      LEFT JOIN public.elections e ON e.id=r.election_id
      LEFT JOIN public.people p ON p.id=c.person_id
      LEFT JOIN public.person_canonical_map cm ON cm.person_id=c.person_id
      LEFT JOIN public.official_profile_values v ON v.person_id=x.pid
      WHERE c.person_id IS DISTINCT FROM x.pid OR cm.canonical_person_id IS DISTINCT FROM x.pid
         OR c.race_id IS DISTINCT FROM x.rid OR r.election_id IS DISTINCT FROM x.eid
         OR e.year IS DISTINCT FROM 2026 OR c.candidate_no IS NOT NULL AND btrim(c.candidate_no) ~ '^[0-9]+$'
             AND ltrim(btrim(c.candidate_no),'0') IS DISTINCT FROM x.ballot::text
         OR c.candidate_no IS NULL OR btrim(c.candidate_no) !~ '^[0-9]+$'
         OR coalesce(nullif(btrim(c.candidate_name),''),p.name) IS DISTINCT FROM x.name
         OR r.race_type NOT IN ('municipality_mayor','county_mayor','city_councilor','county_councilor','councilor_district')
         OR p.is_public IS DISTINCT FROM true
         OR (x.kind='gender' AND p.gender IS DISTINCT FROM 'unknown')
         OR (x.kind='education' AND (p.education IS NOT NULL OR v.education IS NOT NULL))
         OR (x.kind='experience' AND (p.experience IS NOT NULL OR v.experience IS NOT NULL))
         OR (x.kind='birth_date' AND (v.birth_value IS NOT NULL OR v.birth_conflict))
    ) THEN RAISE EXCEPTION 'Candidate identity, ballot, office or before value changed'; END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(stage) x(cid uuid,pid uuid,kind text)
      JOIN public.person_canonical_map cm ON cm.canonical_person_id=x.pid
      JOIN public.person_claims pc ON pc.person_id=cm.person_id AND pc.claim_type=x.kind
      WHERE x.kind<>'platform' OR pc.candidate_id IS NULL OR pc.candidate_id=x.cid
    ) THEN RAISE EXCEPTION 'Existing same-field claim found (includes archived and historical IDs)'; END IF;

    IF EXISTS (
      SELECT 1 FROM public.polling_place_sources s WHERE s.event_key='2026-local-general-election-day'
      AND s.county_code IN ('10009','10016') AND s.is_current
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(stations->'corrections') x
      LEFT JOIN public.polling_place_sources s ON s.id=(x#>>'{source,id}')::uuid
      LEFT JOIN public.polling_places p ON p.id=(x#>>'{before,id}')::uuid AND p.source_id=s.id
      WHERE s.source_hash IS DISTINCT FROM x#>>'{source,source_hash}'
        OR (s.is_current AND s.is_public) IS DISTINCT FROM true
        OR s.county_code IS DISTINCT FROM x->>'county' OR s.event_key IS DISTINCT FROM '2026-local-general-election-day'
        OR s.voting_date IS DISTINCT FROM DATE '2026-11-28'
        OR p.village_code IS DISTINCT FROM x#>>'{before,village_code}' OR p.station_no IS DISTINCT FROM x#>>'{before,station_no}'
        OR p.station_name IS DISTINCT FROM x#>>'{before,station_name}' OR p.address IS DISTINCT FROM x#>>'{before,address}'
        OR p.coverage_kind IS DISTINCT FROM x#>>'{before,coverage_kind}'
        OR to_jsonb(ARRAY(SELECT n.neighborhood_no FROM public.polling_place_neighborhoods n WHERE n.polling_place_id=p.id ORDER BY n.neighborhood_no))
              IS DISTINCT FROM x#>'{before,neighborhoods}'
    ) THEN RAISE EXCEPTION 'Polling baseline or relocated station preimage changed'; END IF;
END $$;
SELECT 'POW_COMBINED_READONLY_PRECONDITIONS_OK' AS result;
ROLLBACK;
