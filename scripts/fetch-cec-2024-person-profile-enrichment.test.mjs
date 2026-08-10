import assert from 'node:assert/strict';
import test from 'node:test';
import { matchCandidate } from './fetch-cec-2024-person-profile-enrichment.mjs';

function indexFor(...candidates) {
  return new Map([['林淑芬', candidates]]);
}

const officialRow = {
  name: '林淑芬',
  candNo: '25',
  party: '台灣民眾黨',
  raceTitle: '全國不分區及僑居國外國民立法委員選舉',
  electionName: '第11屆立法委員選舉',
  typeCode: 'L4',
};

test('rejects a same-name match with no party, race, or candidate-number support', () => {
  const result = matchCandidate(officialRow, indexFor({
    person_id: 'regional-legislator',
    person_name: '林淑芬',
    party: '民主進步黨',
    person_party: '民主進步黨',
    candidate_no: '1',
    race_title: '新北市第2選舉區立法委員選舉',
    election_name: '第11屆立法委員選舉',
  }));

  assert.equal(result, null);
});

test('accepts a same-name match when party and race support the identity', () => {
  const candidate = {
    person_id: 'party-list-candidate',
    person_name: '林淑芬',
    party: '台灣民眾黨',
    person_party: '台灣民眾黨',
    candidate_no: '25',
    race_title: '全國不分區及僑居國外國民立法委員選舉',
    election_name: '第11屆立法委員選舉',
  };
  const result = matchCandidate(officialRow, indexFor(candidate));

  assert.equal(result?.person, candidate);
  assert.ok(result.score >= 110);
});
