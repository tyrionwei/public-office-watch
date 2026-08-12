import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseArgs,
  recordDailyTargets,
  selectDailyTargets,
  skippedResultStatus,
} from './select-daily-person-enrichment-targets.mjs';

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

test('records every attempted person, outcomes, and the last batch boundary', () => {
  const state = { attempts: { old: { name: '舊人物', attemptedAt: '2026-01-01T00:00:00Z' } } };
  const targets = [
    { personId: 'new-1', name: '新人物一', missingSignals: ['family_relation'], researchSignals: ['experience'] },
    { personId: 'new-2', name: '新人物二', missingSignals: [], researchSignals: ['legal_case'] },
  ];
  const results = [
    { personId: 'new-1', status: 'claims_generated', claimCount: 2, reason: null },
    { personId: 'new-2', status: 'source_error', claimCount: 0, reason: 'temporary failure' },
  ];
  const next = recordDailyTargets(state, targets, new Date('2026-08-11T00:00:00Z'), results);
  assert.equal(next.attempts.old.name, '舊人物');
  assert.equal(next.attempts['new-2'].outcome, 'source_error');
  assert.equal(next.lastBatch.targetCount, 2);
  assert.equal(next.lastBatch.firstPersonName, '新人物一');
  assert.equal(next.lastBatch.lastPersonName, '新人物二');
});

test('moves to untouched people after recording the whole attempted batch', () => {
  const targets = Array.from({ length: 4 }, (_, index) => ({ personId: `p-${index}`, name: `人物${index}` }));
  const state = recordDailyTargets({ attempts: {} }, targets.slice(0, 2), new Date('2026-08-11T00:00:00Z'));
  const selected = selectDailyTargets(targets, state, new Date('2026-08-12T00:00:00Z'), 2, 30);
  assert.deepEqual(selected.map((target) => target.personId), ['p-2', 'p-3']);
});

test('accepts a progress file when recording attempts', () => {
  const options = parseArgs(['--record-input', 'targets.json', '--progress-input', 'progress.json', '--skip-input', 'skipped.json']);
  assert.match(options.recordInputPath, /targets\.json$/);
  assert.match(options.progressInputPath, /progress\.json$/);
  assert.match(options.skipInputPath, /skipped\.json$/);
});

test('recovers current identity-review outcomes from a skipped file', () => {
  assert.equal(skippedResultStatus({
    reason: 'Wikidata identity candidates require downstream review',
    identityCandidates: [{ wikidataQid: 'Q1' }],
  }), 'identity_review_required');
  assert.equal(skippedResultStatus({
    reason: 'no matching Wikidata identity candidate found',
    identityCandidates: [],
  }), 'no_candidate_found');
  assert.equal(skippedResultStatus({
    reason: 'Wikidata API failed: maxlag',
  }), 'source_error');
});
