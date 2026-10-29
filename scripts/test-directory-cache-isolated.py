"""Exercise the exact migration/inverse only in the existing dedicated isolation DB.

Run from the repository root: python3 scripts/test-directory-cache-isolated.py
No credentials, production endpoint, role grants, or trigger overrides are used.
"""
import hashlib,json,pathlib,subprocess

ROOT=pathlib.Path(__file__).resolve().parents[1]
DB='pow_combined_release_20261029'
CMD=['docker','exec','-i','supabase_db_public-office-watch','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB]
def sql(query,success=True):
    result=subprocess.run(CMD,input="SET statement_timeout='30s';\n"+query,text=True,capture_output=True)
    if success and result.returncode:raise RuntimeError(result.stderr[-2000:])
    return result
def body(path):
    value=path.read_text()
    assert value.count('\nBEGIN;\n')==1 and value.endswith('COMMIT;\n')
    return value.replace('\nBEGIN;\n','\n',1)[:-len('COMMIT;\n')]
def snapshot():
    return sql("SELECT md5(pg_get_viewdef('public.public_people_list'::regclass,true)),relowner,relacl,reloptions FROM pg_class WHERE oid='public.public_people_list'::regclass;").stdout
def main():
    migration=ROOT/'supabase/migrations/20261029092500_bound_historical_president_lookup.sql'
    inverse=ROOT/'scripts/sql/rollback-bound-historical-president-lookup.sql'
    before=snapshot()
    assert '506c396b7174e54cd2a5ded7286a019d' in before,'Isolation baseline changed'
    # Actual view drift, followed by the unmodified migration guard. Connection
    # failure rolls back the synthetic change and cannot persist a half migration.
    negative=sql("BEGIN; DO $$ DECLARE d text; BEGIN SELECT pg_get_viewdef('public.public_people_list'::regclass,true) INTO d; EXECUTE 'CREATE OR REPLACE VIEW public.public_people_list AS '||rtrim(d,';')||' WHERE false'; END $$;\n"+body(migration),False)
    assert negative.returncode!=0 and 'People directory definition drift' in negative.stderr
    assert snapshot()==before,'Failed migration left schema changes'
    check="""
DO $check$ BEGIN
 IF EXISTS((SELECT * FROM cache_before EXCEPT ALL SELECT * FROM public.public_people_list)
 UNION ALL (SELECT * FROM public.public_people_list EXCEPT ALL SELECT * FROM cache_before)) THEN
  RAISE EXCEPTION 'Directory result changed'; END IF;
 IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) FROM pg_attribute a WHERE attrelid='public.public_people_list'::regclass)
 IS DISTINCT FROM (SELECT attributes FROM cache_metadata) THEN RAISE EXCEPTION 'Columns changed'; END IF;
 IF EXISTS(WITH cases AS (SELECT pid,owner,qualifies FROM unnest(ARRAY['subject','other',NULL]::text[]) pid
 CROSS JOIN unnest(ARRAY['subject','other',NULL]::text[]) owner CROSS JOIN unnest(ARRAY[true,false,NULL]::boolean[]) qualifies)
 SELECT 1 FROM cases WHERE ((pid='subject' AND EXISTS(SELECT 1 WHERE owner=pid AND qualifies)) IS TRUE)
 IS DISTINCT FROM ((pid='subject' AND EXISTS(SELECT 1 WHERE owner='subject' AND qualifies)) IS TRUE)) THEN
  RAISE EXCEPTION 'CASE boundary changed'; END IF;
END $check$;
REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT count(*) AS checked_rows FROM cache_before;
"""
    positive=sql("BEGIN; CREATE TEMP TABLE cache_before AS SELECT * FROM public.public_people_list; CREATE TEMP TABLE cache_metadata AS SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) AS attributes FROM pg_attribute a WHERE attrelid='public.public_people_list'::regclass;\n"+body(migration)+check+body(inverse)+"DO $$ BEGIN IF md5(pg_get_viewdef('public.public_people_list'::regclass,true))<>'506c396b7174e54cd2a5ded7286a019d' THEN RAISE EXCEPTION 'Inverse mismatch'; END IF; END $$; ROLLBACK;")
    assert snapshot()==before,'Outer rollback changed metadata'
    print(json.dumps({'passed':True,'exact_multiset':True,'case_boundaries':27,'column_owner_acl_options_preserved':True,'definition_drift_rejected':True,'failed_migration_rolled_back':True,'inverse_exact':True,'native_cache_refresh':True,'production_writes':0,'migration_sha256':hashlib.sha256(migration.read_bytes()).hexdigest()}))
if __name__=='__main__':main()
