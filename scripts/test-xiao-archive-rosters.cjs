const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const sql=fs.readFileSync(root+'/supabase/migrations/20260908100500_release_xiao_guo_liang_cec_profile_and_platform.sql','utf8');
const setup=sql.slice(sql.indexOf('CREATE TEMP TABLE xiao_archive_targets'),sql.indexOf('DO $replace$'));
const start=sql.indexOf('  -- Accept only the exact full-local');
const end=sql.indexOf('  UPDATE public.person_claims',start);
assert(start>0&&end>start);
const guard=sql.slice(start,end).replaceAll('public.person_claims','pg_temp.archive_claims');
const cases=[];
for(const [label,where,mutate,success] of [
 ['full roster','TRUE','',true],['production roster','production_public','',true],
 ['missing public source','production_public','DELETE FROM archive_claims WHERE id=(SELECT min(id::text)::uuid FROM archive_claims);',false],
 ['unknown source id','production_public','UPDATE archive_claims SET id=gen_random_uuid();',false],
 ['wrong source key','production_public',"UPDATE archive_claims SET claim_key='wrong';",false]
]){
 const input='BEGIN;'+setup+'CREATE TEMP TABLE archive_claims AS SELECT id,person_id,claim_key,source_name,claim_type,TRUE is_public FROM xiao_archive_targets WHERE '+where+';'+mutate+'DO $t$ DECLARE archive_ids uuid[]; expected_archive_count integer; BEGIN '+guard+' END $t$; ROLLBACK;';
 cases.push([label,input,success]);
}
const name='pow-xiao-archive-test';
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
   if(!success) assert.match(r.stderr,/Unexpected Xiao VoteTW public archive roster|Xiao VoteTW archive identity conflict/);
   console.log('PASS '+label);
 }
} finally { cp.execFileSync('docker',['rm','-f',name],{stdio:'ignore'}); }
