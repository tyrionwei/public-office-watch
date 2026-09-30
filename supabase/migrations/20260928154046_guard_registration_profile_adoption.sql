-- Keep reviewed registration-field provenance through imports and invalidate it
-- when its actual parent or candidate identity is held back. Never reapprove it.
BEGIN;
-- The importer may update claims, not write published demographic tables directly.
ALTER FUNCTION public.sync_official_profile_demographics() SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.sync_official_profile_demographics() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_registration_profile_adoption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE parent public.person_claims; candidate public.candidates;
BEGIN
 IF NEW.claim_type NOT IN ('birth_date','education') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.claim_json ? 'registrationProposal'
   AND public.official_profile_claim_allowed(OLD.claim_type,OLD.claim_value,OLD.claim_json,OLD.person_id,OLD.source_url)
   AND ROW(NEW.person_id,NEW.claim_type,NEW.claim_value,NEW.source_url) IS NOT DISTINCT FROM ROW(OLD.person_id,OLD.claim_type,OLD.claim_value,OLD.source_url) THEN
  NEW.candidate_id:=OLD.candidate_id;
  NEW.claim_json:=NEW.claim_json||jsonb_build_object('registrationProposal',OLD.claim_json->'registrationProposal','registrationProfileReview',OLD.claim_json->'registrationProfileReview');
 END IF;
 IF NOT (NEW.claim_json ? 'registrationProposal') THEN RETURN NEW; END IF;
 IF NOT public.official_profile_claim_allowed(NEW.claim_type,NEW.claim_value,NEW.claim_json,NEW.person_id,NEW.source_url) THEN RETURN NEW; END IF;
 SELECT * INTO parent FROM public.person_claims WHERE id=(NEW.claim_json->'registrationProposal'->>'parentClaimId')::uuid;
 SELECT * INTO candidate FROM public.candidates WHERE id=NEW.candidate_id;
 IF parent.id IS NULL OR candidate.id IS NULL OR parent.claim_type<>'candidacy' OR parent.review_status<>'verified'
   OR parent.claim_json->'identityAudit'->>'status' IN ('pending','quarantined')
   OR (parent.candidate_id IS NOT NULL AND parent.candidate_id IS DISTINCT FROM NEW.candidate_id)
   OR candidate.source_url IS DISTINCT FROM NEW.source_url
   OR (SELECT count(*) FROM public.candidates c WHERE c.person_id=NEW.person_id AND c.race_id=candidate.race_id)<>1
   OR jsonb_build_object('id',candidate.id,'person_id',candidate.person_id,'race_id',candidate.race_id,'external_id',candidate.external_id,'candidate_name',candidate.candidate_name,'source_url',candidate.source_url) IS DISTINCT FROM NEW.claim_json->'registrationProfileReview'->'candidateBinding'
   OR parent.person_id IS DISTINCT FROM NEW.person_id OR candidate.person_id IS DISTINCT FROM NEW.person_id
   OR candidate.race_id IS DISTINCT FROM (parent.claim_json->'targetRace'->>'id')::uuid OR NOT candidate.is_public
   OR parent.claim_json->'registrationEvidence' IS DISTINCT FROM NEW.claim_json->'registrationProposal'->'registrationEvidence'
   OR parent.claim_json->'registrationEvidence'->'source'->>'url' IS DISTINCT FROM NEW.source_url THEN
  NEW.claim_json:=jsonb_set(NEW.claim_json,'{officialProfilePolicy}',COALESCE(NEW.claim_json->'officialProfilePolicy','{}')||jsonb_build_object('eligible',false,'reason','registration_identity_or_evidence_changed'));
  NEW.review_status:='pending';NEW.visibility:='private';NEW.is_public:=false;
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.guard_registration_profile_adoption() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS zz_guard_registration_profile ON public.person_claims;
CREATE TRIGGER zz_guard_registration_profile BEFORE INSERT OR UPDATE ON public.person_claims FOR EACH ROW EXECUTE FUNCTION public.guard_registration_profile_adoption();

CREATE OR REPLACE FUNCTION public.hold_changed_registration_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF TG_TABLE_NAME='person_claims' THEN
  IF OLD.claim_type<>'candidacy' OR NOT (OLD.claim_json ? 'registrationEvidence') THEN RETURN NEW; END IF;
  IF ROW(NEW.person_id,NEW.review_status,NEW.claim_json->'registrationEvidence',NEW.claim_json->'targetRace',NEW.claim_json->'identityAudit')
    IS NOT DISTINCT FROM ROW(OLD.person_id,OLD.review_status,OLD.claim_json->'registrationEvidence',OLD.claim_json->'targetRace',OLD.claim_json->'identityAudit') THEN RETURN NEW; END IF;
  UPDATE public.person_claims c SET claim_json=jsonb_set(c.claim_json,'{officialProfilePolicy}',(c.claim_json->'officialProfilePolicy')||jsonb_build_object('eligible',false,'reason','registration_parent_changed')),review_status='pending',visibility='private',is_public=false,updated_at=now()
   WHERE c.claim_json->'registrationProposal'->>'parentClaimId'=NEW.id::text AND c.is_public;
 ELSE
  IF ROW(NEW.person_id,NEW.race_id,NEW.is_public,NEW.external_id,NEW.candidate_name,NEW.source_url) IS NOT DISTINCT FROM ROW(OLD.person_id,OLD.race_id,OLD.is_public,OLD.external_id,OLD.candidate_name,OLD.source_url) THEN RETURN NEW; END IF;
  UPDATE public.person_claims c SET claim_json=jsonb_set(c.claim_json,'{officialProfilePolicy}',(c.claim_json->'officialProfilePolicy')||jsonb_build_object('eligible',false,'reason','registration_candidate_changed')),review_status='pending',visibility='private',is_public=false,updated_at=now()
   WHERE c.candidate_id=NEW.id AND c.claim_json ? 'registrationProposal' AND c.is_public;
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.hold_changed_registration_profiles() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS hold_registration_parent_profiles ON public.person_claims;
CREATE TRIGGER hold_registration_parent_profiles AFTER UPDATE ON public.person_claims FOR EACH ROW EXECUTE FUNCTION public.hold_changed_registration_profiles();
DROP TRIGGER IF EXISTS hold_registration_candidate_profiles ON public.candidates;
CREATE TRIGGER hold_registration_candidate_profiles AFTER UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.hold_changed_registration_profiles();
COMMIT;
