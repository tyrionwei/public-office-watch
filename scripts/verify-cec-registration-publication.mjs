import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const rehearsal=process.argv.includes('--rehearsal');
const container=rehearsal?'supabase_db_public-office-watch-rehearsal':'supabase_db_public-office-watch';
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const manifest=read('tmp/cec-registration-final/import-manifest.json');
const prepared=new Map(read('tmp/cec-registration-final/prepared-import.json').records.map(x=>[x.record.candidateExternalId,x]));
const reconciledPersonIds = new Map([
  ['d230fb3d-2814-4219-9084-7eaed8820a61', '320c38ea-48a7-4cfb-a77b-5842abcda5ac'],
  ['1eef7a03-5e9b-4498-8862-4ca53121993f', '2ec71727-7227-4ee6-a5dc-b16493f0ad27'],
  ['c5d78074-a8d5-44c4-8f8c-713cdd344ff6', 'c1a80678-c645-4bfb-8d93-73423c5f7aaa'],
  ['00533bcc-2617-4e9e-9928-ccd6a3799f7c', '147c1321-53d1-4dd3-89de-7823697c7098'],
]);
const cohort=manifest.filter(x=>x.candidateId).map(x=>{
 const originalPersonId=prepared.get(x.candidateExternalId).decision.personId??x.personId;
 return {...x,canonicalPersonId:reconciledPersonIds.get(originalPersonId)??originalPersonId,raceId:prepared.get(x.candidateExternalId).race.id};
});
const env=Object.fromEntries(fs.readFileSync(rehearsal?'apps/web/.env.rehearsal.local':'apps/web/.env.local','utf8').split(/\r?\n/).filter(x=>x.includes('=')&&!x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const origin=env.VITE_SUPABASE_URL;
assert.equal(new URL(origin).port,rehearsal?'55321':'54321');
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const sql=`CREATE TEMP TABLE cohort AS SELECT * FROM jsonb_to_recordset('${JSON.stringify(cohort).replaceAll("'","''")}'::jsonb) AS x("candidateId" uuid,"canonicalPersonId" uuid,"raceId" uuid);
SELECT json_build_object('candidates',(SELECT count(*) FROM cohort x JOIN published.candidates c ON c.candidate_id=x."candidateId" AND c.person_id=x."canonicalPersonId" AND c.race_id=x."raceId" AND c.candidacy_status='registered' AND c.registration_status='registered' AND c.election_result='pending' AND c.candidate_no IS NULL),
'people',(SELECT count(*) FROM cohort x JOIN published.people p ON p.person_id=x."canonicalPersonId"),
'events',(SELECT count(*) FROM cohort x JOIN public.candidate_lifecycle_events e ON e.candidate_id=x."candidateId" AND e.is_public AND e.event_type='registration_filed'),
'qualification_events',(SELECT count(*) FROM cohort x JOIN public.candidate_lifecycle_events e ON e.candidate_id=x."candidateId" AND e.event_type IN ('qualification_confirmed','qualification_rejected')));`;
const counts=JSON.parse(execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',maxBuffer:10e6}));
assert.deepEqual(counts,{candidates:16822,people:16822,events:16822,qualification_events:0});
const request=async(method,args)=>{
 const response=await fetch(origin+'/rest/v1/rpc/'+method,{method:'POST',headers:{apikey:env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json','Content-Profile':'published'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});
 const payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));return payload;
};
const oldIds=new Set(read('tmp/cec-registration-final/before-candidates.json').map(x=>x.id));
const samples=[...new Map(cohort.filter(x=>!oldIds.has(x.candidateId)).map(x=>[x.county,x])).values()];
const special=cohort.find(x=>prepared.get(x.candidateExternalId).race.external_id.startsWith('pow-cec-registration-2026-race-'));
samples.push(special,cohort.find(x=>x.candidateId==='96bffef8-142b-416b-ac7f-4eb6399922cb'));
const report={environment:rehearsal?'rehearsal':'full-local',counts,samples:[]};
const batchClaimIds=new Set(manifest.map(x=>x.claimId));
for(const sample of samples){
 const profile=(await request('person_profiles_for',{p_person_ids:[sample.canonicalPersonId]}))[0].payload;
 assert.ok(profile.person_rows.some(x=>x.person_id===sample.canonicalPersonId));
 assert.ok(profile.candidate_rows.some(x=>x.candidate_id===sample.candidateId&&x.candidacy_status==='registered'));
 assert.ok(profile.claim_rows.every(x=>!batchClaimIds.has(x.claim_id??x.id)), 'Private registration evidence leaked into profile');
 const events=await request('candidate_lifecycle_for',{p_candidate_id:sample.candidateId});
 assert.equal(events.length,1);assert.equal(events[0].event_type,'registration_filed');
 assert.equal(events[0].occurred_on,prepared.get(sample.candidateExternalId).evidence.registration_date??null);
 assert.deepEqual(Object.keys(events[0]).sort(),['candidate_id','candidate_no','event_type','id','occurred_on','source_name','source_published_on','source_url'].sort());
 report.samples.push({county:sample.county,name:sample.name,personId:sample.canonicalPersonId,candidateId:sample.candidateId});
}
const race=(await request('race_page_for',{p_race_id:special.raceId}))[0].payload;
assert.equal(race.race_row.race_id,special.raceId);
assert.ok(race.candidate_rows.some(x=>x.candidate_id===special.candidateId));
report.new_village_race={id:special.raceId,title:race.race_row.title,candidate_count:race.candidate_rows.length};
report.private_evidence_blocked=true;
fs.mkdirSync('tmp/cec-registration-publication',{recursive:true});
fs.writeFileSync('tmp/cec-registration-publication/'+report.environment+'-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({environment:report.environment,counts,anonymous_profiles_checked:samples.length,new_village_race:report.new_village_race,private_evidence_blocked:true},null,2));
