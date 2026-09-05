import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifySourceFailure, withSourceRetry } from './monitor-source-retry.mjs';

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-source-retry-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { key: 'ly', url: 'https://example.gov/data', statePath: path.join(directory, 'health.json'),
    now: () => Date.parse('2026-09-04T00:00:00Z'), sleep: async () => {} };
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
  const saved = JSON.parse(fs.readFileSync(options.statePath)).sources.ly;
  assert.equal(saved.category, 'tls_configuration');
  assert.equal(saved.nextCheckAt, '2026-09-11T00:00:00.000Z');
  await withSourceRetry({ ...options, now: () => Date.parse(saved.nextCheckAt), operation: async () => 'recovered' });
  assert.equal(JSON.parse(fs.readFileSync(options.statePath)).sources.ly.status, 'ok');
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
  assert.equal(JSON.parse(fs.readFileSync(options.statePath)).sources.ly.nextCheckAt, '2026-09-04T01:00:00.000Z');
});

test('corrupt health state fails closed before contacting a source', async (t) => {
  const options = setup(t);
  fs.writeFileSync(options.statePath, '{');
  let called = false;
  await assert.rejects(withSourceRetry({ ...options, operation: async () => { called = true; } }));
  assert.equal(called, false);
});

test('exhausted transient retry records a short source cooldown, not a person rejection', async (t) => {
  const options = setup(t);
  let calls = 0;
  await assert.rejects(withSourceRetry({ ...options, operation: async () => { calls++; throw new Error('503'); } }));
  assert.equal(calls, 2);
  const entry = JSON.parse(fs.readFileSync(options.statePath)).sources.ly;
  assert.equal(entry.status, 'blocked');
  assert.equal(entry.nextCheckAt, '2026-09-04T00:30:00.000Z');
});
