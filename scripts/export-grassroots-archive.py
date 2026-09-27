#!/usr/bin/env python3
"""Split an existing pre-compaction archive for incremental, UUID-based recovery.

Offline only: never connects to a database. Output contains private research data
and must stay outside Git. No restore or publication is performed.
"""
import argparse
import collections
import contextlib
import gzip
import hashlib
import json
import os
from pathlib import Path

TABLES = {
    'public.people', 'public.person_claims', 'public.candidates',
    'public.source_people', 'public.person_identity_matches',
    'public.person_merge_decisions',
}


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def lines(path):
    with gzip.open(path, 'rt', encoding='utf-8') as stream:
        for line in stream:
            yield json.loads(line)


def encode(row):
    return json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n'


def export_archive(source, source_manifest, output):
    manifest = json.loads(source_manifest.read_text(encoding='utf-8'))
    source_hash = digest(source)
    if manifest.get('format') != 'table-tagged-jsonl-gzip-v1' or source_hash != manifest.get('sha256'):
        raise ValueError('Source format or SHA-256 mismatch')
    if not TABLES.issubset(manifest.get('counts', {})):
        raise ValueError('Required archive tables are missing')
    # Exclusive directory creation protects an earlier archive, including partial exports.
    output.mkdir(mode=0o700)
    counts = collections.Counter()
    seen = {table: set() for table in TABLES}
    people_names = {}
    person_refs = set()
    source_refs = set()
    with contextlib.ExitStack() as stack:
        streams = {table: stack.enter_context(gzip.open(output / (table + '.jsonl.gz'), 'wt', encoding='utf-8'))
                   for table in sorted(TABLES)}
        for item in lines(source):
            table, row = item['table'], item['row']
            counts[table] += 1
            if table not in TABLES:
                continue
            row_id = row.get('id')
            if not row_id or row_id in seen[table]:
                raise ValueError('Missing or duplicate UUID in ' + table)
            seen[table].add(row_id)
            streams[table].write(encode(row))
            if table == 'public.people':
                people_names[row_id] = row['name']
            for key in ('person_id', 'duplicate_person_id', 'canonical_person_id'):
                if row.get(key):
                    person_refs.add(row[key])
            if row.get('source_person_id'):
                source_refs.add(row['source_person_id'])
    if dict(counts) != manifest['counts']:
        raise ValueError('Source row counts differ from the pre-compaction manifest')
    links_path = output / 'candidate-person-links.jsonl.gz'
    with gzip.open(links_path, 'wt', encoding='utf-8') as stream:
        for row in lines(output / 'public.candidates.jsonl.gz'):
            person_id = row['person_id']
            if person_id not in people_names:
                raise ValueError('Candidate original person is absent from this archive')
            stream.write(encode({
                'candidate_id': row['id'], 'candidate_external_id': row.get('external_id'),
                'race_id': row['race_id'], 'original_person_id': person_id,
                'candidate_name': row.get('candidate_name') or people_names[person_id],
            }))
    # Boundary references are explicit. Never invent canonical identities or silently
    # restore/overwrite higher-level people outside the original archived scope.
    dependencies = {
        'people_ids_outside_archive': sorted(person_refs - seen['public.people']),
        'source_people_ids_outside_archive': sorted(source_refs - seen['public.source_people']),
        'races': 'Retain existing race UUIDs or recover them from the separate full dump.',
    }
    deps_path = output / 'external-identity-dependencies.json'
    deps_path.write_text(json.dumps(dependencies, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    files = {}
    for path in sorted(output.glob('*.jsonl.gz')):
        # Verify every produced stream can be decoded independently before publishing manifest.
        count = sum(1 for _ in lines(path))
        table = path.name.removesuffix('.jsonl.gz')
        expected = counts['public.candidates'] if path == links_path else counts[table]
        if count != expected:
            raise ValueError('Output row count mismatch: ' + path.name)
        files[path.name] = {'sha256': digest(path), 'rows': count,
                            'primary_key': 'candidate_id' if path == links_path else 'id'}
    files[deps_path.name] = {'sha256': digest(deps_path)}
    result = {
        'format': 'grassroots-incremental-archive-v1',
        'source_archive_sha256': source_hash,
        'source_manifest_sha256': digest(source_manifest),
        'scope_race_types': manifest.get('scope_race_types'),
        'scope_warning': manifest.get('scope_warning', 'Archive scope is not a deletion or publication allowlist.'),
        'files': files,
        'recovery': {
            'selection': 'Select people by original UUID; select claims/candidates/identity matches by person_id and merge decisions by either endpoint. Include referenced source_people.',
            'identity': 'Preserve original UUIDs, source keys, identity evidence, review states, timestamps and external IDs. Merge decisions are evidence; no new canonical mapping is inferred.',
            'dependencies': 'Resolve external-identity-dependencies.json against the target or full dump before inserting. Resolve race UUIDs first.',
            'conflicts': 'Compare by primary key before applying a selected batch. Never overwrite newer target rows or infer identity from names. Repeated batches require an explicit conflict policy.',
            'publication': 'Archival review/public flags are historical evidence, not approval to republish. Recheck publication and identity policy before restoring links.',
            'coverage': 'This is the core recovery subset. Lifecycle, feedback and other auxiliary tables remain in the original tagged archive and full dump.',
        },
        'validation': 'Source SHA-256 and all source counts verified; output gzip/JSON decoded and counts verified. No database writes or restore performed.',
    }
    (output / 'manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--source-manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True, help='New private directory outside Git')
    args = parser.parse_args()
    os.umask(0o077)
    result = export_archive(args.source, args.source_manifest, args.output)
    print(json.dumps({'format': result['format'], 'files': len(result['files']), 'validation': result['validation']}))


if __name__ == '__main__':
    main()
