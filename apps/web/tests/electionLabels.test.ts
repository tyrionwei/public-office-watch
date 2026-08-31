import assert from 'node:assert/strict';
import test from 'node:test';
import { getRaceCategoryByType } from '../src/data/electionLabels.ts';

test('groups every legislator race type under the legislator category', () => {
  for (const raceType of ['legislator', 'legislative_district', 'party_list_legislator', 'indigenous'] as const) {
    assert.deepEqual(getRaceCategoryByType(raceType), {
      key: 'legislator',
      label: '立法委員',
      order: 30,
    });
  }
});
