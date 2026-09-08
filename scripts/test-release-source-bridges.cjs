const fs=require('node:fs'), cp=require('node:child_process'), assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const cases=[];
for(const file of fs.readdirSync(root+'/supabase/migrations')){
 const sql=fs.readFileSync(root+'/supabase/migrations/'+file,'utf8');
 const start=sql.indexOf('CREATE TEMP TABLE release_source_baselines');
 if(start<0)continue;
 const update=sql.indexOf('UPDATE public.person_claims AS c',start);
 const end=sql.indexOf("AND c.claim_json#>>'{contentSplit,reviewStatus}'='needs_review';",update)+"AND c.claim_json#>>'{contentSplit,reviewStatus}'='needs_review';".length;
 assert(update>start&&end>update);
 const setup=sql.slice(start,update);
 const patch=sql.slice(update,end).replace('public.person_claims','pg_temp.bridge_claims');
 const fixture="CREATE TEMP TABLE bridge_claims AS SELECT id,person_id,candidate_id,claim_key,'platform'::text claim_type,production_text claim_value,jsonb_build_object('platformText',production_text,'contentSplit',jsonb_build_object('reviewStatus','needs_review')) claim_json FROM release_source_baselines;";
 for(const [label,mutate,valid] of [
 ['exact','',true],
 ['wrong person','UPDATE bridge_claims SET person_id=gen_random_uuid();',false],
 ['wrong candidate','UPDATE bridge_claims SET candidate_id=gen_random_uuid();',false],
 ['wrong key',"UPDATE bridge_claims SET claim_key='wrong';",false],
 ['changed source',"UPDATE bridge_claims SET claim_value=claim_value||'x';",false],
 ['changed JSON',"UPDATE bridge_claims SET claim_json=jsonb_set(claim_json,'{platformText}',to_jsonb('wrong'::text));",false],
 ['wrong review',"UPDATE bridge_claims SET claim_json=jsonb_set(claim_json,'{contentSplit,reviewStatus}',to_jsonb('reviewed'::text));",false]
 ]) {
 const check=valid?"IF EXISTS(SELECT 1 FROM bridge_claims c JOIN release_source_baselines b USING(id) WHERE c.claim_value IS DISTINCT FROM b.audited_text OR c.claim_json->>'platformText' IS DISTINCT FROM b.audited_text) THEN RAISE EXCEPTION 'valid bridge failed'; END IF;":"IF EXISTS(SELECT 1 FROM bridge_claims c JOIN release_source_baselines b USING(id) WHERE c.claim_value=b.audited_text) THEN RAISE EXCEPTION 'invalid bridge accepted'; END IF;";
 cases.push([file.slice(0,14)+' '+label,'BEGIN;'+setup+fixture+mutate+patch+'DO $test$ BEGIN '+check+' END $test$; ROLLBACK;',true]);
 }
}
assert(cases.length>=140);
const name='pow-release-bridge-test';
assert.notEqual(cp.spawnSync('docker',['inspect',name],{stdio:'ignore'}).status,0,'refusing existing container');
cp.execFileSync('docker',['run','-d','--name',name,'-e','POSTGRES_PASSWORD=disposable-test-only','public.ecr.aws/supabase/postgres:17.6.1.106'],{stdio:'ignore'});
try {
 let ready=false, streak=0;
 for(let i=0;i<60;i++) {
   streak = cp.spawnSync('docker',['exec',name,'pg_isready','-U','postgres'],{stdio:'ignore'}).status===0 ? streak+1 : 0;
   if(streak>=5){ready=true;break;}
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
 }
 assert(ready);
 for(const [label, change, success] of cases){
   const r=cp.spawnSync('docker',['exec','-i',name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:change,encoding:'utf8'});
   assert.equal(r.status===0,success,label+': '+r.stderr);

   console.log('PASS '+label);
 }
} finally { cp.execFileSync('docker',['rm','-f',name],{stdio:'ignore'}); }
