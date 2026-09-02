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

test('marks historical backfill complete only after all three research categories succeed', () => {
  const target = { personId: 'p-1', name: '人物一', collectionMode: 'historical_backfill' };
  const researchResults = [
    { personId: 'p-1', category: 'family_relation', status: 'no_leads', leadCount: 0 },
    { personId: 'p-1', category: 'party_affiliation', status: 'leads_found', leadCount: 1 },
    { personId: 'p-1', category: 'legal_case', status: 'no_leads', leadCount: 0 },
  ];
  const next = recordDailyTargets(
    { attempts: {}, historicalBackfill: {} },
    [target],
    new Date('2026-08-11T00:00:00Z'),
    [],
    researchResults,
  );

  assert.equal(next.historicalBackfill['p-1'].status, 'completed');
  assert.equal(next.historicalBackfill['p-1'].completedAt, '2026-08-11T00:00:00.000Z');
});

test('keeps historical backfill incomplete when any category fails', () => {
  const target = { personId: 'p-1', name: '人物一', collectionMode: 'historical_backfill' };
  const researchResults = [
    { personId: 'p-1', category: 'family_relation', status: 'no_leads' },
    { personId: 'p-1', category: 'party_affiliation', status: 'source_error' },
    { personId: 'p-1', category: 'legal_case', status: 'no_leads' },
  ];
  const next = recordDailyTargets(
    { attempts: {}, historicalBackfill: {} },
    [target],
    new Date('2026-08-11T00:00:00Z'),
    [],
    researchResults,
  );

  assert.equal(next.historicalBackfill['p-1'].status, 'incomplete');
  assert.equal(next.historicalBackfill['p-1'].completedAt, null);
});

test('uses recurring monitoring after a completed backfill reaches cooldown', () => {
  const targets = [{ personId: 'p-1', name: '人物一' }];
  const state = {
    attempts: { 'p-1': { attemptedAt: '2026-06-01T00:00:00Z' } },
    historicalBackfill: { 'p-1': { completedAt: '2026-06-01T00:00:00Z' } },
  };
  const selected = selectDailyTargets(targets, state, new Date('2026-08-11T00:00:00Z'), 25, 30);
  assert.equal(selected[0].collectionMode, 'recurring_monitor');
  assert.equal(selected[0].researchLookbackDays, 72);
});

test('accepts a progress file when recording attempts', () => {
  const options = parseArgs(['--record-input', 'targets.json', '--progress-input', 'progress.json', '--skip-input', 'skipped.json', '--research-input', 'research.json']);
  assert.match(options.recordInputPath, /targets\.json$/);
  assert.match(options.progressInputPath, /progress\.json$/);
  assert.match(options.skipInputPath, /skipped\.json$/);
  assert.match(options.researchInputPath, /research\.json$/);
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

test('reserves half of a mixed batch for due recurring monitoring', () => {
  const targets = [
    { personId: 'recurring-1', name: '監測一' },
    { personId: 'recurring-2', name: '監測二' },
    { personId: 'recurring-3', name: '監測三' },
    { personId: 'backfill-1', name: '補查一' },
    { personId: 'backfill-2', name: '補查二' },
  ];
  const completedAt = '2026-06-01T00:00:00Z';
  const state = {
    attempts: Object.fromEntries(targets.slice(0, 3).map((target) => [target.personId, { attemptedAt: completedAt }])),
    historicalBackfill: Object.fromEntries(targets.slice(0, 3).map((target) => [target.personId, { completedAt }])),
  };

  const selected = selectDailyTargets(targets, state, new Date('2026-08-11T00:00:00Z'), 4, 30);

  assert.deepEqual(selected.map((target) => target.personId), [
    'recurring-1',
    'recurring-2',
    'backfill-1',
    'backfill-2',
  ]);
  assert.deepEqual(selected.map((target) => target.collectionMode), [
    'recurring_monitor',
    'recurring_monitor',
    'historical_backfill',
    'historical_backfill',
  ]);
});

test('keeps the last successful research time until every recurring category succeeds', () => {
  const previousSuccess = '2026-06-01T00:00:00.000Z';
  const state = {
    attempts: {},
    historicalBackfill: { 'p-1': { completedAt: previousSuccess } },
    researchMonitoring: { 'p-1': { lastSuccessfulAt: previousSuccess } },
  };
  const target = { personId: 'p-1', name: '人物一', collectionMode: 'recurring_monitor' };
  const incomplete = recordDailyTargets(state, [target], new Date('2026-08-11T00:00:00Z'), [], [
    { personId: 'p-1', category: 'family_relation', status: 'no_leads' },
    { personId: 'p-1', category: 'party_affiliation', status: 'source_error' },
    { personId: 'p-1', category: 'legal_case', status: 'no_leads' },
  ]);

  assert.equal(incomplete.researchMonitoring['p-1'].lastSuccessfulAt, previousSuccess);

  const completed = recordDailyTargets(incomplete, [target], new Date('2026-08-12T00:00:00Z'), [], [
    { personId: 'p-1', category: 'family_relation', status: 'no_leads' },
    { personId: 'p-1', category: 'party_affiliation', status: 'leads_found' },
    { personId: 'p-1', category: 'legal_case', status: 'no_leads' },
  ]);

  assert.equal(completed.researchMonitoring['p-1'].lastSuccessfulAt, '2026-08-12T00:00:00.000Z');
});
