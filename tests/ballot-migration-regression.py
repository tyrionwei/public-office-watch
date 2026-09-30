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
schema+="""CREATE SCHEMA published;
CREATE VIEW published.races AS SELECT id AS race_id,election_id,race_type,voting_date,'fixture event'::text AS event_key,'fixture election'::text AS election_name,'臺南市'::text AS region_key FROM public.races WHERE is_public;
CREATE MATERIALIZED VIEW published.election_race_summaries AS
SELECT election_id,count(*)::integer AS race_count,array_agg(DISTINCT race_type ORDER BY race_type) AS race_types FROM published.races GROUP BY election_id;
CREATE MATERIALIZED VIEW published.election_race_facets AS SELECT election_id,race_type,region_key,region_key AS region_label,count(*)::integer AS race_count FROM published.races GROUP BY election_id,race_type,region_key;
CREATE MATERIALIZED VIEW published.event_summaries AS SELECT event_key,min(voting_date) AS voting_date,array_agg(DISTINCT election_id ORDER BY election_id) AS election_ids,array_agg(DISTINCT election_name ORDER BY election_name) AS election_names,count(*)::integer AS race_count FROM published.races GROUP BY event_key;"""
p=run(schema);assert p.returncode==0,p.stderr
summary_migration=(Path(__file__).resolve().parents[1]/'supabase/migrations/20260930083500_refresh_ballot_election_summaries.sql').read_text()
summary_migration=re.sub(r'^(?:BEGIN|COMMIT);\s*$','',summary_migration,flags=re.M)
verify_summary="""DO $$ BEGIN
 IF (SELECT sum(race_count) FROM published.election_race_summaries) IS DISTINCT FROM 2::bigint THEN RAISE EXCEPTION 'ballot summary not refreshed'; END IF;
 IF (SELECT race_types FROM published.election_race_summaries LIMIT 1) IS DISTINCT FROM ARRAY['village_chief']::text[] THEN RAISE EXCEPTION 'ballot summary types changed'; END IF;
 IF (SELECT sum(race_count) FROM published.election_race_facets) IS DISTINCT FROM 2::bigint OR (SELECT sum(race_count) FROM published.event_summaries) IS DISTINCT FROM 2::bigint THEN RAISE EXCEPTION 'race facets or event summary stale'; END IF;
END $$;"""
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
 p=run('BEGIN;'+setup+migration+verify+summary_migration+verify_summary+(migration+verify+summary_migration+verify_summary if error is None else '')+'ROLLBACK;')
 assert (p.returncode==0 if error is None else p.returncode!=0 and error in p.stderr),(name,p.stderr)
 assert run('SELECT count(*) FROM races;').stdout.strip()=='0','case leaked data'
 print('PASS',name)
print('8 isolated ballot migration cases passed, including repeat execution and rollback')

# Remove only this test's known fixture objects, without CASCADE. The following
# cache-topology test in CI retains its empty-published-schema guard.
p=run("DROP MATERIALIZED VIEW published.event_summaries,published.election_race_facets,published.election_race_summaries;DROP VIEW published.races;DROP SCHEMA published;")
assert p.returncode==0,p.stderr
