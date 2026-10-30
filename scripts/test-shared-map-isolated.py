"""Exact migration/inverse and cache regression; dedicated disposable DB only."""
from pathlib import Path
import subprocess,json,time
ROOT=Path(__file__).resolve().parents[1]
CMD=['docker','exec','-i','supabase_db_public-office-watch','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d','pow_combined_release_20261029']
def run(s,ok=True):
    v=subprocess.run(CMD,input="SET statement_timeout='30s';\n"+s,text=True,capture_output=True)
    if ok and v.returncode:raise RuntimeError(v.stderr[-2000:])
    return v
def inner(path):
    s=path.read_text();assert s.count('\nBEGIN;\n')==1 and s.endswith('COMMIT;\n')
    return s.replace('\nBEGIN;\n','\n',1)[:-len('COMMIT;\n')]
def main():
    forward=inner(ROOT/'supabase/migrations/20261029102116_share_directory_canonical_map.sql')
    inverse=inner(ROOT/'scripts/sql/rollback-share-directory-canonical-map.sql')
    fingerprint="SELECT md5(pg_get_viewdef('public.public_people'::regclass,true));"
    before=run(fingerprint).stdout
    assert 'c3cb90853c4b78fd8dd44fdedfd21791' in before
    prefix="""BEGIN;
CREATE TEMP TABLE map_before AS SELECT * FROM public.public_people;
CREATE TEMP TABLE directory_before AS SELECT * FROM public.public_people_list;
CREATE TEMP TABLE metadata_before AS SELECT relowner,relacl,reloptions FROM pg_class WHERE oid='public.public_people'::regclass;
CREATE TEMP TABLE attributes_before AS SELECT to_jsonb(a) AS value FROM pg_attribute a WHERE attrelid='public.public_people'::regclass;
"""
    checks="""
DO $$ BEGIN
 IF EXISTS((SELECT * FROM map_before EXCEPT ALL SELECT * FROM public.public_people) UNION ALL (SELECT * FROM public.public_people EXCEPT ALL SELECT * FROM map_before)) THEN RAISE EXCEPTION 'People result changed'; END IF;
 IF EXISTS((SELECT * FROM directory_before EXCEPT ALL SELECT * FROM public.public_people_list) UNION ALL (SELECT * FROM public.public_people_list EXCEPT ALL SELECT * FROM directory_before)) THEN RAISE EXCEPTION 'Directory result changed'; END IF;
 IF EXISTS((SELECT * FROM metadata_before EXCEPT ALL SELECT relowner,relacl,reloptions FROM pg_class WHERE oid='public.public_people'::regclass) UNION ALL (SELECT relowner,relacl,reloptions FROM pg_class WHERE oid='public.public_people'::regclass EXCEPT ALL SELECT * FROM metadata_before)) THEN RAISE EXCEPTION 'Security metadata changed'; END IF;
 IF EXISTS((SELECT * FROM attributes_before EXCEPT ALL SELECT to_jsonb(a) AS value FROM pg_attribute a WHERE attrelid='public.public_people'::regclass) UNION ALL (SELECT to_jsonb(a) AS value FROM pg_attribute a WHERE attrelid='public.public_people'::regclass EXCEPT ALL SELECT * FROM attributes_before)) THEN RAISE EXCEPTION 'Columns changed'; END IF;
END $$;
REFRESH MATERIALIZED VIEW public.public_people_list_cached;
DO $$ BEGIN
 IF EXISTS((SELECT * FROM public.public_people_list_cached EXCEPT ALL SELECT * FROM public.public_people_list) UNION ALL (SELECT * FROM public.public_people_list EXCEPT ALL SELECT * FROM public.public_people_list_cached)) THEN RAISE EXCEPTION 'Cache differs'; END IF;
END $$;
"""
    start=time.monotonic()
    result=run(prefix+forward+checks+inverse+checks+"SELECT count(*) FROM map_before; ROLLBACK;")
    assert run(fingerprint).stdout==before
    for operation,expected in [(forward,'Public people definition drift'),(inverse,'Shared map after-definition drift')]:
        drift="BEGIN; DO $$ DECLARE d text; BEGIN SELECT pg_get_viewdef('public.public_people'::regclass,true) INTO d; EXECUTE 'CREATE OR REPLACE VIEW public.public_people AS '||rtrim(d,';')||' HAVING false'; END $$;"
        v=run(drift+operation,False)
        assert v.returncode and expected in v.stderr,v.stderr
        assert run(fingerprint).stdout==before
    print(json.dumps({'pass':True,'rows':1220,'multiset_difference':0,'native_cache':True,'columns_owner_acl_options':True,'forward_inverse_drift_rejected':True,'failed_transaction_rollback':True,'elapsed_seconds':round(time.monotonic()-start,3),'production_runtime_claim':False}))
if __name__=='__main__':main()
