import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  acquireRunLock,
  parseLastJsonOutput,
  releaseRunLock,
  resultNeedsAttention,
  runDailySteps,
  summarizeDailyResults,
} from './run-daily-monitor.mjs';

test('daily monitor lock rejects a concurrent live process', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-daily-monitor-lock-'));
  const lockPath = path.join(directory, 'daily.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: 'existing' }));

  assert.throws(() => acquireRunLock(lockPath), /already running/);
});

test('daily monitor lock replaces a stale process and releases only its own token', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-daily-monitor-lock-'));
  const lockPath = path.join(directory, 'daily.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 2147483647, token: 'stale' }));

  const lock = acquireRunLock(lockPath);
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(releaseRunLock(lockPath, 'different-token'), false);
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(releaseRunLock(lockPath, lock.token), true);
  assert.equal(fs.existsSync(lockPath), false);
});

test('parses the final structured result after npm output', () => {
  const result = parseLastJsonOutput(`> sync:real-data:daily
> node scripts/sync-real-data.mjs
{
  "status": "degraded",
  "needsAttention": true,
  "sources": { "moi": { "status": "ok" } }
}
`);

  assert.equal(result.status, 'degraded');
  assert.equal(result.needsAttention, true);
});

test('marks a zero-exit degraded result as needing scheduler attention', () => {
  assert.equal(resultNeedsAttention({ status: 'degraded' }), true);
  assert.equal(resultNeedsAttention({ status: 'ok', needsAttention: true }), true);
  const summary = summarizeDailyResults([
    { scriptName: 'monitor:cec-election-sources', status: 'ok' },
    { scriptName: 'sync:real-data:daily', status: 'degraded' },
  ], 4);

  assert.equal(summary.status, 'degraded');
  assert.equal(summary.needsAttention, true);
  assert.equal(summary.degradedCount, 1);
  assert.deepEqual(summary.degradedSteps, ['sync:real-data:daily']);
});

test('keeps hard failures distinct from degraded results', () => {
  const summary = summarizeDailyResults([
    { scriptName: 'monitor:cec-election-sources', status: 'failed' },
  ], 4);

  assert.equal(summary.status, 'failed');
  assert.equal(summary.needsAttention, true);
  assert.equal(summary.failedCount, 1);
});

test('a failed independent source does not prevent news or person research', async () => {
  const called = [];
  const results = await runDailySteps(async (scriptName) => {
    called.push(scriptName);
    return { scriptName, status: scriptName === 'sync:real-data:daily' ? 'failed' : 'ok' };
  });
  assert.deepEqual(called, ['monitor:cec-election-sources', 'sync:real-data:daily',
    'discover:daily-person-news', 'run:daily-person-enrichment']);
  assert.equal(summarizeDailyResults(results).passedCount, 3);
  assert.equal(summarizeDailyResults(results).needsAttention, true);
});
