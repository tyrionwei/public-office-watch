import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoricalElectionRacePlan,
  renderHistoricalElectionRaceSql,
} from './build-historical-cec-election-race-migration.mjs';

test('builds historical regions and canonical event/race writes without publishing them', () => {
  const preview = {
    summary: { createNewEventCount: 1, createNewRaceCount: 2 },
    comparisonPlan: {
      eventPlans: [
        {
          key: '1998|councilor|national',
          action: 'create_new',
          electionName: '1998年直轄市及縣市議員選舉',
          electionYear: 1998,
          electionType: 'councilor',
          existingCandidates: [],
        },
        {
          key: '2012|legislator|national',
          action: 'reuse_existing',
          electionName: '2012年立法委員選舉',
          electionYear: 2012,
          electionType: 'legislative',
          existingScope: 'same_scope',
          existingCandidates: [{
            externalId: 'cec-2012-legislative-yuan',
            name: '2012年第8屆立法委員選舉',
            electionType: 'legislative',
          }],
        },
        {
          key: '2022|councilor|national',
          action: 'reuse_existing',
          electionName: '2022年直轄市及縣市議員選舉',
          electionYear: 2022,
          electionType: 'councilor',
          existingScope: 'aggregate',
          existingCandidates: [{
            externalId: 'cec-2022-local-public-officials',
            name: '2022年地方公職人員選舉',
            electionType: 'local',
          }],
        },
      ],
      racePlans: [
        {
          key: '1998|councilor|臺北縣|district-1|regional',
          eventContextKey: '1998|councilor|national',
          action: 'create_new',
          historicalGeography: '臺北縣',
          regionScope: 'local',
          raceTitle: '臺北縣第1選舉區議員選舉',
          raceType: 'county_councilor',
          existingCandidates: [],
        },
        {
          key: '2012|legislator|national|district-1|regional',
          eventContextKey: '2012|legislator|national',
          action: 'create_new',
          historicalGeography: '臺北市',
          regionScope: 'local',
          raceTitle: '臺北市第1選舉區立法委員選舉',
          raceType: 'legislative_district',
          existingCandidates: [],
        },
      ],
    },
  };
  const regions = [{
    external_id: 'tw-county-63000',
    name: '臺北市',
    slug: 'taipei-city',
    region_type: 'municipality',
  }];

  const plan = buildHistoricalElectionRacePlan(preview, regions);
  assert.deepEqual(plan.summary, {
    createRegions: 1,
    createEvents: 1,
    normalizeEvents: 1,
    createRaces: 2,
    normalizeRaces: 0,
  });
  assert.equal(plan.createRegions[0].name, '臺北縣');
  assert.equal(plan.createRegions[0].externalId, 'cec-historical-county-taipei');
  assert.equal(plan.createRaces[1].regionExternalId, 'tw-county-63000');
  assert.equal(plan.policy.newRecordsPublic, false);

  const sql = renderHistoricalElectionRaceSql(plan);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /ON CONFLICT \(external_id\) DO UPDATE/);
  assert.match(sql, /2012年立法委員選舉/);
  assert.match(sql, /is_public, updated_at/);
  assert.match(sql, /ROLLBACK;/);

  const migrationSql = renderHistoricalElectionRaceSql(plan, { rollback: false });
  assert.doesNotMatch(migrationSql, /BEGIN;/);
  assert.doesNotMatch(migrationSql, /ROLLBACK;/);
  assert.match(migrationSql, /Historical CEC migration election normalization mismatch/);
  assert.match(migrationSql, /SELECT published\.promote\(NULL\);/);

  const repeatedPlan = buildHistoricalElectionRacePlan(preview, [
    ...regions,
    {
      external_id: plan.createRegions[0].externalId,
      name: plan.createRegions[0].name,
      slug: plan.createRegions[0].slug,
      region_type: plan.createRegions[0].regionType,
    },
  ]);
  assert.equal(repeatedPlan.createRegions.length, 1);
  assert.equal(repeatedPlan.createRegions[0].externalId, plan.createRegions[0].externalId);
});

test('refuses a missing non-historical region instead of guessing a modern mapping', () => {
  const preview = {
    summary: { createNewEventCount: 1, createNewRaceCount: 1 },
    comparisonPlan: {
      eventPlans: [{
        key: '1998|councilor|national',
        action: 'create_new',
        electionName: '1998年直轄市及縣市議員選舉',
        electionYear: 1998,
        electionType: 'councilor',
        existingCandidates: [],
      }],
      racePlans: [{
        key: '1998|councilor|未知縣|district-1|regional',
        eventContextKey: '1998|councilor|national',
        action: 'create_new',
        historicalGeography: '未知縣',
        regionScope: 'local',
        raceTitle: '未知縣第1選舉區議員選舉',
        raceType: 'county_councilor',
        existingCandidates: [],
      }],
    },
  };
  assert.throws(
    () => buildHistoricalElectionRacePlan(preview, []),
    /No canonical or historical region plan/,
  );
});
