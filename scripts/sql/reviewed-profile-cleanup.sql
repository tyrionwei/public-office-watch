-- Session-local guarded batch cleanup; private inputs are never embedded here.
-- One UPDATE statement, preserving native row/statement triggers and all guards.
CREATE FUNCTION pg_temp.clean_claims(batch jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE item jsonb; actual public.person_claims; nextrow public.person_claims;
 persisted public.person_claims; planned public.person_claims[]:=ARRAY[]::public.person_claims[];
 ids uuid[]; affected integer; n integer;
BEGIN
 IF jsonb_typeof(batch) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'CLEANUP_BATCH_SHAPE'; END IF;
 n:=jsonb_array_length(batch);
 IF n<1 OR n>5 THEN RAISE EXCEPTION 'CLEANUP_BATCH_SCOPE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(batch) x WHERE
  jsonb_typeof(x->'before') IS DISTINCT FROM 'object' OR jsonb_typeof(x->'after') IS DISTINCT FROM 'object'
  OR x->'before'->>'id' IS NULL OR x->'after'->>'id' IS DISTINCT FROM x->'before'->>'id') THEN
  RAISE EXCEPTION 'CLEANUP_BATCH_SHAPE'; END IF;
 SELECT array_agg((x->'before'->>'id')::uuid ORDER BY x->'before'->>'id') INTO ids FROM jsonb_array_elements(batch) x;
 IF (SELECT count(DISTINCT id) FROM unnest(ids) id)<>n THEN RAISE EXCEPTION 'CLEANUP_DUPLICATE_ID'; END IF;
 -- Lock every target in deterministic order before comparing any before-image.
 PERFORM c.id FROM public.person_claims c WHERE c.id=ANY(ids) ORDER BY c.id FOR UPDATE;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>n THEN RAISE EXCEPTION 'CLEANUP_BEFORE_DRIFT'; END IF;
 FOR item IN SELECT x FROM jsonb_array_elements(batch) x ORDER BY x->'before'->>'id' LOOP
  SELECT * INTO STRICT actual FROM public.person_claims WHERE id=(item->'before'->>'id')::uuid;
  nextrow:=jsonb_populate_record(actual,item->'before');
  IF to_jsonb(actual) IS DISTINCT FROM to_jsonb(nextrow) THEN RAISE EXCEPTION 'CLEANUP_BEFORE_DRIFT'; END IF;
  nextrow:=jsonb_populate_record(actual,item->'after');
  IF (to_jsonb(actual)-'claim_value'-'claim_json') IS DISTINCT FROM (to_jsonb(nextrow)-'claim_value'-'claim_json') THEN
   RAISE EXCEPTION 'CLEANUP_PROTECTED_CHANGE'; END IF;
  planned:=array_append(planned,nextrow);
 END LOOP;
 UPDATE public.person_claims c SET claim_value=p.claim_value,claim_json=p.claim_json
 FROM unnest(planned) p WHERE c.id=p.id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>n THEN RAISE EXCEPTION 'CLEANUP_AFTER_DRIFT'; END IF;
 -- Re-read only after the entire UPDATE and immediate AFTER triggers complete.
 -- RETURNING or planned rows cannot substitute for persisted-state validation.
 FOREACH nextrow IN ARRAY planned LOOP
  SELECT * INTO persisted FROM public.person_claims WHERE id=nextrow.id;
  IF NOT FOUND OR to_jsonb(persisted) IS DISTINCT FROM to_jsonb(nextrow) THEN RAISE EXCEPTION 'CLEANUP_AFTER_DRIFT'; END IF;
  IF public.official_profile_claim_allowed(persisted.claim_type,persisted.claim_value,persisted.claim_json,persisted.person_id,persisted.source_url) IS NOT TRUE THEN
   RAISE EXCEPTION 'CLEANUP_POLICY_REJECTED'; END IF;
 END LOOP;
END $$;

-- Compatibility for existing single-row callers, including the original P2 tests.
CREATE FUNCTION pg_temp.clean_claim(expected jsonb,desired jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_temp.clean_claims(jsonb_build_array(jsonb_build_object('before',expected,'after',desired))); END $$;
