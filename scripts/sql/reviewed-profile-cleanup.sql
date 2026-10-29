-- Session-local guarded cleanup; no payloads or automatic adoption.
-- Execute only through the approved review transaction with exact before/after inputs.
CREATE FUNCTION pg_temp.clean_claim(expected jsonb, desired jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual public.person_claims; nextrow public.person_claims; persisted public.person_claims;
BEGIN SELECT * INTO actual FROM public.person_claims WHERE id=(expected->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLEANUP_BEFORE_DRIFT'; END IF;
 nextrow:=jsonb_populate_record(actual,expected);
 IF to_jsonb(actual) IS DISTINCT FROM to_jsonb(nextrow) THEN RAISE EXCEPTION 'CLEANUP_BEFORE_DRIFT'; END IF;
 nextrow:=jsonb_populate_record(actual,desired);
 IF (to_jsonb(actual)-'claim_value'-'claim_json') IS DISTINCT FROM (to_jsonb(nextrow)-'claim_value'-'claim_json') THEN RAISE EXCEPTION 'CLEANUP_PROTECTED_CHANGE'; END IF;
 UPDATE public.person_claims SET claim_value=nextrow.claim_value,claim_json=nextrow.claim_json WHERE id=actual.id;
 -- Re-read after the UPDATE statement completes: RETURNING alone does not
 -- include subsequent writes made by immediate AFTER triggers. Compare the
 -- whole row, including content, policy, review/public flags and provenance.
 SELECT * INTO persisted FROM public.person_claims WHERE id=actual.id;
 IF NOT FOUND OR to_jsonb(persisted) IS DISTINCT FROM to_jsonb(nextrow) THEN
  RAISE EXCEPTION 'CLEANUP_AFTER_DRIFT';
 END IF;
 IF public.official_profile_claim_allowed(persisted.claim_type,persisted.claim_value,persisted.claim_json,persisted.person_id,persisted.source_url) IS NOT TRUE THEN RAISE EXCEPTION 'CLEANUP_POLICY_REJECTED'; END IF;
END $$;
