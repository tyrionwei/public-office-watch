import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRegistrationProfileRelease} from './build-registration-profile-release.mjs';
import {profileBinding} from './lib/official-profile-policy.mjs';
function fixture(){
 const person='00000000-0000-4000-8000-000000000001',cid='00000000-0000-4000-8000-000000000002',rid='00000000-0000-4000-8000-000000000003',parentId='00000000-0000-4000-8000-000000000004';
 const url='https://web.cec.gov.tw/api/file/example.pdf';
 const candidate={id:cid,person_id:person,race_id:rid,external_id:'registration:1',candidate_name:'測試',source_url:url,is_public:true};
 const parent={id:parentId,person_id:person,review_status:'verified',source_url:url,claim_json:{targetRace:{id:rid},registrationEvidence:{source:{url}}}};
 const c={claim_key:'registration-profile:fixture:birth_date',person_id:person,candidate_id:cid,claim_type:'birth_date',claim_value:'1960',source_url:url,is_public:true,review_status:'verified',visibility:'public',claim_json:{registrationProposal:{parentClaimId:parentId},registrationProfileReview:{candidateBinding:Object.fromEntries(['id','person_id','race_id','external_id','candidate_name','source_url'].map(k=>[k,candidate[k]]))}}};
 c.claim_json.officialProfilePolicy={version:'official-profile-v1',eligible:true,identityVerified:true,contentVerified:true,binding:profileBinding(c),datePrecision:'year'};
 return {version:'registration-profile-backfill-v1',records:[{claim:c,parent,candidate,canonicalPersonId:person,beforeValue:null,decision:'adopt',contentReview:{verified:true},identityReview:{verified:true}}]};
}
test('release requires independent field review and exact candidate provenance',()=>{
 const m=fixture();assert.match(buildRegistrationProfileRelease(m),/Registration evidence or review changed/);
 for(const edit of [r=>r.contentReview.verified=false,r=>r.identityReview.verified=false,r=>r.parent.review_status='pending',r=>r.candidate.is_public=false,r=>r.candidate.source_url='https://web.cec.gov.tw/other',r=>r.parent.candidate_id='different',r=>r.claim.claim_json.officialProfilePolicy.datePrecision='day']){
  const changed=fixture();edit(changed.records[0]);assert.throws(()=>buildRegistrationProfileRelease(changed));
 }
});
test('duplicate keys are rejected and SQL keeps reviewed conflicts guarded',()=>{
 const m=fixture();m.records.push(structuredClone(m.records[0]));assert.throws(()=>buildRegistrationProfileRelease(m));
 const sql=buildRegistrationProfileRelease(fixture());
 assert.match(sql,/Existing pending field has a different review/);
 assert.match(sql,/Candidate binding is no longer unique/);
 assert.match(sql,/ON CONFLICT\(claim_key\) DO UPDATE/);
});
