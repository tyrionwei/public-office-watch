"""Checkpoint recovery on a tiny owned PG fixture; never capacity certification."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('postgres_fixtures',Path(__file__).with_name('test_grassroots_maintenance_postgres.py'))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
e=base.e
put=base.fixtures.put

@unittest.skipUnless(os.environ.get('POW_EXECUTOR_TEST_DSN'),'requires owned isolated executor fixture')
class CheckpointPostgresTest(base.PostgresExecutorTest):
    # Run only the tests named checkpoint_* below; inherited tests retain their
    # separate existing evidence and are not part of this focused invocation.
    def bootstrap_plan(self):
        self.plan(('cache_clear',))
        p=self.plan_data
        p['maintenance_guard']=put(self.root,'checkpoint-maintenance.sql',
            "SELECT current_database()='pow_executor_fixture' AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid NOT IN (pg_backend_pid(),"+str(self.conn.info.backend_pid)+") AND state='active')")
        p['format']=e.CHECKPOINT_FORMAT
        old=p['routes'].pop('recover')
        gate=copy.deepcopy(p['phases'][-1]);gate.update(id='service-gate',kind='gate')
        gate.pop('relation')
        for field in ('pre','post','recovery_before','recovery_after'):
            gate[field]=put(self.root,'gate-'+field+'.sql',self.guard(True,cache_content=True))
        p['phases'].append(gate)
        cleared_guard=put(self.root,'branch-cleared.sql',self.guard(False))
        intact_guard=put(self.root,'branch-intact.sql',self.guard(True,cache_content=True))
        p['recovery_branches']=[
            {'id':'not-applied','case':'not_applied','from':{'route':'prepare','completed':[],
              'pending':{'id':'phase-0','status':'not_applied_verified'}},'entry':intact_guard,'phases':['service-gate']},
            {'id':'cleared','case':'cache_cleared','from':{'route':'prepare','completed':['phase-0'],'pending':None},
             'entry':cleared_guard,'phases':old['phases']+['service-gate']}]
        return self.seal()

    def node(self):
        return self.conn.execute('SELECT pg_relation_filenode(%s::regclass)',(self.cache,)).fetchone()[0]

    def test_checkpoint_not_applied_returns_original_service_without_refresh(self):
        self.bootstrap_plan()
        self.plan_data['phases'][0]['statement_timeout_ms']=1000;self.seal()
        original=self.node()
        driver,dsn,cache=self.psycopg,self.dsn,self.cache
        # PostgreSQL does not support LOCK TABLE on an MV on every version; use
        # a harmless transaction-held ACCESS EXCLUSIVE lock via ALTER MATERIALIZED
        # VIEW owner-to-self, which is confined to this disposable fixture.
        class LockedMV(e.Database):
            def execute(self,sql):
                with driver.connect(dsn) as blocker:
                    blocker.execute('ALTER MATERIALIZED VIEW '+cache+' OWNER TO postgres')
                    super().execute(sql)
        with self.assertRaisesRegex(e.Stop,'phase_stopped'):
            self.run_executor(db_class=LockedMV)
        self.assertEqual(self.run_executor(reconcile_only=True)['status'],'not_applied')
        self.assertEqual(self.run_executor(route='recover')['status'],'complete')
        self.assertEqual(original,self.node())
        run=json.loads(self.state.read_text())['runs'][-1]
        self.assertEqual(run['recovery_branch_id'],'not-applied')
        self.assertEqual([i['id'] for i in run['items']],['service-gate'])

    def test_checkpoint_clear_commit_disconnect_recovers_only_cleared_cache(self):
        self.bootstrap_plan()
        class Lost(e.Database):
            def execute(self,sql):
                super().execute(sql);self.conn.close();raise ConnectionError('fixture lost commit reply')
        with self.assertRaisesRegex(e.Stop,'phase_stopped'):
            self.run_executor(db_class=Lost)
        self.assertTrue(self.conn.execute(self.guard(False)).fetchone()[0])
        self.assertEqual(self.run_executor(reconcile_only=True)['status'],'committed_verified')
        self.assertEqual(self.run_executor(route='recover')['status'],'complete')
        self.assertTrue(self.conn.execute(self.guard(True,True)).fetchone()[0])
        run=json.loads(self.state.read_text())['runs'][-1]
        self.assertEqual(run['recovery_branch_id'],'cleared')
        self.assertEqual([i['id'] for i in run['items']],['recover-check','service-gate'])

    def test_checkpoint_interrupted_recovery_does_not_refresh_again(self):
        self.bootstrap_plan();self.run_executor()
        class Lost(e.Database):
            def execute(self,sql):
                super().execute(sql);self.conn.close();raise ConnectionError('fixture recovery reply lost')
        with self.assertRaisesRegex(e.Stop,'phase_stopped'):
            self.run_executor(route='recover',db_class=Lost)
        restored=self.node()
        self.assertEqual(self.run_executor(route='recover',reconcile_only=True)['status'],'committed_verified')
        self.assertEqual(self.run_executor(route='recover')['status'],'complete')
        self.assertEqual(restored,self.node())
        self.assertTrue(self.conn.execute(self.guard(True,True)).fetchone()[0])

    def test_checkpoint_partial_index_resumes_missing_index_only(self):
        self.plan(('cache_clear','index_drop','index_create','cache_refresh'))
        p=self.plan_data;p['format']=e.CHECKPOINT_FORMAT
        p['routes'].pop('recover')
        gate=copy.deepcopy(p['phases'][-1]);gate.update(kind='gate');gate.pop('relation')
        p['phases'][-1]=gate
        p['recovery_branches']=[{'id':'index-suffix','case':'indexes_partially_rebuilt',
            'from':{'route':'prepare','completed':['phase-0','phase-1'],'pending':None},
            'entry':put(self.root,'index-entry.sql',self.guard(False,index_present=False)),
            'phases':['phase-2','phase-3','recover-check']}]
        self.seal();self.run_executor(max_phases=2)
        self.assertEqual(self.run_executor(route='recover')['status'],'complete')
        self.assertTrue(self.conn.execute(self.guard(True,True,index_present=True)).fetchone()[0])
        run=json.loads(self.state.read_text())['runs'][-1]
        self.assertEqual([i['id'] for i in run['items']],['phase-2','phase-3','recover-check'])

    def test_checkpoint_data_reverse_commit_loss_reclaims_then_rebuilds(self):
        self.bootstrap_plan()
        p=self.plan_data
        changed_hash=self.conn.execute("SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id)) FROM "+self.table+' t WHERE id<>1').fetchone()[0]
        changed_guard="SELECT (SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id)) FROM "+self.table+" t)='"+changed_hash+"'"
        source_guard=put(self.root,'data-source.sql',changed_guard)
        target_guard=put(self.root,'data-restored.sql',self.guard())
        body='INSERT INTO '+self.table+" VALUES (1,repeat(md5('1'),16));\n"
        tag='$grassroots_'+e.sha(body.encode())+'$'
        sql="""-- PRIVATE operation package. Complete external maintenance/target/backup/capacity gates first.
BEGIN;
SET LOCAL standard_conforming_strings = on;
SET LOCAL timezone = 'UTC';
SET LOCAL extra_float_digits = 3;
SET LOCAL search_path = pg_catalog, public, published;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
"""+'LOCK TABLE '+self.table+' IN SHARE ROW EXCLUSIVE MODE;\nDO '+tag+' BEGIN\n'+body+'END '+tag+';\nCOMMIT;\n'
        (self.root/'reverse').mkdir()
        sql_ref=put(self.root,'reverse/00-public.people-0000.sql',sql)
        package=put(self.root,'reverse-manifest.json',{'format':'grassroots-offline-operation-package-v1',
            'batches':[{'batch':0}], 'reverse_order':[sql_ref['path']],
            'files':[dict(sql_ref,bytes=len(sql.encode()))]})
        reverse=copy.deepcopy(p['phases'][0]);reverse.update(id='restore-row',kind='guarded_reverse',
            epoch='name_only',package_manifest=package,reverse_file=sql_ref['path'],
            pre=source_guard,not_applied=source_guard,post=target_guard,
            recovery_before=source_guard,recovery_after=target_guard)
        reverse.pop('relation')
        full=copy.deepcopy(p['phases'][0]);full.update(id='reclaim-restored',kind='vacuum_full',
            relation=self.table,epoch='restored',pre=target_guard,post=target_guard,
            recovery_before=target_guard,recovery_after=target_guard)
        p['phases'] += [reverse,full]
        p['recovery_branches'][1]['data_checkpoint']={'package_manifest':package,'committed_batches':[],
            'guard':put(self.root,'data-zero.sql',self.guard(False))}
        p['recovery_branches'].append({'id':'data-reverse','case':'name_only_batches_started',
            'from':{'route':'prepare','completed':['phase-0'],'pending':None},
            'entry':source_guard,'data_checkpoint':{'package_manifest':package,'committed_batches':[0],'guard':source_guard},
            'phases':['restore-row','reclaim-restored','recover-check','service-gate']})
        p['data_window']={'after_route':'prepare','package_manifest':package}
        self.seal();self.run_executor()
        self.conn.execute('DELETE FROM '+self.table+' WHERE id=1')
        class LostReverse(e.Database):
            def execute(self,sql):
                super().execute(sql);self.conn.close();raise ConnectionError('fixture reverse reply lost')
        with self.assertRaisesRegex(e.Stop,'phase_stopped'):
            self.run_executor(route='recover',max_phases=1,db_class=LostReverse)
        self.assertEqual(self.run_executor(route='recover',reconcile_only=True)['status'],'committed_verified')
        self.assertEqual(self.run_executor(route='recover')['status'],'complete')
        self.assertTrue(self.conn.execute(self.guard(True,True)).fetchone()[0])
        run=json.loads(self.state.read_text())['runs'][-1]
        self.assertEqual([i['id'] for i in run['items']],['restore-row','reclaim-restored','recover-check','service-gate'])

    def test_checkpoint_clear_before_during_abort_and_after_commit_observations(self):
        self.bootstrap_plan()
        def size():
            return self.conn.execute('SELECT sum(pg_database_size(datname))::bigint FROM pg_database').fetchone()[0]
        original=self.node();before=size()
        writer=self.psycopg.connect(self.dsn,autocommit=True)
        writer.execute('BEGIN')
        writer.execute('REFRESH MATERIALIZED VIEW '+self.cache+' WITH NO DATA')
        inside=writer.execute('SELECT relispopulated,pg_relation_filenode(oid) FROM pg_class WHERE oid=%s::regclass',(self.cache,)).fetchone()
        self.assertFalse(inside[0]);self.assertNotEqual(inside[1],original)
        during=size()
        # Simulate session interruption while the physical rewrite awaits commit.
        writer.close()
        self.assertTrue(self.conn.execute(self.guard(True,True)).fetchone()[0])
        self.assertEqual(self.node(),original)
        after_abort=size()
        self.run_executor()
        after_commit=size()
        self.assertTrue(self.conn.execute(self.guard(False)).fetchone()[0])
        self.run_executor(route='recover')
        self.assertTrue(self.conn.execute(self.guard(True,True)).fetchone()[0])
        observations={'scope':'tiny_isolated_fixture_not_production_bound','before':before,
            'during_after_clear_before_commit':during,'after_interrupted_rollback':after_abort,
            'after_clear_commit':after_commit,'after_recovery':size(),
            'continuous_peak_measured':False,'production_upper_bound_verified':False}
        output=os.environ.get('POW_EXECUTOR_CHECKPOINT_OBSERVATIONS')
        if output:
            Path(output).write_text(json.dumps(observations,indent=2)+'\n')

def load_tests(loader, tests, pattern):
    # Exclude inherited existing tests from both discovery and this focused runner.
    names=[n for n in dir(CheckpointPostgresTest) if n.startswith('test_checkpoint_')]
    return unittest.TestSuite(CheckpointPostgresTest(n) for n in names)

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(load_tests(None,None,None))
    raise SystemExit(not result.wasSuccessful())
