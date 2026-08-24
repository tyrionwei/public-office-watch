import assert from 'node:assert/strict';
import test from 'node:test';
import { selectHomeRelatedRaces } from '../src/lib/homeRaceSelection.ts';
import type { HomePageData } from '../src/lib/publicDataProvider.ts';

function homeData(upcomingRaces: HomePageData['upcomingRaces']): HomePageData {
  return {
    ticker: { title: '2026 地方選舉', date: '2026-11-28', electionId: 'election-1' },
    regions: [],
    stageRegions: [{
      id: 'taipei-city',
      publicRegionId: 'region-taipei',
      parentId: null,
      label: '臺北市',
      stageLabel: '臺北市',
      level: 'county_city',
      displayOrder: 1,
      isPlaceholder: false,
      note: '',
    }],
    stageRegionSummaries: [],
    upcomingRaces,
    dataPrinciples: [],
  };
}

const taipeiMayorRace = {
  id: 'race-taipei-mayor',
  electionId: 'election-1',
  title: '臺北市長選舉',
  region: '臺北市',
  regionId: 'region-taipei',
  date: '2026-11-28',
  status: 'upcoming' as const,
  raceType: 'municipality_mayor',
  partyTag: 'unknown',
  partyLabel: '未知',
};

test('reselects home races when an initially empty snapshot finishes loading', () => {
  assert.deepEqual(selectHomeRelatedRaces(homeData([]), 'taipei-city'), []);
  assert.deepEqual(
    selectHomeRelatedRaces(homeData([taipeiMayorRace]), 'taipei-city'),
    [taipeiMayorRace],
  );
});

test('keeps completed races out of the restored home spotlight', () => {
  assert.deepEqual(selectHomeRelatedRaces(homeData([{ ...taipeiMayorRace, status: 'completed' }]), 'taipei-city'), []);
});
