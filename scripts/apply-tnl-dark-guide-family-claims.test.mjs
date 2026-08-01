import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReviewedFamilyClaimRows,
  summarizeReviewedFamilyClaimRows,
} from './apply-tnl-dark-guide-family-claims.mjs';

function plannedClaim(overrides = {}) {
  return {
    claimKey: 'research:tnl-dark-guide-family:example',
    personId: 'person-primary',
    claimType: 'family_relation',
    claimValue: '父親：人物乙',
    claimJson: {
      relativePersonId: 'person-relative',
      publicationGate: { status: 'preview_only', requiresHumanApproval: true },
    },
    confidenceLevel: 'A',
    sourceName: '官方來源',
    sourceUrl: 'https://official.example/family',
    ...overrides,
  };
}

test('converts approved preview claims into verified but unpublished rows', () => {
  const reviewedAt = '2026-08-01T00:00:00.000Z';
  const [row] = buildReviewedFamilyClaimRows({ plannedClaims: [plannedClaim()] }, reviewedAt);

  assert.equal(row.review_status, 'verified');
  assert.equal(row.visibility, 'review_only');
  assert.equal(row.is_public, false);
  assert.equal(row.confidence_level, 'A');
  assert.equal(row.review_score, 100);
  assert.equal(row.claim_json.publicationGate.status, 'verified_not_published');
  assert.equal(row.claim_json.verificationPolicy.publicationStillRequired, true);
});

test('caps trusted media claims at B while keeping them verified', () => {
  const [row] = buildReviewedFamilyClaimRows({
    plannedClaims: [plannedClaim({
      confidenceLevel: 'B',
      sourceName: '可信媒體',
      sourceUrl: 'https://news.example/family',
    })],
  }, '2026-08-01T00:00:00.000Z');

  assert.equal(row.confidence_level, 'B');
  assert.equal(row.review_score, 85);
  assert.match(row.scoring_reasons[0].reason, /trusted/u);
});

test('rejects unsupported confidence levels and duplicate claim keys', () => {
  assert.throws(() => buildReviewedFamilyClaimRows({
    plannedClaims: [plannedClaim({ confidenceLevel: 'C' })],
  }, '2026-08-01T00:00:00.000Z'), /Unexpected confidence/u);

  assert.throws(() => buildReviewedFamilyClaimRows({
    plannedClaims: [plannedClaim(), plannedClaim()],
  }, '2026-08-01T00:00:00.000Z'), /duplicate claim keys/u);
});

test('summarizes the A and B boundary separately from publication', () => {
  const rows = buildReviewedFamilyClaimRows({
    plannedClaims: [
      plannedClaim(),
      plannedClaim({
        claimKey: 'research:tnl-dark-guide-family:second',
        confidenceLevel: 'B',
      }),
    ],
  }, '2026-08-01T00:00:00.000Z');

  assert.deepEqual(summarizeReviewedFamilyClaimRows(rows), {
    total: 2,
    confidenceA: 1,
    confidenceB: 1,
    verified: 2,
    reviewOnly: 2,
    public: 0,
  });
});
