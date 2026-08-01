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

test('creates a historical Taoyuan County region instead of reusing modern Taoyuan City', () => {
  const preview = {
    summary: { createNewEventCount: 1, createNewRaceCount: 1 },
    comparisonPlan: {
      eventPlans: [{
        key: '2009|councilor|national',
        action: 'create_new',
        electionName: '2009年直轄市及縣市議員選舉',
        electionYear: 2009,
        electionType: 'councilor',
        existingCandidates: [],
      }],
      racePlans: [{
        key: '2009|councilor|桃園縣|district-1|regional',
        eventContextKey: '2009|councilor|national',
        action: 'create_new',
        historicalGeography: '桃園縣',
        regionScope: 'local',
        raceTitle: '桃園縣第1選舉區議員選舉',
        raceType: 'county_councilor',
        existingCandidates: [],
      }],
    },
  };
  const regions = [{
    external_id: 'tw-county-68000',
    name: '桃園市',
    slug: 'taoyuan-city',
    region_type: 'municipality',
  }];

  const plan = buildHistoricalElectionRacePlan(preview, regions);
  assert.equal(plan.createRegions.length, 1);
  assert.equal(plan.createRegions[0].name, '桃園縣');
  assert.equal(plan.createRegions[0].externalId, 'cec-historical-county-taoyuan');
  assert.equal(plan.createRaces[0].regionExternalId, 'cec-historical-county-taoyuan');
  assert.equal(plan.createRaces[0].raceType, 'county_councilor');
});

test('creates pre-merger same-name city regions instead of reusing modern municipalities', () => {
  const preview = {
    summary: { createNewEventCount: 2, createNewRaceCount: 3 },
    comparisonPlan: {
      eventPlans: [{
        key: '2005|councilor|national',
        action: 'create_new',
        electionName: '2005年直轄市及縣市議員選舉',
        electionYear: 2005,
        electionType: 'councilor',
        existingCandidates: [],
      }, {
        key: '2006|councilor|national',
        action: 'create_new',
        electionName: '2006年直轄市及縣市議員選舉',
        electionYear: 2006,
        electionType: 'councilor',
        existingCandidates: [],
      }],
      racePlans: [{
        key: '2005|councilor|臺中市|district-1|regional',
        eventContextKey: '2005|councilor|national',
        action: 'create_new',
        historicalGeography: '臺中市',
        regionScope: 'local',
        raceTitle: '臺中市第1選舉區議員選舉',
        raceType: 'city_councilor',
        existingCandidates: [],
      }, {
        key: '2005|councilor|臺南市|district-1|regional',
        eventContextKey: '2005|councilor|national',
        action: 'create_new',
        historicalGeography: '臺南市',
        regionScope: 'local',
        raceTitle: '臺南市第1選舉區議員選舉',
        raceType: 'city_councilor',
        existingCandidates: [],
      }, {
        key: '2006|councilor|高雄市|district-1|regional',
        eventContextKey: '2006|councilor|national',
        action: 'create_new',
        historicalGeography: '高雄市',
        regionScope: 'local',
        raceTitle: '高雄市第1選舉區議員選舉',
        raceType: 'city_councilor',
        existingCandidates: [],
      }],
    },
  };
  const regions = [{
    external_id: 'tw-county-66000',
    name: '臺中市',
    slug: 'taichung-city',
    region_type: 'municipality',
  }, {
    external_id: 'tw-county-67000',
    name: '臺南市',
    slug: 'tainan-city',
    region_type: 'municipality',
  }, {
    external_id: 'tw-county-64000',
    name: '高雄市',
    slug: 'kaohsiung-city',
    region_type: 'municipality',
  }];

  const plan = buildHistoricalElectionRacePlan(preview, regions);
  assert.deepEqual(
    plan.createRegions.map((region) => [region.name, region.regionType]),
    [['高雄市', 'municipality'], ['臺中市', 'city'], ['臺南市', 'city']],
  );
  assert.deepEqual(
    plan.createRaces.map((race) => race.regionExternalId),
    [
      'cec-historical-city-taichung',
      'cec-historical-city-tainan',
      'cec-historical-municipality-kaohsiung',
    ],
  );
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
