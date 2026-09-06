import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  enrichSeedWithPlannedLocalElections,
  loadPlannedLocalRaceOverrides,
} from './sync-real-public-data.mjs';

const expectedDistrictCounts = new Map([
  ['新竹縣', 14],
  ['彰化縣', 10],
  ['雲林縣', 8],
  ['基隆市', 9],
  ['新竹市', 7],
]);

const regionFixtures = [...expectedDistrictCounts].map(([name], index) => ({
  externalId: `region-${index + 1}`,
  name,
  officialCode: String(index + 1).padStart(5, '0'),
  regionType: name.endsWith('縣') ? 'county' : 'city',
}));

test('official 2026 district override contains all five changed regions', () => {
  const data = loadPlannedLocalRaceOverrides();
  assert.equal(data.announcementNumber, '中選務字第1153150253號');
  assert.equal(data.votingDate, '2026-11-28');
  assert.equal(data.districts.length, 48);

  for (const [regionName, expectedCount] of expectedDistrictCounts) {
    assert.equal(data.districts.filter((row) => row.regionName === regionName).length, expectedCount);
  }
});

test('planned 2026 races replace changed regions with official district metadata', () => {
  const seed = {
    elections: [],
    regions: regionFixtures,
    races: regionFixtures.flatMap((region) => {
      const oldCount = new Map([
        ['新竹縣', 13],
        ['彰化縣', 10],
        ['雲林縣', 6],
        ['基隆市', 8],
        ['新竹市', 7],
      ]).get(region.name);

      return Array.from({ length: oldCount }, (_, index) => ({
        externalId: `cec-2022-local-councilor-regional-${region.officialCode}-${String(index + 1).padStart(2, '0')}`,
        electionExternalId: 'cec-2022-local-public-officials',
        regionExternalId: region.externalId,
        raceType: region.regionType === 'county' ? 'county_councilor' : 'city_councilor',
        title: `${region.name}第${index + 1}選舉區議員選舉`,
        status: 'completed',
      }));
    }),
  };

  const result = enrichSeedWithPlannedLocalElections(seed);
  const plannedRaces = result.seed.races.filter((race) => race.electionExternalId === 'planned-2026-local-public-officials');

  for (const [regionName, expectedCount] of expectedDistrictCounts) {
    const region = regionFixtures.find((item) => item.name === regionName);
    assert.equal(plannedRaces.filter((race) => race.regionExternalId === region.externalId).length, expectedCount);
  }

  const hsinchuCounty = regionFixtures.find((region) => region.name === '新竹縣');
  const hsinchuFourteenth = plannedRaces.find((race) => {
    return race.regionExternalId === hsinchuCounty.externalId && race.title.includes('第14選舉區');
  });

  assert.match(hsinchuFourteenth.title, /山地原住民議員選舉$/);
  assert.equal(hsinchuFourteenth.districtScope.includes('五峰鄉'), true);
  assert.equal(hsinchuFourteenth.seatCount, 1);
  assert.equal(hsinchuFourteenth.reservedWomenSeatCount, 0);
  assert.equal(hsinchuFourteenth.campaignExpenseLimit, 6177000);
  assert.equal(hsinchuFourteenth.sourceId, 'cec-2026-local-election-calendar');
  assert.equal(result.plannedLocalElections.officialDistrictCount, 48);
});

test('new 2026 village races use their current county instead of an unspecified region', () => {
  const sql = fs.readFileSync(new URL('./import-cec-2026-local-grassroots-races.sql', import.meta.url), 'utf8');
  const newVillageCatalog = sql.match(/new_villages[\s\S]+?INSERT INTO races/)?.[0] ?? '';

  assert.match(newVillageCatalog, /new_villages\(jurisdiction, title, source_url\)/);
  assert.match(newVillageCatalog, /county\.name = nv\.jurisdiction/);
  assert.match(newVillageCatalog, /county\.region_type = 'county'/);
  assert.doesNotMatch(newVillageCatalog, /NULL::uuid/);
});
