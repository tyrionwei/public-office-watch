import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArgs, recordDailyTargets, selectDailyTargets } from './select-daily-person-enrichment-targets.mjs';

test('uses 25 as the daily default', () => {
  assert.equal(parseArgs(['--input', 'targets.json']).limit, 25);
});

test('respects the configured limit and existing priority order', () => {
  const targets = Array.from({ length: 12 }, (_, index) => ({ personId: `p-${index}`, name: `人物${index}` }));
  const selected = selectDailyTargets(targets, { attempts: {} }, new Date('2026-08-11T00:00:00Z'), 10, 30);
  assert.deepEqual(selected.map((target) => target.personId), targets.slice(0, 10).map((target) => target.personId));
});

test('selects untouched targets before cooldown-eligible retries', () => {
  const targets = [
    { personId: 'retry', name: '可重試' },
    { personId: 'new-1', name: '未處理一' },
    { personId: 'new-2', name: '未處理二' },
  ];
  const state = { attempts: { retry: { attemptedAt: '2026-01-01T00:00:00Z' } } };
  const selected = selectDailyTargets(targets, state, new Date('2026-08-11T00:00:00Z'), 2, 30);
  assert.deepEqual(selected.map((target) => target.personId), ['new-1', 'new-2']);
});

test('skips recently attempted people and allows them after cooldown', () => {
  const targets = [{ personId: 'recent', name: '近期' }, { personId: 'older', name: '較早' }];
  const state = { attempts: {
    recent: { attemptedAt: '2026-08-01T00:00:00Z' },
    older: { attemptedAt: '2026-06-01T00:00:00Z' },
  } };
  const selected = selectDailyTargets(targets, state, new Date('2026-08-11T00:00:00Z'), 10, 30);
  assert.deepEqual(selected.map((target) => target.personId), ['older']);
});

test('records attempts without discarding prior history', () => {
  const state = { attempts: { old: { name: '舊人物', attemptedAt: '2026-01-01T00:00:00Z' } } };
  const next = recordDailyTargets(state, [{ personId: 'new', name: '新人物', missingSignals: ['family_relation'] }], new Date('2026-08-11T00:00:00Z'));
  assert.equal(next.attempts.old.name, '舊人物');
  assert.deepEqual(next.attempts.new.missingSignals, ['family_relation']);
});

test('accepts a skipped-target file when recording successful attempts', () => {
  const options = parseArgs(['--record-input', 'targets.json', '--skip-input', 'skipped.json']);
  assert.match(options.recordInputPath, /targets\.json$/);
  assert.match(options.skipInputPath, /skipped\.json$/);
});
