from pathlib import Path
import hashlib,json,uuid
import argparse
a=argparse.ArgumentParser(description='Prepare private PR62 staging requests; never sends SQL.');a.add_argument('--private-input',type=Path,required=True);args=a.parse_args()
p=args.private_input.resolve()
o=p/'api-stage-once';o.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(p/'PRODUCTION-APPLY.sql').read_bytes()
assert sha(raw)=='46a254d069f67fdb8a4cdd3e20167df62748d96a2eb961d86fd331ffa67ea0be'
body=(p/'native-psql-once/reviewed-body.sql').read_text()
rows=json.loads((p/'ballot-rebased-reviewed.json').read_text())
payload=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode()
literal="'"+payload.decode().replace("'","''")+"'::jsonb"
assert body.count(literal)==2
ids=[x['before']['id'] for x in rows];assert len(ids)==len(set(ids))==1182
assert all(x['before']['id']==x['after']['id'] for x in rows)
uid=str(uuid.uuid5(uuid.NAMESPACE_URL,'pow-pr62:'+sha(raw)))
chunks=[payload[i:i+160000] for i in range(0,len(payload),160000)]
manifest={'original_sql_sha256':sha(raw),'payload_sha256':sha(payload),'payload_bytes':len(payload),'chunk_count':len(chunks),'chunk_sha256':[sha(x) for x in chunks],'ballot_count':1182,'ballot_ids':ids,'cleanups':5,'office_people':5,'weng':1,'source_head':'1ebaed9ee9ede8d774cc0133ecd4d0be0c8767c4'}
def lit(s):return "'"+s.replace("'","''")+"'"
mj=json.dumps(manifest,separators=(',',':'))
migration='''-- Private transport only: no business triggers, public RPC or browser grants.
BEGIN;
CREATE SCHEMA reviewed_adoption_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA reviewed_adoption_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE reviewed_adoption_private.packages (
 id uuid PRIMARY KEY, manifest jsonb NOT NULL,
 status text NOT NULL DEFAULT 'staging' CHECK(status IN ('staging','applied')),
 applied_at timestamptz,
 CHECK((status='applied')=(applied_at IS NOT NULL))
);
CREATE TABLE reviewed_adoption_private.chunks (
 package_id uuid NOT NULL REFERENCES reviewed_adoption_private.packages(id),
 part integer NOT NULL CHECK(part>=0), payload bytea NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(package_id,part),
 CHECK(octet_length(payload) BETWEEN 1 AND 160000),
 CHECK(encode(pg_catalog.sha256(payload),'hex')=sha256)
);
ALTER TABLE reviewed_adoption_private.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewed_adoption_private.chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA reviewed_adoption_private FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON SCHEMA reviewed_adoption_private IS 'Restricted reviewed release input transport; never an API-exposed schema. Retain failed inputs for inspection; cleanup requires approval.';
COMMIT;
'''
(o/'migration.sql').write_text(migration)
limits="SET LOCAL statement_timeout='45s'; SET LOCAL transaction_timeout='90s'; SET LOCAL lock_timeout='1s'; SET LOCAL idle_in_transaction_session_timeout='10s';\n"
init="BEGIN; "+limits+f"INSERT INTO reviewed_adoption_private.packages(id,manifest) VALUES('{uid}',{lit(mj)}::jsonb) ON CONFLICT DO NOTHING; DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM reviewed_adoption_private.packages WHERE id='{uid}' AND manifest={lit(mj)}::jsonb AND status='staging') THEN RAISE EXCEPTION 'PACKAGE_MISMATCH'; END IF; END $$; COMMIT;"
(o/'upload-init.sql').write_text(init)
for i,b in enumerate(chunks):
 s="BEGIN; "+limits+f"DO $$ BEGIN PERFORM 1 FROM reviewed_adoption_private.packages WHERE id='{uid}' AND status='staging' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'PACKAGE_NOT_STAGING'; END IF; INSERT INTO reviewed_adoption_private.chunks VALUES('{uid}',{i},decode('{b.hex()}','hex'),'{sha(b)}') ON CONFLICT DO NOTHING; IF NOT EXISTS(SELECT 1 FROM reviewed_adoption_private.chunks WHERE package_id='{uid}' AND part={i} AND sha256='{sha(b)}' AND payload=decode('{b.hex()}','hex')) THEN RAISE EXCEPTION 'CHUNK_CONFLICT'; END IF; END $$; COMMIT;"
 # Do not repeat large bytes for idempotence: the CHECK constraint binds stored hash to bytes.
 s=s.replace(f" AND payload=decode('{b.hex()}','hex')",'')
 assert len(json.dumps({'query':s}).encode())<384000
 (o/f'upload-{i:03}.sql').write_text(s)
validation=f'''LOCK TABLE reviewed_adoption_private.packages, reviewed_adoption_private.chunks IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE reviewed_release_payload(payload jsonb NOT NULL) ON COMMIT DROP;
DO $validate$ DECLARE b bytea; m jsonb; actual_ids jsonb; BEGIN
 SELECT manifest INTO m FROM reviewed_adoption_private.packages WHERE id='{uid}' AND status='staging' FOR UPDATE;
 IF m IS DISTINCT FROM {lit(mj)}::jsonb THEN RAISE EXCEPTION 'PACKAGE_MISMATCH'; END IF;
 IF (SELECT count(*) FROM reviewed_adoption_private.chunks WHERE package_id='{uid}')<>{len(chunks)} OR EXISTS(SELECT 1 FROM reviewed_adoption_private.chunks WHERE package_id='{uid}' AND (part>={len(chunks)} OR sha256 IS DISTINCT FROM m->'chunk_sha256'->>part OR encode(pg_catalog.sha256(payload),'hex')<>sha256)) THEN RAISE EXCEPTION 'CHUNKS_INCOMPLETE_OR_TAMPERED'; END IF;
 SELECT string_agg(payload,''::bytea ORDER BY part) INTO b FROM reviewed_adoption_private.chunks WHERE package_id='{uid}';
 IF octet_length(b)<>{len(payload)} OR encode(pg_catalog.sha256(b),'hex')<>'{sha(payload)}' THEN RAISE EXCEPTION 'PAYLOAD_HASH_MISMATCH'; END IF;
 INSERT INTO reviewed_release_payload VALUES(convert_from(b,'UTF8')::jsonb);
 IF (SELECT jsonb_array_length(payload) FROM reviewed_release_payload)<>1182 THEN RAISE EXCEPTION 'SCOPE_COUNT'; END IF;
 SELECT jsonb_agg(x->'before'->>'id' ORDER BY ord) INTO actual_ids FROM reviewed_release_payload, jsonb_array_elements(payload) WITH ORDINALITY a(x,ord);
 IF actual_ids IS DISTINCT FROM m->'ballot_ids' OR (SELECT count(DISTINCT x->'before'->>'id') FROM reviewed_release_payload,jsonb_array_elements(payload) a(x))<>1182 OR EXISTS(SELECT 1 FROM reviewed_release_payload,jsonb_array_elements(payload) a(x) WHERE x->'before'->>'id' IS DISTINCT FROM x->'after'->>'id') THEN RAISE EXCEPTION 'SCOPE_UUID'; END IF;
END $validate$;
'''
adapted=body.replace(literal,'(SELECT payload FROM pg_temp.reviewed_release_payload)')
assert adapted.replace('(SELECT payload FROM pg_temp.reviewed_release_payload)',literal)==body
mark=f"UPDATE reviewed_adoption_private.packages SET status='applied',applied_at=clock_timestamp() WHERE id='{uid}' AND status='staging';\n"
env="DO $$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'WRONG_TARGET'; END IF; IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20261028080055','20261029092500','20261029102116','20261030054737'))<>4 THEN RAISE EXCEPTION 'MIGRATION_PREREQUISITE'; END IF; IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state LIKE 'idle in transaction%') THEN RAISE EXCEPTION 'OPEN_TRANSACTION'; END IF; END $$;\n"
final='BEGIN;\n'+limits+env+validation+adapted+mark+f"COMMIT; SELECT id,status,applied_at FROM reviewed_adoption_private.packages WHERE id='{uid}';"
(o/'FINAL-APPLY.sql').write_text(final)
(o/'validation.sql').write_text(validation)
(o/'adapted-body.sql').write_text(adapted)
(o/'mark.sql').write_text(mark)
manifest.update(package_id=uid,final_sql_sha256=sha(final.encode()),final_sql_bytes=len(final.encode()),byte_equivalent_body_reconstruction=True,max_upload_request_bytes=max(len(json.dumps({'query':x.read_text()}).encode()) for x in o.glob('upload-*.sql')))
(o/'MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({k:v for k,v in manifest.items() if k not in ['ballot_ids','chunk_sha256']}))
