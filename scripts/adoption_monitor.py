"""Read-only observation / exact own-backend cancellation SQL. No network calls."""
import json
import re

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def validate_label(label):
    if not re.fullmatch(r'pow62-[a-z0-9-]{1,50}', label):
        raise ValueError('invalid run label')
    return label

def activity_sql(label):
    tag = literal(validate_label(label))
    return f"""SELECT coalesce(jsonb_agg(jsonb_build_object(
      'pid',a.pid,'backend_start',a.backend_start,'xact_start',a.xact_start,
      'application_name',a.application_name,'datname',a.datname,'usename',a.usename,
      'state',a.state,'wait_event_type',a.wait_event_type,'wait_event',a.wait_event,
      'blockers',(SELECT coalesce(jsonb_agg(jsonb_build_object('pid',w.pid,
        'backend_start',w.backend_start,'query_start',w.query_start)), '[]'::jsonb)
        FROM pg_stat_activity w WHERE w.pid<>a.pid AND w.backend_type='client backend'
          AND w.wait_event_type='Lock' AND a.pid=ANY(pg_blocking_pids(w.pid))))), '[]'::jsonb)
      AS result FROM pg_stat_activity a WHERE a.pid<>pg_backend_pid()
        AND a.datname=current_database() AND a.application_name={tag}
        AND a.backend_type='client backend';"""

def cancel_sql(actor):
    validate_label(actor['application_name'])
    if not actor.get('xact_start') or not actor.get('backend_start'):
        raise ValueError('missing exact transaction identity')
    pid = int(actor['pid'])
    if pid <= 0:
        raise ValueError('invalid pid')
    return f"""SELECT coalesce(jsonb_agg(jsonb_build_object('pid',pid,
      'signal_sent',pg_cancel_backend(pid))), '[]'::jsonb) AS result
      FROM pg_stat_activity WHERE pid={pid} AND pid<>pg_backend_pid()
      AND backend_start={literal(actor['backend_start'])}::timestamptz
      AND xact_start={literal(actor['xact_start'])}::timestamptz
      AND application_name={literal(actor['application_name'])}
      AND datname={literal(actor['datname'])} AND datname=current_database()
      AND usename={literal(actor['usename'])} AND backend_type='client backend'
      AND state='active';"""

class BlockingWindow:
    """Only continuous observed blocking of the same client query counts."""
    def __init__(self, seconds=10):
        self.seconds = seconds
        self.first = {}

    def observe(self, actor, now):
        current = {(w['pid'], w['backend_start'], w['query_start'])
                   for w in actor.get('blockers', [])}
        self.first = {k:self.first.get(k, now) for k in current}
        return any(now-start >= self.seconds for start in self.first.values())

def classify(marker_applied, actor_present, exact_before=False, exact_after=False):
    if marker_applied and exact_after:
        return 'committed'
    if not marker_applied and not actor_present and exact_before:
        return 'rolled-back'
    return 'running' if actor_present else 'uncertain'
