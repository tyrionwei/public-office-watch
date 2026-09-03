import assert from 'node:assert/strict';
import test from 'node:test';
import {
  electionVotingCycles,
  selectNextElectionVotingCycle,
  type ElectionVotingCycle,
} from '../src/data/electionVotingCycles.ts';
import type { VotingRegionPreference } from '../src/votingRegion.tsx';

function preference(countyId: string, districtId?: string, villageName?: string): VotingRegionPreference {
  return {
    county: { id: countyId, name: countyId },
    ...(districtId ? { district: { id: districtId, name: districtId } } : {}),
    ...(villageName ? { village: { id: `village:${villageName}`, name: villageName } } : {}),
    source: 'manual',
    confirmedAt: '2026-09-03T00:00:00.000Z',
  };
}

function cycle(
  id: string,
  votingDate: string,
  scope: ElectionVotingCycle['scope'],
): ElectionVotingCycle {
  return {
    id,
    title: { 'zh-TW': id, en: id },
    votingDate,
    pollingPlaceStatus: 'not-announced',
    scope,
  };
}

test('loads the current nationwide cycle from data instead of a component date check', () => {
  const selected = selectNextElectionVotingCycle(
    preference('new-taipei-city', 'district-65000010'),
    '2026-11-28',
  );

  assert.equal(selected?.id, '2026-local-general-election-day');
  assert.equal(selected?.pollingPlaceLookupUrl, 'https://info.cec.gov.tw/vote2026/voteSearch/');
  assert.equal(electionVotingCycles.length, 1);
});

test('skips a county by-election for voters registered elsewhere', () => {
  const cycles = [
    cycle('county-by-election', '2027-03-06', {
      kind: 'registered-areas',
      areas: [{ countyIds: ['target-county'] }],
    }),
    cycle('next-nationwide-election', '2028-01-08', { kind: 'nationwide' }),
  ];

  assert.equal(
    selectNextElectionVotingCycle(preference('other-county'), '2027-01-01', cycles)?.id,
    'next-nationwide-election',
  );
  assert.equal(
    selectNextElectionVotingCycle(preference('target-county'), '2027-01-01', cycles)?.id,
    'county-by-election',
  );
});

test('requires an exact registered district or village for a narrower by-election', () => {
  const cycles = [
    cycle('district-by-election', '2027-04-10', {
      kind: 'registered-areas',
      areas: [{
        countyIds: ['target-county'],
        districtIds: ['district-target'],
        villageNames: ['目標里'],
      }],
    }),
  ];

  assert.equal(selectNextElectionVotingCycle(
    preference('target-county', 'district-other', '目標里'),
    '2027-01-01',
    cycles,
  ), null);
  assert.equal(selectNextElectionVotingCycle(
    preference('target-county', 'district-target', '其他里'),
    '2027-01-01',
    cycles,
  ), null);
  assert.equal(selectNextElectionVotingCycle(
    preference('target-county', 'district-target', '目標里'),
    '2027-01-01',
    cycles,
  )?.id, 'district-by-election');
});

test('does not reuse an expired cycle for a later election period', () => {
  assert.equal(
    selectNextElectionVotingCycle(preference('new-taipei-city'), '2026-11-29'),
    null,
  );
});
