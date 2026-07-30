import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoricalCecCandidatePlan,
  renderHistoricalCecCandidateSql,
} from './build-historical-cec-candidate-migration.mjs';

function previewFixture({ action = 'create_new' } = {}) {
  const raceContextKey = '1998|local_councilor|臺北縣|1';
  return {
    summary: { safeNewPersonCount: 1, heldNewPersonSourceRows: 2 },
    comparisonPlan: {
      racePlans: [{
        key: raceContextKey,
        action,
        existingCandidates: action === 'reuse_existing'
          ? [{ externalId: 'existing-race-test' }]
          : [],
      }],
    },
    safeNewPeople: [{
      proposedPerson: { externalId: 'cec-historical-person-test' },
      source: {
        sourcePersonId: '11111111-1111-4111-8111-111111111111',
        sourcePersonKey: 'cec-historical:test',
        party: '無',
        candidateNo: '1',
        voteCount: '100',
        voteRate: '12.5',
        elected: false,
        electionYear: 1998,
        raceContextKey,
      },
    }],
  };
}

test('builds one deterministic private historical candidate plan', () => {
  const plan = buildHistoricalCecCandidatePlan(previewFixture());
  assert.deepEqual(plan.summary, {
    createCandidates: 1,
    withVoteCount: 1,
    withVoteRate: 1,
    elected: 0,
    notElected: 1,
  });
  assert.equal(plan.candidates[0].party, '無黨籍');
  assert.equal(plan.candidates[0].voteCount, 100);
  assert.equal(plan.candidates[0].voteRate, 12.5);
  assert.match(plan.candidates[0].raceExternalId, /^cec-historical-race-[a-f0-9]{16}$/);
  assert.match(plan.candidates[0].candidateExternalId, /^cec-historical-candidate-[a-f0-9]{16}$/);
  assert.equal(plan.policy.newCandidatesPublic, false);

  const dryRun = renderHistoricalCecCandidateSql(plan);
  assert.match(dryRun, /BEGIN;/);
  assert.match(dryRun, /ROLLBACK;/);
  assert.match(dryRun, /is_public = FALSE/);
  assert.match(dryRun, /'not_elected'/);

  const migration = renderHistoricalCecCandidateSql(plan, { rollback: false });
  assert.doesNotMatch(migration, /ROLLBACK;/);
  assert.match(migration, /SELECT published\.promote\(NULL\);/);
  assert.match(migration, /unexpectedly published a private candidate/);
  assert.match(migration, /DROP TABLE _historical_cec_candidate_input_20260730/);
});

test('reuses a reviewed existing race and rejects missing race plans', () => {
  const reused = buildHistoricalCecCandidatePlan(previewFixture({ action: 'reuse_existing' }));
  assert.equal(reused.candidates[0].raceExternalId, 'existing-race-test');

  const missing = previewFixture();
  missing.comparisonPlan.racePlans = [];
  assert.throws(() => buildHistoricalCecCandidatePlan(missing), /Missing reviewed race plan/);
});
