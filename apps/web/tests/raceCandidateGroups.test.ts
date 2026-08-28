import assert from 'node:assert/strict';
import test from 'node:test';
import { groupRaceCandidates } from '../src/lib/raceCandidateGroups.ts';
import type { PublicCandidate } from '../src/types/publicViews.ts';

function candidate(overrides: Partial<PublicCandidate>): PublicCandidate {
  return {
    candidate_id: 'candidate-1',
    person_id: 'person-1',
    person_name: '候選人',
    person_party: '測試黨',
    person_position: '總統候選人',
    race_id: 'race-1',
    race_title: '總統副總統全國選舉',
    election_id: 'election-1',
    election_name: '2024年總統副總統選舉',
    election_year: 2024,
    region_id: null,
    region_name: '全國',
    party: '測試黨',
    candidate_no: '1',
    registration_status: 'qualified',
    candidacy_status: 'qualified',
    election_result: 'not_elected',
    status_updated_at: null,
    candidate_updated_at: null,
    vote_count: null,
    vote_rate: null,
    is_elected: false,
    is_incumbent: false,
    source_name: null,
    source_url: null,
    primary_photo_url: null,
    primary_photo_thumbnail_url: null,
    photo_attribution: null,
    photo_license_type: null,
    ...overrides,
  };
}

test('groups presidential and vice-presidential candidates by ticket', () => {
  const groups = groupRaceCandidates([
    candidate({ candidate_id: 'vice-2', person_id: 'vice-person-2', person_name: '副手乙', person_position: '副總統候選人', candidate_no: '2', party: '乙黨', vote_count: 300 }),
    candidate({ candidate_id: 'president-1', person_id: 'president-person-1', person_name: '總統甲', candidate_no: '1', party: '甲黨', vote_count: 500, is_elected: true, election_result: 'elected' }),
    candidate({ candidate_id: 'vice-1', person_id: 'vice-person-1', person_name: '副手甲', person_position: '副總統候選人', candidate_no: '1', party: '甲黨', is_elected: true, election_result: 'elected' }),
    candidate({ candidate_id: 'president-2', person_id: 'president-person-2', person_name: '總統乙', candidate_no: '2', party: '乙黨' }),
  ], '總統副總統全國選舉');

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].members.map((member) => member.person_name), ['總統甲', '副手甲']);
  assert.equal(groups[0].representative.vote_count, 500);
  assert.equal(groups[0].isElected, true);
  assert.deepEqual(groups[1].members.map((member) => member.person_name), ['總統乙', '副手乙']);
  assert.equal(groups[1].representative.vote_count, 300);
});

test('keeps non-presidential candidates as separate rows', () => {
  const candidates = [
    candidate({ candidate_id: 'legislator-1', person_id: 'person-1', race_title: '臺北市第1選舉區', person_position: '立法委員候選人' }),
    candidate({ candidate_id: 'legislator-2', person_id: 'person-2', race_title: '臺北市第1選舉區', person_position: '立法委員候選人', candidate_no: '2' }),
  ];

  const groups = groupRaceCandidates(candidates, '臺北市第1選舉區');

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.members.length), [1, 1]);
});
