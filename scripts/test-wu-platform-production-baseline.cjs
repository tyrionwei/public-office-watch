const fs=require('node:fs');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const local="請給我一次機會，讓我用青年的戰鬥力，來為族人發聲！\n\n常覺得立法委員總是遠在天邊嗎？\n還是覺得政治很遙遠，立委又能改變什麼？\n其實我們所有的生活，都跟法律與政治息息相關。\n\n說是永久屋，土地卻不是我們的？什麼時候山林能還給部落自己管理？\n想用安全的獵槍卻不合法？什麼時候狩獵不用再偷偷摸摸？\n現在都什麼年代了，從學校到社會卻處處是歧視？\n他們說原住民族的語言是國家語言，身分證卻不能單列族語名？\n要求台大歸還馬遠部落丹社群布農祖先遺骨並賠償，他們說沒有法源依據，還罵族人貪婪？\n這麼多我們共同經歷的痛，需要積極修法才有機會改變。\n\n我是 Savungaz，想要成為「族人一定找得到」的立委。\n我有法律專業、有超過十年捍衛原權的經驗；最重要的是，我無黨無派，只有原住民族主體意識，永遠站在族人立場發聲！\n請你支持我，給年輕人一次機會，我將用盡全力，為族人服務！";
const prod="請給我一次機會，讓我用青年的戰鬥力，來為族人發聲！\n\n常覺得立法委員，總是遠在天邊嗎？\n還是覺得政治很遙遠，立委又能改變什麼？\n其實我們所有的生活，都跟法律與政治息息相關。\n\n說是永久屋土地卻不是我們的？什麼時候山林能還給部落自己管理？\n想用安全的獵槍卻不合法？什麼時候狩獵不用再偷偷摸摸？\n現在都什麼年代了，從學校到社會卻處處是歧視？\n他們說原住民族的語言是國家語言，身分證卻不能單列族語名？\n要求台大歸還馬遠部落丹社群布農祖先遺骨並賠償，\n他們說沒有法源依據還罵族人貪婪？\n這麼多我們共同經歷的痛，需要積極的修法才有機會改變。\n\n我是Savungaz，想要成為「族人一定找得到」的立委。\n我有法律專業、有超過十年捍衛原權的經驗，最重要的是，\n我無黨無派，只有原住民族主體意識、永遠站在族人立場發聲！\n請你支持我，給年輕人一次機會，我將用盡全力，為族人服務！";
const migration=fs.readFileSync(root+'/supabase/migrations/20260907061839_release_verified_people_and_platforms.sql','utf8');
const end=migration.indexOf('$repair$;')+'$repair$;'.length;
assert(end>20);
const repair=migration.slice(migration.indexOf('DO $repair$'),end).replaceAll('public.person_claims','pg_temp.wu_claims');
const lit=s=>"'"+s.replaceAll("'","''")+"'";
function makeSql(test){
 const source=test.source??prod;
 const fixture="CREATE TEMP TABLE wu_claims (id uuid, person_id uuid, candidate_id uuid, claim_key text, claim_type text, claim_value text, claim_json jsonb, updated_at timestamptz); INSERT INTO wu_claims VALUES ('5bda03ae-f1cf-425b-aa07-79ed2c65483b','8b6641f7-cdf6-4fc7-9e9b-348cf6c3cda9','a60d25d9-c06f-4801-b56d-0d2d0725500c','cec-platform:2024:votetw-candidate-bdb05cca26bd9824','platform',"+lit(source)+",jsonb_build_object('platformText',"+lit(source)+",'contentSplit',jsonb_build_object('reviewStatus','needs_review'),'platformQualityAudit',jsonb_build_object('classification','confirmed_content_or_split_issue')),now());";
 return 'BEGIN;'+fixture+(test.mutate??'')+repair.replace('BEGIN;','')+'ROLLBACK;';
}
const cases=[
 ['local baseline',{source:local},true],
 ['production baseline',{},true],
 ['changed text',{source:prod+'x'},false],
 ['wrong person',{mutate:'UPDATE wu_claims SET person_id=gen_random_uuid();'},false],
 ['wrong candidate',{mutate:'UPDATE wu_claims SET candidate_id=gen_random_uuid();'},false],
 ['wrong source key',{mutate:"UPDATE wu_claims SET claim_key='wrong';"},false],
 ['JSON source differs',{mutate:"UPDATE wu_claims SET claim_json=jsonb_set(claim_json,'{platformText}','\"wrong\"');"},false],
 ['missing target',{mutate:'DELETE FROM wu_claims;'},false],
];
const name='pow-wu-baseline-test';
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
   const r=cp.spawnSync('docker',['exec','-i',name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:makeSql(change),encoding:'utf8'});
   assert.equal(r.status===0,success,label+': '+r.stderr);
   if(!success) assert.match(r.stderr,/Expected to release one verified platform repair/);
   console.log('PASS '+label);
 }
} finally { cp.execFileSync('docker',['rm','-f',name],{stdio:'ignore'}); }
