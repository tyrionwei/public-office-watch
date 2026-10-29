-- Session-local guarded cleanup; no payloads or automatic adoption.
-- Execute only through the approved review transaction with exact before/after inputs.
CREATE FUNCTION pg_temp.clean_claim(expected jsonb, desired jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual public.person_claims; nextrow public.person_claims;
BEGIN SELECT * INTO actual FROM public.person_claims WHERE id=(expected->>'id')::uuid FOR UPDATE;
 nextrow:=jsonb_populate_record(actual,expected);
 IF to_jsonb(actual) IS DISTINCT FROM to_jsonb(nextrow) THEN RAISE EXCEPTION 'CLEANUP_BEFORE_DRIFT'; END IF;
 nextrow:=jsonb_populate_record(actual,desired);
 IF (to_jsonb(actual)-'claim_value'-'claim_json') IS DISTINCT FROM (to_jsonb(nextrow)-'claim_value'-'claim_json') THEN RAISE EXCEPTION 'CLEANUP_PROTECTED_CHANGE'; END IF;
 UPDATE public.person_claims SET claim_value=nextrow.claim_value,claim_json=nextrow.claim_json WHERE id=actual.id;
 IF NOT public.official_profile_claim_allowed(nextrow.claim_type,nextrow.claim_value,nextrow.claim_json,nextrow.person_id,nextrow.source_url) THEN RAISE EXCEPTION 'CLEANUP_POLICY_REJECTED'; END IF;
END $$;
