import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoricalCecMissingRacePlan,
  renderHistoricalCecMissingRaceSql,
} from './build-historical-cec-missing-race-migration.mjs';

function report() {
  return {
    source: { sourceType: 'official_election', sourceId: 'cec-2024-votedata' },
    categoryCounts: { missing_race_context: 2 },
    missingRaceContexts: [{
      key: '2002|councilor|Taipei|district-1|regional',
      eventContextKey: '2002|councilor|national',
      eventPlanAction: 'reuse_existing',
      racePlanAction: 'create_new',
      eventExternalId: 'cec-historical-election-2002',
      regionExternalId: 'tw-county-63000',
      electionYear: 2002,
      historicalGeography: 'Taipei',
      regionScope: 'local',
      raceTitle: 'Taipei district 1 councilor election',
      raceType: 'city_councilor',
      sourceRowCount: 2,
    }],
  };
}

test('builds deterministic private races for every covered missing source row', () => {
  const first = buildHistoricalCecMissingRacePlan(report());
  const second = buildHistoricalCecMissingRacePlan(report());

  assert.deepEqual(first, second);
  assert.equal(first.summary.createRaces, 1);
  assert.equal(first.summary.coveredSourceRows, 2);
  assert.match(first.createRaces[0].externalId, /^cec-historical-race-[0-9a-f]{16}$/);
  assert.equal(first.policy.candidateWrites, false);

  const dryRunSql = renderHistoricalCecMissingRaceSql(first);
  assert.match(dryRunSql, /BEGIN;/);
  assert.match(dryRunSql, /FALSE/);
  assert.match(dryRunSql, /ROLLBACK;/);

  const migrationSql = renderHistoricalCecMissingRaceSql(first, { rollback: false });
  assert.doesNotMatch(migrationSql, /ROLLBACK;/);
  assert.match(migrationSql, /SELECT published\.promote\(NULL\);/);
});

test('refuses missing event, region and source-count evidence', () => {
  const missingEvent = report();
  missingEvent.missingRaceContexts[0].eventExternalId = null;
  assert.throws(
    () => buildHistoricalCecMissingRacePlan(missingEvent),
    /lacks one reusable election/,
  );

  const missingRegion = report();
  missingRegion.missingRaceContexts[0].regionExternalId = null;
  assert.throws(
    () => buildHistoricalCecMissingRacePlan(missingRegion),
    /lacks a canonical region/,
  );

  const driftedCount = report();
  driftedCount.categoryCounts.missing_race_context = 3;
  assert.throws(
    () => buildHistoricalCecMissingRacePlan(driftedCount),
    /source count mismatch/,
  );
});
