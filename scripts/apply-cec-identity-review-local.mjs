import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateSnapshot, assertWriteWindow} from './import-official-candidate-snapshot.mjs';
import {candidateWriteRow} from './review-official-candidate-snapshot.mjs';
import {canonicalPartyName} from './lib/party-name-normalization.mjs';

// One reviewed delta for the full local database; source evidence stays private.
const args=process.argv.slice(2);
assert(args.every(x=>x==='--apply-local'), 'Usage: node scripts/apply-cec-identity-review-local.mjs [--apply-local]');
const apply=args.includes('--apply-local');
const base=path.resolve('tmp/cec-registration-identity-review');
const archive=path.resolve('tmp/cec-registration-final');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=x=>createHash('sha256').update(x).digest('hex');
const quote=x=>"'"+x.replaceAll("'","''")+"'";
const json=x=>quote(JSON.stringify(x))+'::jsonb';
const ledger=read('docs/cec-registration-identity-review-2026-09-05.json');
for(const [file,hash] of Object.entries(ledger.inputs)) assert.equal(sha(fs.readFileSync(file)),hash,'Reviewed input changed: '+file);
const review=read(path.join(base,'review-manifest.json'));
const targets=new Map(read(path.join(base,'targets.json')).map(x=>[x.candidateExternalId,x]));
const evidence=read(path.join(base,'local-evidence.json'));
const claims=new Map(evidence.pending_claims.map(x=>[x.id,x]));
const sources=read(path.join(archive,'sources.json'));
const manifest=read(path.join(archive,'import-manifest.json'));
const dates=new Map(sources.regions.flatMap(r=>r.articles??[]).map(a=>[a.url,/^\d{14}$/.test(a.published_at_raw??'')?a.published_at_raw.slice(0,4)+'-'+a.published_at_raw.slice(4,6)+'-'+a.published_at_raw.slice(6,8):null]));
assert.equal(review.sourceManifestSha256,sha(fs.readFileSync(path.join(archive,'import-manifest.json'))));
assert.equal(review.environment,'full-local');assert.equal(review.records.length,1137);
assert(fs.readFileSync('supabase/config.toml','utf8').includes('project_id = "public-office-watch"'));
const accepted=review.records.filter(r=>r.decision!=='pending');
assert.equal(accepted.length,246);
assert.equal(new Set(accepted.map(r=>r.personId)).size,246);
assert.equal(new Set(review.records.map(r=>r.claimId)).size,1137);
const people=[],candidates=[],events=[],matches=[],checkedFiles=new Set();
const inputs=review.records.map(r=>{
 const t=targets.get(r.candidateExternalId), e=t.prepared.evidence;
 assert.equal(r.claimId,t.claimId);assert.equal(r.sourcePersonId,t.sourcePersonId);
 assert.equal(r.existingPersonId,t.existingPersonId);assert.equal(r.raceId,t.prepared.race.id);
 assert.equal(r.name,t.name);assert(['pending','create_new','use_existing'].includes(r.decision));
 assert(r.reason&&r.evidenceUrls.includes(e.source.url));
 if(r.decision!=='pending'){
  assert.equal(new URL(e.source.url).hostname,'web.cec.gov.tw');
  const file=path.resolve(archive,e.source.file);assert(file.startsWith(archive+path.sep));
  assert.equal(sha(fs.readFileSync(file)),e.source.sha256);checkedFiles.add(file);
  const snapshot=validateSnapshot({schemaVersion:1,electionYear:2026,candidacyStatus:'registered',source:{name:e.county+'選舉委員會｜'+e.source.name,url:e.source.url,publishedAt:'2026-09-04T00:00:00+08:00',retrievedAt:review.reviewedAt},records:[t.prepared.record]});
  assertWriteWindow(snapshot);
  const record=snapshot.records[0];
  if(r.decision==='create_new')people.push({id:r.personId,external_id:record.personExternalId,name:record.personName,party:record.party??null,election_year:2026,district:t.prepared.race.title,source_url:e.source.url,is_public:true,gender:({'男':'male','女':'female'})[e.gender]??'unknown'});
  else assert.equal(r.personId,r.existingPersonId);
  const candidate={id:r.candidateId,...candidateWriteRow(snapshot,{record,race:t.prepared.race,candidate:null},new Map([[record.personExternalId,{id:r.personId}]]),review.reviewedAt),is_public:true};
  candidate.party=candidate.party==null?null:canonicalPartyName(candidate.party);
  assert.equal(candidate.candidate_no,null);assert.equal(candidate.election_result,'pending');
  candidates.push(candidate);
  events.push({external_id:'cec-registration-2026:'+r.candidateId,candidate_id:r.candidateId,occurred_on:e.registration_date??null,source_published_on:dates.get(e.source.article_url)??null,source_name:candidate.source_name,source_url:e.source.url,source_hash:e.source.sha256,fetched_at:sources.retrieved_at});
  matches.push({id:randomUUID(),source_person_id:r.sourcePersonId,person_id:r.personId,match_reason:r.reason,evidence_json:r,reviewed_by:r.reviewedBy,reviewed_at:r.reviewedAt});
 }
 return {claim_id:r.claimId,source_id:r.sourcePersonId,person_id:r.personId,existing_person_id:r.existingPersonId,race_id:r.raceId,decision:r.decision,review:r,claim_before:claims.get(r.claimId),source_hash:e.source.sha256};
});
const proofIds=new Set(accepted.flatMap(r=>r.evidenceClaimIds));
const proofs=evidence.claims.filter(c=>proofIds.has(c.id)).map(({canonical_person_id,...c})=>({id:c.id,expected:c}));
assert.equal(proofs.length,proofIds.size);
// Freshly fetched CEC 2024 data supplies the additional Zhang Jing birth-date bridge.
const list2024=read(path.join(base,'cec-2024-party-list.json'));
const walk=x=>x&&typeof x==='object'?[x,...Object.values(x).flatMap(walk)]:[];
assert(walk(list2024).some(x=>x.name==='張靜'&&x.birth==='0450527'&&x.gender==='男'));
const sql=`BEGIN;
SET LOCAL application_name='cec-identity-review-20260905';
SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='180s'; SET LOCAL work_mem='64MB';
SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:cec-registration-publication',0));
CREATE TEMP TABLE input AS SELECT * FROM jsonb_to_recordset(${json(inputs)}) AS x(claim_id uuid,source_id uuid,person_id uuid,existing_person_id uuid,race_id uuid,decision text,review jsonb,claim_before jsonb,source_hash text);
CREATE UNIQUE INDEX ON input(claim_id); ANALYZE input;
CREATE TEMP TABLE new_people AS SELECT * FROM jsonb_populate_recordset(NULL::public.people,${json(people)});
CREATE TEMP TABLE new_candidates AS SELECT * FROM jsonb_populate_recordset(NULL::public.candidates,${json(candidates)});
CREATE TEMP TABLE new_events AS SELECT * FROM jsonb_populate_recordset(NULL::public.candidate_lifecycle_events,${json(events)});
CREATE TEMP TABLE new_matches AS SELECT * FROM jsonb_populate_recordset(NULL::public.person_identity_matches,${json(matches)});
CREATE TEMP TABLE claims_before AS SELECT cl.* FROM public.person_claims cl JOIN input i ON i.claim_id=cl.id;
CREATE TEMP TABLE sources_before AS SELECT s.* FROM public.source_people s JOIN input i ON i.source_id=s.id;
CREATE TEMP TABLE untouched_claims AS SELECT cl.id,md5(to_jsonb(cl)::text) hash FROM public.person_claims cl WHERE cl.id IN (SELECT value::uuid FROM jsonb_array_elements_text(${json(manifest.map(x=>x.claimId))})) AND NOT EXISTS(SELECT 1 FROM input i WHERE i.claim_id=cl.id);
CREATE TEMP TABLE candidates_before AS SELECT c.id,md5(to_jsonb(c)::text) hash FROM public.candidates c;
CREATE TEMP TABLE race_before AS SELECT DISTINCT r.* FROM public.races r JOIN new_candidates c ON c.race_id=r.id;
CREATE TEMP TABLE people_before AS SELECT DISTINCT p.* FROM public.people p JOIN input i ON i.existing_person_id=p.id;
DO $check$ BEGIN
 IF (SELECT count(*) FROM claims_before)<>1137 OR (SELECT count(*) FROM sources_before)<>1137 THEN RAISE EXCEPTION 'Incomplete pending review inputs'; END IF;
 IF EXISTS(SELECT 1 FROM input i JOIN public.person_claims cl ON cl.id=i.claim_id JOIN public.source_people s ON s.id=i.source_id
 WHERE cl.review_status<>'pending' OR cl.person_id IS DISTINCT FROM (i.claim_before->>'person_id')::uuid
 OR cl.claim_json IS DISTINCT FROM i.claim_before->'claim_json' OR cl.is_public OR cl.visibility<>'review_only' OR s.is_public
 OR cl.source_person_id IS DISTINCT FROM i.source_id OR cl.claim_json->'targetRace'->>'id' IS DISTINCT FROM i.race_id::text
 OR cl.claim_json->'registrationEvidence'->'source'->>'sha256' IS DISTINCT FROM i.source_hash
 OR s.source_payload->'registrationEvidence' IS DISTINCT FROM cl.claim_json->'registrationEvidence')
 THEN RAISE EXCEPTION 'Pending claim or original official source changed'; END IF;
 IF EXISTS(SELECT 1 FROM input i JOIN public.person_identity_matches m ON m.source_person_id=i.source_id)
 THEN RAISE EXCEPTION 'Identity match already exists for a pending source'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(${json(proofs)}) x(id uuid,expected jsonb) LEFT JOIN public.person_claims cl ON cl.id=x.id WHERE cl.id IS NULL OR NOT(to_jsonb(cl) @> x.expected))
 THEN RAISE EXCEPTION 'Supporting reviewed identity claim changed'; END IF;
 IF EXISTS(SELECT 1 FROM input i LEFT JOIN public.person_canonical_map pm ON pm.person_id=i.existing_person_id LEFT JOIN public.people p ON p.id=i.existing_person_id
 WHERE pm.canonical_person_id IS DISTINCT FROM i.existing_person_id OR (i.decision='use_existing' AND NOT p.is_public))
 THEN RAISE EXCEPTION 'Canonical identity changed or existing profile is private'; END IF;
 IF EXISTS(SELECT 1 FROM input i JOIN public.person_canonical_map pm ON pm.canonical_person_id=i.person_id JOIN public.candidates c ON c.person_id=pm.person_id JOIN public.races r ON r.id=c.race_id JOIN public.elections e ON e.id=r.election_id WHERE i.decision='use_existing' AND e.year=2026)
 THEN RAISE EXCEPTION 'Existing person already has a 2026 candidacy'; END IF;
 IF EXISTS(SELECT 1 FROM new_candidates n JOIN public.candidates c ON c.id=n.id OR c.external_id=n.external_id)
 OR EXISTS(SELECT 1 FROM new_people n JOIN public.people p ON p.id=n.id OR p.external_id=n.external_id)
 THEN RAISE EXCEPTION 'Review was already applied or generated ID collides'; END IF;
 IF EXISTS(SELECT 1 FROM race_before r LEFT JOIN public.race_canonical_map rm ON rm.race_id=r.id JOIN public.elections e ON e.id=r.election_id JOIN public.regions reg ON reg.id=r.region_id WHERE rm.canonical_race_id IS DISTINCT FROM r.id OR e.year<>2026 OR NOT e.is_public OR NOT reg.is_public
 OR (NOT r.is_public AND (r.race_type<>'village_chief' OR r.external_id NOT LIKE 'pow-cec-registration-2026-race-%')))
 THEN RAISE EXCEPTION 'Race is not a verified 2026 public or reviewed village race'; END IF;
END; $check$;
INSERT INTO public.people(id,external_id,name,party,election_year,district,source_url,is_public,gender)
SELECT id,external_id,name,party,election_year,district,source_url,is_public,gender FROM new_people;
UPDATE public.races r SET is_public=TRUE,updated_at=now() FROM race_before b WHERE r.id=b.id AND NOT b.is_public;
INSERT INTO public.candidates(id,external_id,person_id,race_id,party,candidate_no,registration_status,candidacy_status,election_result,is_incumbent,source_name,source_url,is_public,updated_at)
SELECT id,external_id,person_id,race_id,party,candidate_no,registration_status,candidacy_status,election_result,is_incumbent,source_name,source_url,is_public,updated_at FROM new_candidates;
INSERT INTO public.person_identity_matches(id,source_person_id,person_id,match_status,score,match_method,match_reason,evidence_json,reviewed_by,reviewed_at,updated_at)
SELECT id,source_person_id,person_id,'auto_matched',100,'cec_registration_identity_review_v2',match_reason,evidence_json,reviewed_by,reviewed_at,reviewed_at FROM new_matches;
UPDATE public.person_claims cl SET person_id=CASE WHEN i.decision='pending' THEN cl.person_id ELSE i.person_id END,
 review_status=CASE WHEN i.decision='pending' THEN 'pending' ELSE 'verified' END,
 claim_json=cl.claim_json || jsonb_build_object('identityReview',i.review),
 scoring_version='cec-registration-identity-review-v2',scoring_reasons=coalesce(cl.scoring_reasons,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('reason',i.review->>'reason','reasonCode',i.review->>'reasonCode','reviewedAt',i.review->>'reviewedAt')),updated_at=now()
FROM input i WHERE cl.id=i.claim_id;
INSERT INTO public.candidate_lifecycle_events(external_id,candidate_id,event_type,occurred_on,source_published_on,source_name,source_url,source_hash,fetched_at,is_public)
SELECT external_id,candidate_id,'registration_filed',occurred_on,source_published_on,source_name,source_url,source_hash,fetched_at,TRUE FROM new_events;
SELECT public.refresh_public_people_list_cached();
CREATE TEMP TABLE promoted AS SELECT published.promote(NULL) release_id;
DO $verify$ BEGIN
 IF (SELECT count(*) FROM new_candidates n JOIN published.candidates c ON c.candidate_id=n.id AND c.person_id=n.person_id AND c.race_id=n.race_id AND c.candidacy_status='registered' AND c.registration_status='registered' AND c.election_result='pending' AND c.candidate_no IS NULL)<>246
 THEN RAISE EXCEPTION 'Published candidate parity failed'; END IF;
 IF (SELECT count(*) FROM new_events n CROSS JOIN LATERAL published.candidate_lifecycle_for(n.candidate_id) ev WHERE ev.event_type='registration_filed' AND ev.occurred_on IS NOT DISTINCT FROM n.occurred_on AND ev.source_url=n.source_url AND ev.candidate_no IS NULL)<>246
 THEN RAISE EXCEPTION 'Public event parity failed'; END IF;
 IF EXISTS(SELECT 1 FROM sources_before b LEFT JOIN public.source_people s ON s.id=b.id WHERE to_jsonb(s) IS DISTINCT FROM to_jsonb(b))
 OR EXISTS(SELECT 1 FROM candidates_before b LEFT JOIN public.candidates c ON c.id=b.id WHERE md5(to_jsonb(c)::text) IS DISTINCT FROM b.hash)
 OR EXISTS(SELECT 1 FROM people_before b LEFT JOIN public.people p ON p.id=b.id WHERE to_jsonb(p) IS DISTINCT FROM to_jsonb(b))
 OR EXISTS(SELECT 1 FROM untouched_claims b LEFT JOIN public.person_claims cl ON cl.id=b.id WHERE md5(to_jsonb(cl)::text) IS DISTINCT FROM b.hash)
 THEN RAISE EXCEPTION 'Unrelated existing data changed'; END IF;
 IF EXISTS(SELECT 1 FROM input i JOIN public.person_claims cl ON cl.id=i.claim_id WHERE cl.is_public OR cl.visibility<>'review_only' OR cl.claim_json->'registrationEvidence' IS DISTINCT FROM i.claim_before->'claim_json'->'registrationEvidence'
 OR cl.review_status IS DISTINCT FROM CASE WHEN i.decision='pending' THEN 'pending' ELSE 'verified' END)
 THEN RAISE EXCEPTION 'Private evidence or pending boundaries changed'; END IF;
 IF (SELECT count(*) FROM public.person_claims WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(${json(manifest.map(x=>x.claimId))})) AND review_status='pending')<>1349
 THEN RAISE EXCEPTION 'Remaining pending count failed'; END IF;
END; $verify$;
SELECT json_build_object('mode',${quote(apply?'apply-local':'dry-run-rollback')},'release_id',(SELECT release_id FROM promoted),'reviewed',1137,'resolved',246,'reused_people',193,'new_people',53,'remaining_pending',1349,'newly_public_races',(SELECT count(*) FROM race_before WHERE NOT is_public),'before',json_build_object('claims',(SELECT json_agg(to_jsonb(cl)) FROM claims_before cl),'races',(SELECT json_agg(to_jsonb(r)) FROM race_before r WHERE NOT is_public)));
${apply?'COMMIT':'ROLLBACK'};`;
const result=spawnSync('docker',['exec','-i','supabase_db_public-office-watch','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',maxBuffer:30e6});
if(result.status!==0){console.error(result.stderr.slice(-4000));process.exit(result.status??1);}
const report=JSON.parse(result.stdout.trim().split('\n').findLast(x=>x.startsWith('{')));
report.manifest_sha256=sha(fs.readFileSync(path.join(base,'review-manifest.json')));
report.official_archive_files_verified=checkedFiles.size;
const file=path.join(base,new Date().toISOString().replace(/[:.]/g,'-')+'-'+(apply?'apply':'dry-run')+'.json');
fs.writeFileSync(file,JSON.stringify(report,null,2));
const {before,...summary}=report;console.log(JSON.stringify({...summary,report:file},null,2));
