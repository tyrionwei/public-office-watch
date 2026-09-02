import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactStepResult,
  parseArgs,
  parseJsonOutput,
  summarizeWeeklyResults,
} from './run-weekly-monitor.mjs';

test('uses a local ignored weekly output directory by default', () => {
  assert.match(parseArgs([]).outputDir, /tmp[\\/]weekly-monitor$/);
});

test('parses structured step output without guessing mixed logs', () => {
  assert.deepEqual(parseJsonOutput('{"status":"ok","count":2}'), { status: 'ok', count: 2 });
  assert.equal(parseJsonOutput('progress\n{"status":"ok"}'), null);
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
    passedCount: 2,
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
