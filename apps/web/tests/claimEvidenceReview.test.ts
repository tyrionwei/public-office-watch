import assert from 'node:assert/strict';
import test from 'node:test';
import { latestClaimEvidenceReview } from '../src/lib/claimEvidenceReview.ts';
import { claimReviewStatusFilters } from '../build/internalClaimReview.ts';

test('ready recommendations are filtered before the queue limit and stay unapproved', () => {
  assert.deepEqual(claimReviewStatusFilters('ready_for_publication'), {
    review_status: 'in.(pending,needs_more_evidence)',
    'claim_json->evidenceReviews->-1->>route': 'eq.ready_for_publication',
    order: 'updated_at.desc',
  });
  assert.deepEqual(claimReviewStatusFilters('pending'), { review_status: 'eq.pending' });
  assert.deepEqual(claimReviewStatusFilters('needs_more_evidence'), { review_status: 'eq.needs_more_evidence' });
  assert.deepEqual(claimReviewStatusFilters(''), {});
  assert.equal(claimReviewStatusFilters('approved'), null);
});

test('latest evidence supersedes an older ready recommendation', () => {
  const claim = { evidenceReviews: [
    { route: 'ready_for_publication', reason: '舊建議' },
    { route: 'waiting_evidence', reason: '有新衝突' },
  ] };
  assert.equal(latestClaimEvidenceReview(claim)?.route, 'waiting_evidence');
  assert.equal(latestClaimEvidenceReview(claim)?.reason, '有新衝突');
  assert.equal(latestClaimEvidenceReview({ evidenceReviews: [claim.evidenceReviews[0], null] }), null);
});

test('ready evidence preserves reason and safe source links without changing the claim', () => {
  const claim = { evidenceReviews: [{
    route: 'ready_for_publication', reason: '官方資料佐證', confidence: 'high',
    sources: [
      { url: 'https://example.gov.tw/evidence', publisher: '官方來源' },
      { url: 'javascript:alert(1)' },
      { url: 'https://user:password@example.org' },
      { url: 'bad url' },
    ],
  }] };
  const before = structuredClone(claim);
  const result = latestClaimEvidenceReview(claim);
  assert.equal(result?.route, 'ready_for_publication');
  assert.equal(result?.confidence, 'high');
  assert.deepEqual(result?.sources, [{ url: 'https://example.gov.tw/evidence', publisher: '官方來源' }]);
  assert.deepEqual(claim, before);
  assert.equal(latestClaimEvidenceReview(undefined), null);
  assert.equal(latestClaimEvidenceReview({ evidenceReviews: [] }), null);
});
