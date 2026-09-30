import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildRegistrationProfileProposals} from './lib/registration-profile-evidence.mjs';
import {profileBinding,datePrecision,OFFICIAL_PROFILE_VERSION} from './lib/official-profile-policy.mjs';
const [base,originalDirectory]=process.argv.slice(2);
assert(base&&originalDirectory,'Usage: node scripts/prepare-registration-profile-backfill.mjs <private-review-directory> <official-original-directory>');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const snap=read(base+'/registration-before.json');
const parents=new Map(snap.claims.map(c=>[c.id,c])),canon=new Map(snap.canonical.map(r=>[r.person_id,r.canonical_person_id])),profiles=new Map(snap.profiles.map(p=>[p.person_id,p]));
const contents=read(base+'/registration-content-review.json');
const decisions=read(base+'/registration-identity-review.json');
assert.equal(new Set(contents.map(r=>r.parent_claim_id+'|'+r.field)).size,contents.length,'Duplicate content decisions');
assert.equal(new Set(decisions.map(r=>r.parent_claim_id)).size,decisions.length,'Duplicate identity decisions');
const cohort=snap.claims.filter(c=>contents.some(r=>r.parent_claim_id===c.id));
const records=[],audit=[],hashes=new Map();
for(const c of cohort){
 const parent=parents.get(c.id),e=parent.claim_json.registrationEvidence,pid=canon.get(c.person_id)??c.person_id;
 const file=path.resolve(originalDirectory,e.source.file);
 assert.equal(path.dirname(file),path.resolve(originalDirectory));
 if(!hashes.has(file))hashes.set(file,createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
 assert.equal(hashes.get(file),e.source.sha256,'Official original hash changed');
 const candidates=snap.candidates.filter(a=>a.person_id===parent.person_id&&a.race_id===parent.claim_json.targetRace.id);
 const candidate=candidates.length===1&&candidates[0].source_url===parent.source_url&&(!parent.candidate_id||parent.candidate_id===candidates[0].id)?candidates[0]:null;
 const candidateBinding=candidate?Object.fromEntries(['id','person_id','race_id','external_id','candidate_name','source_url'].map(k=>[k,candidate[k]])):null;
 const identity=decisions.find(d=>d.parent_claim_id===parent.id);
 const parseParent=structuredClone(parent);
 for(const proof of contents.filter(p=>p.parent_claim_id===parent.id&&p.correctedRaw)){
  if(proof.field==='birth_date'){parseParent.claim_json.registrationEvidence.birth_date_raw=proof.correctedRaw;parseParent.claim_json.registrationEvidence.raw['出生年月日']=proof.correctedRaw;}
 }
 const proposals=buildRegistrationProfileProposals(parseParent);
 for(const p of proposals){
  const proof=contents.find(r=>r.parent_claim_id===parent.id&&r.field===p.claimType);
  const before=profiles.get(pid)?.[p.claimType==='birth_date'?'birth_value':'education']??null;
  const conflict=p.claimType==='birth_date'&&before&&!p.claimValue.startsWith(before)&&!before.startsWith(p.claimValue);
  const retained=before&&(p.claimType==='education'||!conflict&&before.length>=p.claimValue.length);
  const reason=retained?'保留既有有效官方值':conflict?'與既有官方出生資料實質衝突':!candidate?'既有候選關聯不唯一':parent.review_status!=='verified'?'登記身分目前待審':!candidate.is_public?'候選目前隔離或不公開':!proof?.verified?'官方原件欄位待核對':!identity?.verified?identity?.reason??'身分證據待確認':'官方原件欄位與既有有效身分審核一致';
  const decision=retained?'retain':!conflict&&parent.review_status==='verified'&&candidate?.is_public&&proof?.verified&&identity?.verified?'adopt':'pending';
  const json={...p.claimJson,registrationProposal:{...p.claimJson.registrationProposal,registrationEvidence:e,rawValue:proof?.raw??p.claimJson.registrationProposal.rawValue,parsedRawValue:proof?.correctedRaw??proof?.raw,candidateId:candidate?.id??null},registrationProfileReview:{version:'registration-profile-backfill-v1',candidateBinding,reason,content:proof,identity,reviewedAt:identity?.reviewedAt??null}};
  const claim={claim_key:p.claimKey,person_id:parent.person_id,source_person_id:parent.source_person_id,candidate_id:candidate?.id,claim_type:p.claimType,claim_value:p.claimValue,claim_json:json,confidence_level:'B',review_status:decision==='adopt'?'verified':'pending',visibility:decision==='adopt'?'public':'private',is_public:decision==='adopt',source_name:p.sourceName,source_url:p.sourceUrl,observed_at:p.observedAt,scoring_version:'registration-profile-backfill-v1',scoring_reasons:[{reason}]};
  if(decision==='adopt')claim.claim_json.officialProfilePolicy={version:OFFICIAL_PROFILE_VERSION,eligible:true,identityVerified:true,contentVerified:true,binding:profileBinding(claim),datePrecision:p.claimType==='birth_date'?datePrecision(p.claimValue):null,evidenceMethod:'reviewed_registration_original_field',sourceUrl:p.sourceUrl,reviewBasis:reason,archivedEvidence:{path:'tmp/cec-registration-final/'+e.source.file,sha256:e.source.sha256},parentClaimId:parent.id};
  audit.push({name:e.name,person_id:parent.person_id,canonical_person_id:pid,candidate_id:candidate?.id,field:p.claimType,before_value:before,after_value:decision==='adopt'?p.claimValue:before,proposed_value:p.claimValue,raw_value:proof?.raw,date_precision:p.claimType==='birth_date'?datePrecision(p.claimValue):null,official_source:p.sourceUrl,file:e.source.file,page:e.source.page,row:e.source.row,result:decision,reason,parent_claim_id:parent.id,claim_key:claim.claim_key});
  if(decision!=='retain'&&candidate)records.push({claim,parent,candidate,canonicalPersonId:pid,beforeValue:before,decision,contentReview:proof,identityReview:identity});
 }
}
fs.writeFileSync(base+'/registration-profile-decisions.json',JSON.stringify({version:'registration-profile-backfill-v1',records},null,2));
fs.writeFileSync(base+'/registration-profile-audit.json',JSON.stringify(audit,null,2));
console.log(JSON.stringify({records:records.length,counts:audit.reduce((o,r)=>(o[r.field+':'+r.result]=(o[r.field+':'+r.result]??0)+1,o),{})}));
