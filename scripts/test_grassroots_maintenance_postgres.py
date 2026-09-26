"""新 executor 的小型 PostgreSQL 故障測試；不匯入人物資料、不重跑精簡。

只允許 /tmp/pow-* Unix socket、pow_executor_fixture DB 及明確 fixture 註記。
未提供 POW_EXECUTOR_TEST_DSN 時明列 skip；不讀正式或本機研究 DB 設定。
"""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import uuid

spec = importlib.util.spec_from_file_location('fault_fixtures', Path(__file__).with_name('test_grassroots_maintenance_executor.py'))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
e = fixtures.executor


@unittest.skipUnless(os.environ.get('POW_EXECUTOR_TEST_DSN'), 'requires owned isolated executor fixture')
class PostgresExecutorTest(unittest.TestCase):
    def setUp(self):
        import psycopg
        from psycopg.conninfo import conninfo_to_dict
        self.psycopg = psycopg
        self.dsn = os.environ['POW_EXECUTOR_TEST_DSN']
        params = conninfo_to_dict(self.dsn)
        self.assertTrue(params.get('host','').startswith('/tmp/pow-'))
        self.assertEqual(params.get('dbname'), 'pow_executor_fixture')
        self.assertNotIn('service', params)
        self.assertNotIn('hostaddr', params)
        self.conn = psycopg.connect(self.dsn, autocommit=True)
        self.addCleanup(self.conn.close)
        self.assertEqual(self.conn.execute("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()").fetchone()[0], 'owned synthetic executor fixture')
        self.schema = 'exec_'+uuid.uuid4().hex[:10]
        self.table = self.schema+'.records'
        self.index = self.schema+'.records_value_idx'
        self.cache = self.schema+'.cache'
        self.conn.execute('CREATE SCHEMA '+self.schema)
        self.conn.execute('CREATE TABLE '+self.table+' (id integer PRIMARY KEY, value text NOT NULL) WITH (autovacuum_enabled=false)')
        self.conn.execute('INSERT INTO '+self.table+" SELECT x,repeat(md5(x::text),16) FROM generate_series(1,500) x")
        self.conn.execute('CREATE INDEX records_value_idx ON '+self.table+' (value)')
        self.conn.execute('DELETE FROM '+self.table+' WHERE id%2=0')
        self.conn.execute('CREATE MATERIALIZED VIEW '+self.cache+' AS SELECT * FROM '+self.table)
        self.temp = tempfile.TemporaryDirectory(prefix='pow-executor-contract-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root/'state.json'
        self.hash = self.conn.execute("SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id)) FROM "+self.table+' t').fetchone()[0]

    def guard(self, populated=None, cache_content=False, index_present=None):
        parts = ["(SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id)) FROM "+self.table+" t)='"+self.hash+"'"]
        if populated is not None:
            parts.append("(SELECT relispopulated FROM pg_class WHERE oid='"+self.cache+"'::regclass)="+str(populated).lower())
        if cache_content:
            parts.append("(SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id)) FROM "+self.cache+" t)='"+self.hash+"'")
        if index_present is not None:
            parts.append("to_regclass('"+self.index+"') IS "+('NOT ' if index_present else '')+'NULL')
        return 'SELECT '+' AND '.join(parts)

    def plan(self, kinds):
        plan, _, _ = fixtures.make_plan(self.root, kinds)
        plan['target']['identity'] = e.Database(self.conn,plan).identity()
        plan['target']['connection'] = {'host':self.psycopg.conninfo.conninfo_to_dict(self.dsn)['host'],
                                        'port':'5432','dbname':'pow_executor_fixture','user':'postgres'}
        plan['ceiling_bytes'] = 500000000
        plan['watch'] = [self.table,self.index,self.cache]
        plan['maintenance_guard'] = fixtures.put(self.root,'maintenance.sql',
            "SELECT current_database()='pow_executor_fixture' AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active')")
        for route in plan['routes'].values():
            route['entry'] = fixtures.put(self.root,route['phases'][0]+'-entry.sql',self.guard())
        populated = True; index_present = True
        definition = self.conn.execute('SELECT pg_get_indexdef(%s::regclass)',(self.index,)).fetchone()[0]
        for p in plan['phases']:
            p['reserve_bytes'] = 1000000
            p['post_max_cluster_bytes'] = 490000000
            if p['kind'] != 'gate':
                p['relation'] = self.index if p['kind'] in e.INDEX_KINDS else self.cache if p['kind'].startswith('cache_') else self.table
            p['pre'] = fixtures.put(self.root,p['id']+'-pre.sql',self.guard(populated,index_present=index_present))
            if p['kind']=='cache_clear': populated = False
            if p['kind']=='cache_refresh': populated = True
            if p['kind']=='index_drop': index_present = False
            if p['kind']=='index_create': index_present = True
            if p['kind'] in e.INDEX_KINDS:
                p['definition'] = fixtures.put(self.root,p['id']+'-definition.sql',definition)
            p['post'] = fixtures.put(self.root,p['id']+'-post.sql',self.guard(populated,cache_content=populated,index_present=index_present))
            for key in ('recovery_before','recovery_after'):
                p[key] = fixtures.put(self.root,p['id']+'-'+key+'.sql',self.guard())
        # Recovery is an actual cache rebuild, not an acknowledgement-only gate.
        recovery = plan['phases'][-1]
        recovery.update(kind='cache_refresh',relation=self.cache)
        recovery['pre'] = fixtures.put(self.root,'recovery-pre.sql',self.guard())
        recovery['post'] = fixtures.put(self.root,'recovery-post.sql',self.guard(True,cache_content=True))
        self.plan_data = plan
        return self.seal()

    def seal(self):
        plan = self.plan_data
        overrides = {p['id']:{'operation_extra_bytes':16000000,'recovery_before_extra_bytes':16000000,
            'recovery_extra_bytes':16000000,'max_after_delta_bytes':16000000,
            'components':{'heap_toast':4000000,'indexes':4000000,'temporary':4000000,'other':4000000},
            'relation_max_bytes':{name:8000000 for name in plan['watch']}} for p in plan['phases']}
        path,digest=fixtures.seal_plan(self.root,plan,overrides)
        self.plan_sha=digest
        self.plan_data=e.load_plan(path,digest)
        return self.plan_data

    def run_executor(self, route='prepare', max_phases=20, db_class=e.Database, **options):
        with e.connect(self.plan_data,self.dsn) as conn:
            journal=e.Journal(self.state,self.plan_sha)
            try:
                return e.Executor(self.plan_data,self.root,db_class(conn,self.plan_data),journal).run(route,max_phases,**options)
            finally:
                journal.close()

    def test_typed_cache_index_rewrite_and_reuse_route(self):
        self.plan(('cache_clear','vacuum_reuse','vacuum_full','reindex_table','index_drop','index_create','reindex_index','cache_refresh'))
        self.assertEqual(self.run_executor()['status'],'complete')
        items=json.loads(self.state.read_text())['runs'][0]['items']
        self.assertEqual(len(items),8)
        self.assertTrue(all(x['status']=='done' for x in items))
        self.assertEqual(items[1]['measured_relation_reclaimed_bytes'],0)
        self.assertTrue(items[1]['reuse_only'])
        self.assertTrue(self.conn.execute(self.guard(True,True)).fetchone()[0])

    def test_disconnect_after_commit_reconciles_without_second_rewrite(self):
        self.plan(('vacuum_full',))
        class Disconnect(e.Database):
            def execute(self,sql):
                super().execute(sql)
                self.conn.close()
                raise ConnectionError('fixture disconnect after committed operation')
        with self.assertRaisesRegex(e.Stop,'phase_stopped'):
            self.run_executor(db_class=Disconnect)
        filenode=self.conn.execute('SELECT pg_relation_filenode(%s::regclass)',(self.table,)).fetchone()[0]
        result=self.run_executor(reconcile_only=True)
        self.assertEqual(result['status'],'committed_verified')
        self.assertEqual(self.conn.execute('SELECT pg_relation_filenode(%s::regclass)',(self.table,)).fetchone()[0],filenode)
        self.assertEqual(self.run_executor()['status'],'complete')

    def test_statement_timeout_not_applied_can_recover_cleared_cache(self):
        self.plan(('cache_clear','vacuum_full'))
        self.plan_data['phases'][1]['statement_timeout_ms']=1000
        self.seal()
        self.assertEqual(self.run_executor(max_phases=1)['status'],'checkpoint')
        driver, dsn, table = self.psycopg, self.dsn, self.table
        class LockBeforeWrite(e.Database):
            def execute(self,sql):
                with driver.connect(dsn) as blocker:
                    blocker.execute('LOCK TABLE '+table+' IN ACCESS EXCLUSIVE MODE')
                    super().execute(sql)
        with self.assertRaisesRegex(e.Stop,'phase_stopped'):
            self.run_executor(db_class=LockBeforeWrite)
        self.assertEqual(self.run_executor(reconcile_only=True)['status'],'not_applied')
        self.assertEqual(self.run_executor(route='recover')['status'],'complete')
        self.assertTrue(self.conn.execute(self.guard(True,True)).fetchone()[0])
        with self.assertRaisesRegex(e.Stop,'forward_after_recovery'):
            self.run_executor()

    def test_same_session_advisory_lock_excludes_second_executor(self):
        self.plan(('vacuum_full',))
        self.conn.execute('SELECT pg_advisory_lock(20260926,53)')
        try:
            with self.assertRaisesRegex(e.Stop,'another_database_executor'):
                self.run_executor()
        finally:
            self.conn.execute('SELECT pg_advisory_unlock(20260926,53)')
        self.assertFalse(self.state.exists())

    def test_readonly_assertion_rejects_writing_function(self):
        self.plan(('vacuum_full',))
        self.conn.execute('CREATE FUNCTION '+self.schema+'.forbidden_write() RETURNS boolean LANGUAGE sql AS $$ INSERT INTO '+self.table+" VALUES (999,'forbidden') RETURNING true $$")
        db=e.Database(self.conn,self.plan_data)
        with self.assertRaises(self.psycopg.errors.ReadOnlySqlTransaction):
            db.guard('SELECT '+self.schema+'.forbidden_write()')
        self.assertEqual(self.conn.execute('SELECT count(*) FROM '+self.table+' WHERE id=999').fetchone()[0],0)


if __name__=='__main__':
    unittest.main()
