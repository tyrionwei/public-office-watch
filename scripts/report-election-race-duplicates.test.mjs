import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDecisionState, candidateIdentityKey, confidenceForRacePair, electionRelationSuggestion, isSuppressedByDecision, normalizeCandidateNumber, raceRegionCompatibility, semanticRaceType } from './report-election-race-duplicates.mjs';

test('normalizes candidate numbers and keeps different numbers separate', () => {
  assert.equal(normalizeCandidateNumber('01'), '1');
  const people = new Map([['p1', { name: 'Alice' }]]);
  const first = candidateIdentityKey({ person_id: 'p1', party: 'Independent', candidate_no: '1' }, people);
  const second = candidateIdentityKey({ person_id: 'p1', party: 'Independent', candidate_no: '2' }, people);
  assert.notEqual(first, second);
});

test('suppresses decided pairs and active duplicate records', () => {
  const state = buildDecisionState([
    { duplicate_election_id: 'child', canonical_election_id: 'parent', status: 'verified' },
    { duplicate_election_id: 'left', canonical_election_id: 'right', status: 'rejected' },
  ], 'duplicate_election_id', 'canonical_election_id');
  assert.equal(isSuppressedByDecision('parent', 'child', state), true);
  assert.equal(isSuppressedByDecision('child', 'third', state), true);
  assert.equal(isSuppressedByDecision('right', 'left', state), true);
  assert.equal(isSuppressedByDecision('parent', 'third', state), false);
});

test('classifies aggregate local elections separately from exact duplicates', () => {
  assert.equal(electionRelationSuggestion({ semanticType: 'local', candidateOverlap: { smallerRate: 1 }, left: { electionType: 'local', candidateCount: 1766, raceCount: 236 }, right: { electionType: 'councilor', candidateCount: 132, raceCount: 17 } }), 'aggregate_source_link');
  assert.equal(electionRelationSuggestion({ semanticType: 'local', candidateOverlap: { smallerRate: 1 }, left: { electionType: 'local', candidateCount: 59, raceCount: 15 }, right: { electionType: 'local_chief', candidateCount: 59, raceCount: 15 } }), 'same_election');
});

test('keeps subcounty chiefs separate from county and city chiefs', () => {
  assert.equal(semanticRaceType('county_mayor'), 'local_chief');
  assert.equal(semanticRaceType('municipality_mayor'), 'local_chief');
  assert.equal(semanticRaceType('township_mayor'), 'township_mayor');
});

test('requires matching region context for automatic race confidence', () => {
  assert.equal(raceRegionCompatibility({ region_id: 'r1' }, { region_id: 'r2' }, true), 'different_region');
  const candidateOverlap = { count: 1, smallerRate: 1 };
  assert.equal(confidenceForRacePair({ candidateOverlap, regionCompatibility: 'unknown' }), 'manual');
  assert.equal(confidenceForRacePair({ candidateOverlap, regionCompatibility: 'same_region' }), 'auto');
});
