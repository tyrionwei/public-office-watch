#!/usr/bin/env python3
"""可續行的基層精簡維護執行器。預設只檢查計畫；不編排或重分候選批次。

需要私人、hash 固定的計畫/SQL 斷言/峰值與回復證據。不得以取樣峰值替代上界。
CLI 與 manifest 不是正式寫入授權；維護、停寫及資料 epoch 必須先由操作人確認。
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile

FORMAT = 'grassroots-maintenance-v1'
KINDS = {'cache_clear', 'cache_refresh', 'index_drop', 'index_create',
         'reindex_index', 'reindex_table', 'vacuum_full', 'vacuum_reuse', 'gate'}
REWRITES = {'cache_refresh', 'index_create', 'reindex_index', 'reindex_table', 'vacuum_full'}
INDEX_KINDS = {'index_drop', 'index_create', 'reindex_index'}
RECLAIM_KINDS = {'cache_clear', 'index_drop', 'reindex_index', 'reindex_table', 'vacuum_full'}
SERVICE_CACHES = {
    'public.public_people_list_cached','published.person_candidate_summaries',
    'published.people_directory','published.search_results','published.home_ticker',
    'published.home_region_summary','published.election_race_summaries',
    'published.election_race_facets','published.event_summaries','published.party_officers',
    'published.region_issue_results','published.candidate_election_office_facts',
}


class Stop(RuntimeError):
    """只含可公開的錯誤代碼，不包含資料、SQL 或連線資訊。"""


def require(condition, code):
    if not condition:
        raise Stop(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(r'[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*', value), 'invalid_relation')
    return '.'.join('"'+part+'"' for part in value.split('.'))


def integer(value, minimum=0):
    require(type(value) is int and value >= minimum, 'invalid_integer')
    return value


def artifact(root, item):
    require(set(item) == {'path', 'sha256'}, 'invalid_artifact_reference')
    path = (root / item['path']).resolve()
    require(path.is_relative_to(root.resolve()) and path.is_file(), 'artifact_outside_package')
    data = path.read_bytes()
    require(sha(data) == item['sha256'], 'artifact_hash_mismatch')
    return data


def action_sql(phase, root):
    kind = phase['kind']
    if kind == 'gate':
        return None
    relation = identifier(phase['relation'])
    if kind == 'index_create':
        sql = artifact(root, phase['definition']).decode().strip()
        # Definitions are reviewed pg_get_indexdef outputs, not arbitrary SQL files.
        name = phase['relation'].split('.')[1]
        require(re.match(r'^CREATE INDEX (?:"'+name+r'"|'+name+r') ON ', sql) is not None,
                'unexpected_index_definition')
        require(';' not in sql and '--' not in sql and '/*' not in sql, 'multiple_index_statements')
        return sql
    return {
        'cache_clear': f'REFRESH MATERIALIZED VIEW {relation} WITH NO DATA',
        'cache_refresh': f'REFRESH MATERIALIZED VIEW {relation}',
        'index_drop': f'DROP INDEX {relation}',
        'reindex_index': f'REINDEX INDEX {relation}',
        'reindex_table': f'REINDEX TABLE {relation}',
        'vacuum_full': f'VACUUM (FULL, ANALYZE) {relation}',
        # TRUNCATE false prevents a reuse-only phase from accidentally claiming shrinkage.
        'vacuum_reuse': f'VACUUM (TRUNCATE FALSE) {relation}',
    }[kind]


def binding(plan, phase, root):
    """Bind evidence to SQL, both data epochs, recovery assertions and settings."""
    return sha(canonical({
        'id': phase['id'], 'kind': phase['kind'], 'relation': phase.get('relation'),
        'phase_contract': {k:v for k,v in phase.items() if k != 'evidence'},
        'ceiling_bytes': plan['ceiling_bytes'], 'routes': plan['routes'],
        'sql': action_sql(phase, root), 'epoch': phase['epoch'],
        'pre': phase['pre'], 'post': phase['post'],
        'recovery_before': phase['recovery_before'], 'recovery_after': phase['recovery_after'],
        'maintenance_guard': plan['maintenance_guard'], 'target': plan['target'],
        'statement_timeout_ms': phase['statement_timeout_ms'],
        'settings': plan['settings'], 'watch': plan['watch'], 'backup_artifacts': plan['backup_artifacts'],
        'recovery_route': {'entry': plan['routes']['recover']['entry'], 'phases': [
            {k:v for k,v in p.items() if k not in ('evidence',)}
            for ident in plan['routes']['recover']['phases']
            for p in plan['phases'] if p['id'] == ident]},
    }))


def evidence(plan, phase, root):
    e = json.loads(artifact(root, phase['evidence']))
    require(e['format'] == 'grassroots-space-envelope-v1' and e['status'] == 'passed', 'unvalidated_envelope')
    require(e['binding_sha256'] == binding(plan, phase, root), 'evidence_binding_mismatch')
    require(e['server_version_num'] == plan['target']['identity']['server_version_num'], 'evidence_version_mismatch')
    require(e['basis'] == 'reviewed_conservative_upper_envelope', 'sampling_is_not_a_peak_bound')
    require(e['recovery_covers'] == ['before', 'during', 'after_commit'], 'incomplete_recovery_envelope')
    require(bool(e['reports']), 'missing_peak_reports')
    for report in e['reports']:
        artifact(root, report)
    if plan['target']['kind'] == 'production':
        require(e['scope'] == 'production_shape', 'fixture_evidence_on_production')
    else:
        require(e['scope'] in ('production_shape', 'isolated_fixture'), 'invalid_evidence_scope')
    for key in ('operation_extra_bytes', 'recovery_extra_bytes', 'recovery_before_extra_bytes'):
        integer(e[key])
    require(type(e['max_after_delta_bytes']) is int, 'invalid_after_delta')
    if phase['kind'] in ('vacuum_reuse','gate'):
        require(e['max_after_delta_bytes'] >= 0, 'reuse_is_not_physical_reclaim')
    integer(e['observed_extra_bytes'])
    require(e['operation_extra_bytes'] >= e['observed_extra_bytes'], 'envelope_below_observation')
    require(e['components'] and all(type(v) is int and v >= 0 for v in e['components'].values()), 'missing_space_components')
    if phase['kind'] in REWRITES:
        require({'heap_toast', 'indexes', 'temporary', 'other'} <= set(e['components']), 'incomplete_rewrite_peak')
        require(e['operation_extra_bytes'] >= sum(e['components'].values()), 'peak_components_exceed_bound')
    require(set(e['relation_max_bytes']) == set(plan['watch']), 'incomplete_relation_envelope')
    require(set(e['relation_min_bytes']) == set(plan['watch']), 'incomplete_relation_floor')
    for name, value in e['relation_max_bytes'].items():
        integer(value); integer(e['relation_min_bytes'][name])
        require(e['relation_min_bytes'][name] <= value, 'invalid_relation_range')
    if e['max_after_delta_bytes'] < 0:
        require(phase['kind'] in RECLAIM_KINDS, 'negative_delta_requires_physical_reclaim')
        required = -e['max_after_delta_bytes']
        require(required <= e['relation_min_bytes'][phase['relation']] and required <= phase['min_physical_reclaim_bytes'], 'negative_delta_without_guaranteed_reclaim')
    return e


def load_plan(path, expected_sha):
    raw = path.read_bytes()
    require(sha(raw) == expected_sha, 'plan_hash_mismatch')
    p = json.loads(raw)
    require(p['format'] == FORMAT, 'unsupported_plan')
    require(p['target']['kind'] in ('production', 'isolated'), 'invalid_target_kind')
    require(set(p['target']['connection']) == {'host','port','dbname','user'}, 'only_public_connection_selectors_allowed')
    require(set(p['target']['identity']) == {'database', 'session_user', 'server_version_num', 'system_identifier'}, 'incomplete_target_identity')
    require(p['target']['identity']['server_version_num'] // 10000 == 17, 'unreviewed_postgres_major')
    require(p['settings'] == {'work_mem': '32MB', 'maintenance_work_mem': '32MB',
                             'max_parallel_maintenance_workers': '0', 'lock_timeout': '5s'}, 'unreviewed_settings')
    integer(p['ceiling_bytes'], 1)
    require(p['ceiling_bytes'] <= 500000000, 'capacity_limit_too_large')
    for name in p['watch']:
        identifier(name)
    require(len(p['watch']) == len(set(p['watch'])), 'duplicate_relation')
    artifact(path.parent, p['maintenance_guard'])
    require(bool(p['backup_artifacts']), 'missing_recovery_backup')
    for item in p['backup_artifacts']:
        artifact(path.parent, item)
    ids = set()
    for phase in p['phases']:
        require(re.fullmatch(r'[a-z0-9][a-z0-9_.:-]*', phase['id']) is not None and phase['id'] not in ids, 'invalid_phase_id')
        ids.add(phase['id'])
        require(phase['kind'] in KINDS and phase['epoch'] in ('original', 'name_only', 'restored'), 'invalid_phase_type')
        require(1000 <= integer(phase['statement_timeout_ms']) <= 300000, 'unbounded_statement_timeout')
        integer(phase['reserve_bytes'], 1)
        integer(phase['post_max_cluster_bytes'], 1)
        require(phase['post_max_cluster_bytes'] + phase['reserve_bytes'] <= p['ceiling_bytes'], 'invalid_post_capacity_limit')
        integer(phase['min_physical_reclaim_bytes'])
        if phase['kind'] not in RECLAIM_KINDS:
            require(phase['min_physical_reclaim_bytes'] == 0, 'reuse_is_not_physical_reclaim')
        if phase['kind'] != 'gate':
            require(phase['relation'] in p['watch'], 'unwatched_operation')
        for key in ('pre', 'post', 'recovery_before', 'recovery_after'):
            artifact(path.parent, phase[key])
        if phase['kind'] in ('index_create','index_drop'):
            artifact(path.parent, phase['definition'])
        action_sql(phase, path.parent)
        evidence(p, phase, path.parent)
    require(p['routes'] and p['phases'], 'empty_plan')
    for name, route in p['routes'].items():
        require(name in ('prepare', 'finish', 'recover'), 'unknown_route')
        require(route['phases'] and len(set(route['phases'])) == len(route['phases']) and set(route['phases']) <= ids, 'invalid_route')
        artifact(path.parent, route['entry'])
    require('recover' in p['routes'], 'missing_recovery_route')
    if p['target']['kind'] == 'production':
        require(SERVICE_CACHES <= set(p['watch']), 'full_service_cache_inventory_required')
        by_id = {phase['id']:phase for phase in p['phases']}
        for name, route in p['routes'].items():
            final = by_id[route['phases'][-1]]
            require(final['kind'] == 'gate', 'route_must_end_with_service_gate')
            if name == 'prepare':
                require(final['post_max_cluster_bytes'] <= 485000000, 'full_service_15mb_reserve_required')
    return p


class Journal:
    """External state only: exclusive file lock, fsync intent/done and directory."""
    def __init__(self, path, plan_sha):
        self.path = path
        require(path.parent.is_dir(), 'state_directory_missing')
        self.lock = os.open(str(path)+'.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            os.close(self.lock)
            raise Stop('another_local_executor') from None
        try:
            require(not path.is_symlink(), 'state_symlink')
            self.data = json.loads(path.read_text()) if path.exists() else {'plan_sha256': plan_sha, 'runs': [], 'recovery_started': False}
            require(self.data['plan_sha256'] == plan_sha, 'journal_plan_mismatch')
        except BaseException:
            os.close(self.lock)
            raise

    def save(self):
        fd, name = tempfile.mkstemp(prefix='.maintenance-', dir=self.path.parent)
        try:
            with os.fdopen(fd, 'wb') as f:
                f.write(canonical(self.data)); f.flush(); os.fsync(f.fileno())
            os.replace(name, self.path)
            directory = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            if os.path.exists(name):
                os.unlink(name)

    def close(self):
        os.close(self.lock)


class Database:
    def __init__(self, conn, plan):
        self.conn, self.plan = conn, plan

    def scalar(self, sql, params=()):
        return self.conn.execute(sql, params).fetchone()[0]

    def guard(self, text):
        # A subquery in a read-only transaction cannot break into DDL or COMMIT.
        require(';' not in text, 'guard_must_be_one_select_without_semicolon')
        with self.conn.transaction():
            self.conn.execute('SET TRANSACTION READ ONLY')
            self.conn.execute("SET LOCAL statement_timeout='30s'")
            rows = self.conn.execute('SELECT g.value FROM ('+text+') AS g(value)').fetchall()
            return len(rows) == 1 and len(rows[0]) == 1 and rows[0][0] is True

    def identity(self):
        return self.scalar("SELECT json_build_object('database',current_database(),'session_user',session_user,'server_version_num',current_setting('server_version_num')::int,'system_identifier',(SELECT system_identifier::text FROM pg_control_system()))")

    def snapshot(self):
        sizes = self.scalar("SELECT json_build_object('database_bytes',pg_database_size(current_database()),'cluster_bytes',(SELECT sum(pg_database_size(datname)) FROM pg_database))")
        sizes['relations'] = {}
        for name in self.plan['watch']:
            value = self.scalar("""SELECT (SELECT json_build_object('kind',c.relkind,'filenode',pg_relation_filenode(c.oid),
              'bytes',pg_total_relation_size(c.oid),'populated',c.relispopulated,
              'definition',CASE WHEN c.relkind='m' THEN pg_get_viewdef(c.oid,true) WHEN c.relkind='i' THEN pg_get_indexdef(c.oid) ELSE NULL END,
              'indexes',coalesce((SELECT json_agg(json_build_object('name',n.nspname||'.'||ix.relname,'filenode',pg_relation_filenode(ix.oid),
                'definition',pg_get_indexdef(ix.oid),'valid',i.indisvalid,'ready',i.indisready,
                'protected',i.indisunique OR i.indisprimary OR i.indisreplident OR EXISTS(SELECT 1 FROM pg_constraint co WHERE co.conindid=ix.oid)
                  OR EXISTS(SELECT 1 FROM pg_constraint fk WHERE fk.contype='f' AND fk.conrelid=i.indrelid AND i.indkey[0]=ANY(fk.conkey))) ORDER BY ix.oid)
                FROM pg_index i JOIN pg_class ix ON ix.oid=i.indexrelid JOIN pg_namespace n ON n.oid=ix.relnamespace
                WHERE i.indrelid=c.oid OR i.indexrelid=c.oid),'[]'::json))
              FROM pg_class c WHERE c.oid=to_regclass(%s))""", (name,))
            sizes['relations'][name] = value
        return sizes

    def configure(self, timeout_ms):
        settings = dict(self.plan['settings'], statement_timeout=str(timeout_ms), timezone='UTC',
                        extra_float_digits='3', standard_conforming_strings='on', search_path='pg_catalog,public,published')
        for name, value in settings.items():
            self.scalar('SELECT set_config(%s,%s,false)', (name, value))

    def execute(self, sql):
        if sql is not None:
            self.conn.execute(sql)

    def acquire(self):
        require(self.scalar('SELECT pg_try_advisory_lock(20260926,53)'), 'another_database_executor')


def capacity(plan, phase, e, snap):
    integer(snap['cluster_bytes'])
    for name, maximum in e['relation_max_bytes'].items():
        current = snap['relations'][name]
        size = current['bytes'] if current else 0
        require(e['relation_min_bytes'][name] <= size <= maximum, 'relation_outside_validated_envelope')
    for key in ('operation_extra_bytes', 'recovery_before_extra_bytes'):
        require(snap['cluster_bytes'] + e[key] + phase['reserve_bytes'] <= plan['ceiling_bytes'], key+'_capacity_gate')
    require(snap['cluster_bytes'] + e['max_after_delta_bytes'] + e['recovery_extra_bytes'] + phase['reserve_bytes'] <= plan['ceiling_bytes'], 'recovery_extra_bytes_capacity_gate')


def compatible(before, after):
    if before is None or after is None:
        return before == after
    def stable(value):
        return {'kind':value['kind'], 'definition':value['definition'],
                'indexes':sorted((x['name'],x['definition'],x['valid'],x['ready'],x['protected']) for x in value['indexes'])}
    return stable(before) == stable(after)


def shape_before(phase, snap, root):
    kind = phase['kind']
    if kind == 'gate':
        return
    row = snap['relations'][phase['relation']]
    if kind == 'index_create':
        require(row is None, 'index_already_exists_without_journal')
        return
    require(row is not None, 'missing_relation')
    if kind.startswith('cache_'):
        require(row['kind'] == 'm', 'expected_materialized_view')
        if kind == 'cache_clear':
            require(row['populated'] is True, 'cache_already_empty_without_journal')
    elif kind in INDEX_KINDS:
        require(row['kind'] == 'i' and len(row['indexes']) == 1, 'expected_index')
    else:
        require(row['kind'] == 'r', 'partition_or_non_table_requires_review')
    require(all(i['valid'] and i['ready'] for i in row['indexes']), 'invalid_index_before_operation')
    if kind == 'index_drop':
        require(not row['indexes'][0]['protected'], 'protected_index')
        require(row['definition'] == artifact(root, phase['definition']).decode().strip(), 'index_definition_drift')
    if kind == 'reindex_table':
        require(bool(row['indexes']), 'reindex_without_observable_indexes')


def completed_shape(phase, before, after, root):
    kind = phase['kind']
    if kind == 'gate':
        return True
    old, new = before['relations'][phase['relation']], after['relations'][phase['relation']]
    if kind == 'index_drop':
        return old is not None and new is None
    if kind == 'index_create':
        return old is None and new is not None and new['definition'] == action_sql(phase, root) and all(i['valid'] and i['ready'] for i in new['indexes'])
    if not new or not compatible(old, new):
        return False
    if kind == 'cache_clear':
        return new['populated'] is False
    if kind == 'cache_refresh':
        return new['populated'] is True and new['filenode'] != old['filenode']
    if kind in ('vacuum_full', 'reindex_index'):
        return new['filenode'] != old['filenode']
    if kind == 'reindex_table':
        previous = {i['name']:i['filenode'] for i in old['indexes']}
        return all(i['filenode'] != previous[i['name']] for i in new['indexes'])
    return kind == 'vacuum_reuse'


class Executor:
    def __init__(self, plan, root, db, journal):
        self.plan, self.root, self.db, self.journal = plan, root, db, journal
        self.phases = {p['id']:p for p in plan['phases']}

    def guard(self, ref, code):
        require(self.db.guard(artifact(self.root, ref).decode().strip()), code)

    def common(self):
        require(self.db.identity() == self.plan['target']['identity'], 'target_identity_changed')
        self.guard(self.plan['maintenance_guard'], 'maintenance_or_write_freeze_lost')

    def post(self, p, e, before, after):
        self.common()
        require(completed_shape(p, before, after, self.root), 'physical_completion_not_proven')
        self.guard(p['post'], 'data_or_catalog_postcondition_failed')
        self.guard(p['recovery_after'], 'recovery_after_gate_failed')
        if p['kind']=='gate' and self.plan['target']['kind']=='production':
            require(all(after['relations'][name] is not None and after['relations'][name]['kind']=='m'
                        and after['relations'][name]['populated'] for name in SERVICE_CACHES), 'full_service_cache_gate_failed')
        require(after['cluster_bytes'] <= p['post_max_cluster_bytes'], 'post_capacity_limit')
        require(after['cluster_bytes'] <= before['cluster_bytes'] + e['max_after_delta_bytes'], 'retained_growth_exceeds_envelope')
        if p['kind'] != 'gate':
            previous = before['relations'][p['relation']]
            current = after['relations'][p['relation']]
            reclaimed = (previous['bytes'] if previous else 0) - (current['bytes'] if current else 0)
            if p['min_physical_reclaim_bytes'] > 0:
                require(reclaimed >= p['min_physical_reclaim_bytes'], 'physical_reclaim_target_not_met')
        # After commit, use actual retained size plus the validated remaining
        # recovery work, not the older pre-operation baseline.
        require(after['cluster_bytes'] + e['recovery_extra_bytes'] + p['reserve_bytes'] <= self.plan['ceiling_bytes'], 'recovery_capacity_gate')

    def reconcile(self, p, item):
        """Only read live state. Never infer commit from filenode alone."""
        e = evidence(self.plan, p, self.root)
        now = self.db.snapshot()
        try:
            self.post(p, e, item['before'], now)
        except Stop:
            self.common()
            if p['kind'] == 'vacuum_reuse':
                return 'ambiguous', now
            if (p['kind'] != 'vacuum_reuse' and completed_shape(p, item['before'], now, self.root)
                    and self.db.guard(artifact(self.root, p['post']).decode().strip())):
                return 'committed_needs_recovery', now
            unchanged = now['relations'] == item['before']['relations']
            pre = self.db.guard(artifact(self.root, p['pre']).decode().strip())
            return ('not_applied' if unchanged and pre else 'ambiguous'), now
        if p['kind'] == 'vacuum_reuse':
            # Success is unobservable; data/recovery is safe, but never claim the
            # VACUUM ran, auto-repeat it, or count it as a completed forward step.
            return 'reuse_unconfirmed', now
        return 'committed_verified', now

    def run(self, route_name, max_phases=1, retry_not_applied=False, reconcile_only=False):
        self.db.acquire()  # Same session remains alive throughout all phases.
        self.db.configure(30000)
        self.common()
        data = self.journal.data
        require(not data['recovery_started'] or route_name == 'recover', 'forward_after_recovery_forbidden')
        route = self.plan['routes'][route_name]
        if data['runs'] and data['runs'][-1]['route'] == route_name:
            run = data['runs'][-1]
        else:
            require(not reconcile_only, 'no_pending_route')
            require(bool(data['runs']) or route_name == 'prepare', 'first_route_must_prepare')
            if data['runs']:
                previous = data['runs'][-1]
                require(route_name == 'recover' or (previous['route'] == 'prepare' and route_name == 'finish'), 'invalid_route_transition')
                require(previous.get('complete') or route_name == 'recover', 'forward_route_incomplete')
                pending = previous['items'][-1] if previous['items'] else None
                require(not pending or pending['status'] in ('done','committed_blocked','not_applied_verified','reuse_unconfirmed'), 'reconcile_pending_before_recovery')
            self.guard(route['entry'], 'route_epoch_entry_failed')
            run = {'route':route_name, 'items':[], 'complete':False}
            data['runs'].append(run)
            if route_name == 'recover':
                data['recovery_started'] = True
            self.journal.save()
        if run['complete']:
            self.guard(self.phases[route['phases'][-1]]['post'], 'completed_route_drift')
            return {'route':route_name, 'status':'already_complete'}
        items = run['items']
        require([item['id'] for item in items] == route['phases'][:len(items)] and len(items) <= len(route['phases']), 'invalid_journal_phase_order')
        require(all(item['status'] == 'done' for item in items[:-1]), 'invalid_journal_frontier')
        if items and items[-1]['status'] != 'done':
            item = items[-1]; phase = self.phases[item['id']]
            status, snap = self.reconcile(phase, item)
            item['reconciliation'] = status
            if status == 'committed_verified':
                item.update(status='done', after=snap)
            elif status == 'committed_needs_recovery':
                item.update(status='committed_blocked', after=snap)
            elif status == 'not_applied':
                item.update(status='not_applied_verified', after=snap)
            elif status == 'reuse_unconfirmed':
                item.update(status='reuse_unconfirmed', after=snap)
            self.journal.save()
            if reconcile_only:
                return {'phase':item['id'], 'status':status}
            require(status != 'ambiguous', 'ambiguous_phase_requires_review')
            require(status != 'committed_needs_recovery', 'committed_phase_requires_recovery_route')
            require(status != 'reuse_unconfirmed', 'reuse_unconfirmed_recovery_route_only')
            if status == 'not_applied':
                require(retry_not_applied, 'explicit_retry_required_after_reconciliation')
                item['status'] = 'retry_approved'
        elif reconcile_only:
            return {'route':route_name, 'status':'nothing_to_reconcile'}
        count = 0
        while count < max_phases:
            completed = sum(i['status'] == 'done' for i in items)
            if completed == len(route['phases']):
                run['complete'] = True; self.journal.save()
                return {'route':route_name, 'status':'complete'}
            p = self.phases[route['phases'][completed]]
            self.common()
            for backup in self.plan['backup_artifacts']:
                artifact(self.root, backup)
            self.guard(p['pre'], 'phase_precondition_failed')
            self.guard(p['recovery_before'], 'recovery_before_gate_failed')
            e = evidence(self.plan, p, self.root)
            before = self.db.snapshot()
            shape_before(p, before, self.root)
            capacity(self.plan, p, e, before)
            self.db.configure(p['statement_timeout_ms'])
            item = {'id':p['id'], 'status':'intent', 'before':before, 'evidence_sha256':p['evidence']['sha256']}
            if items and items[-1]['status'] == 'retry_approved':
                item['previous_attempt'] = items.pop()
            items.append(item); self.journal.save()  # Durable before any mutation.
            try:
                self.db.execute(action_sql(p, self.root))
                after = self.db.snapshot()
                item['observed_after'] = after
                self.post(p, e, before, after)
            except BaseException as exc:
                # Connection loss/cancel/COMMIT ambiguity never authorizes resending.
                item['status'] = 'unknown'
                item['error_type'] = type(exc).__name__
                if isinstance(exc, Stop):
                    item['error_code'] = str(exc)
                self.journal.save()
                raise Stop('phase_stopped_reconcile_before_retry') from None
            reclaimed = 0
            if p['kind'] in RECLAIM_KINDS:
                old, new = before['relations'][p['relation']], after['relations'][p['relation']]
                reclaimed = max(0, (old['bytes'] if old else 0) - (new['bytes'] if new else 0))
            item.update(status='done', after=after, measured_relation_reclaimed_bytes=reclaimed,
                        capacity_credit='measured_cluster_only', reuse_only=p['kind']=='vacuum_reuse')
            self.journal.save()
            count += 1
        if len(items) == len(route['phases']) and all(i['status'] == 'done' for i in items):
            run['complete'] = True; self.journal.save()
        return {'route':route_name, 'status':'complete' if run['complete'] else 'checkpoint', 'phases_run':count}


def connect(plan, dsn):
    import psycopg
    from psycopg.conninfo import conninfo_to_dict
    params = conninfo_to_dict(dsn)
    require(all(params.get(k) == str(v) for k,v in plan['target']['connection'].items()), 'connection_target_mismatch')
    require({'host','port','dbname','user'} <= set(plan['target']['connection']), 'incomplete_endpoint')
    require('service' not in params and 'hostaddr' not in params and ',' not in params['host'], 'indirect_endpoint_not_allowed')
    if plan['target']['kind'] == 'production':
        ref = plan['target']['project_ref']
        require((params['host'] == 'db.'+ref+'.supabase.co' or (params['host'].endswith('.pooler.supabase.com') and params['user'] == 'postgres.'+ref)) and params['port'] == '5432', 'not_verified_session_endpoint')
        require(params.get('sslmode') == 'verify-full', 'verified_tls_required')
    else:
        require(params['host'].startswith('/tmp/pow-'), 'isolated_socket_required')
    params.update(connect_timeout='15', application_name='pow-grassroots-maintenance', options='',
                  target_session_attrs='read-write', keepalives='1', keepalives_idle='15',
                  keepalives_interval='5', keepalives_count='3', tcp_user_timeout='30000')
    conn = psycopg.connect(**params, autocommit=True)
    if plan['target']['kind'] == 'production':
        require(conn.pgconn.ssl_in_use, 'tls_not_active')
    return conn


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--state', type=Path)
    parser.add_argument('--route', choices=['prepare','finish','recover'])
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--reconcile-only', action='store_true')
    parser.add_argument('--retry-not-applied', action='store_true')
    parser.add_argument('--permit-production')
    parser.add_argument('--max-phases', type=int, default=1)
    parser.add_argument('--print-bindings', action='store_true', help='只輸出峰值證據所需binding；不連DB、不核准計畫')
    args = parser.parse_args()
    if args.print_bindings:
        require(not args.apply and not args.reconcile_only, 'bindings_are_offline_only')
        raw = args.plan.read_bytes()
        require(sha(raw) == args.plan_sha256, 'plan_hash_mismatch')
        draft = json.loads(raw)
        print(json.dumps({'status':'bindings_only_not_validation', 'database_connections':0,
                          'bindings':{p['id']:binding(draft,p,args.plan.parent) for p in draft['phases']}}))
        return
    p = load_plan(args.plan, args.plan_sha256)
    require(1 <= args.max_phases <= 1000, 'invalid_phase_limit')
    if not args.apply and not args.reconcile_only:
        print(json.dumps({'status':'plan_validated_offline','phases':len(p['phases']),'database_connections':0}))
        return
    require(args.state is not None and args.route in p['routes'], 'state_and_route_required')
    if p['target']['kind'] == 'production':
        require(args.permit_production == p['target']['project_ref'], 'explicit_production_scope_required')
    dsn = os.environ.get('POW_GRASSROOTS_DSN')
    require(bool(dsn), 'missing_private_connection')
    journal = Journal(args.state, args.plan_sha256)
    try:
        with connect(p, dsn) as conn:
            result = Executor(p, args.plan.parent, Database(conn,p), journal).run(
                args.route, args.max_phases, args.retry_not_applied, args.reconcile_only)
            print(json.dumps(result))
    finally:
        journal.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'status':'stopped','code':str(exc) if isinstance(exc,Stop) else type(exc).__name__}), file=sys.stderr)
        sys.exit(1)
