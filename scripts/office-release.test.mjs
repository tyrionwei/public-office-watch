import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDraft, buildRelease, snapshotOn } from './office-release.mjs';
const source = () => ({complete:true,family:'legislator',people:[{person_id:'p1',terms:[{candidate_id:'c1',race_id:'r1',family:'legislator',race_type:'legislator',starts_on:'2024-02-01',ends_on:'2028-02-01',source_url:'https://example.test/election',source_version:'v1'}]}]});
const baseline = () => ({schemaVersion:1,candidacyContextVersion:1,releaseId:'r',officeRevision:3,people:[{personId:'p1',fingerprint:'fingerprint',officeSnapshot:{list_status:'candidate'}}]});
const draft = () => makeDraft(source(),baseline(),'2026-09-13');
const review = d => ({draftHash:d.draftHash,reviewedBy:'Reviewer',reason:"Official evidence 'verified'",approvedPersonIds:['p1']});
test('draft gives before/after diff, evidence, dates and explicit target baseline',()=>{
 const d=draft();assert.equal(d.people.length,1);assert.equal(d.preview[0].before.list_status,'candidate');assert.equal(d.preview[0].after.list_status,'current');assert.equal(d.expectedOfficeRevision,3);assert.equal(d.people[0].terms[0].sourceVersion,'v1');
});
test('missing source, invalid date and unknown early departure remain blocked',()=>{
 for(const change of [{source_url:null},{starts_on:'2024-02-30'},{unknown_end:true},{ended_on:'2023-01-01'},{race_type:'unknown'}]){const s=source();Object.assign(s.people[0].terms[0],change);const d=makeDraft(s,baseline(),'2026-09-13');assert.equal(d.people.length,0);assert.equal(d.blocked.length,1);}
});
test('not-yet-published people and unsupported appointments cannot enter package',()=>{
 const b=baseline();b.people=[];assert.equal(makeDraft(source(),b,'2026-09-13').blocked.length,1);
 const c=baseline();Object.assign(c.people[0],{officeRole:'agency_head',officeStatus:'current'});assert.equal(makeDraft(source(),c,'2026-09-13').blocked.length,1);
});
test('incomplete exports and duplicated people are errors',()=>{
 const s=source();s.complete=false;assert.throws(()=>makeDraft(s,baseline(),'2026-09-13'));
 s.complete=true;s.people.push(s.people[0]);assert.throws(()=>makeDraft(s,baseline(),'2026-09-13'));
});
test('inauguration and end use half-open intervals, including year boundary and early departure',()=>{
 const p=draft().people[0];assert.equal(snapshotOn(p,'2024-01-31').list_status,'other');assert.equal(snapshotOn(p,'2024-02-01').list_status,'current');assert.equal(snapshotOn(p,'2028-02-01').list_status,'former');
 p.terms[0].endedOn='2026-01-02';assert.equal(snapshotOn(p,'2026-01-01').list_status,'current');assert.equal(snapshotOn(p,'2026-01-02').list_status,'former');
});
test('review must bind exact draft and explicitly select known unique people',()=>{
 const d=draft();assert.throws(()=>buildRelease(d,{...review(d),draftHash:'old'}));assert.throws(()=>buildRelease(d,{...review(d),approvedPersonIds:['missing']}));assert.throws(()=>buildRelease(d,{...review(d),approvedPersonIds:['p1','p1']}));
 const changed=structuredClone(d);changed.people[0].terms[0].startsOn='2020-01-01';assert.throws(()=>buildRelease(changed,review(d)));
});
test('package carries office fields only; rollback is versioned and literal text quoted',()=>{
 const d=draft(),r=buildRelease(d,review(d));assert.equal(r.payload.expectedOfficeRevision,3);assert.match(r.sql,/''verified''/);assert.match(r.rollback,/,4,/);assert.deepEqual(Object.keys(r.payload.people[0]).sort(),['expectedFingerprint','fallback','personId','terms']);assert.doesNotMatch(r.sql,/promote\(/);
});
test('shared presidential race cannot label the vice president as president',()=>{
 const s=source();s.family='president';Object.assign(s.people[0].terms[0],{race_type:'president',family:'president'});
 assert.equal(makeDraft(s,baseline(),'2026-09-13').blocked.length,1);
 Object.assign(s.people[0].terms[0],{office_role:'vice_president',role_source_url:'https://example.test/vice-president'});
 const d=makeDraft(s,baseline(),'2026-09-13');assert.equal(d.preview[0].after.current_office_label,'副總統');
});
test('approved future winner retains existing candidacy presentation until inauguration',()=>{
 const b=baseline();b.people[0].officeStatus='candidate';b.people[0].officeSnapshot={position:'立委候選人',district:null,current_office_label:null,list_role:'legislator',list_status:'candidate',list_is_grassroots:false,list_status_order:1,list_role_order:2};
 b.people[0].candidacies=[{candidateId:'c1',raceType:'legislator',raceTitle:'立委選舉',year:2024,status:'qualified',result:'elected'}];
 const d=makeDraft(source(),b,'2024-01-20');assert.equal(d.preview[0].after.list_status,'candidate');assert.equal(snapshotOn(d.people[0],'2024-02-01').list_status,'current');
});
test('live candidacy outranks old terms, expires after vote, and follows withdrawal/loss',()=>{
 const p=draft().people[0];p.terms[0].startsOn='2018-12-25';p.terms[0].endsOn='2022-12-25';
 const c={candidateId:'new',raceType:'city_councilor',raceTitle:'議員選舉',year:2026,votingDate:'2026-11-28',status:'registered',result:'pending'};
 assert.equal(snapshotOn(p,'2026-09-13',[c]).list_status,'candidate');
 for(const status of ['potential','officially_announced','party_nominee']) assert.equal(snapshotOn(p,'2026-09-13',[{...c,status}]).list_status,'candidate');
 assert.equal(snapshotOn(p,'2026-11-29',[c]).list_status,'former');
 assert.equal(snapshotOn(p,'2026-09-13',[{...c,status:'withdrawn_or_disqualified'}]).list_status,'former');
 assert.equal(snapshotOn(p,'2026-09-13',[{...c,result:'not_elected'}]).list_status,'former');
 p.terms.push({...p.terms[0],candidateId:'new',startsOn:'2026-12-25',endsOn:'2030-12-25'});
 assert.equal(snapshotOn(p,'2026-12-01',[{...c,result:'elected'}]).list_status,'candidate');
 assert.equal(snapshotOn(p,'2026-12-25',[{...c,result:'elected'}]).list_status,'current');
 p.fallback={...p.fallback,list_status:'candidate'};
 assert.equal(snapshotOn(p,'2031-01-01',[]).list_status,'former');
});
