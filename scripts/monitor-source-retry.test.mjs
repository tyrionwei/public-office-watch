import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifySourceFailure,
  sourceHealthStatePath,
  withSourceRetry,
} from './monitor-source-retry.mjs';

function setup(t, key = 'ly') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-source-retry-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { key, url: 'https://example.gov/data', stateDirectory: path.join(directory, 'health'),
    now: () => Date.parse('2026-09-04T00:00:00Z'), sleep: async () => {} };
}

function readSaved(options, key = options.key) {
  return JSON.parse(fs.readFileSync(sourceHealthStatePath(options.stateDirectory, key), 'utf8')).source;
}

test('distinguishes URL changes, TLS, local tool and transient errors', () => {
  assert.equal(classifySourceFailure(new Error('404 Not Found')), 'url_unavailable');
  assert.equal(classifySourceFailure(new Error('fetch failed', { cause: { code: 'ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED' } })), 'tls_configuration');
  assert.equal(classifySourceFailure(new Error('helper_unknown_error')), 'local_tool');
  assert.equal(classifySourceFailure(new Error('maxlag')), 'transient');
  assert.equal(classifySourceFailure(new Error('403 CAPTCHA')), 'access_blocked');
});

test('persistent TLS error is attempted once and skipped for seven days without losing failure', async (t) => {
  const options = setup(t);
  let calls = 0;
  const operation = async () => { calls++; throw Object.assign(new Error('TLS incompatible'), { code: 'ERR_SSL_PROTOCOL_ERROR' }); };
  await assert.rejects(withSourceRetry({ ...options, operation }));
  await assert.rejects(withSourceRetry({ ...options, operation }), /deferred/);
  assert.equal(calls, 1);
  const saved = readSaved(options);
  assert.equal(saved.category, 'tls_configuration');
  assert.equal(saved.nextCheckAt, '2026-09-11T00:00:00.000Z');
  await withSourceRetry({ ...options, now: () => Date.parse(saved.nextCheckAt), operation: async () => 'recovered' });
  assert.equal(readSaved(options).status, 'ok');
});

test('transient failure retries once, respecting Retry-After', async (t) => {
  const options = setup(t);
  let calls = 0;
  let delay;
  const value = await withSourceRetry({ ...options, sleep: async (ms) => { delay = ms; },
    operation: async () => { if (++calls === 1) throw Object.assign(new Error('429'), { retryAfterMs: 12000 }); return 'ok'; } });
  assert.equal(value, 'ok');
  assert.equal(calls, 2);
  assert.equal(delay, 12000);
});

test('long Retry-After defers instead of blocking worker or hammering source', async (t) => {
  const options = setup(t);
  let calls = 0;
  await assert.rejects(withSourceRetry({ ...options, operation: async () => {
    calls++; throw Object.assign(new Error('429'), { retryAfterMs: 3600000 });
  } }));
  assert.equal(calls, 1);
  assert.equal(readSaved(options).nextCheckAt, '2026-09-04T01:00:00.000Z');
});

test('corrupt source health state fails closed before contacting that source', async (t) => {
  const options = setup(t);
  fs.mkdirSync(options.stateDirectory, { recursive: true });
  fs.writeFileSync(sourceHealthStatePath(options.stateDirectory, options.key), '{');
  let called = false;
  await assert.rejects(withSourceRetry({ ...options, operation: async () => { called = true; } }));
  assert.equal(called, false);
});

test('exhausted transient retry records a short source cooldown, not a person rejection', async (t) => {
  const options = setup(t);
  let calls = 0;
  await assert.rejects(withSourceRetry({ ...options, operation: async () => { calls++; throw new Error('503'); } }));
  assert.equal(calls, 2);
  const entry = readSaved(options);
  assert.equal(entry.status, 'blocked');
  assert.equal(entry.nextCheckAt, '2026-09-04T00:30:00.000Z');
});

test('concurrent sources update independent health files without losing state', async (t) => {
  const options = setup(t);
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const first = withSourceRetry({
    ...options,
    key: 'ly-current-legislators',
    operation: async () => { await firstGate; return 'ly-ok'; },
  });
  const second = withSourceRetry({
    ...options,
    key: 'cec-candidates',
    operation: async () => 'cec-ok',
  });
  assert.equal(await second, 'cec-ok');
  releaseFirst();
  assert.equal(await first, 'ly-ok');
  assert.equal(readSaved(options, 'ly-current-legislators').status, 'ok');
  assert.equal(readSaved(options, 'cec-candidates').status, 'ok');
  assert.equal(fs.readdirSync(options.stateDirectory).length, 2);
});

test('source keys cannot escape the health-state directory', () => {
  assert.throws(() => sourceHealthStatePath('/tmp/health', '../other'), /Unsafe monitor source key/);
});

test('uses a valid legacy shared state until the source gets its own file', async (t) => {
  const options = setup(t);
  const legacyStatePath = path.join(path.dirname(options.stateDirectory), 'monitor-source-health.json');
  fs.writeFileSync(legacyStatePath, JSON.stringify({
    schemaVersion: 1,
    sources: {
      [options.key]: {
        key: options.key,
        url: options.url,
        status: 'blocked',
        nextCheckAt: '2026-09-05T00:00:00.000Z',
        error: 'legacy cooldown',
      },
    },
  }));
  let called = false;
  await assert.rejects(withSourceRetry({
    ...options,
    legacyStatePath,
    operation: async () => { called = true; },
  }), /deferred/);
  assert.equal(called, false);
  assert.equal(fs.existsSync(sourceHealthStatePath(options.stateDirectory, options.key)), false);
});
