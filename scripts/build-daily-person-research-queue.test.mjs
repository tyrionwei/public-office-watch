import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResearchQueue, buildSearchPlans } from './build-daily-person-research-queue.mjs';

const target = {
  personId: 'person-1',
  name: '測試人物',
  position: '立法委員',
  district: '測試選區',
  priorElectionYears: [2024, 2020],
  missingSignals: ['gender', 'family_relation'],
  researchSignals: ['experience', 'party_affiliation', 'legal_case'],
};

test('builds historical basic, experience, party, family, and legal search plans', () => {
  const plans = buildSearchPlans(target);
  assert.deepEqual(plans.map((plan) => plan.key), [
    'basic_profile',
    'family_relation',
    'experience_history',
    'party_affiliation_history',
    'legal_record_clues',
  ]);
  assert.equal(plans.every((plan) => plan.historical), true);
  assert.equal(plans.some((plan) => plan.key === 'platform'), false);
});

test('keeps the research queue private and ordered', () => {
  const queue = buildResearchQueue([target], '2026-08-12T00:00:00.000Z');
  assert.equal(queue.targetCount, 1);
  assert.equal(queue.targets[0].order, 1);
  assert.equal(queue.targets[0].reviewStatus, 'pending');
  assert.equal(queue.targets[0].autoPublish, false);
});
