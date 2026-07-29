import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPartyCandidateReviewWrite,
  parsePartyCandidateReviewSource,
} from '../build/internalPartyCandidateReview.ts';

const source = {
  source_person_key: 'party-candidate:pfp-2026-example',
  party: '親民黨',
  source_name: '親民黨 2026 選舉專區',
  source_url: 'https://youth.pfpnext.com/2026/',
  source_payload: {
    sourceCandidateKey: 'pfp-2026-example',
    candidacyStatus: 'party_nominee',
    targetRace: { id: 'race-1' },
  },
};

test('builds a private candidate write for an approved party candidate identity', () => {
  const write = buildPartyCandidateReviewWrite(source, 'person-1', '2026-07-29T13:00:00.000Z');

  assert.equal(write?.candidate.external_id, 'party-candidate:pfp-2026-example');
  assert.equal(write?.candidate.person_id, 'person-1');
  assert.equal(write?.candidate.race_id, 'race-1');
  assert.equal(write?.candidate.candidacy_status, 'party_nominee');
  assert.equal(write?.candidate.is_public, false);
  assert.equal(write?.claimPatch.visibility, 'review_only');
  assert.equal(write?.claimPatch.is_public, false);
  assert.equal(write?.sourcePatch.is_public, false);
});

test('leaves non-party review sources on the existing review path', () => {
  assert.equal(parsePartyCandidateReviewSource({ ...source, source_person_key: 'wikidata:Q1' }), null);
});

test('rejects incomplete party candidate payloads', () => {
  assert.throws(
    () => parsePartyCandidateReviewSource({ ...source, source_payload: {} }),
    /incomplete or unsupported/,
  );
});
