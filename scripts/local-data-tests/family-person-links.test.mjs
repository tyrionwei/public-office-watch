import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('已核准親屬雙向連結、匿名白名單及回滾', {
  skip: process.env.POW_LOCAL_DB_TESTS !== '1',
}, () => {
  const container = 'supabase_db_public-office-watch';
  const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', container], { encoding: 'utf8' }));
  assert(ports['5432/tcp'].some((port) => port.HostPort === '54322'));
  const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const state = `SELECT jsonb_build_object(
    'people', (SELECT count(*) FROM public.people),
    'claims', (SELECT count(*) FROM public.person_claims),
    'public_people', (SELECT count(*) FROM public.people WHERE is_public),
    'functions', (SELECT jsonb_agg(jsonb_build_array(p.oid,p.proacl) ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','published')),
    'tables', (SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','published')))`;
  const sql = `${state} AS before_state \\gset
BEGIN;
${read('../../supabase/migrations/20261017100815_add_reviewed_family_person_links.sql')}
${read('../sql/family-person-links-regression.sql')}
ROLLBACK;
SELECT 1 / CASE WHEN (${state}) = :'before_state'::jsonb THEN 1 ELSE 0 END AS rollback_verified;`;
  const output = execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
  assert.match(output, /rollback_verified/);
});
