"""Exercise both released/local directory layouts in a disposable database."""
import re,subprocess,sys
from pathlib import Path
cmd=sys.argv[1:]
if not cmd:raise SystemExit('Supply the local disposable psql command')
def run(sql):return subprocess.run(cmd+['-X','-At','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
p=run("DO $$ BEGIN IF current_database()<>'pow_ballot_migration_test' OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='published') THEN RAISE EXCEPTION 'Use disposable test DB with no published schema'; END IF; END $$;");assert p.returncode==0,p.stderr
root=Path(__file__).resolve().parents[1]
paths=['supabase/migrations/20260928130407_enforce_official_person_profile_sources.sql','supabase/migrations/20260928133331_correct_reviewed_identity_links.sql','scripts/build-registration-profile-release.mjs']
blocks=[re.search(r'DO \$directory_refresh\$.*?END \$directory_refresh\$;', (root/f).read_text(),re.S).group() for f in paths]
assert len(set(blocks))==1,'Directory refresh paths diverged'
setup='BEGIN;CREATE SCHEMA published;CREATE TABLE published.fixture(value int);INSERT INTO published.fixture VALUES(1);'
cases=[('released materialized directory','CREATE MATERIALIZED VIEW published.people_directory AS SELECT * FROM published.fixture;',None),('local snapshot + view','CREATE MATERIALIZED VIEW published.people_directory_snapshot AS SELECT * FROM published.fixture;CREATE VIEW published.people_directory AS SELECT * FROM published.people_directory_snapshot;',None),('wrong relation type','CREATE VIEW published.people_directory AS SELECT * FROM published.fixture;','Expected published people directory materialized view is missing'),('missing directory','', 'Expected published people directory materialized view is missing')]
for name,layout,error in cases:
 p=run(setup+layout+'INSERT INTO published.fixture VALUES(2);'+blocks[0]+"DO $$ BEGIN IF (SELECT sum(value) FROM published.people_directory)<>3 THEN RAISE EXCEPTION 'Stale directory';END IF;END $$;ROLLBACK;")
 assert (p.returncode==0 if error is None else p.returncode!=0 and error in p.stderr),(name,p.stderr)
 print('PASS',name)
print('4 cache topology cases passed')
