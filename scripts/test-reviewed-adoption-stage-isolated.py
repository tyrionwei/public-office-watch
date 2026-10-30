from pathlib import Path
import subprocess,json,time
import argparse
a=argparse.ArgumentParser();a.add_argument('--private-input',type=Path,required=True);args=a.parse_args()
p=args.private_input.resolve();o=p/'api-stage-once'
cmd=['docker','exec','-i','supabase_db_public-office-watch','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d','pow_combined_release_20261029']
def run(s):return subprocess.run(cmd,input=s,text=True,capture_output=True,timeout=110)
def ok(s):
 v=run(s);assert v.returncode==0,v.stderr[-1500:];return v.stdout.strip()
assert ok('SELECT current_database()')=='pow_combined_release_20261029'
ok((o/'migration.sql').read_text())
for f in sorted(o.glob('upload-*.sql')): pass
ok((o/'upload-init.sql').read_text())
for f in sorted(o.glob('upload-[0-9]*.sql')):ok(f.read_text())
ok((o/'upload-000.sql').read_text())
uid=json.loads((o/'MANIFEST.json').read_text())['package_id']
validate=(o/'validation.sql').read_text()
results=[{'test':'upload + identical retry','pass':True}]
def negative(name,prep,tail,expected):
 v=run('BEGIN; SET LOCAL statement_timeout=\'45s\';'+prep+tail+'ROLLBACK;')
 assert v.returncode==3 and expected in v.stderr,(name,v.returncode,v.stderr[-700:])
 results.append({'test':name,'pass':True})
negative('missing chunk',f"DELETE FROM reviewed_adoption_private.chunks WHERE package_id='{uid}' AND part=0;",validate,'CHUNKS_INCOMPLETE')
negative('tampered chunk',f"UPDATE reviewed_adoption_private.chunks SET payload=decode('00','hex'),sha256=encode(sha256(decode('00','hex')),'hex') WHERE package_id='{uid}' AND part=0;",validate,'CHUNKS_INCOMPLETE')
negative('duplicate chunk','',f"INSERT INTO reviewed_adoption_private.chunks SELECT * FROM reviewed_adoption_private.chunks WHERE package_id='{uid}' AND part=0;",'duplicate key')
negative('extra chunk',f"INSERT INTO reviewed_adoption_private.chunks SELECT package_id,999,payload,sha256 FROM reviewed_adoption_private.chunks WHERE package_id='{uid}' AND part=0;",validate,'CHUNKS_INCOMPLETE')
negative('already applied',f"UPDATE reviewed_adoption_private.packages SET status='applied',applied_at=now() WHERE id='{uid}';",validate,'PACKAGE_MISMATCH')
for role in ['anon','authenticated','service_role']:
 for op in ['SELECT * FROM reviewed_adoption_private.packages;',f"DELETE FROM reviewed_adoption_private.chunks WHERE package_id='{uid}';"]:
  negative(role+' denied '+op.split()[0],f'SET LOCAL ROLE {role};',op,'permission denied')
tables=list(dict.fromkeys(list(json.loads((p/'combined-production-before.json').read_text()))+['public.current_office_exclusions','public.person_identity_matches','public.public_people_list_cached','published.candidate_election_office_facts','published.person_candidate_summaries','reviewed_adoption_private.packages','reviewed_adoption_private.chunks']))
digest='SELECT jsonb_build_object('+','.join("'"+t+"',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text) FROM "+t+' x)' for t in tables)+');'
before=json.loads(ok(digest))
old=(p/'native-psql-once/positive-isolated.sql').read_text();body=(p/'native-psql-once/reviewed-body.sql').read_text();assert old.count(body)==1
prefix=old.split(body)[0]
adapted=(o/'adapted-body.sql').read_text();mark=(o/'mark.sql').read_text()
for mode in ['positive','late-error','fresh-drift']:
 change="UPDATE public.registration_candidates SET candidate_no=candidate_no+10000 WHERE id='"+json.loads((p/'ballot-rebased-reviewed.json').read_text())[0]['before']['id']+"';" if mode=='fresh-drift' else ''
 # Derive target from reviewed adoption function instead of assuming its table name.
 if mode=='fresh-drift':
  change="UPDATE public.person_claims SET claim_value=claim_value||' drift' WHERE id='"+json.loads((p/'cleanup-five.json').read_text())[0]['before']['id']+"';"
 sql=prefix+change+validate+adapted+mark+("SELECT 1/0; COMMIT;" if mode=='late-error' else 'ROLLBACK;')
 t=time.monotonic();v=run(sql);(o/(mode+'.log')).write_text(v.stdout+'\n'+v.stderr)
 assert v.returncode==(0 if mode=='positive' else 3),(mode,v.stderr[-1500:])
 if mode=='late-error':assert 'division by zero' in v.stderr
 if mode=='fresh-drift':assert 'CLEANUP_BEFORE_DRIFT' in v.stderr
 assert json.loads(ok(digest))==before,'full rollback mismatch'
 results.append({'test':mode,'pass':True,'seconds':round(time.monotonic()-t,3),'rollback_tables':len(tables)})
(o/'ISOLATED-RESULT.json').write_text(json.dumps({'results':results,'productionWrites':0},indent=2))
print(json.dumps(results))
