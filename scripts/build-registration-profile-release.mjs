import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {acceptedOfficialProfileClaim} from './lib/official-profile-policy.mjs';

// Offline only. Explicit, field-reviewed decisions are the privileged adoption
// input; registration verification and import payloads never grant approval.
export function buildRegistrationProfileRelease(manifest){
 assert.equal(manifest.version,'registration-profile-backfill-v1');
 assert(manifest.records.length>0);
 const keys=new Set();
 for(const r of manifest.records){
  const c=r.claim;assert(['birth_date','education'].includes(c.claim_type));
  assert(!keys.has(c.claim_key));keys.add(c.claim_key);
  assert.equal(c.person_id,r.parent.person_id);
  assert.equal(c.source_url,r.parent.claim_json.registrationEvidence.source.url);
  assert.equal(c.candidate_id,r.candidate.id);
  assert.equal(r.candidate.person_id,r.parent.person_id);
  assert.equal(r.candidate.race_id,r.parent.claim_json.targetRace.id);
  assert.equal(r.candidate.source_url,r.parent.source_url);
  if(r.parent.candidate_id)assert.equal(r.parent.candidate_id,r.candidate.id);
  assert.deepEqual(c.claim_json.registrationProfileReview.candidateBinding,Object.fromEntries(['id','person_id','race_id','external_id','candidate_name','source_url'].map(k=>[k,r.candidate[k]])));
  assert.equal(c.claim_json.registrationProposal.parentClaimId,r.parent.id);
  if(r.decision==='adopt'){
   assert.equal(r.contentReview.verified,true);assert.equal(r.identityReview.verified,true);
   assert.equal(r.candidate.is_public,true);assert.equal(r.parent.review_status,'verified');
   assert(acceptedOfficialProfileClaim(c));assert.equal(c.review_status,'verified');assert.equal(c.is_public,true);assert.equal(c.visibility,'public');
  }else{assert.equal(c.is_public,false);assert.equal(c.review_status,'pending');}
 }
 const json=JSON.stringify(manifest.records).replaceAll("'","''");
 return `-- Generated from a locally reviewed registration-profile decision manifest.\n-- Apply only after reconciling this exact parent/candidate/canonical baseline.\nBEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='300s';
SELECT pg_advisory_xact_lock(hashtextextended('pow:registration-profile-backfill',0));
CREATE TEMP TABLE registration_profile_batch AS SELECT value r FROM jsonb_array_elements('${json}'::jsonb);
DO $guard$ BEGIN
 IF to_regprocedure('public.guard_registration_profile_adoption()') IS NULL THEN RAISE EXCEPTION 'Registration adoption guard migration required'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b LEFT JOIN public.person_claims p ON p.id=(b.r->'parent'->>'id')::uuid WHERE to_jsonb(p) IS DISTINCT FROM b.r->'parent') THEN RAISE EXCEPTION 'Registration evidence or review changed'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b LEFT JOIN public.candidates c ON c.id=(b.r->'candidate'->>'id')::uuid WHERE to_jsonb(c) IS DISTINCT FROM b.r->'candidate') THEN RAISE EXCEPTION 'Candidate identity or visibility changed'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b WHERE (SELECT count(*) FROM public.candidates c WHERE c.person_id=(b.r->'parent'->>'person_id')::uuid AND c.race_id=(b.r->'candidate'->>'race_id')::uuid)<>1) THEN RAISE EXCEPTION 'Candidate binding is no longer unique'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b LEFT JOIN public.person_canonical_map m ON m.person_id=(b.r->'claim'->>'person_id')::uuid WHERE m.canonical_person_id IS DISTINCT FROM (b.r->>'canonicalPersonId')::uuid) THEN RAISE EXCEPTION 'Canonical mapping changed'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b JOIN public.person_claims c ON c.claim_key=b.r->'claim'->>'claim_key' WHERE ROW(c.person_id,c.claim_type,c.claim_value,c.source_url,c.candidate_id) IS DISTINCT FROM ROW((b.r->'claim'->>'person_id')::uuid,b.r->'claim'->>'claim_type',b.r->'claim'->>'claim_value',b.r->'claim'->>'source_url',(b.r->'claim'->>'candidate_id')::uuid)) THEN RAISE EXCEPTION 'Existing profile claim changed'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b JOIN public.person_claims c ON c.claim_key=b.r->'claim'->>'claim_key' WHERE b.r->>'decision'='adopt' AND c.review_status='pending' AND (c.claim_json ? 'manualReview' OR c.claim_json ? 'publicationGate' OR c.claim_json->'registrationProposal'->>'parentClaimId' IS DISTINCT FROM b.r->'parent'->>'id' OR (c.claim_json ? 'registrationProfileReview' AND c.claim_json->'registrationProfileReview' IS DISTINCT FROM b.r->'claim'->'claim_json'->'registrationProfileReview'))) THEN RAISE EXCEPTION 'Existing pending field has a different review'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b LEFT JOIN public.official_profile_values v ON v.person_id=(b.r->>'canonicalPersonId')::uuid WHERE b.r->>'decision'='adopt' AND NOT EXISTS(SELECT 1 FROM public.person_claims c WHERE c.claim_key=b.r->'claim'->>'claim_key' AND c.review_status='verified' AND c.is_public AND public.official_profile_claim_allowed(c.claim_type,c.claim_value,c.claim_json,c.person_id,c.source_url)) AND (CASE WHEN b.r->'claim'->>'claim_type'='birth_date' THEN v.birth_value ELSE v.education END) IS DISTINCT FROM (b.r->>'beforeValue')) THEN RAISE EXCEPTION 'Adopted official value changed'; END IF;
END $guard$;
INSERT INTO public.person_claims(claim_key,person_id,source_person_id,candidate_id,claim_type,claim_value,claim_json,confidence_level,review_status,visibility,source_name,source_url,observed_at,is_public,scoring_version,scoring_reasons)
SELECT c.claim_key,c.person_id,c.source_person_id,c.candidate_id,c.claim_type,c.claim_value,c.claim_json,c.confidence_level,c.review_status,c.visibility,c.source_name,c.source_url,c.observed_at,c.is_public,c.scoring_version,c.scoring_reasons
FROM registration_profile_batch b CROSS JOIN LATERAL jsonb_populate_record(NULL::public.person_claims,b.r->'claim') c
ON CONFLICT(claim_key) DO UPDATE SET claim_json=EXCLUDED.claim_json,review_status=EXCLUDED.review_status,visibility=EXCLUDED.visibility,is_public=EXCLUDED.is_public,scoring_version=EXCLUDED.scoring_version,scoring_reasons=EXCLUDED.scoring_reasons,updated_at=now()
WHERE EXCLUDED.review_status='verified' AND public.person_claims.review_status='pending' AND NOT public.person_claims.is_public AND public.person_claims.claim_json->'identityAudit' IS NULL;
DO $verify$ BEGIN
 IF EXISTS(SELECT 1 FROM registration_profile_batch b JOIN public.person_claims c ON c.claim_key=b.r->'claim'->>'claim_key' WHERE b.r->>'decision'='adopt' AND (NOT public.official_profile_claim_allowed(c.claim_type,c.claim_value,c.claim_json,c.person_id,c.source_url) OR c.review_status<>'verified' OR NOT c.is_public OR c.visibility<>'public')) THEN RAISE EXCEPTION 'Profile adoption failed'; END IF;
 IF EXISTS(SELECT 1 FROM registration_profile_batch b JOIN public.person_claims c ON c.claim_key=b.r->'claim'->>'claim_key' WHERE b.r->>'decision'<>'adopt' AND c.is_public) THEN RAISE EXCEPTION 'Pending field became public'; END IF;
END $verify$;
REFRESH MATERIALIZED VIEW published.people_directory_snapshot;
COMMIT;\n`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [input,output]=process.argv.slice(2);assert(input&&output,'Usage: node scripts/build-registration-profile-release.mjs decisions.json output.sql');
 fs.writeFileSync(output,buildRegistrationProfileRelease(JSON.parse(fs.readFileSync(input,'utf8'))));
 console.log('Created reviewed registration profile SQL; no database connection made.');
}
