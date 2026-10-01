const cp = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const name = 'pow-historical-presidents-test-' + process.pid;
const image = 'public.ecr.aws/supabase/postgres:17.6.1.147';
assert.notEqual(cp.spawnSync('docker', ['inspect', name], { stdio: 'ignore' }).status, 0, 'refusing existing container');
const id = cp.execFileSync('docker', ['run', '-d', '--network', 'none', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image], { encoding: 'utf8' }).trim();
try {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    if (cp.spawnSync('docker', ['exec', id, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  assert(ready, 'isolated database did not start');
  cp.execFileSync('docker', ['exec', id, 'createdb', '-U', 'postgres', '-T', 'template0', 'pow_historical_presidents_test']);
  cp.execFileSync('docker', ['exec', id, 'mkdir', '-p', '/tmp/pow/tests/sql', '/tmp/pow/supabase/migrations']);
  for (const file of ['tests/sql/historical-elected-presidents.sql', 'supabase/migrations/20261001071919_classify_historical_elected_presidents.sql']) {
    cp.execFileSync('docker', ['cp', path.join(root, file), id + ':/tmp/pow/' + file]);
  }
  cp.execFileSync('docker', ['exec', id, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'pow_historical_presidents_test', '-f', '/tmp/pow/tests/sql/historical-elected-presidents.sql'], { stdio: 'inherit' });
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261001071919_classify_historical_elected_presidents.sql'), 'utf8');
  const guard = migration.match(/DO \$historical_role\$[\s\S]*?END \$historical_role\$;/)[0];
  for (const [label, mutation, expected] of [
    ['identity drift', "UPDATE public.public_candidates SET person_id='00000000-0000-4000-8000-000000000001' WHERE election_year=2016", /identity\/result baseline changed/],
    ['result drift', "UPDATE public.public_candidates SET election_result='pending' WHERE election_year=2020", /identity\/result baseline changed/],
    ['year drift', "UPDATE public.public_candidates SET election_year=2024 WHERE election_year=2020", /identity\/result baseline changed/],
    ['publication removal', "DELETE FROM public.public_candidates WHERE candidate_id='1c9caa82-01a1-49be-9a9a-22f3764c6979'", /identity\/result baseline changed/],
    ['view drift', "CREATE OR REPLACE VIEW public.public_people_list AS SELECT person_id,'other'::text list_role,'former'::text list_status FROM public.fixture_people", /view changed since application/],
  ]) {
    const result = cp.spawnSync('docker', ['exec', '-i', id, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'pow_historical_presidents_test'], {
      input: 'BEGIN; ' + mutation + ';' + guard + 'ROLLBACK;', encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, label + ' must be rejected');
    assert.match(result.stderr, expected, label);
    console.log('PASS rejected ' + label + ' (rolled back)');
  }
} finally {
  cp.execFileSync('docker', ['rm', '-f', id], { stdio: 'ignore' });
}
