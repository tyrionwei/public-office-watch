\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $$
DECLARE c jsonb; p jsonb; m jsonb;
BEGIN
    SELECT body INTO STRICT c FROM pow_release_20261127.input WHERE kind='candidates';
    SELECT body INTO STRICT p FROM pow_release_20261127.input WHERE kind='polling';
    SELECT body INTO STRICT m FROM pow_release_20261127.input WHERE kind='provenance';
    IF (SELECT count(DISTINCT x->>'cid') FROM jsonb_array_elements(c) x) <> 1164
       OR (SELECT count(DISTINCT (CASE WHEN x->>'kind'='platform' THEN x->>'cid' ELSE x->>'pid' END, x->>'kind')) FROM jsonb_array_elements(c) x) <> 2529
       OR (SELECT jsonb_object_agg(kind,n) FROM (SELECT x->>'kind' kind,count(*) n FROM jsonb_array_elements(c) x GROUP BY x->>'kind') q)
          IS DISTINCT FROM '{"gender":350,"birth_date":327,"education":365,"experience":372,"platform":1115}'::jsonb
       OR m->>'candidate_published_baseline' IS DISTINCT FROM '14fdb601-fbdf-4587-9804-c949f5ef266f'
       OR (SELECT jsonb_object_agg(county,n) FROM (SELECT x->>'county_code' county,count(*) n FROM jsonb_array_elements(p->'rows') x GROUP BY x->>'county_code') q)
          IS DISTINCT FROM '{"10009":501,"10016":111}'::jsonb
       OR (SELECT count(DISTINCT (x->>'county_code',x->>'station_no',x->>'village_code')) FROM jsonb_array_elements(p->'rows') x) <> 612
       OR (SELECT sum(CASE WHEN jsonb_typeof(x->'neighbor_numbers')='array' THEN jsonb_array_length(x->'neighbor_numbers') ELSE 0 END) FROM jsonb_array_elements(p->'rows') x) <> 4152
       OR (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p->'fallback_village_codes') x) <> 63
       OR NOT ((p->'fallback_village_codes') ? '10009010039')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p->'rows') x WHERE (p->'fallback_village_codes') ? (x->>'village_code') OR x->'hold' <> '[]'::jsonb)
       OR (SELECT count(*) FROM jsonb_array_elements(p->'corrections') x WHERE x->>'official_sha256' ~ '^[a-f0-9]{64}$'
              AND (x->>'county',x#>>'{after,station_no}',x#>>'{after,village_code}') IN (('65000','0146','65000100033'),('10013','0705','10013290006'))) <> 2
       OR jsonb_array_length(p->'corrections') <> 2
    THEN RAISE EXCEPTION 'Release payload no longer matches the reviewed scope'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r
      WHERE has_schema_privilege(r,'pow_release_20261127','USAGE')
         OR has_table_privilege(r,'pow_release_20261127.input','SELECT')
         OR has_table_privilege(r,'pow_release_20261127.receipt','INSERT'))
    THEN RAISE EXCEPTION 'Release staging must be operator-only'; END IF;
END $$;
SELECT 'POW_PRIVATE_RELEASE_PAYLOAD_OK' AS result;
ROLLBACK;
