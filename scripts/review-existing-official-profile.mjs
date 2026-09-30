import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewExistingOfficialClaim,profileBinding,OFFICIAL_PROFILE_VERSION,officialHost,datePrecision} from './lib/official-profile-policy.mjs';
// Offline migration inventory only. This does not approve new incoming claims or write a DB.
const [snapshotPath,claimsPath,seedDir,outputPath,manualReviewPath]=process.argv.slice(2);
if(!outputPath)throw new Error('Usage: node scripts/review-existing-official-profile.mjs snapshot.json claims.json seed-directory output.json');
const snapshot=JSON.parse(fs.readFileSync(snapshotPath));
const claims=JSON.parse(fs.readFileSync(claimsPath));
const provenance=new Map();
for(const name of fs.readdirSync(seedDir).filter(n=>n.endsWith('.json')&&!/votetw|wikidata/.test(n))){
 const file=path.join(seedDir,name),raw=fs.readFileSync(file),seed=JSON.parse(raw),sha256=createHash('sha256').update(raw).digest('hex');
 for(const c of seed.personClaims??[]) if(c.claimKey)provenance.set(c.claimKey,{...c,path:'data-sources/'+name,sha256});
}
const context={canonical:new Map(snapshot.canonical.map(x=>[x.person_id,x.canonical_person_id])),candidates:new Map(snapshot.candidates.map(x=>[x.id,x])),sources:new Map(snapshot.sources.map(x=>[x.id,x])),people:new Map(snapshot.people.map(x=>[x.id,x])),provenance};
const decisions=claims.map(c=>({id:c.id,personId:c.person_id,type:c.claim_type,value:c.claim_value,sourceUrl:c.source_url,policy:reviewExistingOfficialClaim(c,context)}));
if(manualReviewPath){
 for(const review of JSON.parse(fs.readFileSync(manualReviewPath))){
  const c=claims.find(c=>c.id===review.id),d=decisions.find(d=>d.id===review.id);
  if(!c||!officialHost(c.source_url)||c.person_id!==review.personId||c.claim_value!==review.value||c.source_url!==review.sourceUrl)throw new Error('manual evidence binding differs');
  if(createHash('sha256').update(fs.readFileSync(review.evidencePath)).digest('hex')!==review.sha256)throw new Error('official document hash differs');
  d.policy={version:OFFICIAL_PROFILE_VERSION,eligible:true,identityVerified:true,contentVerified:true,binding:profileBinding(c),datePrecision:datePrecision(c.claim_value),evidenceMethod:'manual_official_bulletin_visual_review_20260928',sourceUrl:c.source_url,sourceDocument:{sha256:review.sha256,page:review.page,candidateNo:review.candidateNo},reviewBasis:review.review};
 }
}
fs.writeFileSync(outputPath,JSON.stringify(decisions,null,2)+'\n');
const counts={};for(const d of decisions){const key=d.type+':'+(d.policy.evidenceMethod??d.policy.reason);counts[key]=(counts[key]??0)+1;}console.log(JSON.stringify(counts,null,2));
