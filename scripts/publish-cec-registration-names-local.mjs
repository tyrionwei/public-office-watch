import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';import {execFileSync} from 'node:child_process';import {canonicalPartyName} from './lib/party-name-normalization.mjs';
const args=process.argv.slice(2);assert(args.every(a=>a==='--apply-local'));const apply=args.includes('--apply-local');
assert(fs.readFileSync('supabase/config.toml','utf8').includes('project_id = "public-office-watch"'));
const base='tmp/cec-registration-names',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const baseline=read('tmp/cec-pending-statistics/live-pending.json'),targets=read('tmp/cec-registration-identity-review-2/targets.json'),context=read(base+'/live-context.json');
assert.equal(baseline.length,917);
const manifestPath=base+'/manifest.json';
if(!fs.existsSync(manifestPath)){
 const excluded=[],records=[];
 for(const c of baseline){
  const e=c.claim_json.registrationEvidence,t=targets.find(t=>t.claimId===c.id),raceId=c.claim_json.targetRace?.id;
  if(!raceId||/[\uE000-\uF8FF]|\(cid:/.test(e.name)){excluded.push({claimId:c.id,name:e.name,reason:!raceId?'source_race_conflict':'source_name_encoding'});continue;}
  assert(t);assert.equal(t.prepared.record.personName,e.name);assert.equal(t.prepared.race.id,raceId);assert(context.publishedRaceIds.includes(raceId));
  assert(!context.candidates.some(x=>x.external_id===t.candidateExternalId||x.race_id===raceId&&x.name===e.name));
  const party=e.party_recommendation??Object.entries(e.raw).find(([k])=>k.includes('政黨'))?.[1]??null;
  records.push({id:randomUUID(),source_claim_id:c.id,candidate_external_id:t.candidateExternalId,race_id:raceId,display_name:e.name,party:canonicalPartyName(party==='無'?'無黨籍':party),registered_on:e.registration_date??null,source_name:e.county+'選舉委員會｜'+e.source.name,source_url:e.source.url,source_hash:e.source.sha256,is_public:true,reviewed_at:new Date().toISOString()});
 }
 assert.equal(records.length,913);assert.equal(excluded.length,4);assert.equal(new Set(records.map(r=>r.race_id+'|'+r.display_name)).size,913);
 fs.writeFileSync(manifestPath,JSON.stringify({environment:'full-local',baselineHash:sha('tmp/cec-pending-statistics/live-pending.json'),records,excluded},null,2));
}
const m=read(manifestPath);assert.equal(m.baselineHash,sha('tmp/cec-pending-statistics/live-pending.json'));
for(const r of m.records){const c=baseline.find(c=>c.id===r.source_claim_id),e=c.claim_json.registrationEvidence;assert.equal(sha('tmp/cec-registration-final/'+e.source.file),r.source_hash);assert.equal(e.name,r.display_name);assert.equal(e.source.url,r.source_url);assert.equal(c.claim_json.targetRace.id,r.race_id);}
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const migration='supabase/migrations/20260905103228_add_registration_name_roster.sql';
const sql=fs.readFileSync(migration,'utf8').replace(/COMMIT;\s*$/,'')+[
"SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='60s';",
"SELECT pg_advisory_xact_lock(hashtextextended('public-office-watch:cec-registration-publication',0));",
"CREATE TEMP TABLE expected_claims AS SELECT * FROM jsonb_populate_recordset(NULL::public.person_claims,"+q(baseline)+");",
"CREATE TEMP TABLE counts_before AS SELECT (SELECT count(*) FROM public.people) people,(SELECT count(*) FROM public.candidates) candidates,(SELECT count(*) FROM public.candidate_lifecycle_events) events;",
"DO $check$ BEGIN IF EXISTS(SELECT 1 FROM expected_claims b LEFT JOIN public.person_claims c ON c.id=b.id WHERE to_jsonb(c) IS DISTINCT FROM to_jsonb(b) OR c.review_status<>'pending' OR c.is_public OR c.visibility<>'review_only') THEN RAISE EXCEPTION 'Pending evidence changed';END IF;END $check$;",
"INSERT INTO public.registration_name_roster SELECT * FROM jsonb_populate_recordset(NULL::public.registration_name_roster,"+q(m.records)+");",
"DO $check$ BEGIN",
"IF (SELECT count(*) FROM public.registration_name_roster)<>913 THEN RAISE EXCEPTION 'Roster count';END IF;",
"IF EXISTS(SELECT 1 FROM public.registration_name_roster n LEFT JOIN published.races r ON r.race_id=n.race_id WHERE r.race_id IS NULL) OR EXISTS(SELECT 1 FROM public.registration_name_roster n JOIN public.candidates c ON c.external_id=n.candidate_external_id) THEN RAISE EXCEPTION 'Missing public race or duplicate candidate';END IF;",
"IF EXISTS(SELECT 1 FROM expected_claims b LEFT JOIN public.person_claims c ON c.id=b.id WHERE to_jsonb(c) IS DISTINCT FROM to_jsonb(b)) THEN RAISE EXCEPTION 'Identity evidence changed';END IF;",
"IF EXISTS(SELECT 1 FROM counts_before b WHERE b.people<>(SELECT count(*) FROM public.people) OR b.candidates<>(SELECT count(*) FROM public.candidates) OR b.events<>(SELECT count(*) FROM public.candidate_lifecycle_events)) THEN RAISE EXCEPTION 'Person or candidate data changed';END IF;END $check$;",
"SELECT json_build_object('mode','"+(apply?'apply-local':'dry-run-rollback')+"','plain_names',913,'withheld',4,'identity_pending',917,'new_people',0);",
apply?'COMMIT;':'ROLLBACK;'].join('\n');
const output=execFileSync('docker',['exec','-i','supabase_db_public-office-watch','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',maxBuffer:40e6}).trim();
const report={...JSON.parse(output.split('\n').findLast(s=>s.startsWith('{'))),manifest_sha256:sha(manifestPath),migration_sha256:sha(migration),at:new Date().toISOString()};
fs.writeFileSync(base+'/'+(apply?'apply':'dry-run')+'.json',JSON.stringify(report,null,2));console.log(report);
