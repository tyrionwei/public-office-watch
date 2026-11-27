\set ON_ERROR_STOP on
-- Only checks; it does not adopt or approve a row.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '90s';
SET LOCAL search_path = pg_catalog;
DO $$
DECLARE stage jsonb; stations jsonb; m jsonb;
BEGIN
    SELECT body INTO STRICT stage FROM pow_release_20261127.input WHERE kind='candidates';
    SELECT body INTO STRICT stations FROM pow_release_20261127.input WHERE kind='polling';
    SELECT body INTO STRICT m FROM pow_release_20261127.input WHERE kind='provenance';
    IF (SELECT release_id::text FROM published.release_state WHERE state_key='current')
             IS DISTINCT FROM m->>'candidate_published_baseline'
       OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=m->>'candidate_baseline_schema')
       OR (SELECT count(DISTINCT version) FROM supabase_migrations.schema_migrations
           WHERE version IN ('20261127055704','20261127094600','20261127101444')) <> 3
       OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version>m->>'candidate_baseline_schema'
                  AND version NOT IN ('20261127055704','20261127094600','20261127101444'))
       OR EXISTS (SELECT 1 FROM pow_release_20261127.receipt)
    THEN RAISE EXCEPTION 'Baseline or release receipt differs; stop for review'; END IF;

    IF (
SELECT encode(sha256(convert_to(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) ORDER BY p.proname)
 FROM pg_proc p WHERE p.oid IN('public.sync_official_profile_demographics()'::regprocedure,'public.guard_official_demographics()'::regprocedure)),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY t.tgname)
 FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN('public.person_claims'::regclass,'published.person_demographics'::regclass)
 AND t.tgfoid IN('public.sync_official_profile_demographics()'::regprocedure,'public.guard_official_demographics()'::regprocedure)),
 'profile_view',pg_get_viewdef('public.official_profile_values'::regclass)
)::text,'UTF8')),'hex')
    ) IS DISTINCT FROM '9a6f7b4e82e72882951f6aa27990ac95b4ef115ecdf8461d74c59a175e34f093'
    THEN RAISE EXCEPTION 'Birthday projection definition drift; stop for review'; END IF;
    IF encode(sha256(convert_to(pg_get_viewdef('public.public_people_list'::regclass),'UTF8')),'hex')
        IS DISTINCT FROM '73875e267b0bb05ff6c0a42d7bb9c5bc9a0e2c2b32249a066856eb21516c548a'
    THEN RAISE EXCEPTION 'Directory projection definition drift; stop for review'; END IF;

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
