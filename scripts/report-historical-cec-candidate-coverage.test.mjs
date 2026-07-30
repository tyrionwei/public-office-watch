import assert from 'node:assert/strict';
import test from 'node:test';

import { auditHistoricalCecCandidateCoverage } from './report-historical-cec-candidate-coverage.mjs';

function source(id, name = id) {
  return {
    id,
    source_person_key: `cec:${id}`,
    raw_name: name,
    normalized_name: name,
    gender: 'male',
    party: '無',
    position: '臺北市議員',
    district: '臺北市第01選舉區',
    election_year: 2022,
    source_payload: {
      candidateNo: '1',
      voteCount: '100',
      voteRate: '10.5',
      elected: false,
      districtCode: '01',
    },
  };
}

function exactCandidate(id, personId) {
  return {
    id,
    external_id: `candidate-${id}`,
    person_id: personId,
    race_id: 'race-1',
    party: '無黨籍',
    candidate_no: '1',
    registration_status: 'not_elected',
    vote_count: 100,
    vote_rate: 10.5,
    is_elected: false,
    candidacy_status: 'qualified',
    election_result: 'not_elected',
    is_public: false,
  };
}

function fixture() {
  return {
    sources: [source('source-exact'), source('source-create'), source('source-update')],
    matches: [
      { source_person_id: 'source-exact', person_id: 'person-exact', match_status: 'auto_matched', match_method: 'external_id' },
      { source_person_id: 'source-create', person_id: 'person-create', match_status: 'auto_matched', match_method: 'external_id' },
      { source_person_id: 'source-update', person_id: 'person-update', match_status: 'auto_matched', match_method: 'external_id' },
    ],
    candidates: [
      exactCandidate('exact', 'person-exact'),
      { ...exactCandidate('update', 'person-update'), vote_count: null },
    ],
    elections: [{
      id: 'election-1',
      external_id: 'election-2022',
      name: '2022年地方公職人員選舉',
      year: 2022,
      election_type: 'local',
    }],
    races: [{
      id: 'race-1',
      external_id: 'race-2022-taipei-1',
      election_id: 'election-1',
      region_id: 'region-taipei',
      race_type: 'city_councilor',
      title: '臺北市第1選舉區議員選舉',
    }],
    regions: [{ id: 'region-taipei', name: '臺北市', region_type: 'city' }],
    electionCanonicalMap: [],
    raceCanonicalMap: [],
  };
}

test('separates exact, safely creatable and safely updatable candidate coverage', () => {
  const report = auditHistoricalCecCandidateCoverage(fixture());
  assert.deepEqual(report.categoryCounts, {
    exact_candidate: 1,
    safe_create_candidate: 1,
    safe_update_candidate: 1,
  });
  assert.equal(report.summary.actionableRows, 2);
  assert.deepEqual(report.safeUpdates[0].mismatchFields, ['vote_count']);
});

test('holds multiple identities and duplicate source assignments for manual review', () => {
  const data = fixture();
  data.sources = [source('source-conflict'), source('source-duplicate-a'), source('source-duplicate-b')];
  data.matches = [
    { source_person_id: 'source-conflict', person_id: 'person-a', match_status: 'auto_matched', match_method: 'method-a' },
    { source_person_id: 'source-conflict', person_id: 'person-b', match_status: 'auto_matched', match_method: 'method-b' },
    { source_person_id: 'source-duplicate-a', person_id: 'person-shared', match_status: 'auto_matched', match_method: 'external_id' },
    { source_person_id: 'source-duplicate-b', person_id: 'person-shared', match_status: 'auto_matched', match_method: 'external_id' },
  ];
  data.candidates = [];

  const report = auditHistoricalCecCandidateCoverage(data);
  assert.equal(report.categoryCounts.identity_conflict, 1);
  assert.equal(report.categoryCounts.duplicate_source_assignment, 2);
  assert.equal(report.summary.manualReviewRows, 3);
});
