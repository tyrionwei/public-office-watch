import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStagingRows, assertLocalSupabase, validateReviewFile } from './official-candidate-review.mjs';

function fixture() {
  const snapshot = {
    electionYear: 2026,
    candidacyStatus: 'registered',
    source: {
      name: '中央選舉委員會',
      url: 'https://web.cec.gov.tw/example',
      publishedAt: '2026-09-01',
    },
  };
  const record = {
    candidateExternalId: 'cec-candidate-1',
    personExternalId: 'cec-person-1',
    personName: '測試人物',
    party: '測試政黨',
    candidateNo: null,
    candidateNoProvided: false,
    isIncumbent: false,
  };
  const item = {
    record,
    race: { id: 'race-1', external_id: 'cec-race-1', title: '測試選舉' },
    person: null,
    candidate: null,
    identityCandidates: [{ id: 'person-1', name: '測試人物' }],
    raceCandidates: [],
  };
  return { snapshot, plan: { matched: [item], blocking: [] }, item };
}

test('stages official records as private review data', () => {
  const { snapshot, plan } = fixture();
  const staging = buildStagingRows(snapshot, plan, '2026-09-01T12:00:00Z');
  assert.equal(staging.sourcePeople[0].source_type, 'official_election');
  assert.equal(staging.sourcePeople[0].is_public, false);
  assert.equal(staging.claims[0].visibility, 'review_only');
  assert.equal(staging.claims[0].is_public, false);
});

test('allows reviewed exact-name matches and rejects arbitrary person IDs', () => {
  const { snapshot, plan } = fixture();
  const review = {
    schemaVersion: 1,
    reviewedBy: 'tester',
    decisions: [{
      candidateExternalId: 'cec-candidate-1',
      personName: '測試人物',
      decision: 'use_existing',
      personId: 'person-1',
      reviewedAt: '2026-09-02T00:00:00Z',
    }],
  };
  assert.equal(validateReviewFile(review, snapshot, plan).decisions[0].personId, 'person-1');
  assert.throws(() => validateReviewFile({
    ...review,
    decisions: [{ ...review.decisions[0], personId: 'someone-else' }],
  }, snapshot, plan), /not an exact-name or external-ID candidate/);
});

test('rejects review writes outside local Supabase', () => {
  assert.doesNotThrow(() => assertLocalSupabase({ supabaseUrl: 'http://127.0.0.1:54321' }));
  assert.throws(
    () => assertLocalSupabase({ supabaseUrl: 'https://example.supabase.co' }),
    /local-only/,
  );
});
