import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { localReviewSqlPath, parseArgs, runInstaller, verifyLocalContainer } from './install-local-review-rpc.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = 'a'.repeat(64);
function container() {
  return { Id: id, Name: '/supabase_db_public-office-watch', State: { Running: true },
    Config: { Image: 'public.ecr.aws/supabase/postgres:17.6.1.147', Labels: {
      'com.supabase.cli.project': 'public-office-watch', 'com.supabase.cli.workdir': root,
    } }, NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '54322' }] } } };
}
const absent = { database: 'postgres', claimTable: true, affiliationTable: true, roles: true, installed: false, restrictedInvoker: false };

test('installer defaults to offline plan and accepts no target or linked-project override', () => {
  assert.equal(parseArgs([]), 'plan');
  assert.equal(parseArgs(['--apply-local']), 'apply-local');
  for (const args of [['--write'], ['--linked'], ['--db-url', 'postgres://remote/db'], ['--apply-local', '--check']]) assert.throws(() => parseArgs(args));
  const result = runInstaller('plan', { docker: () => { throw new Error('must not contact Docker'); } });
  assert.equal(result.applied, false); assert.equal(result.targetVerified, false);
  assert.equal(result.sha256, '082ca386041270daeca72e688921064b8cb59dfb0f24a140afed4e330eb57b9d');
  assert.ok(!fs.existsSync(path.join(root, 'supabase/migrations', path.basename(localReviewSqlPath))));
});

test('installer rejects mismatched project, workdir, stopped container and missing runtime ports', () => {
  assert.equal(verifyLocalContainer(container()), id);
  for (const alter of [c => { c.Id = 'bad'; }, c => { c.Name += '-rehearsal'; }, c => { c.State.Running = false; },
    c => { c.Config.Labels['com.supabase.cli.project'] = 'different'; }, c => { c.Config.Labels['com.supabase.cli.workdir'] = '/other'; },
    c => { c.NetworkSettings.Ports['5432/tcp'] = null; }, c => { c.NetworkSettings.Ports['5432/tcp'][0].HostPort = '55322'; }]) {
    const c = container(); alter(c); assert.throws(() => verifyLocalContainer(c), /full-local/u);
  }
});

test('check reads only; explicit apply sends the byte-identical SQL to verified container ID and then verifies grants', () => {
  const sql = fs.readFileSync(path.join(root, localReviewSqlPath), 'utf8');
  const calls = [];
  let installed = false;
  const docker = (args, options) => {
    calls.push({ args, input: options?.input });
    if (args[0] === 'inspect') return JSON.stringify([container()]);
    assert.equal(args[2], id); assert.equal(args[3], 'env');
    for (const flag of ['/var/run/postgresql', '--no-password', 'PGPASSFILE=/dev/null', '5432']) assert.ok(args.includes(flag));
    for (const name of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGPASSWORD']) assert.equal(args[args.indexOf(name) - 1], '-u');
    if (options.input === sql) { installed = true; return ''; }
    return JSON.stringify({ ...absent, installed, restrictedInvoker: installed });
  };
  assert.equal(runInstaller('check', { docker }).installed, false);
  assert.equal(calls.filter(c => c.input === sql).length, 0);
  assert.equal(runInstaller('apply-local', { docker }).applied, true);
  assert.equal(calls.filter(c => c.input === sql).length, 1);
  assert.equal(createHash('sha256').update(sql).digest('hex'), '082ca386041270daeca72e688921064b8cb59dfb0f24a140afed4e330eb57b9d');
  assert.ok(!sql.includes('supabase_migrations'));
});

test('prerequisite failure and container identity change prevent any install; verification failure cannot report success', () => {
  for (const scenario of ['missing-table', 'identity-change', 'bad-grants']) {
    let inspections = 0, writes = 0;
    const docker = (args, options) => {
      if (args[0] === 'inspect') {
        const c = container(); if (++inspections === 2 && scenario === 'identity-change') c.Id = 'b'.repeat(64);
        return JSON.stringify([c]);
      }
      if (options.input.startsWith('BEGIN;')) { writes++; return ''; }
      return JSON.stringify({ ...absent, claimTable: scenario !== 'missing-table', installed: writes > 0 });
    };
    assert.throws(() => runInstaller('apply-local', { docker }), /prerequisites|identity|permission/u);
    assert.equal(writes, scenario === 'bad-grants' ? 1 : 0);
  }
});

test('real review CLI rejects remote environment and remote .env.local before any fetch, in both modes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-local-review-cli-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts/lib'), { recursive: true });
    for (const name of ['auto-review-person-claims.mjs', 'lib/local-review-target.mjs']) fs.copyFileSync(path.join(root, 'scripts', name), path.join(tmp, 'scripts', name));
    const preload = path.join(tmp, 'offline.mjs');
    fs.writeFileSync(preload, "globalThis.fetch = () => { throw new Error('UNEXPECTED_FETCH'); };\n");
    for (const fromFile of [false, true]) for (const args of [[], ['--write']]) {
      fs.writeFileSync(path.join(tmp, '.env.local'), fromFile ? 'SUPABASE_URL=https://remote.example\nSUPABASE_SERVICE_ROLE_KEY=synthetic-key\n' : '');
      const result = spawnSync(process.execPath, ['--import', preload, path.join(tmp, 'scripts/auto-review-person-claims.mjs'), ...args], {
        encoding: 'utf8', env: { ...process.env, SUPABASE_URL: fromFile ? '' : 'https://remote.example', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key' },
      });
      assert.equal(result.status, 1); assert.match(result.stderr, /requires a loopback/u); assert.doesNotMatch(result.stderr, /UNEXPECTED_FETCH|synthetic-key/u);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('installer CLI pins Docker socket despite inherited remote context and host variables', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-local-installer-cli-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts')); fs.mkdirSync(path.join(tmp, 'bin'));
    fs.mkdirSync(path.join(tmp, 'supabase/local-migrations'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts/install-local-review-rpc.mjs'), path.join(tmp, 'scripts/install-local-review-rpc.mjs'));
    fs.copyFileSync(path.join(root, localReviewSqlPath), path.join(tmp, localReviewSqlPath));
    const c = container(); c.Config.Labels['com.supabase.cli.workdir'] = tmp;
    const fakeDocker = path.join(tmp, 'bin/docker');
    const log = path.join(tmp, 'calls.jsonl');
    fs.writeFileSync(fakeDocker, `#!${process.execPath}\nimport fs from 'node:fs';
const args=process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args,host:process.env.DOCKER_HOST??null,context:process.env.DOCKER_CONTEXT??null})+'\\n');
if(args[2]==='inspect')console.log(${JSON.stringify(JSON.stringify([c]))});
else {fs.readFileSync(0,'utf8');console.log(${JSON.stringify(JSON.stringify(absent))});}\n`);
    fs.chmodSync(fakeDocker, 0o700);
    const result = spawnSync(process.execPath, [path.join(tmp, 'scripts/install-local-review-rpc.mjs'), '--check'], {
      encoding: 'utf8', env: { ...process.env, PATH: path.join(tmp, 'bin') + path.delimiter + process.env.PATH,
        DOCKER_HOST: 'ssh://remote.example', DOCKER_CONTEXT: 'production' },
    });
    assert.equal(result.status, 0, result.stderr);
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.deepEqual(call.args.slice(0, 2), ['--host', 'unix:///var/run/docker.sock']);
      assert.equal(call.host, null); assert.equal(call.context, null);
    }
    assert.equal(JSON.parse(result.stdout).applied, false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
