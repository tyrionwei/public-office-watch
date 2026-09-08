const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '..');
const sql = fs.readFileSync(root + '/supabase/migrations/20260906175037_release_verified_platform_repairs.sql','utf8');
const split = sql.indexOf('DO $repair$');
assert(split > 0);
const prefix = sql.slice(0,split);
const repair = sql.slice(split).replaceAll('public.person_claims','pg_temp.test_platform_claims').replace(/COMMIT;\s*$/, 'ROLLBACK;');
const fixture = `CREATE TEMP TABLE test_platform_claims (id uuid, person_id uuid, candidate_id uuid, claim_key text, claim_type text, claim_value text, claim_json jsonb, updated_at timestamptz);
INSERT INTO test_platform_claims SELECT r.id, b.person_id, b.candidate_id, b.claim_key, 'platform', r.old_source, jsonb_build_object('platformText',r.old_source,'contentSplit',jsonb_build_object('reviewStatus','needs_review')) , now() FROM verified_platform_repairs r LEFT JOIN production_platform_baselines b USING(id);
`;
const production = `UPDATE test_platform_claims c SET claim_value=b.source_text, claim_json=jsonb_set(c.claim_json,'{platformText}',to_jsonb(b.source_text)) FROM production_platform_baselines b WHERE c.id=b.id;\n`;
const cases = [
 ['local baseline', '', true],
 ['production baseline', production, true],
 ['source mismatch', production + "UPDATE test_platform_claims SET claim_value=claim_value||'x' WHERE id='987d1197-7508-40a0-aa03-b2639f095892';", false],
 ['person mismatch', production + "UPDATE test_platform_claims SET person_id=gen_random_uuid() WHERE id='987d1197-7508-40a0-aa03-b2639f095892';", false],
 ['candidate mismatch', production + "UPDATE test_platform_claims SET candidate_id=gen_random_uuid() WHERE id='d50b80a9-02d3-4c62-987d-0ca6559300b7';", false],
 ['source key mismatch', production + "UPDATE test_platform_claims SET claim_key='wrong' WHERE id='debbde04-80c2-4d13-b2b4-4fb461495360';", false],
 ['missing target', production + "DELETE FROM test_platform_claims WHERE id='987d1197-7508-40a0-aa03-b2639f095892';", false],
];
const name='pow-platform-baseline-test';
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
   const r=cp.spawnSync('docker',['exec','-i',name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:prefix+fixture+change+repair,encoding:'utf8'});
   assert.equal(r.status===0,success,label+': '+r.stderr);
   if(!success) assert.match(r.stderr,/Expected to release 6 verified platform repairs/);
   console.log('PASS '+label);
 }
} finally { cp.execFileSync('docker',['rm','-f',name],{stdio:'ignore'}); }
