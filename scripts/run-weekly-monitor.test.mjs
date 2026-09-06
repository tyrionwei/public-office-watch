import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  acquireRunLock,
  compactStepResult,
  parseArgs,
  parseJsonOutput,
  releaseRunLock,
  runNodeStep,
  summarizeWeeklyResults,
} from './run-weekly-monitor.mjs';

test('uses a local ignored weekly output directory by default', () => {
  assert.match(parseArgs([]).outputDir, /tmp[\\/]weekly-monitor$/);
});

test('parses the final structured step output after progress logs', () => {
  assert.deepEqual(parseJsonOutput('{"status":"ok","count":2}'), { status: 'ok', count: 2 });
  assert.deepEqual(parseJsonOutput('progress\n{"status":"degraded","needsAttention":true}'), {
    status: 'degraded',
    needsAttention: true,
  });
});

test('returns null for truncated JSON that starts at index zero', () => {
  assert.equal(parseJsonOutput('{broken'), null);
});

test('rejects a concurrent weekly run while the lock owner is alive', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-weekly-lock-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const lockPath = path.join(directory, 'weekly.lock');
  const lock = acquireRunLock(lockPath);
  assert.throws(() => acquireRunLock(lockPath), /already running/);
  assert.equal(releaseRunLock(lockPath, lock.token), true);
});

test('replaces a stale weekly lock and only releases the matching token', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-weekly-stale-lock-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const lockPath = path.join(directory, 'weekly.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999999, token: 'stale' }));
  const lock = acquireRunLock(lockPath);
  assert.equal(releaseRunLock(lockPath, 'other'), false);
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(releaseRunLock(lockPath, lock.token), true);
});

test('does not delete a freshly created incomplete weekly lock', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-weekly-incomplete-lock-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const lockPath = path.join(directory, 'weekly.lock');
  fs.writeFileSync(lockPath, '');
  assert.throws(() => acquireRunLock(lockPath), /still being acquired/);
  assert.equal(fs.existsSync(lockPath), true);
});

async function assertSingleStaleLockReclaimer(t, moduleFile, lockName) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-monitor-stale-lock-race-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const lockPath = path.join(directory, lockName);
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999999, token: 'stale' }));
  const childPath = path.join(directory, 'lock-contender.mjs');
  const moduleUrl = pathToFileURL(path.resolve(moduleFile)).href;
  fs.writeFileSync(childPath, `
    import { acquireRunLock, releaseRunLock } from ${JSON.stringify(moduleUrl)};
    const lockPath = process.argv[2];
    let lock;
    process.send({ status: 'ready' });
    process.on('message', (message) => {
      if (message === 'go') {
        try {
          lock = acquireRunLock(lockPath);
          process.send({ status: 'acquired' });
        } catch (error) {
          process.send({ status: 'blocked', error: error.message }, () => process.exit(0));
        }
      } else if (message === 'release' && lock) {
        releaseRunLock(lockPath, lock.token);
        process.exit(0);
      }
    });
  `);

  const children = [
    fork(childPath, [lockPath], { silent: true }),
    fork(childPath, [lockPath], { silent: true }),
  ];
  t.after(() => {
    for (const child of children) {
      if (child.exitCode === null) child.kill();
    }
  });
  const exitPromises = children.map((child) => once(child, 'exit'));
  await Promise.all(children.map((child) => once(child, 'message')));
  const resultPromises = children.map((child) => once(child, 'message'));
  for (const child of children) child.send('go');
  const results = await Promise.all(resultPromises);
  const statuses = results.map(([message]) => message.status);
  assert.deepEqual([...statuses].sort(), ['acquired', 'blocked']);
  children[statuses.indexOf('acquired')].send('release');
  await Promise.all(exitPromises);
}

test('only one isolated process reclaims a stale daily or weekly lock', async (t) => {
  await t.test('daily monitor', (childTest) => assertSingleStaleLockReclaimer(
    childTest,
    'scripts/run-daily-monitor.mjs',
    'daily.lock',
  ));
  await t.test('weekly monitor', (childTest) => assertSingleStaleLockReclaimer(
    childTest,
    'scripts/run-weekly-monitor.mjs',
    'weekly.lock',
  ));
});

test('records the execution window for weekly step provenance', async (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-weekly-step-'));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const before = Date.now();
  const result = await runNodeStep('timestamp-evidence', ['-e', "console.log('{}')"], outputDir);
  const after = Date.now();
  assert.equal(result.status, 'ok');
  assert.ok(Date.parse(result.startedAt) >= before && Date.parse(result.startedAt) <= after);
  assert.ok(Date.parse(result.finishedAt) >= Date.parse(result.startedAt));
  assert.ok(Date.parse(result.finishedAt) <= after);
  assert.ok(fs.existsSync(path.join(outputDir, 'logs', 'timestamp-evidence.log')));
});

test('weekly summary preserves failed step names for review', () => {
  assert.deepEqual(summarizeWeeklyResults([
    { name: 'one', status: 'ok' },
    { name: 'two', status: 'failed' },
  ]), {
    status: 'needs_attention',
    needsAttention: true,
    stepCount: 2,
    passedCount: 1,
    failedCount: 1,
    failedSteps: ['two'],
    degradedCount: 0,
    degradedSteps: [],
  });
});

test('weekly summary reports successful but degraded source steps', () => {
  assert.deepEqual(summarizeWeeklyResults([
    { name: 'real-public-data', status: 'ok', result: { status: 'degraded', needsAttention: true } },
    { name: 'cec', status: 'ok', result: { status: 'ok', needsAttention: false } },
  ]), {
    status: 'degraded',
    needsAttention: true,
    stepCount: 2,
    passedCount: 1,
    failedCount: 0,
    failedSteps: [],
    degradedCount: 1,
    degradedSteps: ['real-public-data'],
  });
});

test('large step output is compacted while the full log remains available', () => {
  const result = compactStepResult({ status: 'ok', summary: { count: 2 }, leadCount: 3, rows: ['x'.repeat(12_000)] });
  assert.deepEqual(result, {
    status: 'ok',
    summary: { count: 2 },
    counts: null,
    metrics: { leadCount: 3 },
    detailStoredInStepLog: true,
  });
});

test('zero-exit child reporting failed is not counted as healthy', () => {
  const summary = summarizeWeeklyResults([{ name: 'source', status: 'ok', result: { status: 'failed' } }]);
  assert.equal(summary.needsAttention, true);
  assert.equal(summary.passedCount, 0);
  assert.equal(summary.degradedCount, 1);
});
