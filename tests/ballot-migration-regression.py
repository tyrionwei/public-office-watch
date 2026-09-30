"""Disposable PostgreSQL regression; accepts a local psql command, never a URL."""
import os,re,subprocess,sys
from pathlib import Path
# A caller supplies psql (or docker exec ... psql) already bound to an empty test DB.
# SQL refuses any other database or an existing application table.
cmd=sys.argv[1:]
if not cmd: raise SystemExit('Usage: python3 tests/ballot-migration-regression.py <local psql command>')
def run(sql):
 return subprocess.run(cmd+['-X','-At','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
p=run("DO $$ BEGIN IF current_database()<>'pow_ballot_migration_test' OR to_regclass('public.races') IS NOT NULL THEN RAISE EXCEPTION 'Use empty disposable pow_ballot_migration_test'; END IF; END $$;")
assert p.returncode==0,p.stderr
schema="""CREATE TABLE elections(id uuid PRIMARY KEY);
CREATE TABLE regions(id uuid PRIMARY KEY,name text,slug text,region_type text,parent_region_id uuid,official_code text,external_id text,is_public boolean);
CREATE TABLE races(id uuid PRIMARY KEY,election_id uuid,region_id uuid,race_type text,title text,voting_date date,status text,source_name text,source_url text,is_public boolean DEFAULT true,external_id text,district_scope text,seat_count int,updated_at timestamptz);
CREATE TABLE candidates(id uuid,race_id uuid);
INSERT INTO elections VALUES('6d807b31-ddb1-4ff4-9786-fc1388d298ae');
INSERT INTO regions(id,slug) VALUES('042cf107-62f0-426b-bcdc-44900eb1e6ca','tainan-city');"""
p=run(schema);assert p.returncode==0,p.stderr
migration=(Path(__file__).resolve().parents[1]/'supabase/migrations/20260928113720_resolve_2026_ballot_village_race_links.sql').read_text()
migration=re.sub(r'^(?:BEGIN|COMMIT);\s*$','',migration,flags=re.M)
old="""INSERT INTO races(id,election_id,region_id,race_type,title,voting_date,external_id) VALUES('58f65fad-3dee-4352-91f9-a45c317ee73d','6d807b31-ddb1-4ff4-9786-fc1388d298ae','45774a50-3ffa-463c-ab32-97ca0e910577','village_chief','臺南市官田區東西庄里里長選舉','2026-11-28','cec-2026-grassroots-857f4a3d6298f24ffed926512ce5eceb');"""
cases=[
 ('old absent','',None),('old valid',old,None),
 ('changed old identity',old.replace('2026-11-28','2026-11-27'),'Old combined race identity changed'),
 ('old has candidate',old+"INSERT INTO candidates VALUES(gen_random_uuid(),'58f65fad-3dee-4352-91f9-a45c317ee73d');",'Old combined race has candidates'),
 ('old alternate id',old.replace('58f65fad-3dee-4352-91f9-a45c317ee73d','11111111-1111-4111-8111-111111111111'),'Combined race exists under another ID'),
 ('new region collision',"INSERT INTO regions(id,official_code) VALUES(gen_random_uuid(),'67000100017');",'Village region exists under another ID'),
 ('new race collision',"INSERT INTO races(id,external_id) VALUES(gen_random_uuid(),'cec-2026-village-chief-67000100017');",'Village race exists under another ID'),
 ('new target id wrong',"INSERT INTO races(id,title) VALUES('50d51085-f950-4ea6-982b-9166a51f791f','Wrong');",'New village race identity collision'),
]
verify="""DO $$ BEGIN
 IF (SELECT count(*) FROM races WHERE id IN ('50d51085-f950-4ea6-982b-9166a51f791f','fe21df5e-f078-4658-b850-d43900202afe') AND is_public AND seat_count=1)<>2 THEN RAISE EXCEPTION 'missing target races'; END IF;
 IF EXISTS(SELECT 1 FROM races WHERE id='58f65fad-3dee-4352-91f9-a45c317ee73d' AND is_public) THEN RAISE EXCEPTION 'old race still public'; END IF;
END $$;"""
for name,setup,error in cases:
 p=run('BEGIN;'+setup+migration+verify+(migration+verify if error is None else '')+'ROLLBACK;')
 assert (p.returncode==0 if error is None else p.returncode!=0 and error in p.stderr),(name,p.stderr)
 assert run('SELECT count(*) FROM races;').stdout.strip()=='0','case leaked data'
 print('PASS',name)
print('8 isolated ballot migration cases passed, including repeat execution and rollback')
