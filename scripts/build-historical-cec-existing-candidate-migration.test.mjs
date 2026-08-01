import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoricalCecExistingCandidatePlan,
  renderHistoricalCecExistingCandidateSql,
} from './build-historical-cec-existing-candidate-migration.mjs';

function expected(overrides = {}) {
  return {
    party: 'Independent',
    candidate_no: '3',
    vote_count: 120,
    vote_rate: 12.5,
    is_elected: false,
    candidacy_status: 'qualified',
    election_result: 'not_elected',
    registration_status: 'not_elected',
    ...overrides,
  };
}

function report() {
  return {
    categoryCounts: { safe_create_candidate: 1, safe_update_candidate: 1 },
    actionableByYear: { 2002: 1, 2014: 1 },
    safeCreates: [{
      sourcePersonId: '11111111-1111-4111-8111-111111111111',
      sourcePersonKey: 'cec-historical:create',
      personId: '22222222-2222-4222-8222-222222222222',
      expectedRaceId: '33333333-3333-4333-8333-333333333333',
      electionYear: 2002,
      raceContextKey: 'create-race',
      expected: expected(),
    }],
    safeUpdates: [{
      sourcePersonId: '44444444-4444-4444-8444-444444444444',
      sourcePersonKey: 'cec-historical:update',
      personId: '55555555-5555-4555-8555-555555555555',
      expectedRaceId: '66666666-6666-4666-8666-666666666666',
      candidateId: '77777777-7777-4777-8777-777777777777',
      candidateExternalId: 'existing-candidate',
      candidateIsPublic: true,
      electionYear: 2014,
      raceContextKey: 'update-race',
      mismatchFields: ['candidate_no', 'is_elected'],
      expected: expected({
        candidate_no: '8',
        is_elected: true,
        election_result: 'elected',
        registration_status: 'elected',
      }),
    }],
  };
}

test('separates private creates from publication-preserving official updates', () => {
  const plan = buildHistoricalCecExistingCandidatePlan(report());
  assert.deepEqual(plan.summary, {
    createCandidates: 1,
    updateCandidates: 1,
    totalCandidates: 2,
    withVoteCount: 2,
    withVoteRate: 2,
    elected: 1,
    publicUpdates: 1,
  });
  assert.match(plan.rows[0].candidateExternalId, /^cec-historical-candidate-[0-9a-f]{16}$/);
  assert.equal(plan.rows[1].originalIsPublic, true);
  assert.equal(plan.policy.createsPublic, false);
  assert.equal(plan.policy.updatesPreservePublicationState, true);

  const dryRunSql = renderHistoricalCecExistingCandidateSql(plan);
  assert.match(dryRunSql, /BEGIN;/);
  assert.match(dryRunSql, /WHERE input\.operation = 'create'/);
  assert.match(dryRunSql, /WHERE input\.operation = 'update'/);
  assert.match(dryRunSql, /candidate\.is_public = input\.original_is_public/);
  assert.match(dryRunSql, /UPDATE source_people source/);
  assert.match(dryRunSql, /input\.operation = 'create'[\s\S]+person_identity_matches/);
  assert.match(dryRunSql, /JOIN person_canonical_map person_map/);
  assert.match(dryRunSql, /JOIN race_canonical_map race_map/);
  assert.match(dryRunSql, /ROLLBACK;/);

  const migrationSql = renderHistoricalCecExistingCandidateSql(plan, { rollback: false });
  assert.doesNotMatch(migrationSql, /ROLLBACK;/);
  assert.match(migrationSql, /SELECT published\.promote\(NULL\);/);
  assert.match(migrationSql, /unexpectedly published a newly created private candidate/);
});

test('can restrict a migration plan to one election year', () => {
  const plan = buildHistoricalCecExistingCandidatePlan(report(), { electionYear: 2002 });
  assert.deepEqual(plan.summary, {
    createCandidates: 1,
    updateCandidates: 0,
    totalCandidates: 1,
    withVoteCount: 1,
    withVoteRate: 1,
    elected: 0,
    publicUpdates: 0,
  });
  assert.equal(plan.policy.electionYear, 2002);
  assert.equal(plan.rows[0].electionYear, 2002);
});

test('rejects count drift, unsafe update fields and missing publication state', () => {
  const countDrift = report();
  countDrift.categoryCounts.safe_create_candidate = 2;
  assert.throws(() => buildHistoricalCecExistingCandidatePlan(countDrift), /Safe create count mismatch/);

  const unsafeField = report();
  unsafeField.safeUpdates[0].mismatchFields = ['person_id'];
  assert.throws(() => buildHistoricalCecExistingCandidatePlan(unsafeField), /Unsafe update field/);

  const missingState = report();
  delete missingState.safeUpdates[0].candidateIsPublic;
  assert.throws(() => buildHistoricalCecExistingCandidatePlan(missingState), /Missing original publication state/);
});
