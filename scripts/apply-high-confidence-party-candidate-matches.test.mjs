import assert from 'node:assert/strict';
import test from 'node:test';
import {
  highConfidenceCandidate,
  planHighConfidenceMatches,
} from './apply-high-confidence-party-candidate-matches.mjs';

function source(overrides = {}) {
  return {
    id: 'source-1',
    source_person_key: 'party-candidate:party-2026-001',
    raw_name: '王小明',
    party: '測試黨',
    source_name: '官方候選人頁',
    source_url: 'https://example.org/candidate',
    source_payload: {
      sourceCandidateKey: 'party-2026-001',
      candidacyStatus: 'party_nominee',
      targetRace: { id: 'race-1' },
      identitySuggestion: {
        resolution: 'high_confidence_match',
        selectedCanonicalPersonId: 'person-1',
        canonicalCandidates: [{
          canonicalPersonId: 'person-1',
          evidence: ['party', 'geography'],
        }],
      },
    },
    ...overrides,
  };
}

test('accepts only a unique high-confidence party and geography match', () => {
  assert.deepEqual(highConfidenceCandidate(source()), {
    status: 'eligible',
    sourceCandidateKey: 'party-2026-001',
    personId: 'person-1',
    raceId: 'race-1',
  });
  assert.equal(highConfidenceCandidate(source({
    source_payload: {
      ...source().source_payload,
      identitySuggestion: { resolution: 'probable_match' },
    },
  })).status, 'skip');
});

test('blocks a high-confidence label without both required evidence signals', () => {
  const invalid = source();
  invalid.source_payload.identitySuggestion.canonicalCandidates[0].evidence = ['party'];
  const result = highConfidenceCandidate(invalid);
  assert.equal(result.status, 'blocked');
  assert.match(result.errors.join(' '), /party and geography/);
});

test('plans unmatched A-grade sources and preserves already confirmed identities', () => {
  const first = source();
  const second = source({
    id: 'source-2',
    source_person_key: 'party-candidate:party-2026-002',
    source_payload: {
      ...source().source_payload,
      sourceCandidateKey: 'party-2026-002',
    },
  });
  const plan = planHighConfidenceMatches({
    sources: [first, second],
    matches: [{ source_person_id: 'source-2', person_id: 'person-1', match_status: 'auto_matched' }],
    claims: [{ id: 'claim-1', source_person_id: 'source-1' }],
    candidates: [],
  });

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.eligible.length, 1);
  assert.equal(plan.eligible[0].source.id, 'source-1');
  assert.equal(plan.alreadyConfirmed.length, 1);
});

test('blocks an existing candidate linked to a different person', () => {
  const plan = planHighConfidenceMatches({
    sources: [source()],
    matches: [],
    claims: [{ id: 'claim-1', source_person_id: 'source-1' }],
    candidates: [{ external_id: 'party-candidate:party-2026-001', person_id: 'person-2', race_id: 'race-1' }],
  });

  assert.equal(plan.eligible.length, 0);
  assert.equal(plan.blocking.length, 1);
  assert.match(plan.blocking[0].errors.join(' '), /conflicts/);
});
