import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  compactStepResult,
  parseArgs,
  parseJsonOutput,
  runNodeStep,
  summarizeWeeklyResults,
} from './run-weekly-monitor.mjs';

test('uses a local ignored weekly output directory by default', () => {
  assert.match(parseArgs([]).outputDir, /tmp[\\/]weekly-monitor$/);
});

test('parses structured step output without guessing mixed logs', () => {
  assert.deepEqual(parseJsonOutput('{"status":"ok","count":2}'), { status: 'ok', count: 2 });
  assert.equal(parseJsonOutput('progress\n{"status":"ok"}'), null);
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
