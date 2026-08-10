import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicCandidate, PublicPerson, PublicPersonClaim, PublicRace } from '../src/types/publicViews.ts';
import {
  buildElectionEducationDistribution,
  buildPartyElectionPerformance,
  collapsePartyElectionPerformance,
} from '../src/lib/electionStatistics.ts';

const races = [
  { race_id: 'race-taipei', election_id: 'election-2022', race_type: 'city_councilor', region_name: '臺北市' },
  { race_id: 'race-tainan', election_id: 'election-2022', race_type: 'city_councilor', region_name: '臺南市' },
  { race_id: 'race-mayor', election_id: 'election-2022', race_type: 'municipality_mayor', region_name: '臺北市' },
] as PublicRace[];

function candidate(
  candidateId: string,
  raceId: string,
  party: string,
  elected = false,
): PublicCandidate {
  return {
    candidate_id: candidateId,
    person_id: `person-${candidateId}`,
    person_name: candidateId,
    person_party: party,
    person_position: null,
    race_id: raceId,
    race_title: raceId,
    election_id: 'election-2022',
    election_name: '2022',
    election_year: 2022,
    region_id: null,
    region_name: null,
    party,
    candidate_no: null,
    registration_status: elected ? 'elected' : 'not_elected',
    candidacy_status: 'qualified',
    election_result: elected ? 'elected' : 'not_elected',
    status_updated_at: null,
    candidate_updated_at: null,
    vote_count: null,
    vote_rate: null,
    is_elected: elected,
    is_incumbent: null,
    source_name: null,
    source_url: null,
    primary_photo_url: null,
    primary_photo_thumbnail_url: null,
    photo_attribution: null,
    photo_license_type: null,
  };
}

test('groups only the selected election, race type and region with canonical party names', () => {
  const rows = buildPartyElectionPerformance([
    candidate('a', 'race-taipei', '基進黨', true),
    candidate('b', 'race-taipei', '台灣基進'),
    candidate('c', 'race-tainan', '民主進步黨', true),
    candidate('d', 'race-mayor', '中國國民黨', true),
  ], races, ['election-2022'], { raceTypes: ['city_councilor'], regionKey: '臺北市' });

  assert.deepEqual(rows, [{
    party_name: '台灣基進',
    candidate_count: 2,
    elected_count: 1,
    pending_count: 0,
  }]);
});

test('collapses small groups without changing totals', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    party_name: `party-${index}`,
    candidate_count: 5 - index,
    elected_count: index % 2,
    pending_count: 0,
  }));
  const collapsed = collapsePartyElectionPerformance(rows, 3);

  assert.equal(collapsed.length, 3);
  assert.deepEqual(collapsed[2], {
    party_name: '__other_parties__',
    candidate_count: 6,
    elected_count: 1,
    pending_count: 0,
  });
});

test('groups education using profile values, claim fallbacks and an explicit unknown bucket', () => {
  const candidates = [
    candidate('a', 'race-taipei', '民主進步黨'),
    candidate('b', 'race-taipei', '中國國民黨'),
    candidate('c', 'race-taipei', '無黨籍'),
    candidate('d', 'race-tainan', '民主進步黨'),
  ];
  const people = [
    { person_id: 'person-a', education: '國立政治大學碩士' },
    { person_id: 'person-b', education: null },
    { person_id: 'person-c', education: null },
  ] as PublicPerson[];
  const claims = [{
    person_id: 'person-b',
    claim_type: 'education',
    claim_value: '某某大學法律學系',
  }] as PublicPersonClaim[];

  assert.deepEqual(buildElectionEducationDistribution(
    candidates,
    races,
    people,
    claims,
    ['election-2022'],
    { raceTypes: ['city_councilor'], regionKey: '臺北市' },
  ), [
    {
      education_key: 'master',
      candidate_count: 1,
    },
    {
      education_key: 'university',
      candidate_count: 1,
    },
    {
      education_key: 'unknown',
      candidate_count: 1,
    },
  ]);
});
