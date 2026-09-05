import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2);assert(args.every(x=>x==='--rehearsal'));
const rehearsal=args.includes('--rehearsal');
const container=rehearsal?'supabase_db_public-office-watch-rehearsal':'supabase_db_public-office-watch';
const base='tmp/cec-registration-identity-review';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const base2='tmp/cec-registration-identity-review-2';
const records=read(base+'/review-manifest.json').records;
const base3='tmp/cec-registration-identity-review-3';
const base4='tmp/cec-registration-identity-review-4';
const base5='tmp/cec-registration-identity-review-5';
const base6='tmp/cec-registration-identity-review-6';
const base7='tmp/cec-registration-identity-review-7';
const base8='tmp/cec-registration-identity-review-8';
const base9='tmp/cec-registration-identity-review-9';
const base10='tmp/cec-registration-identity-review-all';
const records10=read(base10+'/review-manifest.json').records;
const base11='tmp/cec-registration-identity-review-11';
const records11=read(base11+'/review-manifest.json').records;
const base12='tmp/cec-registration-identity-review-12';
const records12=read(base12+'/review-manifest.json').records;
const base13='tmp/cec-registration-identity-review-13';
const records13=read(base13+'/review-manifest.json').records;
const records2=read(base2+'/review-manifest.json').records;
const records3=read(base3+'/review-manifest.json').records;
const records4=read(base4+'/review-manifest.json').records;
const records5=read(base5+'/review-manifest.json').records;
const records6=read(base6+'/review-manifest.json').records;
const records7=read(base7+'/review-manifest.json').records;
const records8=read(base8+'/review-manifest.json').records;
const records9=read(base9+'/review-manifest.json').records;
const laterBases=[14,15,16,17,18,19,20].map(n=>'tmp/cec-registration-identity-review-'+n);
const laterRecords=laterBases.flatMap(b=>read(b+'/review-manifest.json').records);
const accepted=[...records.filter(x=>x.decision!=='pending'),...records2.filter(x=>x.decision!=='pending'),...records3,...records4,...records5,...records6,...records7,...records8,...records9,...records10,...records11,...records12,...records13,...laterRecords];
const targets=new Map([...read(base+'/targets.json'),...read(base2+'/targets.json'),...read(base3+'/targets.json'),...read(base4+'/targets.json'),...read(base5+'/targets.json'),...read(base6+'/targets.json'),...read(base7+'/targets.json'),...read(base8+'/targets.json'),...read(base9+'/targets.json'),...read(base10+'/targets.json'),...read(base11+'/targets.json'),...read(base12+'/targets.json'),...read(base13+'/targets.json'),...laterBases.flatMap(b=>read(b+'/targets.json'))].map(x=>[x.candidateExternalId,x]));
const allClaims=read('tmp/cec-registration-final/import-manifest.json').map(x=>x.claimId);
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const sql=`CREATE TEMP TABLE cohort AS SELECT * FROM jsonb_to_recordset(${q(accepted)}) AS x("candidateId" uuid,"personId" uuid,"raceId" uuid);
SELECT json_build_object('candidates',(SELECT count(*) FROM cohort x JOIN published.candidates c ON c.candidate_id=x."candidateId" AND c.person_id=x."personId" AND c.race_id=x."raceId" AND c.candidacy_status='registered' AND c.registration_status='registered' AND c.election_result='pending' AND c.candidate_no IS NULL),
'people',(SELECT count(*) FROM cohort x JOIN published.people p ON p.person_id=x."personId"),
'events',(SELECT count(*) FROM cohort x JOIN public.candidate_lifecycle_events e ON e.candidate_id=x."candidateId" AND e.is_public AND e.event_type='registration_filed'),
'qualification_events',(SELECT count(*) FROM cohort x JOIN public.candidate_lifecycle_events e ON e.candidate_id=x."candidateId" AND e.event_type IN ('qualification_confirmed','qualification_rejected')),
'private_batch_claims',(SELECT count(*) FROM public.person_claims WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(${q(allClaims)})) AND (is_public OR visibility='public')),
'pending_batch_claims',(SELECT count(*) FROM public.person_claims WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(${q(allClaims)})) AND review_status='pending'),
'pending_reasons',(SELECT count(*) FROM public.person_claims WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(${q(records2.filter(x=>x.decision==='pending').map(x=>x.claimId))})) AND review_status='pending' AND claim_json->'identityReviewRound2'->>'decision'='pending' AND length(claim_json->'identityReviewRound2'->>'reason')>0),
'guo_xi_candidate_position',(SELECT count(*) FROM published.people WHERE person_id='96c49dbf-21a1-467d-8acf-2e5f3b9a933f'::uuid AND position IS NULL AND current_office_label IS NULL AND upcoming_candidate_label='臺北市市長' AND list_status='candidate'));`;
const counts=JSON.parse(execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',maxBuffer:5e6}));
assert.deepEqual(counts,{candidates:678,people:678,events:678,qualification_events:0,private_batch_claims:0,pending_batch_claims:rehearsal?0:916,pending_reasons:rehearsal?0:916,guo_xi_candidate_position:1});
const env=Object.fromEntries(fs.readFileSync(rehearsal?'apps/web/.env.rehearsal.local':'apps/web/.env.local','utf8').split(/\r?\n/).filter(x=>x.includes('=')&&!x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const origin=env.VITE_SUPABASE_URL;assert.equal(new URL(origin).port,rehearsal?'55321':'54321');assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const request=async(method,args)=>{const r=await fetch(origin+'/rest/v1/rpc/'+method,{method:'POST',headers:{apikey:env.VITE_SUPABASE_ANON_KEY,'Content-Type':'application/json','Content-Profile':'published'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});const value=await r.json();assert.equal(r.status,200);return value;};
const byCase=new Map(accepted.map(x=>[x.county+'|'+x.reasonCode,x]));
for(const r of accepted.filter(x=>x.office==='mayor'))byCase.set(r.candidateId,r);
for(const r of [...records9,...records10,...records11,...records12,...records13,...laterRecords])byCase.set(r.candidateId,r);
const privateClaimIds=new Set(allClaims);const samples=[];
for(const x of byCase.values()){
 const profile=(await request('person_profiles_for',{p_person_ids:[x.personId]}))[0].payload;
 assert(profile.candidate_rows.some(c=>c.candidate_id===x.candidateId&&c.race_id===x.raceId&&c.candidacy_status==='registered'));
 assert(profile.claim_rows.every(c=>!privateClaimIds.has(c.claim_id??c.id)),'Private identity evidence leaked');
 const ev=await request('candidate_lifecycle_for',{p_candidate_id:x.candidateId});assert.equal(ev.length,1);assert.equal(ev[0].event_type,'registration_filed');assert.equal(ev[0].occurred_on,targets.get(x.candidateExternalId).prepared.evidence.registration_date??null);
 assert.deepEqual(Object.keys(ev[0]).sort(),['candidate_id','candidate_no','event_type','id','occurred_on','source_name','source_published_on','source_url'].sort());
 samples.push({name:x.name,personId:x.personId,decision:x.decision,reason:x.reasonCode});
}
const result={environment:rehearsal?'rehearsal':'full-local',counts,anonymous_profiles_checked:samples.length,samples};
fs.writeFileSync(laterBases.at(-1)+'/'+result.environment+'-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,samples:undefined},null,2));
