-- Follow-up to the already-applied local adoption guard; do not rewrite its ledger.
-- Invalidate only the reviewed profile children of the changed/deleted parent.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.hold_changed_registration_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
BEGIN
 IF TG_TABLE_NAME = 'person_claims' THEN
  IF OLD.claim_type <> 'candidacy' OR NOT (OLD.claim_json ? 'registrationEvidence') THEN
   RETURN NULL;
  END IF;

  -- NEW is unavailable on DELETE. Even when only a binding changes, the
  -- previous field approval must not silently follow the new parent identity.
  IF TG_OP = 'UPDATE' THEN
   IF ROW(NEW.person_id, NEW.candidate_id, NEW.claim_type, NEW.review_status, NEW.source_url,
          NEW.claim_json->'registrationEvidence', NEW.claim_json->'targetRace', NEW.claim_json->'identityAudit')
     IS NOT DISTINCT FROM
      ROW(OLD.person_id, OLD.candidate_id, OLD.claim_type, OLD.review_status, OLD.source_url,
          OLD.claim_json->'registrationEvidence', OLD.claim_json->'targetRace', OLD.claim_json->'identityAudit') THEN
    RETURN NULL;
   END IF;
  END IF;

  UPDATE public.person_claims c
  SET claim_json = jsonb_set(COALESCE(c.claim_json, '{}'::jsonb), '{officialProfilePolicy}',
        COALESCE(c.claim_json->'officialProfilePolicy', '{}'::jsonb)
        || jsonb_build_object('eligible', false, 'reason',
             CASE WHEN TG_OP = 'DELETE' THEN 'registration_parent_deleted' ELSE 'registration_parent_changed' END)),
      review_status = 'pending', visibility = 'private', is_public = false, updated_at = now()
  WHERE c.claim_type IN ('birth_date', 'education')
    AND c.claim_json->'registrationProposal'->>'parentClaimId' = OLD.id::text
    AND c.is_public;
 ELSE
  -- Preserve the existing candidate-change guard and its adoption boundaries.
  IF ROW(NEW.person_id, NEW.race_id, NEW.is_public, NEW.external_id, NEW.candidate_name, NEW.source_url)
    IS NOT DISTINCT FROM
     ROW(OLD.person_id, OLD.race_id, OLD.is_public, OLD.external_id, OLD.candidate_name, OLD.source_url) THEN
   RETURN NULL;
  END IF;
  UPDATE public.person_claims c
  SET claim_json = jsonb_set(COALESCE(c.claim_json, '{}'::jsonb), '{officialProfilePolicy}',
        COALESCE(c.claim_json->'officialProfilePolicy', '{}'::jsonb)
        || jsonb_build_object('eligible', false, 'reason', 'registration_candidate_changed')),
      review_status = 'pending', visibility = 'private', is_public = false, updated_at = now()
  WHERE c.candidate_id = NEW.id
    AND c.claim_json ? 'registrationProposal'
    AND c.is_public;
 END IF;
 -- AFTER triggers do not replace or cancel the source row operation.
 RETURN NULL;
END $f$;
REVOKE ALL ON FUNCTION public.hold_changed_registration_profiles() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS hold_registration_parent_profiles ON public.person_claims;
CREATE TRIGGER hold_registration_parent_profiles
AFTER UPDATE OR DELETE ON public.person_claims
FOR EACH ROW EXECUTE FUNCTION public.hold_changed_registration_profiles();

COMMIT;
