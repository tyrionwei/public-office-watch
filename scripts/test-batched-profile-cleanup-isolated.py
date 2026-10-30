from pathlib import Path
import json,subprocess,time
import argparse
a=argparse.ArgumentParser();a.add_argument('--private-input',type=Path,required=True);a.add_argument('--baseline-repo',type=Path,required=True);args=a.parse_args()
p=args.private_input.resolve();o=p/'batch-cleanup-local';o.mkdir(exist_ok=True)
r=args.baseline_repo.resolve();new=(Path(__file__).parent/'sql/reviewed-profile-cleanup.sql').read_text();old=(r/'scripts/sql/reviewed-profile-cleanup.sql').read_text()
cmd=['docker','exec','-i','supabase_db_public-office-watch','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d','pow_combined_release_20261029']
def run(s):return subprocess.run(cmd,input=s,text=True,capture_output=True,timeout=110)
def js(v):return "'"+json.dumps(v,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb"
tables=['public.person_claims','public.people','public.public_people_list_cached','published.candidate_election_office_facts','published.person_candidate_summaries']
digest='SELECT jsonb_build_object('+','.join("'"+t+"',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text) FROM "+t+' x)' for t in tables)+');'
v=run(digest);assert v.returncode==0;baseline=v.stdout
v=subprocess.run(cmd+['-v','fixed=true'],input=new+'\n'+(p/'cleanup-p2-regression.sql').read_text(),text=True,capture_output=True,timeout=110)
(o/'p2.log').write_text(v.stdout+v.stderr);assert v.returncode==0,v.stderr[-1500:];assert run(digest).stdout==baseline
rows=json.loads((p/'cleanup-five.json').read_text());assert len(rows)==5
prefix="BEGIN; SET LOCAL statement_timeout='45s'; SET LOCAL transaction_timeout='90s'; SET LOCAL lock_timeout='1s'; DO $$ BEGIN IF current_database()<>'pow_combined_release_20261029' THEN RAISE EXCEPTION 'WRONG_ISOLATION'; END IF; END $$;\n"
for name in ['20261029092500_bound_historical_president_lookup.sql','20261029102116_share_directory_canonical_map.sql']:
 s=(r/'supabase/migrations'/name).read_text();prefix+=s.replace('\nBEGIN;\n','\n',1)[:-len('COMMIT;\n')]
prefix+=old+'\n'+''.join('SELECT pg_temp.clean_claim('+js(x['after'])+','+js(x['before'])+');\n' for x in rows)+'DROP FUNCTION pg_temp.clean_claim(jsonb,jsonb);\n'
node="SELECT jsonb_build_object('cache_relfilenode',relfilenode) FROM pg_class WHERE oid='public.public_people_list_cached'::regclass;\n"
results=[];after=[]
for label,helper in [('single-five',old),('batch-five',new)]:
 sql=prefix+helper+node
 if label=='single-five':sql+=''.join('SELECT pg_temp.clean_claim('+js(x['before'])+','+js(x['after'])+');\n'+node for x in rows)
 else:sql+='SELECT pg_temp.clean_claims('+js(rows)+');\n'+node
 for x in rows:
  sql+="DO $$ DECLARE a public.person_claims; BEGIN SELECT * INTO STRICT a FROM public.person_claims WHERE id='"+x['after']['id']+"'; IF to_jsonb(a) IS DISTINCT FROM to_jsonb(jsonb_populate_record(a,"+js(x['after'])+")) OR public.official_profile_claim_allowed(a.claim_type,a.claim_value,a.claim_json,a.person_id,a.source_url) IS NOT TRUE THEN RAISE EXCEPTION 'RESULT_MISMATCH'; END IF; END $$;\n"
 sql+=digest+'ROLLBACK;'
 t=time.monotonic();v=run(sql);(o/(label+'.log')).write_text(v.stdout+v.stderr);assert v.returncode==0,(label,v.stderr[-1500:]);assert run(digest).stdout==baseline
 parsed=[json.loads(l) for l in v.stdout.splitlines() if l.startswith('{')];nodes=[x['cache_relfilenode'] for x in parsed if 'cache_relfilenode' in x];assert len(set(nodes))==len(nodes)
 after.append(parsed[-1]);results.append({'mode':label,'qualifying_updates':len(nodes)-1,'native_cache_rebuilds_observed':len(nodes)-1,'seconds_including_inverse_setup':round(time.monotonic()-t,3),'rollback_exact':True})
assert after[0]==after[1],'batch/single final rows differ'
# One stale input prevents the whole batch before any write; one post-trigger
# mutation rejects after all row updates and must unwind every row/cache change.
bad=json.loads(json.dumps(rows));bad[-1]['before']['claim_value']+=' drift'
for label,batch,extra,error in [('one-before-drift',bad,'','CLEANUP_BEFORE_DRIFT'),('one-after-trigger',rows,"CREATE FUNCTION pg_temp.batch_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='"+rows[-1]['before']['id']+"'::uuid AND pg_trigger_depth()=1 THEN UPDATE public.person_claims SET source_name='synthetic-after-rewrite' WHERE id=NEW.id; END IF; RETURN NULL; END $$; CREATE TRIGGER batch_negative_after AFTER UPDATE ON public.person_claims FOR EACH ROW EXECUTE FUNCTION pg_temp.batch_rewrite();",'CLEANUP_AFTER_DRIFT')]:
 sql=prefix+new+extra+'SELECT pg_temp.clean_claims('+js(batch)+'); COMMIT;'
 v=run(sql);(o/(label+'.log')).write_text(v.stdout+v.stderr);assert v.returncode==3 and error in v.stderr,(label,v.stderr[-1500:]);assert run(digest).stdout==baseline
 results.append({'mode':label,'rejected':True,'all_five_and_cache_rollback':True})
(o/'RESULT.json').write_text(json.dumps({'original_P2_cases':5,'P2_pass':True,'same_final_table_hashes':True,'results':results,'productionWrites':0},indent=2));print((o/'RESULT.json').read_text())
