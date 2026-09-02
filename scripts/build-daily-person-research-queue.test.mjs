import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResearchQueue, buildSearchPlans } from './build-daily-person-research-queue.mjs';

const target = {
  personId: 'person-1',
  name: '測試人物',
  position: '立法委員',
  district: '測試選區',
  priorElectionYears: [2024, 2020],
  missingSignals: [],
  researchSignals: ['family_relation', 'party_affiliation', 'legal_case'],
};

test('builds only family, party, and legal plans for ongoing daily research', () => {
  const plans = buildSearchPlans(target);
  assert.deepEqual(plans.map((plan) => plan.key), [
    'family_relation',
    'party_affiliation_history',
    'legal_record_clues',
  ]);
  assert.equal(plans.every((plan) => plan.historical), true);
  assert.equal(plans.some((plan) => plan.key === 'platform'), false);
});

test('limits recurring research plans to the recent 30-day window', () => {
  const plans = buildSearchPlans({ ...target, collectionMode: 'recurring_monitor' });

  assert.equal(plans.every((plan) => plan.historical === false), true);
  assert.equal(plans.every((plan) => plan.timeScope === 'recent_30_days'), true);
  assert.equal(plans.every((plan) => plan.query.includes('when:30d')), true);
});

test('keeps the research queue private and ordered', () => {
  const queue = buildResearchQueue([target], '2026-08-12T00:00:00.000Z');
  assert.equal(queue.targetCount, 1);
  assert.equal(queue.targets[0].order, 1);
  assert.equal(queue.targets[0].reviewStatus, 'pending');
  assert.equal(queue.targets[0].autoPublish, false);
});

test('expands recurring research plans when the last successful run is older', () => {
  const plans = buildSearchPlans({ ...target, collectionMode: 'recurring_monitor', researchLookbackDays: 72 });

  assert.equal(plans.every((plan) => plan.timeScope === 'recent_72_days'), true);
  assert.equal(plans.every((plan) => plan.query.includes('when:72d')), true);
});
