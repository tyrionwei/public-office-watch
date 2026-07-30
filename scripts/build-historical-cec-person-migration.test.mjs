import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoricalCecPersonPlan,
  renderHistoricalCecPersonSql,
} from './build-historical-cec-person-migration.mjs';

function previewFixture() {
  return {
    summary: {
      safeNewPersonCount: 1,
      heldNewPersonSourceRows: 2,
      heldNewPersonGroupCount: 1,
    },
    safeNewPeople: [{
      identityContextKey: '測試人物|male|臺北縣|councilor',
      proposedPerson: {
        externalId: 'cec-historical-person-test',
        name: '測試人物',
        gender: 'male',
        party: '無',
        position: '臺北縣議員候選人',
        district: '臺北縣第1選舉區議員',
        electionYear: 1998,
        isPublic: false,
      },
      source: {
        sourcePersonId: '11111111-1111-4111-8111-111111111111',
        sourcePersonKey: 'cec-historical:test',
      },
    }],
  };
}

test('builds one deterministic private source-scoped person plan', () => {
  const plan = buildHistoricalCecPersonPlan(previewFixture());
  assert.deepEqual(plan.summary, { createPeople: 1, createMatches: 1 });
  assert.equal(plan.people[0].party, '無黨籍');
  assert.equal(plan.policy.newPeoplePublic, false);
  assert.equal(plan.policy.heldSourceRows, 2);

  const dryRun = renderHistoricalCecPersonSql(plan);
  assert.match(dryRun, /BEGIN;/);
  assert.match(dryRun, /ROLLBACK;/);
  assert.match(dryRun, /is_public = FALSE/);
  assert.match(dryRun, /official_historical_source_scoped_new_person_v1/);

  const migration = renderHistoricalCecPersonSql(plan, { rollback: false });
  assert.doesNotMatch(migration, /ROLLBACK;/);
  assert.match(migration, /SELECT published\.promote\(NULL\);/);
  assert.match(migration, /unexpectedly published a private person/);
  assert.match(migration, /DROP TABLE _historical_cec_person_input_20260730/);
});

test('rejects duplicate source identities and preview count drift', () => {
  const duplicate = previewFixture();
  duplicate.summary.safeNewPersonCount = 2;
  duplicate.safeNewPeople.push(structuredClone(duplicate.safeNewPeople[0]));
  assert.throws(() => buildHistoricalCecPersonPlan(duplicate), /Duplicate identity context/);

  const drift = previewFixture();
  drift.summary.safeNewPersonCount = 2;
  assert.throws(() => buildHistoricalCecPersonPlan(drift), /count mismatch/);
});
