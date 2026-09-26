#!/usr/bin/env python3
"""Generate a private, offline SQL operation package; never connect to a database.

The package is NOT deployment approval. It requires the candidate-name DDL,
maintenance mode, validated target/backup and capacity gates outside this tool.
"""
import argparse
import gzip
import hashlib
import json
import re
import uuid
from pathlib import Path

TABLES = ['public.people', 'public.person_claims', 'public.person_merge_decisions',
          'public.person_identity_matches', 'public.person_party_affiliations',
          'published.person_demographics', 'public.candidates', 'published.candidate_facts']
KEYS = {t: 'id' for t in TABLES}
KEYS.update({'published.person_demographics': 'person_id', 'published.candidate_facts': 'candidate_id'})
PUBLIC_VIEW_TABLES = ['public.elections', 'public.regions', 'public.race_merge_decisions',
                      'public.election_merge_decisions']
LOW = ['village_chief', 'township_representative', 'township_representative_district']
ZERO = [('public.current_office_assignments', 'person_id'),
        ('public.current_office_exclusions', 'person_id'),
        ('public.legal_record_leads', 'matched_person_id'),
        ('public.person_company_relations', 'person_id'),
        ('public.person_feedback_submissions', 'person_id'),
        ('public.person_identity_research_holds', 'person_id'),
        ('public.person_media', 'person_id'), ('public.person_party_events', 'person_id'),
        ('public.platform_fulfillment_votes', 'claim_id')]
# Fixed, reviewed incoming FK schema for every table that this package deletes.
# New inbound dependencies, including dependencies of cascade children, fail closed.
FK = [(t, col, 'public.people', 'id', action) for t, col, action in [
    ('public.candidates', 'person_id', 'a'), ('public.person_claims', 'person_id', 'c'),
    ('public.person_merge_decisions', 'canonical_person_id', 'c'),
    ('public.person_merge_decisions', 'duplicate_person_id', 'c'),
    ('public.person_identity_matches', 'person_id', 'c'),
    ('public.person_party_affiliations', 'person_id', 'c'),
    ('published.person_demographics', 'person_id', 'c'),
    ('public.current_office_assignments', 'person_id', 'c'),
    ('public.current_office_exclusions', 'person_id', 'c'),
    ('public.legal_record_leads', 'matched_person_id', 'n'),
    ('public.person_company_relations', 'person_id', 'a'),
    ('public.person_feedback_submissions', 'person_id', 'c'),
    ('public.person_identity_research_holds', 'person_id', 'a'),
    ('public.person_media', 'person_id', 'a'), ('public.person_party_events', 'person_id', 'c')]]
FK.append(('public.platform_fulfillment_votes', 'claim_id', 'public.person_claims', 'id', 'c'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_verified(path, expected):
    if not re.fullmatch(r'[0-9a-f]{64}', str(expected)) or digest(path) != expected:
        raise ValueError(f'SHA256 mismatch: {path.name}')
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.name.endswith('.gz') else raw)


def sql_json(value):
    return "'" + json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace("'", "''") + "'::jsonb"


def sql_ids(values):
    return 'ARRAY[' + ','.join("'" + str(uuid.UUID(v)) + "'" for v in sorted(set(values))) + ']::uuid[]'


def ident(value):
    if not re.fullmatch(r'[a-z_][a-z0-9_]*', value):
        raise ValueError('Unexpected column identifier')
    return '"' + value + '"'


def index_rows(rows, key):
    result = {}
    for row in rows:
        value = str(uuid.UUID(row[key]))
        if value in result:
            raise ValueError('Duplicate record UUID')
        result[value] = row
    return result


def sorted_rows(rows):
    return sorted(rows, key=lambda row: json.dumps(row, sort_keys=True))


def public_candidate_guard(actual, expected):
    # Reuse the filtered view result, preserving both EXCEPT ALL directions.
    return (f"IF EXISTS (WITH actual AS MATERIALIZED ({actual}), "
            f"expected AS MATERIALIZED ({expected}) "
            "SELECT 1 FROM ((SELECT row FROM actual EXCEPT ALL SELECT row FROM expected) "
            "UNION ALL (SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)) AS delta) "
            "THEN RAISE EXCEPTION 'Public candidate membership or name drift'; END IF;\n")


def exact(table, where, rows, subset=False):
    """Compare whole JSON rows, not counts/hashes; subset is for missing restore rows."""
    expected = sql_json(rows)
    actual = f'SELECT to_jsonb(t) AS row FROM {table} t WHERE {where}'
    right = f'SELECT value AS row FROM jsonb_array_elements({expected})'
    difference = f'({actual}) EXCEPT ALL ({right})'
    if not subset:
        difference += f' UNION ALL (({right}) EXCEPT ALL ({actual}))'
    return f"IF EXISTS ({difference}) THEN RAISE EXCEPTION 'Row drift: {table}'; END IF;\n"


def schema_guard():
    wanted = [{'table': t, 'column': c, 'target': target, 'target_column': tc, 'action': action}
              for t, c, target, tc, action in FK]
    tables = ','.join("'" + t + "'::regclass" for t in TABLES[:6])
    actual = f"""SELECT jsonb_build_object('table',ns.nspname||'.'||cl.relname,
      'column',a.attname,'target',nt.nspname||'.'||ct.relname,
      'target_column',at.attname,'action',con.confdeltype::text) AS row
      FROM pg_constraint con JOIN pg_class cl ON cl.oid=con.conrelid
      JOIN pg_namespace ns ON ns.oid=cl.relnamespace
      JOIN pg_class ct ON ct.oid=con.confrelid JOIN pg_namespace nt ON nt.oid=ct.relnamespace
      JOIN pg_attribute a ON a.attrelid=cl.oid AND a.attnum=con.conkey[1]
      JOIN pg_attribute at ON at.attrelid=ct.oid AND at.attnum=con.confkey[1]
      WHERE con.contype='f' AND con.confrelid IN ({tables})"""
    expected = f'SELECT value AS row FROM jsonb_array_elements({sql_json(wanted)})'
    return f"""IF EXISTS (SELECT 1 FROM pg_constraint WHERE contype='f'
      AND confrelid IN ({tables}) AND (cardinality(conkey)<>1 OR cardinality(confkey)<>1 OR NOT convalidated))
      OR EXISTS (({actual}) EXCEPT ALL ({expected}))
      OR EXISTS (({expected}) EXCEPT ALL ({actual})) THEN
      RAISE EXCEPTION 'Incoming FK schema changed or unknown dependency'; END IF;
"""


def transaction(body):
    locks = sorted(set(TABLES + [t for t, _ in ZERO] + ['public.races'] + PUBLIC_VIEW_TABLES))
    body = schema_guard() + body
    delimiter = '$grassroots_' + hashlib.sha256(body.encode()).hexdigest() + '$'
    while delimiter in body:
        delimiter = delimiter[:-1] + '_x$'
    return """-- PRIVATE operation package. Complete external maintenance/target/backup/capacity gates first.
BEGIN;
SET LOCAL standard_conforming_strings = on;
SET LOCAL timezone = 'UTC';
SET LOCAL extra_float_digits = 3;
SET LOCAL search_path = pg_catalog, public, published;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
""" + 'LOCK TABLE ' + ','.join(locks) + ' IN SHARE ROW EXCLUSIVE MODE;\n' + \
        'DO ' + delimiter + ' BEGIN\n' + body + 'END ' + delimiter + ';\nCOMMIT;\n'



SEGMENT_BOUNDARY = '-- grassroots-forward-request-boundary\n'


def segment_forward_transaction(sql):
    """Split this generator's forward DO; preserve each statement and one commit.

    PG17 deadline is set before BEGIN, so smaller DO statements cannot extend
    the total transaction budget. Execute requests on one dedicated session.
    This is not a parser for arbitrary SQL or reverse packages.
    """
    match = re.search(r'^DO (\$grassroots_[a-f0-9]+\$) BEGIN\n', sql, re.M)
    if not match:
        raise ValueError('Expected generated forward DO')
    tail = 'END ' + match.group(1) + ';\nCOMMIT;\n'
    if not sql.endswith(tail) or SEGMENT_BOUNDARY in sql:
        raise ValueError('Unexpected transaction envelope')
    head = sql[:match.start()]
    if head.count('BEGIN;\n') != 1 or "SET LOCAL statement_timeout = '5min';" not in head:
        raise ValueError('Unexpected transaction settings')
    body = sql[match.end():-len(tail)]
    parts = []; current = ''
    for line in body.splitlines(True):
        if not current and not line.strip():
            continue
        if not current and not line.startswith(('IF ', 'UPDATE ', 'DELETE ')):
            raise ValueError('Unsupported forward statement')
        current += line
        if line.rstrip().endswith('END IF;') or (current.startswith(('UPDATE ', 'DELETE ')) and line.rstrip().endswith(';')):
            parts.append(current); current = ''
    if current or ''.join(parts).strip() != body.strip():
        raise ValueError('Forward statement content changed')
    writes = [part for part in parts if not part.startswith('IF ')]
    expected = ('UPDATE public.candidates t SET', 'UPDATE published.candidate_facts SET', 'DELETE FROM public.people WHERE')
    if len(writes) != 3 or not all(part.startswith(prefix) for part, prefix in zip(writes, expected)):
        raise ValueError('Unexpected forward writes')
    requests = ["SET transaction_timeout = '5min';\n", head]
    for part in parts:
        tag = '$segment_' + hashlib.sha256(part.encode()).hexdigest() + '$'
        if tag in part:
            raise ValueError('Segment delimiter collision')
        requests.append('DO ' + tag + ' BEGIN\n' + part + 'END ' + tag + ';\n')
    requests.append('COMMIT;\n')
    return requests


def forward_requests(sql):
    """Read a hash-verified segmented file; caller owns target/transaction gates."""
    requests = sql.split(SEGMENT_BOUNDARY)
    if len(requests) < 4 or requests[-1] != 'COMMIT;\n':
        raise ValueError('Missing segmented forward envelope')
    if requests[0] != "SET transaction_timeout = '5min';\n" or "BEGIN;\n" not in requests[1]:
        raise ValueError('Missing whole-transaction deadline')
    for request in requests[2:-1]:
        match = re.fullmatch(r'DO (\$segment_[a-f0-9]{64}\$) BEGIN\n(.*)END \1;\n', request, re.S)
        if not match or match.group(1) != '$segment_' + hashlib.sha256(match.group(2).encode()).hexdigest() + '$':
            raise ValueError('Segment body hash mismatch')
    return requests

def batch_rows(tables, people):
    people = set(people)
    selected = {}
    for table in TABLES:
        if table == 'published.candidate_facts':
            cids = {x['id'] for x in selected['public.candidates']}
            rows = [x for x in tables[table] if x['candidate_id'] in cids or x.get('person_id') in people]
        elif table == 'public.people':
            rows = [x for x in tables[table] if x['id'] in people]
        elif table == 'public.person_merge_decisions':
            rows = [x for x in tables[table] if x['duplicate_person_id'] in people or x['canonical_person_id'] in people]
        else:
            rows = [x for x in tables[table] if x.get('person_id') in people]
        selected[table] = rows
    return selected


def where_for(table, rows, people, candidate_ids):
    key = KEYS[table]
    terms = [f't.{key}=ANY({sql_ids([x[key] for x in rows])})']
    if table == 'public.people':
        terms.append(f't.id=ANY({sql_ids(people)})')
    elif table == 'public.person_merge_decisions':
        terms += [f't.{col}=ANY({sql_ids(people)})' for col in ['duplicate_person_id', 'canonical_person_id']]
    else:
        terms.append(f't.person_id=ANY({sql_ids(people)})')
    if table == 'published.candidate_facts':
        terms.append(f't.candidate_id=ANY({sql_ids(candidate_ids)})')
    return '(' + ' OR '.join(terms) + ')'


def zero_guards(people, claims):
    return ''.join(f"IF EXISTS (SELECT 1 FROM {table} WHERE {col}=ANY({sql_ids(claims if col == 'claim_id' else people)})) THEN RAISE EXCEPTION 'Unsupported dependent rows: {table}'; END IF;\n"
                   for table, col in ZERO)


def build(snapshot_dir, baseline_dir, backup_dir, output_dir, batch_size=1000):
    if output_dir.exists():
        raise ValueError('Output directory already exists; refusing overwrite')
    if not 1 <= batch_size <= 1000:
        raise ValueError('batch-size must be 1..1000; canonical groups are never split')
    journal = snapshot_dir / 'journal'
    manifest_path = journal / 'manifest.json'
    journal_manifest = json.loads(manifest_path.read_text())
    hashes_path = snapshot_dir / 'input-hashes.json'
    input_hashes = json.loads(hashes_path.read_text())
    # Manifest files are explicit trust anchors supplied by the operator; their hashes
    # are recorded in the output. Every consumed data file must be covered by them.
    for name, entry in journal_manifest.items():
        if Path(name).name != name:
            raise ValueError('Journal manifest path traversal')
        p = journal / name
        if p.stat().st_size != entry['bytes'] or digest(p) != entry['sha256']:
            raise ValueError(f'Journal integrity mismatch: {name}')
    verified = {}
    for relative, expected in input_hashes.items():
        parts = Path(relative).parts
        if len(parts) != 2 or parts[0] not in ('baseline-v2', 'backup'):
            raise ValueError('Unsupported baseline manifest path')
        path = (baseline_dir if parts[0] == 'baseline-v2' else backup_dir) / parts[1]
        verified[relative] = load_verified(path, expected)
    def journal_data(name):
        return load_verified(journal / name, journal_manifest[name]['sha256'])
    tables = {t: journal_data(t + '.json.gz') for t in TABLES}
    for table, rows in tables.items():
        index_rows(rows, KEYS[table])
        for row in rows:
            for column in row:
                ident(column)
    checks = journal_data('dependency-checks.json')
    check_map = {(x['table'], x.get('column', 'claim_id')): x['target_rows'] for x in checks}
    if set(check_map) != set(ZERO) or any(value != 0 for value in check_map.values()):
        raise ValueError('Unsupported or incomplete zero-dependency evidence')
    scope = verified['baseline-v2/scope.json']
    scope_by_id = index_rows(scope, 'id')
    people_by_id = index_rows(tables['public.people'], 'id')
    canonical = verified['baseline-v2/canonical.json']
    canonical_by_id = index_rows(canonical, 'person_id')
    visible = index_rows(verified['baseline-v2/public-candidates.json'], 'id')
    groups = {}
    for person_id, row in scope_by_id.items():
        if person_id not in people_by_id or canonical_by_id.get(person_id, {}).get('canonical_person_id') != row['canonical_id']:
            raise ValueError('Scope person/canonical mapping mismatch')
        if row['name'] != people_by_id[row['canonical_id']]['name']:
            raise ValueError('Scope fallback name differs from canonical name')
        groups.setdefault(row['canonical_id'], []).append(person_id)
    for row in canonical:
        if row['canonical_person_id'] in groups and row['person_id'] not in scope_by_id:
            raise ValueError('Scope splits a canonical group; higher-level groups must be excluded whole')
    # Preserve canonical identity groups. Cross-group rejected/suggested edges
    # only connect operational components so each cascade row is handled once.
    parent = {key: key for key in groups}
    def find(key):
        while parent[key] != key:
            parent[key] = parent[parent[key]]
            key = parent[key]
        return key
    for row in tables['public.person_merge_decisions']:
        left, right = row['duplicate_person_id'], row['canonical_person_id']
        if left in scope_by_id or right in scope_by_id:
            if left not in scope_by_id or right not in scope_by_id:
                raise ValueError('Merge edge has an endpoint outside scope')
            a, b = find(scope_by_id[left]['canonical_id']), find(scope_by_id[right]['canonical_id'])
            if a != b:
                parent[max(a, b)] = min(a, b)
    components = {}
    for canonical_id, members in groups.items():
        components.setdefault(find(canonical_id), []).extend(members)
    # Hard safety bound independent of the target batch size: large dependency
    # components need a separately reviewed memory/capacity plan.
    component_limit = 2000
    if any(len(members) > component_limit for members in components.values()):
        raise ValueError('Operational component exceeds 2000 people safety limit')
    batches, pending = [], []
    for component_id in sorted(components):
        members = sorted(components[component_id])
        if pending and len(pending) + len(members) > batch_size:
            batches.append(pending); pending = []
        pending += members
        if len(pending) >= batch_size:
            batches.append(pending); pending = []
    if pending:
        batches.append(pending)
    candidate_index = index_rows(tables['public.candidates'], 'id')
    candidate_people = {row['person_id'] for row in candidate_index.values()}
    if any(not candidate_people.intersection(members) for members in groups.values()):
        raise ValueError('Scoped canonical group has no original candidacy')
    for fact in tables['published.candidate_facts']:
        candidate = candidate_index.get(fact['candidate_id'])
        target_person = scope_by_id.get(candidate['person_id']) if candidate else None
        if target_person and fact.get('person_id') != target_person['canonical_id']:
            raise ValueError('Target facts person differs from candidate canonical identity')
        if fact.get('person_id') in scope_by_id and not target_person:
            raise ValueError('Facts reference scoped people outside scoped candidates')
    for cid, row in visible.items():
        old = candidate_index.get(cid)
        # Public race/person IDs are canonical, not necessarily raw candidate IDs.
        uuid.UUID(row['race_id'])
        if not old or canonical_by_id.get(old['person_id'], {}).get('canonical_person_id') != row['person_id'] or not isinstance(row['name'], str) or not row['name'].strip():
            raise ValueError('Visible candidate baseline mismatch')
    for candidate in tables['public.candidates']:
        if candidate.get('candidate_name') is not None:
            raise ValueError('Journal must precede name-only conversion')
        candidate['candidate_name'] = None
    output_dir.mkdir(parents=True, exist_ok=False, mode=0o700)
    (output_dir / 'forward').mkdir(mode=0o700)
    (output_dir / 'reverse').mkdir(mode=0o700)
    outputs, details = [], []
    reverse_parts = {t: [] for t in TABLES}
    def emit(relative, sql):
        path = output_dir / relative
        path.write_text(sql, encoding='utf-8'); path.chmod(0o600)
        outputs.append({'path': relative, 'bytes': path.stat().st_size, 'sha256': digest(path)})
    for number, people in enumerate(batches):
        selected = batch_rows(tables, people)
        candidates = selected['public.candidates']; cids = [x['id'] for x in candidates]
        claims = [x['id'] for x in selected['public.person_claims']]
        mappings = [canonical_by_id[p] for p in people]
        body = zero_guards(people, claims)
        body += exact('public.person_canonical_map', f't.person_id=ANY({sql_ids(people)}) OR t.canonical_person_id=ANY({sql_ids(groups_id for groups_id in {scope_by_id[p]["canonical_id"] for p in people})})', mappings)
        body += f"IF EXISTS (SELECT 1 FROM public.candidates c LEFT JOIN public.races r ON r.id=c.race_id WHERE c.person_id=ANY({sql_ids(people)}) AND (r.race_type IS NULL OR r.race_type NOT IN ({','.join(repr(x) for x in LOW)}))) THEN RAISE EXCEPTION 'Scope has higher-level or unknown race'; END IF;\n"
        visible_rows = [visible[cid] for cid in cids if cid in visible]
        view_actual = f"SELECT jsonb_build_object('id',candidate_id,'person_id',person_id,'name',person_name,'race_id',race_id) AS row FROM public.public_candidates WHERE candidate_id=ANY({sql_ids(cids)})"
        view_expected = f'SELECT value AS row FROM jsonb_array_elements({sql_json(visible_rows)})'
        body += public_candidate_guard(view_actual, view_expected)
        compacted = {}
        for table in TABLES:
            rows = selected[table]
            where = where_for(table, rows, people, cids)
            body += exact(table, where, rows)
            if table == 'public.candidates':
                compacted[table] = [{**x, 'person_id': None, 'candidate_name': visible[x['id']]['name'] if x['id'] in visible else scope_by_id[x['person_id']]['name'], 'is_public': x['id'] in visible} for x in rows]
            elif table == 'published.candidate_facts':
                if any(x['candidate_id'] not in set(cids) for x in rows):
                    raise ValueError('Facts reference scoped people outside scoped candidates')
                compacted[table] = [{**x, 'person_id': None, 'person_party': None, 'person_position': None} for x in rows]
        body += f"UPDATE public.candidates t SET person_id=NULL,candidate_name=b.candidate_name,is_public=b.is_public FROM jsonb_populate_recordset(NULL::public.candidates,{sql_json(compacted['public.candidates'])}) b WHERE t.id=b.id;\n"
        body += f"UPDATE published.candidate_facts SET person_id=NULL,person_party=NULL,person_position=NULL WHERE candidate_id=ANY({sql_ids(cids)});\n"
        body += f"DELETE FROM public.people WHERE id=ANY({sql_ids(people)});\n"
        for table in TABLES:
            rows = selected[table]
            body += exact(table, where_for(table, rows, people, cids), compacted.get(table, []))
        emit(f'forward/{number:04d}.sql', transaction(body))
        details.append({'batch': number, 'people': len(people), 'candidates': len(cids), 'canonical_groups': len({scope_by_id[p]['canonical_id'] for p in people})})
        for table in TABLES:
            rows = selected[table]
            if not rows:
                continue
            where = where_for(table, rows, people, cids)
            key = KEYS[table]
            reverse = zero_guards(people, claims)
            if table in compacted:
                # Each target UUID may be original or exact compacted state, but
                # must exist exactly once. Never overwrite a subsequent edit.
                reverse += exact(table, where, rows + compacted[table], subset=True)
                reverse += f"IF (SELECT count(*) FROM {table} t WHERE {where}) <> {len(rows)} THEN RAISE EXCEPTION 'Missing candidate/facts during recovery'; END IF;\n"
                columns = ['person_id', 'candidate_name', 'is_public'] if table == 'public.candidates' else ['person_id', 'person_party', 'person_position']
                assignments = ','.join(ident(c) + '=b.' + ident(c) for c in columns)
                reverse += f'UPDATE {table} t SET {assignments} FROM jsonb_populate_recordset(NULL::{table},{sql_json(rows)}) b WHERE t.{key}=b.{key};\n'
            else:
                reverse += exact(table, where, rows, subset=True)
                columns = ','.join(ident(c) for c in rows[0])
                reverse += f'INSERT INTO {table} ({columns}) SELECT {",".join("b."+ident(c) for c in rows[0])} FROM jsonb_populate_recordset(NULL::{table},{sql_json(rows)}) b WHERE NOT EXISTS (SELECT 1 FROM {table} t WHERE t.{key}=b.{key});\n'
            reverse += exact(table, where, rows)
            reverse_parts[table].append((number, transaction(reverse)))
    for phase, table in enumerate(TABLES):
        for number, sql in reverse_parts[table]:
            emit(f'reverse/{phase:02d}-{table}-{number:04d}.sql', sql)
    package = {'format': 'grassroots-offline-operation-package-v1', 'executable_authorization': False,
               'transaction_timeouts': {'lock_timeout': '5s', 'statement_timeout': '5min'},
               'source_manifest_sha256': digest(manifest_path), 'input_manifest_sha256': digest(hashes_path),
               'batch_target_people': batch_size, 'max_operational_component_people': component_limit, 'scope_people': len(scope), 'batches': details,
               'forward_order': [x['path'] for x in outputs if x['path'].startswith('forward/')],
               'reverse_order': [x['path'] for x in outputs if x['path'].startswith('reverse/')],
               'required_external_gates': ['verified current target and pre-operation backup', 'maintenance and write freeze',
                 'candidate-name DDL applied without full-table backfill', 'capacity and maintenance plan approved',
                 'runtime scope/canonical/FK guards pass', 'restore private external source dependencies before recovery',
                 'materialized-view rebuild and schema rollback handled separately', 'no merge or deployment authorization provided'],
               'limitations': ['No database connections or SQL execution performed by this generator',
                 'Snapshot scope is supplied; runtime SQL checks grassroots race types again',
                 'Run reverse files in manifest order; schema/index/MV maintenance is outside this package',
                 'Scope-internal cross-group edges share an operation batch without changing canonical identity; external edges are rejected',
                 'Operational components above 2000 people are rejected; normal triggers and constraints stay enabled'],
               'files': outputs}
    manifest = output_dir / 'manifest.json'
    manifest.write_text(json.dumps(package, ensure_ascii=False, indent=2), encoding='utf-8'); manifest.chmod(0o600)
    return package


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ['snapshot-dir', 'baseline-dir', 'backup-dir', 'output-dir']:
        parser.add_argument('--' + flag, required=True, type=Path)
    parser.add_argument('--batch-size', type=int, default=1000)
    args = parser.parse_args()
    package = build(args.snapshot_dir, args.baseline_dir, args.backup_dir, args.output_dir, args.batch_size)
    print(json.dumps({'generated_batches': len(package['batches']), 'scope_people': package['scope_people'], 'database_operations': 0}))


if __name__ == '__main__':
    main()
