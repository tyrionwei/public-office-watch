#!/usr/bin/env python3
"""Apply archived grassroots compaction to the full LOCAL DB in one transaction."""
import argparse, hashlib, json, os, pathlib, re, subprocess


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup-dir', type=pathlib.Path, required=True)
    parser.add_argument('--apply', action='store_true', help='Write full local DB; otherwise only verify backup files')
    args = parser.parse_args()
    os.umask(0o077)
    backup = args.backup_dir.resolve()
    verified = json.loads((backup / 'verified-files.json').read_text())
    if verified.get('restore_status') != 'passed':
        raise RuntimeError('A successful full restore is required')
    for filename, expected in verified['sha256'].items():
        if pathlib.Path(filename).name != filename or digest(backup / filename) != expected:
            raise RuntimeError('Backup verification failed: ' + filename)
    fingerprints = [json.loads(line) for name in ('restored-fingerprints.jsonl', 'restored-indirect-fingerprints.jsonl', 'restored-unchanged-fingerprints.jsonl') for line in (backup / name).read_text().splitlines()]
    required = {'public.person_identity_research_holds', 'public.platform_voting_inaugurations', 'public.platform_fulfillment_votes', 'public.people', 'public.person_claims', 'public.current_office_exclusions', 'public.candidate_lifecycle_events', 'public.person_media', 'public.races', 'public.person_party_events', 'public.person_merge_decisions', 'public.source_people', 'public.current_office_assignments', 'public.person_office_status_cache', 'public.person_feedback_submissions', 'public.reviewed_office_profiles', 'public.person_identity_matches', 'public.person_party_affiliations', 'public.person_feedback_history', 'public.legal_record_leads', 'public.candidate_status_history', 'public.person_company_relations', 'public.candidates'}
    if len(fingerprints) != len(required) or {row['table'] for row in fingerprints} != required:
        raise RuntimeError('Incomplete or duplicate restored baseline: expected all 23 tables')
    for row in fingerprints:
        if not re.fullmatch(r'public\.[a-z_]+', row['table']) or not re.fullmatch(r'[0-9a-f]{32}', row['hash'] or ''):
            raise RuntimeError('Invalid baseline entry')
    print('Backup file hashes verified; source table fingerprints will be checked under write locks.', flush=True)
    if not args.apply:
        return
    container = 'supabase_db_public-office-watch'
    details = subprocess.check_output(['docker', 'inspect', '--format', '{{json .Config.Labels}}\n{{json .NetworkSettings.Ports}}', container]).decode().splitlines()
    labels, mappings = map(json.loads, details)
    if labels.get('com.supabase.cli.project') != 'public-office-watch':
        raise RuntimeError('Wrong local project')
    ports = mappings.get('5432/tcp') or []
    if not any(port['HostPort'] == '54322' for port in ports):
        raise RuntimeError('Expected full local DB port 54322')
    root = pathlib.Path(__file__).resolve().parents[1]
    migration = root / 'supabase/migrations/20260926093536_grassroots_candidate_names.sql'
    schema = migration.read_text()
    compact = (root / 'scripts/compact-grassroots-name-only.sql').read_text()
    sql = "BEGIN;\nSET LOCAL lock_timeout='10s';\nSET LOCAL statement_timeout='15min';\n"
    sql += 'LOCK TABLE ' + ', '.join(row['table'] for row in fingerprints) + ' IN SHARE ROW EXCLUSIVE MODE;\n'
    sql += 'DO $backup_guard$ DECLARE actual_count bigint; actual_hash text; BEGIN\n'
    for row in fingerprints:
        sql += "SELECT count(*),md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) INTO actual_count,actual_hash FROM " + row['table'] + ' t;\n'
        sql += "IF actual_count <> " + str(int(row['count'])) + " OR actual_hash IS DISTINCT FROM '" + row['hash'] + "' THEN RAISE EXCEPTION 'Source differs from verified backup: " + row['table'] + "'; END IF;\n"
    sql += 'END; $backup_guard$;\n' + schema + '\n' + compact
    if '$grassroots_schema$' in schema:
        raise RuntimeError('Unexpected SQL delimiter')
    sql += "\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20260926093536','grassroots_candidate_names',ARRAY[$grassroots_schema$" + schema + "$grassroots_schema$]);\nCOMMIT;\n"
    (backup / 'local-apply.sql').write_text(sql)
    log = backup / 'local-apply.log'
    if log.exists():
        raise RuntimeError('Existing apply log: inspect before attempting another write')
    with log.open('wb') as stream:
        result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=sql.encode(), stdout=stream, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError('Local transaction failed; inspect private local-apply.log. No automatic retry.')
    print('Local compaction committed with all invariants and migration ledger.', flush=True)


if __name__ == '__main__':
    main()
