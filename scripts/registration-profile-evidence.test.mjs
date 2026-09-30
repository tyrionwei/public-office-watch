import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRegistrationProfileProposals } from './lib/registration-profile-evidence.mjs';
import { profileBinding } from './lib/official-profile-policy.mjs';
import { buildPersonEnrichmentClaimRows, preserveReviewedPersonClaimRows } from './sync-real-public-data.mjs';

const sourceUrl = 'https://web.cec.gov.tw/api/file/registration.pdf';
const personId = '00000000-0000-0000-0000-000000000001';
const candidateId = '00000000-0000-0000-0000-000000000002';
function parent(raw, overrides = {}) {
  return {
    id: 'claim-parent-1', claim_key: 'registration:2026:1', claim_type: 'candidacy',
    person_id: personId, candidate_id: candidateId, review_status: 'verified',
    source_url: sourceUrl, source_name: '地方選委會',
    claim_json: { registrationEvidence: {
      name: '測試候選人', source: { url: sourceUrl, name: '地方選委會', page: 2, sha256: 'a'.repeat(64) },
      raw,
    } },
    ...overrides,
  };
}

test('DB parent claim yields private, traceable, deterministic raw proposals', () => {
  const claim = parent({ 出生年月日: '048/09/25', 學歷: '大學肄業；高中畢業' });
  const proposals = buildRegistrationProfileProposals(claim);
  assert.deepEqual(proposals.map((item) => [item.claimType, item.claimValue]), [
    ['birth_date', '1959-09-25'], ['education', '大學肄業；高中畢業'],
  ]);
  assert.deepEqual(buildRegistrationProfileProposals(claim), proposals);
  for (const proposal of proposals) {
    assert.equal(proposal.reviewStatus, 'pending');
    assert.equal(proposal.visibility, 'review_only');
    assert.equal(proposal.isPublic, false);
    assert.equal(proposal.personId, personId);
    assert.equal(proposal.candidateId, candidateId);
    assert.equal(proposal.claimJson.registrationProposal.parentClaimId, claim.id);
    assert.equal(proposal.claimJson.registrationProposal.parentClaimKey, claim.claim_key);
    assert.deepEqual(proposal.claimJson.registrationProposal.registrationEvidence, claim.claim_json.registrationEvidence);
    assert.equal(proposal.sourceUrl, sourceUrl);
  }
  assert.equal(proposals[0].claimJson.registrationProposal.datePrecision, 'day');
  assert.equal(proposals[0].claimJson.registrationProposal.rawValue, '048/09/25');
  assert.equal(proposals.some((item) => item.claimType === 'experience'), false);
});

test('masked ROC and Gregorian dates retain only certain precision', () => {
  const cases = [
    ['052/**/**', '1963', 'year'],
    ['052/07/**', '1963-07', 'month'],
    ['052/07/0*', '1963-07', 'month'],
    ['2026/01/01', '2026-01-01', 'day'],
    ['2026/01', '2026-01', 'month'],
    ['2026', '2026', 'year'],
    ['113年1月1日', '2024-01-01', 'day'],
  ];
  for (const [raw, value, precision] of cases) {
    const [proposal] = buildRegistrationProfileProposals(parent({ 出生年月日: raw }));
    assert.equal(proposal.claimValue, value, raw);
    assert.equal(proposal.claimJson.registrationProposal.datePrecision, precision, raw);
  }
  assert.deepEqual(buildRegistrationProfileProposals(parent({ 出生年月日: '113/02/30' })), []);
  assert.deepEqual(buildRegistrationProfileProposals(parent({ 出生年月日: '**/09/25' })), []);
});

test('unverified source and missing identity do not create adopted profile claims', () => {
  assert.deepEqual(buildRegistrationProfileProposals(parent({ 學歷: '大學' }, { source_url: 'https://example.org', claim_json: {
    registrationEvidence: { raw: { 學歷: '大學' }, source: { url: 'https://example.org' } },
  } })), []);
  const [pending] = buildRegistrationProfileProposals(parent({ 學歷: '大學' }, { review_status: 'pending' }));
  assert.equal(pending.claimJson.registrationProposal.identityStatus, 'pending');
  assert.equal(pending.reviewStatus, 'pending');
  const [isolated] = buildRegistrationProfileProposals(parent({ 學歷: '大學' }), { identityStatus: 'isolated' });
  assert.equal(isolated.claimJson.registrationProposal.identityStatus, 'isolated');
  assert.equal(isolated.isPublic, false);
});

test('common importer keeps parent and adds private proposals without name matching', () => {
  const claim = parent({ 出生年月日: '052/**/**', 學歷: '高中畢業' });
  const seedClaim = {
    id: claim.id, claimKey: claim.claim_key, claimType: claim.claim_type,
    claimJson: claim.claim_json, personId, candidateId,
    personName: '測試候選人', sourceId: 'cec-registration',
    sourceName: claim.source_name, sourceUrl,
    reviewStatus: 'verified', visibility: 'public', confidenceLevel: 'A',
  };
  const people = [{ id: personId, external_id: null, name: '測試候選人' }];
  const rows = buildPersonEnrichmentClaimRows({ personEnrichmentClaims: [seedClaim] }, people, '2026-09-28T00:00:00Z');
  assert.equal(rows.length, 3);
  assert.equal(rows.filter((row) => row.claim_type === 'candidacy').length, 1);
  for (const row of rows.filter((item) => item.claim_json.registrationProposal)) {
    assert.equal(row.person_id, personId);
    assert.equal(row.candidate_id, candidateId);
    assert.equal(row.review_status, 'pending');
    assert.equal(row.visibility, 'private');
    assert.equal(row.is_public, false);
    assert.equal(row.claim_json.officialProfilePolicy.eligible, false);
  }
  const unlinked = buildPersonEnrichmentClaimRows({ personEnrichmentClaims: [{
    ...seedClaim, personId: null,
  }] }, people, '2026-09-28T00:00:00Z');
  assert.equal(unlinked.length, 0);
  const conflicting = buildPersonEnrichmentClaimRows({ personEnrichmentClaims: [{
    ...seedClaim, personExternalId: 'other-person',
  }] }, [people[0], { id: 'other-id', external_id: 'other-person', name: '另一人' }], '2026-09-28T00:00:00Z');
  assert.equal(conflicting.filter((row) => row.claim_json.registrationProposal).length, 0);
});

test('reimport preserves reviewed proposal, candidate, and official marker only for the same binding', () => {
  const claim = parent({ 學歷: '高中畢業' });
  const [proposal] = buildRegistrationProfileProposals(claim);
  const incoming = buildPersonEnrichmentClaimRows({ personEnrichmentClaims: [{
    ...proposal, candidateId: null,
  }] }, [{ id: personId, external_id: null, name: '測試候選人' }], '2026-09-28T00:00:00Z')[0];
  const reviewed = {
    ...incoming, candidate_id: candidateId, review_status: 'verified', visibility: 'public', is_public: true,
    claim_json: {
      ...incoming.claim_json,
      registrationProposal: { ...incoming.claim_json.registrationProposal, contentReviewed: true },
      registrationProfileReview: { version: 'registration-profile-backfill-v1', reason: '原件已核對' },
      officialProfilePolicy: {
        version: 'official-profile-v1', eligible: true, identityVerified: true,
        contentVerified: true, binding: profileBinding(incoming),
      },
    },
  };
  const states = (old) => ({ byClaimKey: new Map([[incoming.claim_key, old]]),
    rejectedWikidataPersonQids: new Map(), byWikidataSemanticKey: new Map() });
  const [retained] = preserveReviewedPersonClaimRows([incoming], states(reviewed));
  assert.equal(retained.review_status, 'verified');
  assert.equal(retained.is_public, true);
  assert.equal(retained.candidate_id, candidateId);
  assert.deepEqual(retained.claim_json.registrationProfileReview, reviewed.claim_json.registrationProfileReview);
  assert.deepEqual(retained.claim_json.registrationProposal, reviewed.claim_json.registrationProposal);
  assert.deepEqual(retained.claim_json.officialProfilePolicy, reviewed.claim_json.officialProfilePolicy);

  const [isolated] = preserveReviewedPersonClaimRows([{
    ...incoming, claim_json: { ...incoming.claim_json, registrationProposal: {
      ...incoming.claim_json.registrationProposal, identityStatus: 'isolated',
    } },
  }], states(reviewed));
  assert.equal(isolated.is_public, false);
  assert.equal(isolated.review_status, 'pending');

  const [otherParent] = preserveReviewedPersonClaimRows([{
    ...incoming, claim_json: { ...incoming.claim_json, registrationProposal: {
      ...incoming.claim_json.registrationProposal, parentClaimId: 'another-parent',
    } },
  }], states(reviewed));
  assert.equal(otherParent.is_public, false);
  assert.equal(otherParent.claim_json.officialProfilePolicy.eligible, false);

  const [otherCandidate] = preserveReviewedPersonClaimRows([{
    ...incoming, candidate_id: 'another-candidate',
  }], states(reviewed));
  assert.equal(otherCandidate.is_public, false);
  assert.equal(otherCandidate.claim_json.officialProfilePolicy.eligible, false);
});
