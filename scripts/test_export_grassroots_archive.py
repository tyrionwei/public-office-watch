import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('archive', Path(__file__).with_name('export-grassroots-archive.py'))
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class ArchiveTest(unittest.TestCase):
    def fixture(self, base):
        rows = {
            'public.people': [{'id': 'p1', 'name': '同名'}, {'id': 'p2', 'name': '同名'}],
            'public.candidates': [{'id': 'c1', 'person_id': 'p1', 'race_id': 'r1'}, {'id': 'c2', 'person_id': 'p2', 'race_id': 'r1'}],
            'public.person_claims': [{'id': 'claim1', 'person_id': 'p1', 'source_person_id': 's1', 'review_status': 'draft'}],
            'public.source_people': [{'id': 's1', 'source_person_key': 'official-1'}],
            'public.person_identity_matches': [{'id': 'match1', 'person_id': 'p1', 'source_person_id': 's1', 'reviewed_at': None}],
            'public.person_merge_decisions': [{'id': 'merge1', 'duplicate_person_id': 'p1', 'canonical_person_id': 'higher', 'status': 'verified'}],
        }
        source = base / 'source.gz'
        with gzip.open(source, 'wt', encoding='utf-8') as stream:
            for table, records in rows.items():
                for row in records:
                    stream.write(json.dumps({'table': table, 'row': row}) + '\n')
        manifest = base / 'source.json'
        manifest.write_text(json.dumps({'format': 'table-tagged-jsonl-gzip-v1', 'counts': {t: len(r) for t, r in rows.items()}, 'sha256': archive.digest(source)}))
        return source, manifest, rows

    def test_round_trip_original_rows_links_and_external_identity_boundary(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source, manifest, rows = self.fixture(base)
            out = base / 'out'
            result = archive.export_archive(source, manifest, out)
            for table, records in rows.items():
                self.assertEqual(list(archive.lines(out / (table + '.jsonl.gz'))), records)
            links = list(archive.lines(out / 'candidate-person-links.jsonl.gz'))
            self.assertEqual([r['original_person_id'] for r in links], ['p1', 'p2'])
            self.assertEqual([r['candidate_name'] for r in links], ['同名', '同名'])
            deps = json.loads((out / 'external-identity-dependencies.json').read_text())
            self.assertEqual(deps['people_ids_outside_archive'], ['higher'])
            for name, detail in result['files'].items():
                self.assertEqual(archive.digest(out / name), detail['sha256'])
            with self.assertRaises(FileExistsError):
                archive.export_archive(source, manifest, out)

    def test_bad_hash_is_rejected_before_creating_output(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source, manifest, _ = self.fixture(base)
            source.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                archive.export_archive(source, manifest, base / 'out')
            self.assertFalse((base / 'out').exists())


if __name__ == '__main__':
    unittest.main()
