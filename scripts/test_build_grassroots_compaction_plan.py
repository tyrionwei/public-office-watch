import gzip
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('plan', Path(__file__).with_name('build-grassroots-compaction-plan.py'))
plan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan)


def uid(n):
    return f'00000000-0000-0000-0000-{n:012d}'


class OfflinePlanTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.snapshot = self.root / 'snapshot'
        self.journal = self.snapshot / 'journal'
        self.journal.mkdir(parents=True)
        self.baseline = self.root / 'baseline'; self.baseline.mkdir()
        self.backup = self.root / 'backup'; self.backup.mkdir()
        self.out = self.root / 'package'
        self.tables = {t: [] for t in plan.TABLES}
        self.tables['public.people'] = [{'id': uid(n), 'name': '同名測試', 'is_public': True} for n in [1, 2, 3, 4]]
        self.tables['public.candidates'] = [{'id': uid(n+10), 'person_id': uid(n), 'race_id': uid(90), 'is_public': True} for n in [1, 2, 3, 4]]
        self.tables['published.candidate_facts'] = [{'candidate_id': uid(11), 'person_id': uid(1), 'person_party': '甲', 'person_position': '村長', 'person_name': '原公開別名'}]
        self.tables['public.person_claims'] = [{'id': uid(30), 'person_id': uid(1), 'claim_value': "literal ' and \\ text"}]
        self.tables['public.person_merge_decisions'] = [{'id': uid(40), 'duplicate_person_id': uid(2), 'canonical_person_id': uid(1), 'status': 'verified'}]
        self.tables['public.person_identity_matches'] = [{'id': uid(50), 'person_id': uid(1)}]
        self.tables['public.person_party_affiliations'] = [{'id': uid(60), 'person_id': uid(1)}]
        self.tables['published.person_demographics'] = [{'person_id': uid(1), 'birth_date': None}]
        self.scope = [{'id': uid(n), 'canonical_id': uid(1 if n == 2 else n), 'name': '同名測試'} for n in [1, 2, 3]]
        self.canonical = [{'person_id': uid(n), 'canonical_person_id': uid(1 if n == 2 else n)} for n in [1, 2, 3, 4]]
        self.visible = [{'id': uid(11), 'person_id': uid(1), 'name': '原公開別名', 'race_id': uid(90)}]
        self.write_inputs()

    def write_inputs(self):
        for table, rows in self.tables.items():
            (self.journal / (table+'.json.gz')).write_bytes(gzip.compress(json.dumps(rows).encode()))
        checks = [{'table': t, 'column': c, 'target_rows': 0} for t, c in plan.ZERO]
        (self.journal / 'dependency-checks.json').write_text(json.dumps(checks))
        manifest = {p.name: {'bytes': p.stat().st_size, 'sha256': plan.digest(p)} for p in self.journal.iterdir() if p.name != 'manifest.json'}
        (self.journal / 'manifest.json').write_text(json.dumps(manifest))
        for name, value in [('scope.json', self.scope), ('canonical.json', self.canonical), ('public-candidates.json', self.visible)]:
            (self.baseline/name).write_text(json.dumps(value))
        (self.backup/'table-fingerprints.json').write_text('[]')
        inputs = {'baseline-v2/'+p.name: plan.digest(p) for p in self.baseline.iterdir()}
        inputs['backup/table-fingerprints.json'] = plan.digest(self.backup/'table-fingerprints.json')
        (self.snapshot/'input-hashes.json').write_text(json.dumps(inputs))

    def build(self):
        return plan.build(self.snapshot, self.baseline, self.backup, self.out, 1)

    def test_scope_batches_name_visibility_and_high_level_exclusion(self):
        result = self.build()
        self.assertEqual([x['people'] for x in result['batches']], [2, 1])
        self.assertEqual(result['scope_people'], 3)
        sql = (self.out/result['forward_order'][0]).read_text()
        self.assertIn('原公開別名', sql)
        self.assertIn('candidate_name', sql)
        self.assertIn('"is_public":false', sql)
        self.assertIn('Scope has higher-level or unknown race', sql)
        self.assertIn('person_canonical_map', sql)
        all_sql = ''.join((self.out/p).read_text() for p in result['forward_order'])
        self.assertNotIn(uid(4), all_sql)
        self.assertNotIn(uid(14), all_sql)
        self.assertEqual(len(result['forward_order']), 2)  # Same name does not merge independent people.

    def test_rejected_cross_group_edge_connects_operation_not_identity(self):
        self.tables['public.person_merge_decisions'].append({'id': uid(41), 'duplicate_person_id': uid(3), 'canonical_person_id': uid(1), 'status': 'rejected'})
        self.write_inputs()
        result = self.build()
        self.assertEqual(len(result['batches']), 1)
        self.assertEqual(result['batches'][0]['people'], 3)
        self.assertEqual(result['batches'][0]['canonical_groups'], 2)
        sql = (self.out/result['forward_order'][0]).read_text()
        self.assertIn('"person_id":"'+uid(3)+'","canonical_person_id":"'+uid(3)+'"', sql)
        self.assertNotIn('UPDATE public.person_merge_decisions', sql)
        self.assertIn("SET LOCAL timezone = 'UTC'", sql)
        self.assertIn('SET LOCAL extra_float_digits = 3', sql)
        reverse_merge = [p for p in result['reverse_order'] if 'person_merge_decisions' in p]
        self.assertEqual(len(reverse_merge), 1)

    def test_scope_external_edge_is_rejected(self):
        self.tables['public.person_merge_decisions'].append({'id': uid(41), 'duplicate_person_id': uid(3), 'canonical_person_id': uid(4), 'status': 'rejected'})
        self.write_inputs()
        with self.assertRaisesRegex(ValueError, 'endpoint outside scope'):
            self.build()

    def test_oversized_operation_component_is_rejected(self):
        self.tables = {t: [] for t in plan.TABLES}
        self.tables['public.people'] = [{'id': uid(n), 'name': '合成測試'} for n in range(1, 2002)]
        self.scope = [{'id': uid(n), 'canonical_id': uid(n), 'name': '合成測試'} for n in range(1, 2002)]
        self.canonical = [{'person_id': uid(n), 'canonical_person_id': uid(n)} for n in range(1, 2002)]
        self.visible = []
        self.tables['public.person_merge_decisions'] = [{'id': uid(n+3000), 'duplicate_person_id': uid(n), 'canonical_person_id': uid(n+1), 'status': 'rejected'} for n in range(1, 2001)]
        self.write_inputs()
        with self.assertRaisesRegex(ValueError, '2000 people safety limit'):
            self.build()
        self.assertFalse(self.out.exists())

    def test_public_baseline_guard_uses_canonical_view_before_updates(self):
        self.visible = [{'id': uid(12), 'person_id': uid(1), 'name': '公開姓名', 'race_id': uid(91)}]
        self.write_inputs()
        result = self.build()
        sql = (self.out/result['forward_order'][0]).read_text()
        guard = sql.index('Public candidate membership or name drift')
        self.assertLess(guard, sql.index('UPDATE public.candidates'))
        self.assertIn("'id',candidate_id,'person_id',person_id,'name',person_name,'race_id',race_id", sql)
        self.assertIn('FROM public.public_candidates WHERE candidate_id=ANY', sql)
        # Canonical identity/race may differ from original candidates: no raw-ID comparison.
        self.assertIn('"id":"'+uid(12)+'","person_id":"'+uid(1)+'","name":"公開姓名","race_id":"'+uid(91)+'"', sql)
        lock = sql.split('LOCK TABLE ', 1)[1].split(' IN SHARE ROW EXCLUSIVE MODE', 1)[0]
        for table in ['public.elections', 'public.regions', 'public.race_merge_decisions', 'public.election_merge_decisions', 'public.person_media']:
            self.assertIn(table, lock)

    def test_scope_without_original_candidacy_is_rejected(self):
        self.tables['public.candidates'] = [row for row in self.tables['public.candidates'] if row['person_id'] != uid(3)]
        self.write_inputs()
        with self.assertRaisesRegex(ValueError, 'no original candidacy'):
            self.build()
        self.assertFalse(self.out.exists())

    def test_facts_link_to_canonical_not_raw_candidate_identity(self):
        self.tables['published.candidate_facts'][0]['candidate_id'] = uid(12)
        self.write_inputs()
        self.build()  # Raw candidate person 2, facts canonical person 1.

    def test_wrong_facts_canonical_identity_is_rejected(self):
        self.tables['published.candidate_facts'][0]['candidate_id'] = uid(12)
        self.tables['published.candidate_facts'][0]['person_id'] = uid(2)
        self.write_inputs()
        with self.assertRaisesRegex(ValueError, 'facts person differs'):
            self.build()
        self.assertFalse(self.out.exists())

    def test_hash_tampering_and_no_output_on_invalid_input(self):
        with (self.journal/'public.people.json.gz').open('ab') as f:
            f.write(b'tamper')
        with self.assertRaisesRegex(ValueError, 'integrity'):
            self.build()
        self.assertFalse(self.out.exists())

    def test_baseline_tampering(self):
        (self.baseline/'scope.json').write_text('[]')
        with self.assertRaisesRegex(ValueError, 'SHA256'):
            self.build()

    def test_canonical_group_must_not_be_split(self):
        self.scope = self.scope[:1]
        self.write_inputs()
        with self.assertRaisesRegex(ValueError, 'splits a canonical group'):
            self.build()

    def test_exact_runtime_dependency_guards(self):
        result = self.build()
        sql = (self.out/result['forward_order'][0]).read_text()
        self.assertIn('Incoming FK schema changed or unknown dependency', sql)
        self.assertIn('NOT convalidated', sql)
        for table, _ in plan.ZERO:
            self.assertIn('Unsupported dependent rows: '+table, sql)
        for table in plan.TABLES:
            self.assertIn('Row drift: '+table, sql)
        self.assertIn('EXCEPT ALL', sql)
        self.assertLess(sql.index('Unsupported dependent rows:'), sql.index('DELETE FROM public.people'))
        self.assertIn('IN SHARE ROW EXCLUSIVE MODE', sql)

    def test_reverse_order_exact_existing_rows_and_no_destructive_reset(self):
        result = self.build()
        order = result['reverse_order']
        self.assertIn('public.people', order[0])
        self.assertLess(next(i for i,p in enumerate(order) if 'public.people' in p), next(i for i,p in enumerate(order) if 'public.person_claims' in p))
        self.assertLess(next(i for i,p in enumerate(order) if 'person_merge_decisions' in p), next(i for i,p in enumerate(order) if 'public.candidates' in p))
        for path in order:
            sql = (self.out/path).read_text()
            self.assertIn('Row drift:', sql)
            for forbidden in ['TRUNCATE', 'DISABLE TRIGGER', 'session_replication_role', 'DROP CONSTRAINT']:
                self.assertNotIn(forbidden, sql)
        self.assertFalse(result['executable_authorization'])
        for entry in result['files']:
            self.assertEqual(plan.digest(self.out/entry['path']), entry['sha256'])

    def test_sql_data_cannot_close_do_delimiter(self):
        self.tables['public.person_claims'][0]['claim_value'] = "$grassroots$ $batch$ $other_tag$ \\ \\n'; DROP TABLE public.people; --"
        self.write_inputs()
        result = self.build()
        sql = (self.out/result['forward_order'][0]).read_text()
        delimiter = sql.split('DO ', 1)[1].split(' BEGIN', 1)[0]
        self.assertEqual(sql.count(delimiter), 2)
        self.assertNotEqual(delimiter, '$grassroots$')

    def test_forward_and_reverse_have_bounded_statement_timeout(self):
        result = self.build()
        self.assertEqual(result['transaction_timeouts'], {'lock_timeout': '5s', 'statement_timeout': '5min'})
        for path in result['forward_order'] + result['reverse_order']:
            sql = (self.out/path).read_text()
            self.assertEqual(sql.count("SET LOCAL statement_timeout = '5min';"), 1)
            self.assertLess(sql.index("SET LOCAL statement_timeout = '5min';"), sql.index('LOCK TABLE '))
            self.assertLess(sql.index("SET LOCAL statement_timeout = '5min';"), sql.index('DO '))

    def test_existing_output_refused(self):
        self.build()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.build()

    def test_nonzero_dependency_evidence_refused(self):
        path = self.journal/'dependency-checks.json'
        checks = json.loads(path.read_text()); checks[0]['target_rows'] = 1
        path.write_text(json.dumps(checks))
        manifest_path = self.journal/'manifest.json'
        manifest = json.loads(manifest_path.read_text()); manifest[path.name] = {'bytes': path.stat().st_size, 'sha256': plan.digest(path)}
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'zero-dependency'):
            self.build()


if __name__ == '__main__':
    unittest.main()
