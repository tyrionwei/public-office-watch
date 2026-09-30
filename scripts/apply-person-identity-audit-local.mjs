import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
export function correctionSql(plan,apply=false,reverse=false){
 assert.equal(plan.schemaVersion,1);assert.equal(plan.environment,'full-local');
 assert.equal(plan.type,'candidate_name_correction');assert(plan.reason&&plan.source?.sha256);
 assert.match(plan.before.id,/^[0-9a-f-]{36}$/);assert(plan.before.person_id);
 assert.equal(plan.before.source_url,plan.source.url);
 assert(plan.afterName&& !/[<>]/.test(plan.afterName));
 const baseline={...plan.before};delete baseline.updated_at;
 const target=reverse?plan.before.candidate_name:plan.afterName;
 if(reverse)baseline.candidate_name=plan.afterName;
 const expected={...baseline,candidate_name:target};
 return `begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('pow:person-identity-audit',0));
do $audit$
declare actual jsonb;
begin
 select to_jsonb(c)-'updated_at' into actual from public.candidates c where id=${quote(plan.before.id)}::uuid for update;
 if actual is null then raise exception 'candidate missing'; end if;
 if actual=${quote(JSON.stringify(expected))}::jsonb then
   raise notice 'already applied';
 elsif actual=${quote(JSON.stringify(baseline))}::jsonb then
   update public.candidates set candidate_name=${quote(target)} where id=${quote(plan.before.id)}::uuid;
 else raise exception 'candidate baseline drift'; end if;
 if (select to_jsonb(c)-'updated_at' from public.candidates c where id=${quote(plan.before.id)}::uuid) <> ${quote(JSON.stringify(expected))}::jsonb then raise exception 'unexpected candidate change'; end if;
end $audit$;
select jsonb_build_object('id',id,'person_id',person_id,'candidate_name',candidate_name) from public.candidates where id=${quote(plan.before.id)}::uuid;
${apply?'commit':'rollback'};\n`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),file=args.find(x=>!x.startsWith('--'));
 assert(file&&args.every(x=>x===file||['--apply-local','--reverse'].includes(x)));
 const plan=JSON.parse(fs.readFileSync(file));
 const source=fs.readFileSync(plan.source.path);
 assert.equal(createHash('sha256').update(source).digest('hex'),plan.source.sha256,'source changed');
 assert(source.toString().includes(plan.source.quote),'official source text missing');
 const container='supabase_db_public-office-watch';
 const probe=spawnSync('docker',['inspect',container,'--format','{{json .}}'],{encoding:'utf8'});
 assert.equal(probe.status,0,'local container inspection failed');
 const meta=JSON.parse(probe.stdout);
 assert.equal(meta.Name,'/'+container);
 assert.equal(meta.Config.Labels['com.supabase.cli.project'],'public-office-watch');
 assert(meta.State.Running);
 assert(meta.NetworkSettings.Ports['5432/tcp'].some(p=>p.HostPort==='54322'),'full-local DB port differs');
 const sql=correctionSql(plan,args.includes('--apply-local'),args.includes('--reverse'));
 const out=spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8'});
 if(out.status!==0){console.error('Local correction failed:',out.stderr);process.exit(1);}
 console.log(JSON.stringify({applied:args.includes('--apply-local'),reverse:args.includes('--reverse'),target:'full-local:54322',rows:out.stdout.trim(),notice:out.stderr.trim()}));
}
