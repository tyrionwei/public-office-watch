"""Offline fault-injection contracts; no PostgreSQL/network/production calls."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

_spec = importlib.util.spec_from_file_location('maintenance_executor', Path(__file__).with_name('grassroots-maintenance-executor.py'))
executor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(executor)


def put(root, name, value):
    data = value.encode() if isinstance(value, str) else executor.canonical(value)
    (root/name).write_bytes(data)
    return {'path': name, 'sha256': executor.sha(data)}


def seal_plan(root, plan, overrides=None):
    """Rebind synthetic evidence after a caller changes fixture guards/settings.

    Integration callers must replace the synthetic reports/envelopes themselves;
    these bytes are test fixtures and never production evidence.
    """
    overrides = overrides or {}
    for phase in plan['phases']:
        e = {'format': 'grassroots-space-envelope-v1', 'status': 'passed',
             'binding_sha256': executor.binding(plan, phase, root),
             'server_version_num': plan['target']['identity']['server_version_num'],
             'basis': 'reviewed_conservative_upper_envelope',
             'recovery_covers': ['before', 'during', 'after_commit'],
             'reports': [put(root, 'synthetic-report.json', {'fixture': True})],
             'scope': 'isolated_fixture', 'operation_extra_bytes': 500,
             'recovery_extra_bytes': 700, 'recovery_before_extra_bytes': 700, 'max_after_delta_bytes': 1000,
             'observed_extra_bytes': 100,
             'components': {'heap_toast': 100, 'indexes': 100, 'temporary': 100, 'other': 100},
             'relation_max_bytes': {name: 2000 for name in plan['watch']},
             'relation_min_bytes': {name: 0 for name in plan['watch']}}
        e.update(overrides.get(phase['id'], {}))
        phase['evidence'] = put(root, phase['id']+'-evidence.json', e)
    path = root/'plan.json'; path.write_bytes(executor.canonical(plan))
    return path, executor.sha(path.read_bytes())


def make_plan(root, kinds=('vacuum_full',), identity=None):
    """Create a self-contained isolated fixture. Return (plan, path, sha256)."""
    root.mkdir(parents=True, exist_ok=True)
    identity = identity or {'database': 'fixture', 'session_user': 'fixture', 'server_version_num': 170006, 'system_identifier': 'fixture-system'}
    table, index, cache = 'public.fixture', 'public.fixture_idx', 'published.fixture_cache'
    phases = []
    for number, kind in enumerate((*kinds, 'gate')):
        name = 'recover-check' if number == len(kinds) else f'phase-{number}'
        phase = {'id': name, 'kind': kind, 'epoch': 'restored' if number == len(kinds) else 'original',
                 'statement_timeout_ms': 300000, 'reserve_bytes': 100,
                 'post_max_cluster_bytes': 9000, 'min_physical_reclaim_bytes': 0}
        if kind != 'gate':
            phase['relation'] = index if kind in executor.INDEX_KINDS else cache if kind.startswith('cache_') else table
        for field in ['pre', 'post', 'recovery_before', 'recovery_after']:
            phase[field] = put(root, name+'-'+field+'.sql', 'SELECT true /* '+name+' '+field+' */')
        if kind in executor.INDEX_KINDS:
            phase['definition'] = put(root, name+'-index.sql', 'CREATE INDEX fixture_idx ON public.fixture USING btree (value)')
        phases.append(phase)
    plan = {'format': executor.FORMAT, 'target': {'kind': 'isolated', 'identity': identity,
            'connection': {'host': '/tmp/pow-unit-fixture', 'port': '5432', 'dbname': 'fixture', 'user': 'fixture'}},
            'settings': {'work_mem': '32MB', 'maintenance_work_mem': '32MB', 'max_parallel_maintenance_workers': '0', 'lock_timeout': '5s'},
            'ceiling_bytes': 10000, 'watch': [table, index, cache],
            'maintenance_guard': put(root, 'maintenance.sql', 'SELECT true /* maintenance */'),
            'backup_artifacts': [put(root, 'backup.json', {'synthetic_backup': True})],
            'phases': phases,
            'routes': {'prepare': {'entry': put(root, 'prepare-entry.sql', 'SELECT true /* prepare entry */'), 'phases': [p['id'] for p in phases[:-1]]},
                       'recover': {'entry': put(root, 'recover-entry.sql', 'SELECT true /* recover entry */'), 'phases': ['recover-check']}}}
    path, digest = seal_plan(root, plan)
    return plan, path, digest


class FakeDB:
    def __init__(self, plan, state_path=None):
        self.plan, self.state_path = plan, state_path
        self.mode = 'normal'; self.calls = []; self.guard_values = {}; self.configurations = []
        self.live_identity = copy.deepcopy(plan['target']['identity'])
        idx = {'name': 'public.fixture_idx', 'filenode': 20, 'definition': 'CREATE INDEX fixture_idx ON public.fixture USING btree (value)', 'valid': True, 'ready': True, 'protected': False}
        self.live = {'database_bytes': 1000, 'cluster_bytes': 1000, 'relations': {
            'public.fixture': {'kind': 'r', 'filenode': 10, 'bytes': 1000, 'populated': True, 'definition': None, 'indexes': [copy.deepcopy(idx)]},
            'public.fixture_idx': {'kind': 'i', 'filenode': 20, 'bytes': 100, 'populated': True, 'definition': idx['definition'], 'indexes': [copy.deepcopy(idx)]},
            'published.fixture_cache': {'kind': 'm', 'filenode': 30, 'bytes': 100, 'populated': True, 'definition': 'SELECT value FROM public.fixture', 'indexes': []}}}

    def identity(self): return self.live_identity
    def snapshot(self): return copy.deepcopy(self.live)
    def guard(self, sql): return self.guard_values.get(sql, True)
    def configure(self, timeout): self.configurations.append(timeout)
    def acquire(self): pass

    def execute(self, sql):
        # Durable intent must exist in the actual external state file before write.
        if self.state_path is not None:
            disk = json.loads(self.state_path.read_text())
            assert disk['runs'][-1]['items'][-1]['status'] == 'intent'
        self.calls.append(sql)
        if self.mode == 'disconnect_before':
            raise ConnectionError('synthetic disconnect before commit')
        if sql is not None:
            relation = self.live['relations']['public.fixture']
            if sql.startswith('VACUUM (FULL'):
                relation['filenode'] += 1
            elif sql.startswith('REFRESH MATERIALIZED'):
                relation = self.live['relations']['published.fixture_cache']
                relation['filenode'] += 1; relation['populated'] = 'WITH NO DATA' not in sql
            elif sql.startswith('DROP INDEX'):
                self.live['relations']['public.fixture_idx'] = None
        if self.mode == 'partial':
            self.live['relations']['public.fixture']['definition'] = 'unexpected partial shape'
            for key in self.guard_values:
                if ' pre ' in key or key.endswith(' pre */'): self.guard_values[key] = False
        if self.mode == 'invalid_index':
            self.live['relations']['public.fixture']['indexes'][0]['valid'] = False
        if self.mode == 'post_capacity':
            self.live['cluster_bytes'] = 1600
        if self.mode in ('disconnect_after', 'partial', 'invalid_index'):
            raise ConnectionError('synthetic disconnect after physical mutation')


class MaintenanceFaultTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.plan, self.path, self.digest = make_plan(self.root)
        self.state = self.root/'state.json'
        self.db = FakeDB(self.plan, self.state)
        self.journal = None

    def open_executor(self):
        if self.journal: self.journal.close()
        self.journal = executor.Journal(self.state, self.digest)
        return executor.Executor(self.plan, self.root, self.db, self.journal)

    def tearDown(self):
        if self.journal: self.journal.close(); self.journal = None

    def ref_sql(self, field, number=0):
        return executor.artifact(self.root, self.plan['phases'][number][field]).decode().strip()

    def test_intent_is_durable_before_mutation_and_commits_are_recorded(self):
        result = self.open_executor().run('prepare')
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(len(self.db.calls), 1)
        self.assertEqual(json.loads(self.state.read_text())['runs'][0]['items'][0]['status'], 'done')
        self.assertEqual(self.db.configurations[-1], 300000)

    def test_disconnect_after_commit_resumes_postcheck_without_resending(self):
        self.db.mode = 'disconnect_after'
        with self.assertRaisesRegex(executor.Stop, 'reconcile_before_retry'):
            self.open_executor().run('prepare')
        self.assertEqual(self.journal.data['runs'][0]['items'][0]['status'], 'unknown')
        self.db.mode = 'normal'
        result = self.open_executor().run('prepare', reconcile_only=True)
        self.assertEqual(result['status'], 'committed_verified')
        self.assertEqual(len(self.db.calls), 1)
        self.assertEqual(self.open_executor().run('prepare')['status'], 'complete')
        self.assertEqual(len(self.db.calls), 1)

    def test_not_applied_requires_explicit_retry(self):
        self.db.mode = 'disconnect_before'
        with self.assertRaises(executor.Stop): self.open_executor().run('prepare')
        self.db.mode = 'normal'
        with self.assertRaisesRegex(executor.Stop, 'explicit_retry_required'):
            self.open_executor().run('prepare')
        self.assertEqual(len(self.db.calls), 1)
        self.assertEqual(self.open_executor().run('prepare', retry_not_applied=True)['status'], 'complete')
        self.assertEqual(len(self.db.calls), 2)
        self.assertIn('previous_attempt', self.journal.data['runs'][0]['items'][0])

    def test_partial_or_invalid_index_is_ambiguous_and_never_resent(self):
        for mode in ['partial', 'invalid_index']:
            with self.subTest(mode=mode):
                if self.journal: self.journal.close(); self.journal = None
                self.state.unlink(missing_ok=True)
                self.db = FakeDB(self.plan, self.state); self.db.mode = mode
                self.db.guard_values[self.ref_sql('pre')] = False if mode == 'partial' else True
                # Allow the initial precondition, then invalidate it during execute.
                self.db.guard_values[self.ref_sql('pre')] = True
                with self.assertRaises(executor.Stop): self.open_executor().run('prepare')
                self.db.mode = 'normal'
                with self.assertRaisesRegex(executor.Stop, 'ambiguous_phase'):
                    self.open_executor().run('prepare', retry_not_applied=True)
                self.assertEqual(len(self.db.calls), 1)

    def test_committed_postcapacity_failure_can_only_enter_recovery(self):
        self.plan['phases'][0]['post_max_cluster_bytes'] = 1500
        self.path, self.digest = seal_plan(self.root, self.plan)
        self.db.mode = 'post_capacity'
        with self.assertRaises(executor.Stop): self.open_executor().run('prepare')
        self.assertEqual(self.open_executor().run('prepare', reconcile_only=True)['status'], 'committed_needs_recovery')
        with self.assertRaisesRegex(executor.Stop, 'requires_recovery_route'):
            self.open_executor().run('prepare')
        self.db.mode = 'normal'
        self.assertEqual(self.open_executor().run('recover')['status'], 'complete')
        with self.assertRaisesRegex(executor.Stop, 'forward_after_recovery'):
            self.open_executor().run('prepare')
        self.assertEqual(len([c for c in self.db.calls if c is not None]), 1)

    def test_operation_and_recovery_peak_gates_stop_before_write(self):
        for key in ['operation_extra_bytes', 'recovery_before_extra_bytes', 'recovery_extra_bytes']:
            with self.subTest(key=key):
                self.path, self.digest = seal_plan(self.root, self.plan, {'phase-0': {key: 9000}})
                with self.assertRaisesRegex(executor.Stop, key+'_capacity_gate'):
                    self.open_executor().run('prepare')
                self.assertEqual(self.db.calls, [])
                if self.journal: self.journal.close(); self.journal = None
                self.state.unlink(missing_ok=True)

    def test_each_phase_checks_new_capacity_not_stale_plan_size(self):
        self.plan, self.path, self.digest = make_plan(self.root, ('vacuum_full', 'vacuum_full'))
        self.db = FakeDB(self.plan, self.state)
        self.assertEqual(self.open_executor().run('prepare')['status'], 'checkpoint')
        self.db.live['cluster_bytes'] = 9400
        with self.assertRaisesRegex(executor.Stop, 'capacity_gate'):
            self.open_executor().run('prepare')
        self.assertEqual(len(self.db.calls), 1)

    def test_sampled_missing_or_incomplete_envelopes_are_rejected(self):
        cases = [({'basis': 'sampled_peak'}, 'sampling_is_not'),
                 ({'reports': []}, 'missing_peak_reports'),
                 ({'recovery_covers': ['before', 'after_commit']}, 'incomplete_recovery'),
                 ({'components': {'heap_toast': 1}}, 'incomplete_rewrite'),
                 ({'relation_max_bytes': {}}, 'incomplete_relation')]
        for override, code in cases:
            with self.subTest(code=code):
                self.path, self.digest = seal_plan(self.root, self.plan, {'phase-0': override})
                with self.assertRaisesRegex(executor.Stop, code): executor.load_plan(self.path, self.digest)
        self.path, self.digest = seal_plan(self.root, self.plan)
        (self.root/self.plan['phases'][0]['evidence']['path']).unlink()
        with self.assertRaisesRegex(executor.Stop, 'artifact_outside_package'):
            executor.load_plan(self.path, self.digest)

    def test_reuse_vacuum_does_not_claim_physical_reclaim(self):
        self.plan, self.path, self.digest = make_plan(self.root, ('vacuum_reuse',))
        self.db = FakeDB(self.plan, self.state)
        self.open_executor().run('prepare')
        item = self.journal.data['runs'][0]['items'][0]
        self.assertEqual(item['measured_relation_reclaimed_bytes'], 0)
        self.assertTrue(item['reuse_only'])
        self.assertIn('TRUNCATE FALSE', self.db.calls[0])
        self.plan['phases'][0]['min_physical_reclaim_bytes'] = 1
        self.path, self.digest = seal_plan(self.root, self.plan)
        with self.assertRaisesRegex(executor.Stop, 'reuse_is_not_physical_reclaim'):
            executor.load_plan(self.path, self.digest)

    def test_protected_fk_or_unique_indexes_cannot_be_dropped(self):
        self.plan, self.path, self.digest = make_plan(self.root, ('index_drop',))
        self.db = FakeDB(self.plan, self.state)
        self.db.live['relations']['public.fixture_idx']['indexes'][0]['protected'] = True
        with self.assertRaisesRegex(executor.Stop, 'protected_index'):
            self.open_executor().run('prepare')
        self.assertEqual(self.db.calls, [])

    def test_invalid_existing_index_stops_before_write(self):
        self.db.live['relations']['public.fixture']['indexes'][0]['valid'] = False
        with self.assertRaisesRegex(executor.Stop, 'invalid_index_before'):
            self.open_executor().run('prepare')
        self.assertEqual(self.db.calls, [])

    def test_identity_maintenance_and_evidence_tampering_fail_closed(self):
        self.db.live_identity['system_identifier'] = 'impostor'
        with self.assertRaisesRegex(executor.Stop, 'target_identity_changed'):
            self.open_executor().run('prepare')
        self.db.live_identity = copy.deepcopy(self.plan['target']['identity'])
        self.db.guard_values[executor.artifact(self.root, self.plan['maintenance_guard']).decode()] = False
        with self.assertRaisesRegex(executor.Stop, 'maintenance_or_write_freeze'):
            self.open_executor().run('prepare')
        self.db.guard_values.clear()
        (self.root/self.plan['phases'][0]['evidence']['path']).write_text('{}')
        with self.assertRaisesRegex(executor.Stop, 'artifact_hash_mismatch'):
            executor.load_plan(self.path, self.digest)
        with self.assertRaisesRegex(executor.Stop, 'plan_hash_mismatch'):
            executor.load_plan(self.path, '0'*64)
        self.assertEqual(self.db.calls, [])

    def test_evidence_is_bound_to_route_order_and_sql_artifacts(self):
        self.plan, self.path, self.digest = make_plan(self.root, ('vacuum_full', 'vacuum_full'))
        self.plan['routes']['recover']['phases'] = ['phase-1', 'recover-check']
        self.path.write_bytes(executor.canonical(self.plan))
        with self.assertRaisesRegex(executor.Stop, 'evidence_binding_mismatch'):
            executor.load_plan(self.path, executor.sha(self.path.read_bytes()))

    def test_journal_exclusive_lock_and_recorded_phase_order(self):
        current = self.open_executor()
        with self.assertRaisesRegex(executor.Stop, 'another_local_executor'):
            executor.Journal(self.state, self.digest)
        self.journal.data['runs'] = [{'route': 'prepare', 'complete': False, 'items': [{'id': 'recover-check', 'status': 'done'}]}]
        self.journal.save()
        with self.assertRaisesRegex(executor.Stop, 'invalid_journal_phase_order'):
            current.run('prepare')
        self.assertEqual(self.db.calls, [])

    def test_failed_journal_initialization_releases_the_lock(self):
        self.state.write_text(json.dumps({'plan_sha256': 'different-plan', 'runs': [], 'recovery_started': False}))
        with self.assertRaisesRegex(executor.Stop, 'journal_plan_mismatch'):
            executor.Journal(self.state, self.digest)
        # A rejected plan must not permanently block the legitimate plan in this process.
        journal = executor.Journal(self.state, 'different-plan')
        journal.close()

    def test_unreconciled_unknown_blocks_switch_to_recovery(self):
        self.db.mode = 'disconnect_before'
        with self.assertRaises(executor.Stop): self.open_executor().run('prepare')
        with self.assertRaisesRegex(executor.Stop, 'reconcile_pending_before_recovery'):
            self.open_executor().run('recover')
        self.assertEqual(len(self.db.calls), 1)

    def test_fixture_evidence_cannot_be_used_for_production(self):
        self.plan['target']['kind'] = 'production'
        self.path, self.digest = seal_plan(self.root, self.plan)
        with self.assertRaisesRegex(executor.Stop, 'fixture_evidence_on_production'):
            executor.load_plan(self.path, self.digest)

    def test_backup_tampering_stops_before_any_phase_write(self):
        (self.root/self.plan['backup_artifacts'][0]['path']).write_text('tampered backup')
        with self.assertRaisesRegex(executor.Stop, 'artifact_hash_mismatch'):
            self.open_executor().run('prepare')
        self.assertEqual(self.db.calls, [])

    def test_reuse_disconnect_is_not_commit_or_not_applied_and_can_recover(self):
        self.plan, self.path, self.digest = make_plan(self.root, ('vacuum_reuse',))
        self.db = FakeDB(self.plan, self.state); self.db.mode = 'disconnect_after'
        with self.assertRaises(executor.Stop): self.open_executor().run('prepare')
        self.db.mode = 'normal'
        result = self.open_executor().run('prepare', reconcile_only=True)
        self.assertEqual(result['status'], 'reuse_unconfirmed')
        self.assertNotEqual(self.journal.data['runs'][0]['items'][0]['status'], 'done')
        with self.assertRaises(executor.Stop):
            self.open_executor().run('prepare', retry_not_applied=True)
        self.assertEqual(len(self.db.calls), 1)
        self.assertEqual(self.open_executor().run('recover')['status'], 'complete')
        original = self.journal.data['runs'][0]['items'][0]
        self.assertNotEqual(original['status'], 'done')
        self.assertEqual(original.get('measured_relation_reclaimed_bytes', 0), 0)
        self.assertEqual(len([sql for sql in self.db.calls if sql is not None]), 1)

    def test_verified_not_applied_may_cancel_forward_into_recovery(self):
        self.db.mode = 'disconnect_before'
        with self.assertRaises(executor.Stop): self.open_executor().run('prepare')
        self.db.mode = 'normal'
        self.assertEqual(self.open_executor().run('prepare', reconcile_only=True)['status'], 'not_applied')
        self.assertEqual(self.journal.data['runs'][0]['items'][0]['status'], 'not_applied_verified')
        self.assertEqual(self.open_executor().run('recover')['status'], 'complete')
        self.assertEqual(len([sql for sql in self.db.calls if sql is not None]), 1)

    def test_before_and_after_recovery_space_are_independently_bounded(self):
        phase = self.plan['phases'][0]
        phase['min_physical_reclaim_bytes'] = 100
        self.path, self.digest = seal_plan(self.root, self.plan, {'phase-0': {
            'max_after_delta_bytes': -100, 'operation_extra_bytes': 100,
            'relation_min_bytes': {name: 100 if name == 'public.fixture' else 0 for name in self.plan['watch']},
            'recovery_before_extra_bytes': 9000, 'recovery_extra_bytes': 50,
            'observed_extra_bytes': 100, 'components': {'heap_toast': 25, 'indexes': 25, 'temporary': 25, 'other': 25}}})
        with self.assertRaisesRegex(executor.Stop, 'recovery_before_extra_bytes_capacity_gate'):
            self.open_executor().run('prepare')
        self.assertEqual(self.db.calls, [])

    def test_reuse_envelope_cannot_credit_expected_negative_delta(self):
        self.plan, self.path, self.digest = make_plan(self.root, ('vacuum_reuse',))
        self.path, self.digest = seal_plan(self.root, self.plan, {'phase-0': {'max_after_delta_bytes': -1}})
        with self.assertRaisesRegex(executor.Stop, 'reuse_is_not_physical_reclaim'):
            executor.load_plan(self.path, self.digest)

    def production_contract_fixture(self):
        # Pure synthetic certificate for testing validation branches; never a real
        # production report, connection, or authorization.
        plan, _, _ = make_plan(self.root, ('gate',))
        plan['target']['kind'] = 'production'
        plan['ceiling_bytes'] = 500000000
        plan['watch'] = sorted(set(plan['watch']) | executor.SERVICE_CACHES)
        plan['phases'][0]['post_max_cluster_bytes'] = 485000000
        return plan

    def seal_production_contract_fixture(self, plan):
        return seal_plan(self.root, plan, {phase['id']: {'scope': 'production_shape'} for phase in plan['phases']})

    def test_production_plan_requires_complete_service_inventory_and_final_gate(self):
        base = self.production_contract_fixture()
        path, digest = self.seal_production_contract_fixture(base)
        self.assertEqual(executor.load_plan(path, digest)['target']['kind'], 'production')
        cases = ['missing_cache', 'prepare_not_gate', 'recover_not_gate', 'insufficient_reserve']
        codes = ['full_service_cache_inventory_required', 'route_must_end_with_service_gate',
                 'route_must_end_with_service_gate', 'full_service_15mb_reserve_required']
        for case, code in zip(cases, codes):
            with self.subTest(case=case):
                plan = copy.deepcopy(base)
                if case == 'missing_cache': plan['watch'].remove(sorted(executor.SERVICE_CACHES)[0])
                elif case == 'insufficient_reserve': plan['phases'][0]['post_max_cluster_bytes'] = 485000001
                else:
                    phase = plan['phases'][0 if case == 'prepare_not_gate' else -1]
                    phase['kind'] = 'vacuum_full'; phase['relation'] = 'public.fixture'
                path, digest = self.seal_production_contract_fixture(plan)
                with self.assertRaisesRegex(executor.Stop, code): executor.load_plan(path, digest)

    def test_production_post_gate_requires_all_caches_populated_materialized_views(self):
        self.plan = self.production_contract_fixture()
        self.path, self.digest = self.seal_production_contract_fixture(self.plan)
        self.db = FakeDB(self.plan, self.state)
        for name in executor.SERVICE_CACHES:
            self.db.live['relations'][name] = {'kind': 'm', 'filenode': 1, 'bytes': 100, 'populated': True, 'definition': 'SELECT true', 'indexes': []}
        instance = self.open_executor(); phase = self.plan['phases'][0]
        envelope = executor.evidence(self.plan, phase, self.root)
        before = self.db.snapshot()
        instance.post(phase, envelope, before, self.db.snapshot())
        watched = sorted(executor.SERVICE_CACHES)[0]
        for bad in [None, {'kind': 'r', 'populated': True}, {'kind': 'm', 'populated': False}]:
            with self.subTest(bad=bad):
                after = self.db.snapshot(); after['relations'][watched] = bad
                with self.assertRaisesRegex(executor.Stop, 'full_service_cache_gate_failed'):
                    instance.post(phase, envelope, before, after)
        self.assertEqual(self.db.calls, [])

    def test_hard_forward_route_transition_is_prepare_then_finish_only(self):
        self.plan['routes']['finish'] = {'entry': put(self.root, 'finish-entry.sql', 'SELECT true /* finish entry */'), 'phases': ['recover-check']}
        self.path, self.digest = seal_plan(self.root, self.plan)
        with self.assertRaisesRegex(executor.Stop, 'first_route_must_prepare'):
            self.open_executor().run('finish')
        self.assertEqual(self.open_executor().run('prepare')['status'], 'complete')
        self.assertEqual(self.open_executor().run('finish')['status'], 'complete')
        with self.assertRaisesRegex(executor.Stop, 'invalid_route_transition'):
            self.open_executor().run('prepare')

    def test_negative_delta_requires_guaranteed_reclaim_and_live_relation_floor(self):
        override = {'max_after_delta_bytes': -100}
        self.path, self.digest = seal_plan(self.root, self.plan, {'phase-0': override})
        with self.assertRaisesRegex(executor.Stop, 'negative_delta_without_guaranteed_reclaim'):
            executor.load_plan(self.path, self.digest)
        self.plan['phases'][0]['min_physical_reclaim_bytes'] = 100
        override['relation_min_bytes'] = {name: 100 if name == 'public.fixture' else 0 for name in self.plan['watch']}
        self.path, self.digest = seal_plan(self.root, self.plan, {'phase-0': override})
        executor.load_plan(self.path, self.digest)
        self.db.live['relations']['public.fixture']['bytes'] = 90
        with self.assertRaisesRegex(executor.Stop, 'relation_outside_validated_envelope'):
            self.open_executor().run('prepare')
        self.assertEqual(self.db.calls, [])

    def test_connection_manifest_rejects_secret_fields(self):
        self.plan['target']['connection']['password'] = 'synthetic-placeholder-not-a-credential'
        self.path, self.digest = seal_plan(self.root, self.plan)
        with self.assertRaisesRegex(executor.Stop, 'only_public_connection_selectors_allowed'):
            executor.load_plan(self.path, self.digest)
        self.assertEqual(self.db.calls, [])

    def test_evidence_binding_covers_capacity_contract_and_forward_route_order(self):
        for field in ['ceiling', 'reserve', 'postmax', 'minreclaim', 'route_order']:
            with self.subTest(field=field):
                plan, _, _ = make_plan(self.root, ('vacuum_full', 'vacuum_full'))
                phase = plan['phases'][0]
                if field == 'ceiling': plan['ceiling_bytes'] += 1
                elif field == 'reserve': phase['reserve_bytes'] += 1
                elif field == 'postmax': phase['post_max_cluster_bytes'] += 1
                elif field == 'minreclaim': phase['min_physical_reclaim_bytes'] += 1
                else: plan['routes']['prepare']['phases'].reverse()
                # Deliberately preserve the old evidence bytes and checksum.
                with self.assertRaisesRegex(executor.Stop, 'evidence_binding_mismatch'):
                    executor.evidence(plan, phase, self.root)

    def test_completed_recovery_blocks_forward_even_after_restart(self):
        with self.assertRaisesRegex(executor.Stop, 'first_route_must_prepare'):
            self.open_executor().run('recover')
        self.assertEqual(self.open_executor().run('prepare')['status'], 'complete')
        self.assertEqual(self.open_executor().run('recover')['status'], 'complete')
        with self.assertRaisesRegex(executor.Stop, 'forward_after_recovery'):
            self.open_executor().run('prepare')


if __name__ == '__main__':
    unittest.main()
