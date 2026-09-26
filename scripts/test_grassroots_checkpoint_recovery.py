"""Offline v2 checkpoint routing contracts; synthetic fixtures are not capacity evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

_spec = importlib.util.spec_from_file_location('maintenance_fault_fixtures', Path(__file__).with_name('test_grassroots_maintenance_executor.py'))
fixtures = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixtures)
executor = fixtures.executor
_generator_spec = importlib.util.spec_from_file_location('offline_operation_generator', Path(__file__).with_name('build-grassroots-compaction-plan.py'))
generator = importlib.util.module_from_spec(_generator_spec)
_generator_spec.loader.exec_module(generator)


def checkpoint_plan(root):
    """Fixture phases: clear, refresh, drop, create, gate, recovery gate."""
    plan, _, _ = fixtures.make_plan(root, ('cache_clear', 'cache_refresh', 'index_drop', 'index_create', 'gate'))
    plan['format'] = 'grassroots-maintenance-v2'
    plan['routes'] = {
        'prepare': {'entry': fixtures.put(root, 'v2-prepare.sql', 'SELECT true /* prepare */'),
                    'phases': ['phase-0', 'phase-2', 'phase-3', 'phase-4']},
        'finish': {'entry': fixtures.put(root, 'v2-finish.sql', 'SELECT true /* finish */'),
                   'phases': ['phase-1', 'phase-4']}}
    def branch(name, case, completed, pending, phases):
        return {'id': name, 'case': case,
                'from': {'route': 'prepare', 'completed': completed, 'pending': pending},
                'entry': fixtures.put(root, name+'-entry.sql', 'SELECT true /* '+name+' entry */'),
                'phases': phases}
    plan['recovery_branches'] = [
        branch('before-any-write', 'not_applied', [], None, ['recover-check']),
        branch('clear-never-applied', 'not_applied', [], {'id': 'phase-0', 'status': 'not_applied_verified'}, ['recover-check']),
        branch('only-cleared-cache', 'cache_cleared', ['phase-0'], None, ['phase-1', 'recover-check']),
        branch('rebuild-dropped-index', 'indexes_partially_rebuilt', ['phase-0', 'phase-2'], None, ['phase-3', 'phase-1', 'recover-check'])]
    path, digest = fixtures.seal_plan(root, plan)
    return plan, path, digest


class RecoveryFakeDB(fixtures.FakeDB):
    def __init__(self, plan, state_path):
        super().__init__(plan, state_path)
        self.root = state_path.parent
        self.original_index = copy.deepcopy(self.live['relations']['public.fixture_idx'])

    def execute(self, sql):
        super().execute(sql)
        if sql and sql.startswith('-- PRIVATE operation package.'):
            phase = next(p for p in self.plan['phases'] if p['kind'] == 'guarded_reverse')
            self.guard_values[executor.artifact(self.root, phase['post']).decode().strip()] = True
            self.guard_values[executor.artifact(self.root, phase['not_applied']).decode().strip()] = False
            if self.mode == 'reverse_disconnect_after':
                raise ConnectionError('synthetic reverse committed before disconnect')
        if sql and sql.startswith('DROP INDEX'):
            self.live['relations']['public.fixture']['indexes'] = []
        elif sql and sql.startswith('CREATE INDEX'):
            row = copy.deepcopy(self.original_index)
            row['filenode'] = 99; row['indexes'][0]['filenode'] = 99
            self.live['relations']['public.fixture_idx'] = row
            self.live['relations']['public.fixture']['indexes'] = copy.deepcopy(row['indexes'])


class CheckpointRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.plan, self.path, self.digest = checkpoint_plan(self.root)
        self.state = self.root/'state.json'
        self.db = RecoveryFakeDB(self.plan, self.state)
        self.journal = None

    def tearDown(self):
        if self.journal: self.journal.close(); self.journal = None

    def open_executor(self):
        if self.journal: self.journal.close()
        self.journal = executor.Journal(self.state, self.digest)
        return executor.Executor(self.plan, self.root, self.db, self.journal)

    def seed_checkpoint(self, completed=(), pending=None):
        instance = self.open_executor()
        items = [{'id': name, 'status': 'done', 'before': self.db.snapshot(), 'after': self.db.snapshot()} for name in completed]
        if pending:
            items.append({'id': pending[0], 'status': pending[1], 'before': self.db.snapshot()})
        self.journal.data['runs'] = [{'route': 'prepare', 'items': items, 'complete': False}]
        self.journal.save()
        return instance

    def seal(self):
        self.path, self.digest = fixtures.seal_plan(self.root, self.plan)

    def assert_branch_recorded(self, branch_id):
        disk = json.loads(self.state.read_text())
        encoded = json.dumps(disk)
        self.assertIn('recovery_branch_id', encoded)
        self.assertIn('source_checkpoint', encoded)
        self.assertIn(branch_id, encoded)

    def add_reverse_fixture(self):
        directory = self.root/'operation-package'; (directory/'reverse').mkdir(parents=True)
        sql = generator.transaction('NULL;\n')
        file_ref = fixtures.put(directory, 'reverse/00-public.people-0000.sql', sql)
        package = {'format': 'grassroots-offline-operation-package-v1', 'batches': [{'batch': 0}],
                   'reverse_order': ['reverse/00-public.people-0000.sql'],
                   'files': [{**file_ref, 'bytes': len(sql.encode())}]}
        manifest_ref = fixtures.put(self.root, 'operation-package/manifest.json', package)
        reverse = copy.deepcopy(self.plan['phases'][-1])
        reverse.update(id='data-reverse', kind='guarded_reverse', epoch='name_only',
                       package_manifest=manifest_ref, reverse_file='reverse/00-public.people-0000.sql')
        for field in ['pre', 'post', 'not_applied', 'recovery_before', 'recovery_after']:
            reverse[field] = fixtures.put(self.root, 'reverse-'+field+'.sql', 'SELECT true /* reverse '+field+' */')
        full = copy.deepcopy(self.plan['phases'][-1])
        full.update(id='recovery-full', kind='vacuum_full', relation='public.fixture')
        self.plan['phases'] += [reverse, full]
        self.plan['recovery_branches'] = [{
            'id': 'restore-data-before-service', 'case': 'name_only_batches_started',
            'from': {'route': 'prepare', 'completed': ['phase-0'], 'pending': None},
            'entry': fixtures.put(self.root, 'name-only-entry.sql', 'SELECT true /* compacted data checkpoint */'),
            'data_checkpoint': {'package_manifest': manifest_ref, 'committed_batches': [0],
                'guard': fixtures.put(self.root, 'data-prefix-one.sql', 'SELECT true /* exact committed batch zero */')},
            'phases': ['data-reverse', 'recovery-full', 'phase-1', 'recover-check']}]
        self.seal()
        self.db = RecoveryFakeDB(self.plan, self.state)
        self.db.live['relations']['published.fixture_cache']['populated'] = False
        self.db.guard_values[executor.artifact(self.root, reverse['post']).decode().strip()] = False
        self.db.guard_values[executor.artifact(self.root, reverse['not_applied']).decode().strip()] = True
        return reverse

    def test_guarded_reverse_commit_disconnect_reconciles_without_resend(self):
        self.add_reverse_fixture()
        executor.load_plan(self.path, self.digest)
        self.db.mode = 'reverse_disconnect_after'
        with self.assertRaisesRegex(executor.Stop, 'reconcile_before_retry'):
            self.seed_checkpoint(['phase-0']).run('recover', max_phases=1)
        self.assertEqual(len(self.db.calls), 1)
        self.db.mode = 'normal'
        result = self.open_executor().run('recover', reconcile_only=True)
        self.assertEqual(result['status'], 'committed_verified')
        self.assertEqual(len(self.db.calls), 1)
        self.assertEqual(self.open_executor().run('recover', max_phases=10)['status'], 'complete')
        self.assertEqual(sum(bool(sql and sql.startswith('-- PRIVATE operation package.')) for sql in self.db.calls), 1)
        self.assertEqual(self.db.calls[1], 'VACUUM (FULL, ANALYZE) "public"."fixture"')
        self.assertEqual(self.db.calls[2], 'REFRESH MATERIALIZED VIEW "published"."fixture_cache"')

    def test_reverse_both_true_or_both_false_is_ambiguous_not_retried(self):
        reverse = self.add_reverse_fixture()
        self.db.mode = 'reverse_disconnect_after'
        with self.assertRaises(executor.Stop):
            self.seed_checkpoint(['phase-0']).run('recover')
        self.db.mode = 'normal'
        for value in [True, False]:
            with self.subTest(value=value):
                for field in ['post', 'not_applied']:
                    self.db.guard_values[executor.artifact(self.root, reverse[field]).decode().strip()] = value
                self.assertEqual(self.open_executor().run('recover', reconcile_only=True)['status'], 'ambiguous')
                with self.assertRaises(executor.Stop):
                    self.open_executor().run('recover', retry_not_applied=True)
                self.assertEqual(len(self.db.calls), 1)

    def test_reverse_requires_unapplied_data_before_execution(self):
        reverse = self.add_reverse_fixture()
        self.db.guard_values[executor.artifact(self.root, reverse['post']).decode().strip()] = True
        with self.assertRaises(executor.Stop):
            self.seed_checkpoint(['phase-0']).run('recover')
        self.assertEqual(self.db.calls, [])

    def test_reverse_package_hash_and_membership_fail_closed(self):
        reverse = self.add_reverse_fixture()
        self.assertTrue(executor.action_sql(reverse, self.root).startswith('-- PRIVATE operation package.'))
        changed = copy.deepcopy(reverse); changed['reverse_file'] = 'forward/00-fixture.sql'
        with self.assertRaisesRegex(executor.Stop, 'not_a_reverse_file'):
            executor.action_sql(changed, self.root)
        (self.root/'operation-package/reverse/00-public.people-0000.sql').write_text('BEGIN; COMMIT;')
        with self.assertRaisesRegex(executor.Stop, 'artifact_hash_mismatch'):
            executor.action_sql(reverse, self.root)
        self.assertEqual(self.db.calls, [])

    def add_data_window_fixture(self):
        reverse = self.add_reverse_fixture()
        directory = self.root/'operation-package'
        package = json.loads((directory/'manifest.json').read_text())
        second_name = 'reverse/00-public.people-0001.sql'
        sql = generator.transaction('NULL;\n')
        second_ref = fixtures.put(directory, second_name, sql)
        package['batches'].append({'batch': 1})
        package['reverse_order'].append(second_name)
        package['files'].append({**second_ref, 'bytes': len(sql.encode())})
        ref = fixtures.put(self.root, 'operation-package/manifest.json', package)
        reverse['package_manifest'] = ref
        second_phase = copy.deepcopy(reverse)
        second_phase.update(id='data-reverse-second', reverse_file=second_name)
        self.plan['phases'].append(second_phase)
        checkpoint = {'route': 'prepare', 'completed': self.plan['routes']['prepare']['phases'][:], 'pending': None}
        partial = self.plan['recovery_branches'][0]
        partial['from'] = copy.deepcopy(checkpoint)
        partial['data_checkpoint']['package_manifest'] = ref
        zero = {'id': 'window-before-data', 'case': 'cache_cleared', 'from': copy.deepcopy(checkpoint),
                'entry': fixtures.put(self.root, 'window-zero-entry.sql', 'SELECT true /* window zero entry */'),
                'data_checkpoint': {'package_manifest': ref, 'committed_batches': [],
                                    'guard': fixtures.put(self.root, 'window-zero-guard.sql', 'SELECT true /* zero batches */')},
                'phases': ['phase-1', 'recover-check']}
        full_guard = fixtures.put(self.root, 'all-batches-guard.sql', 'SELECT true /* all batches committed */')
        full = copy.deepcopy(partial)
        full['id'] = 'window-all-data'
        full['data_checkpoint'].update(committed_batches=[0, 1], guard=full_guard)
        full['phases'].insert(1, second_phase['id'])
        self.plan['recovery_branches'] = [zero, partial, full]
        self.plan['data_window'] = {'after_route': 'prepare', 'package_manifest': ref, 'full_commit_guard': full_guard}
        self.seal()
        return ref

    def test_reverse_requires_all_files_for_known_committed_prefix(self):
        reverse = self.add_reverse_fixture()
        directory = self.root/'operation-package'
        package = json.loads((directory/'manifest.json').read_text())
        package['reverse_order'].append('reverse/01-public.person_claims-0000.sql')
        ref = fixtures.put(self.root, 'operation-package/manifest.json', package)
        reverse['package_manifest'] = ref
        self.plan['recovery_branches'][0]['data_checkpoint']['package_manifest'] = ref
        with self.assertRaisesRegex(executor.Stop, 'incomplete_checkpoint_reverse_files'):
            executor.validate_branches(self.plan, self.root)
        self.assertEqual(self.db.calls, [])

    def test_reverse_rejects_nonprefix_and_unknown_committed_batches(self):
        self.add_reverse_fixture()
        for bad in [[1], [0, 2], [0, 1]]:
            with self.subTest(committed=bad):
                self.plan['recovery_branches'][0]['data_checkpoint']['committed_batches'] = bad
                with self.assertRaisesRegex(executor.Stop, 'reverse_requires_known_committed_prefix'):
                    executor.validate_branches(self.plan, self.root)
        self.assertEqual(self.db.calls, [])

    def test_saved_empty_recovery_rechecks_entry_before_first_write(self):
        self.db.live['relations']['published.fixture_cache']['populated'] = False
        refresh = self.plan['phases'][1]
        pre = executor.artifact(self.root, refresh['pre']).decode().strip()
        self.db.guard_values[pre] = False
        with self.assertRaises(executor.Stop):
            self.seed_checkpoint(['phase-0']).run('recover')
        self.assertEqual(self.journal.data['runs'][-1]['items'], [])
        self.assert_branch_recorded('only-cleared-cache')
        self.db.guard_values[pre] = True
        entry = executor.artifact(self.root, self.plan['recovery_branches'][2]['entry']).decode().strip()
        self.db.guard_values[entry] = False
        with self.assertRaises(executor.Stop): self.open_executor().run('recover')
        self.assertEqual(self.db.calls, [])

    def test_data_window_requires_every_intermediate_committed_prefix(self):
        self.add_data_window_fixture()
        self.plan['recovery_branches'] = [b for b in self.plan['recovery_branches'] if b['data_checkpoint']['committed_batches'] != [0]]
        with self.assertRaisesRegex(executor.Stop, 'uncovered_data_batch_checkpoint'):
            executor.validate_branches(self.plan, self.root)
        self.assertEqual(self.db.calls, [])

    def test_data_window_all_prefixes_validate(self):
        self.add_data_window_fixture()
        executor.validate_branches(self.plan, self.root)
        executor.load_plan(self.path, self.digest)
        self.assertEqual(self.db.calls, [])

    def test_finish_requires_full_data_guard_even_when_entry_allows(self):
        self.add_data_window_fixture()
        full_guard = executor.artifact(self.root, self.plan['data_window']['full_commit_guard']).decode().strip()
        self.db.guard_values[full_guard] = False
        self.seed_checkpoint(self.plan['routes']['prepare']['phases'])
        self.journal.data['runs'][-1]['complete'] = True
        self.journal.save()
        with self.assertRaisesRegex(executor.Stop, 'all_forward_batches_must_be_committed'):
            self.open_executor().run('finish')
        self.assertEqual(self.db.calls, [])
        # Full data is temporarily confirmed, permitting one finish phase.
        self.db.guard_values[full_guard] = True
        self.open_executor().run('finish', max_phases=1)
        writes = len(self.db.calls)
        self.db.guard_values[full_guard] = False
        with self.assertRaisesRegex(executor.Stop, 'all_forward_batches_must_be_committed'):
            self.open_executor().run('finish', max_phases=10)
        self.assertEqual(len(self.db.calls), writes)

    def test_v2_plan_validates_offline(self):
        loaded = executor.load_plan(self.path, self.digest)
        self.assertEqual(loaded['format'], 'grassroots-maintenance-v2')
        self.assertNotIn('recover', loaded['routes'])
        self.assertEqual(self.db.calls, [])

    def test_first_clear_not_applied_recovers_with_gate_without_refresh(self):
        instance = self.seed_checkpoint(pending=('phase-0', 'not_applied_verified'))
        result = instance.run('recover', max_phases=10)
        self.assertEqual(result['status'], 'complete')
        self.assertEqual([sql for sql in self.db.calls if sql is not None], [])
        self.assert_branch_recorded('clear-never-applied')
        self.assertTrue(self.db.live['relations']['published.fixture_cache']['populated'])

    def test_before_any_write_uses_gate_only(self):
        self.seed_checkpoint().run('recover', max_phases=10)
        self.assertEqual([sql for sql in self.db.calls if sql is not None], [])
        self.assert_branch_recorded('before-any-write')

    def test_cleared_checkpoint_refreshes_only_named_cache(self):
        self.db.live['relations']['published.fixture_cache']['populated'] = False
        self.seed_checkpoint(['phase-0']).run('recover', max_phases=10)
        sql = [s for s in self.db.calls if s is not None]
        self.assertEqual(sql, ['REFRESH MATERIALIZED VIEW "published"."fixture_cache"'])
        self.assert_branch_recorded('only-cleared-cache')

    def test_partial_index_recovery_executes_only_remaining_suffix(self):
        self.db.live['relations']['published.fixture_cache']['populated'] = False
        self.db.live['relations']['public.fixture_idx'] = None
        self.db.live['relations']['public.fixture']['indexes'] = []
        self.seed_checkpoint(['phase-0', 'phase-2']).run('recover', max_phases=10)
        sql = [s for s in self.db.calls if s is not None]
        self.assertEqual(sql, ['CREATE INDEX fixture_idx ON public.fixture USING btree (value)',
                               'REFRESH MATERIALIZED VIEW "published"."fixture_cache"'])
        self.assertFalse(any('DROP INDEX' in s for s in sql))
        self.assert_branch_recorded('rebuild-dropped-index')

    def test_unknown_pending_cannot_select_recovery_branch(self):
        with self.assertRaises(executor.Stop):
            self.seed_checkpoint(pending=('phase-0', 'unknown')).run('recover')
        self.assertEqual(self.db.calls, [])

    def test_wrong_completed_prefix_cannot_select_recovery_branch(self):
        with self.assertRaises(executor.Stop):
            self.seed_checkpoint(['phase-2']).run('recover')
        self.assertEqual(self.db.calls, [])

    def test_no_matching_entry_guard_stops_before_mutation(self):
        branch = self.plan['recovery_branches'][2]
        self.db.guard_values[executor.artifact(self.root, branch['entry']).decode()] = False
        with self.assertRaises(executor.Stop):
            self.seed_checkpoint(['phase-0']).run('recover')
        self.assertEqual(self.db.calls, [])

    def test_multiple_matching_branches_stop_before_mutation(self):
        duplicate = copy.deepcopy(self.plan['recovery_branches'][2])
        duplicate['id'] = 'second-cache-match'
        duplicate['entry'] = fixtures.put(self.root, 'second-cache-entry.sql', 'SELECT true /* second match */')
        self.plan['recovery_branches'].append(duplicate); self.seal()
        with self.assertRaises(executor.Stop):
            self.seed_checkpoint(['phase-0']).run('recover')
        self.assertEqual(self.db.calls, [])

    def test_branch_contract_change_invalidates_evidence_without_resealing(self):
        phase = self.plan['phases'][0]
        self.plan['recovery_branches'][2]['phases'] = ['recover-check']
        with self.assertRaisesRegex(executor.Stop, 'evidence_binding_mismatch'):
            executor.evidence(self.plan, phase, self.root)
        self.assertEqual(self.db.calls, [])

    def test_recovery_resume_keeps_original_branch_not_a_new_matching_one(self):
        self.db.live['relations']['published.fixture_cache']['populated'] = False
        self.seed_checkpoint(['phase-0']).run('recover', max_phases=1)
        self.assert_branch_recorded('only-cleared-cache')
        # Refresh has committed; restart must continue its gate, not choose a
        # different branch from the resulting live cache shape or re-refresh.
        result = self.open_executor().run('recover', max_phases=10)
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(len([sql for sql in self.db.calls if sql is not None]), 1)
        self.assert_branch_recorded('only-cleared-cache')
        with self.assertRaises(executor.Stop): self.open_executor().run('prepare')


if __name__ == '__main__':
    unittest.main()
