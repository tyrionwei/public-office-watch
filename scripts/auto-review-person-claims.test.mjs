import assert from 'node:assert/strict';
import test from 'node:test';
import { explainEligibility } from './auto-review-person-claims.mjs';

const options = { minScore: 0 };
const emptySet = new Set();
const emptyMap = new Map();

function explain(claim) {
  return explainEligibility(
    {
      person_id: '11111111-1111-4111-8111-111111111111',
      claim_type: 'gender',
      review_score: 80,
      source_name: '中央選舉委員會選舉資料庫',
      claim_json: {},
      ...claim,
    },
    options,
    emptySet,
    emptySet,
    emptySet,
    emptyMap,
  );
}

test('keeps election-scoped platforms in the dedicated content review flow', () => {
  assert.deepEqual(explain({
    claim_type: 'platform',
    candidate_id: '22222222-2222-4222-8222-222222222222',
    source_name: '中央選舉委員會：2022年選舉公報',
  }), {
    eligible: false,
    reason: 'platform-requires-scoped-content-review',
  });
});

test('keeps VoteTW platforms without a candidacy out of generic auto review', () => {
  assert.deepEqual(explain({
    claim_type: 'platform',
    source_name: 'VoteTW',
    claim_json: {
      identityMatch: { status: 'matched' },
      publicationGate: { status: 'passed' },
    },
  }), {
    eligible: false,
    reason: 'platform-requires-scoped-content-review',
  });
});

test('keeps candidate status changes in manual review', () => {
  assert.equal(explain({ claim_type: 'candidacy' }).eligible, false);
});

test('still permits a non-sensitive official basic field', () => {
  assert.deepEqual(explain({ claim_type: 'gender' }), {
    eligible: true,
    reason: 'non-wikidata-non-sensitive',
  });
});
