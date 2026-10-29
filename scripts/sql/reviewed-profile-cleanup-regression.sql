-- Run ONLY in the dedicated disposable integration database with native
-- profile/registration guards and at least one race. All fixtures roll back.
-- Run: psql -X -v ON_ERROR_STOP=1 -d pow_combined_release_20261029
--      -f scripts/sql/reviewed-profile-cleanup-regression.sql
-- Requires existing service_role grants and the original profile/registration
-- migrations. Do not grant extra privileges or disable guards to run this test.
\set fixed true
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'pow_combined_release_20261029' THEN
  RAISE EXCEPTION 'Dedicated isolation database required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.races) THEN RAISE EXCEPTION 'Race fixture missing'; END IF;
END $$;
\ir reviewed-profile-cleanup.sql

CREATE FUNCTION pg_temp.cleanup_fixture(k text, pub boolean, registration boolean)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE pid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); parentid uuid:=gen_random_uuid();
 childid uuid:=gen_random_uuid(); rid uuid; url text:='https://www.gov.tw/cleanup-synthetic';
 policy jsonb; evidence jsonb; binding jsonb;
BEGIN
 INSERT INTO public.people(id,name,is_public) VALUES(pid,'Synthetic cleanup regression',true);
 policy:=jsonb_build_object('version','official-profile-v1','eligible',true,'identityVerified',true,
 'contentVerified',true,'binding',md5(pid::text||'|education|original footer|'||url));
 IF registration THEN
  SELECT id INTO STRICT rid FROM public.races ORDER BY id LIMIT 1;
  INSERT INTO public.candidates(id,person_id,race_id,candidate_name,source_url,is_public)
   VALUES(cid,pid,rid,'Synthetic cleanup regression',url,true);
  evidence:=jsonb_build_object('source',jsonb_build_object('url',url));
  SELECT jsonb_build_object('id',c.id,'person_id',c.person_id,'race_id',c.race_id,
   'external_id',c.external_id,'candidate_name',c.candidate_name,'source_url',c.source_url)
   INTO binding FROM public.candidates c WHERE id=cid;
  INSERT INTO public.person_claims(id,claim_key,person_id,candidate_id,claim_type,review_status,claim_json)
   VALUES(parentid,k||'-parent',pid,cid,'candidacy','verified',
    jsonb_build_object('registrationEvidence',evidence,'targetRace',jsonb_build_object('id',rid)));
 END IF;
 INSERT INTO public.person_claims(id,claim_key,person_id,candidate_id,claim_type,claim_value,
  source_url,review_status,visibility,is_public,claim_json)
 VALUES(childid,k,pid,CASE WHEN registration THEN cid END,'education','original footer',url,
 'verified',CASE WHEN pub THEN 'public' ELSE 'private' END,pub,
 jsonb_build_object('officialProfilePolicy',policy)||CASE WHEN registration THEN
 jsonb_build_object('registrationProposal',jsonb_build_object('parentClaimId',parentid,'registrationEvidence',evidence),
 'registrationProfileReview',jsonb_build_object('candidateBinding',binding)) ELSE '{}'::jsonb END);
 IF NOT (SELECT public.official_profile_claim_allowed(claim_type,claim_value,claim_json,person_id,source_url)
  FROM public.person_claims WHERE id=childid) THEN RAISE EXCEPTION 'Fixture policy invalid'; END IF;
 IF registration THEN
  UPDATE public.person_claims SET review_status='pending' WHERE id=parentid;
  IF (SELECT review_status FROM public.person_claims WHERE id=childid)<>'verified' THEN
   RAISE EXCEPTION 'Private child unexpectedly changed with parent'; END IF;
 END IF;
 RETURN childid;
END $$;
SELECT pg_temp.cleanup_fixture('cleanup-p2-service',true,false);
SELECT pg_temp.cleanup_fixture('cleanup-p2-parent',false,true);
SELECT pg_temp.cleanup_fixture('cleanup-p2-public-success',true,false);
SELECT pg_temp.cleanup_fixture('cleanup-p2-private-success',false,false);

CREATE FUNCTION pg_temp.check_cleanup(k text, negative boolean, fixed boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE oldrow jsonb; wanted jsonb; got jsonb; person_before jsonb; person_after jsonb;
 rejected boolean:=false;
BEGIN
 SELECT to_jsonb(c) INTO STRICT oldrow FROM public.person_claims c WHERE claim_key=k;
 SELECT to_jsonb(p) INTO STRICT person_before FROM public.people p WHERE id=(oldrow->>'person_id')::uuid;
 wanted:=jsonb_set(oldrow,'{claim_value}','"cleaned"');
 wanted:=jsonb_set(wanted,'{claim_json,officialProfilePolicy,binding}',
  to_jsonb(md5((oldrow->>'person_id')||'|education|cleaned|'||(oldrow->>'source_url'))));
 BEGIN
  PERFORM pg_temp.clean_claim(oldrow,wanted);
  SELECT to_jsonb(c) INTO got FROM public.person_claims c WHERE id=(oldrow->>'id')::uuid;
  IF negative THEN
   IF fixed THEN RAISE EXCEPTION 'BUG: trigger rewrite returned success'; END IF;
   IF got->>'review_status'<>'pending' OR got->>'visibility'<>'private' OR (got->>'is_public')::boolean
    OR public.official_profile_claim_allowed(got->>'claim_type',got->>'claim_value',got->'claim_json',
      (got->>'person_id')::uuid,got->>'source_url') THEN RAISE EXCEPTION 'Reported rewrite not reproduced'; END IF;
   RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Observed old bug; roll back test update';
  ELSE
   IF got IS DISTINCT FROM wanted OR NOT public.official_profile_claim_allowed(got->>'claim_type',got->>'claim_value',
      got->'claim_json',(got->>'person_id')::uuid,got->>'source_url') THEN RAISE EXCEPTION 'Success result differs'; END IF;
   IF (oldrow->>'is_public')::boolean AND (SELECT education FROM public.people WHERE id=(oldrow->>'person_id')::uuid)<>'cleaned' THEN
    RAISE EXCEPTION 'Public projection not updated'; END IF;
   RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Success checked; roll back test update';
  END IF;
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 WHEN raise_exception THEN
  IF NOT (negative AND fixed AND SQLERRM='CLEANUP_AFTER_DRIFT') THEN RAISE; END IF;
  rejected:=true;
 END;
 IF negative AND fixed AND NOT rejected THEN RAISE EXCEPTION 'Expected rejection absent'; END IF;
 SELECT to_jsonb(c) INTO got FROM public.person_claims c WHERE id=(oldrow->>'id')::uuid;
 SELECT to_jsonb(p) INTO person_after FROM public.people p WHERE id=(oldrow->>'person_id')::uuid;
 IF got IS DISTINCT FROM oldrow OR person_after IS DISTINCT FROM person_before THEN
  RAISE EXCEPTION 'Partial write survived exception rollback'; END IF;
END $$;
SET LOCAL ROLE service_role;
SELECT pg_temp.check_cleanup('cleanup-p2-service',true, :fixed);
RESET ROLE;
SELECT pg_temp.check_cleanup('cleanup-p2-parent',true, :fixed);
SELECT pg_temp.check_cleanup('cleanup-p2-public-success',false, :fixed);
SELECT pg_temp.check_cleanup('cleanup-p2-private-success',false, :fixed);
-- Immediate AFTER trigger writes are absent from UPDATE RETURNING. This
-- transaction-local test trigger changes only a synthetic fixture's provenance;
-- all existing guards remain installed and enabled.
\if :fixed
SELECT pg_temp.cleanup_fixture('cleanup-p2-after',false,false);
CREATE FUNCTION pg_temp.rewrite_cleanup_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.claim_key='cleanup-p2-after' AND pg_trigger_depth()=1 THEN
  UPDATE public.person_claims SET source_name='unexpected trigger rewrite' WHERE id=NEW.id;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER cleanup_regression_after AFTER UPDATE ON public.person_claims
 FOR EACH ROW EXECUTE FUNCTION pg_temp.rewrite_cleanup_fixture();
SELECT pg_temp.check_cleanup('cleanup-p2-after',true,true);
\endif
ROLLBACK;
