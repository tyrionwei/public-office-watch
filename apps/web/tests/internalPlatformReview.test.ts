import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlatformApprovalPatch } from '../build/internalPlatformReview.ts';

function claim(overrides: Record<string, unknown> = {}) {
  return {
    candidate_id: '11111111-1111-4111-8111-111111111111',
    claim_type: 'platform',
    claim_value: '既有政見文字',
    claim_json: {
      electionContext: { candidateId: '11111111-1111-4111-8111-111111111111' },
      publicationGate: { status: 'pending_manual_transcription' },
    },
    source_name: '中央選舉委員會：2022年選舉公報',
    source_url: 'https://eebulletin.cec.gov.tw/111/source.pdf',
    scoring_reasons: [],
    ...overrides,
  };
}

test('rejects a platform without an exact candidacy', () => {
  assert.throws(() => buildPlatformApprovalPatch(claim({ candidate_id: null }), undefined, '2026-08-13T00:00:00Z'), /參選紀錄/u);
});

test('rejects a staged platform without the bound CEC source', () => {
  assert.throws(() => buildPlatformApprovalPatch(claim({ source_url: 'https://example.com/source' }), '政見', '2026-08-13T00:00:00Z'), /官方來源/u);
});

test('publishes substantive CEC OCR text without requiring typo correction', () => {
  const patch = buildPlatformApprovalPatch(claim({
    claim_json: {
      electionContext: { candidateId: '11111111-1111-4111-8111-111111111111' },
      publicationGate: { status: 'pending_manual_transcription' },
      transcriptionCandidates: { bestOcrText: '推動公共托育並改善地方交通建設' },
    },
  }), undefined, '2026-08-13T00:00:00Z');

  assert.equal(patch.claim_value, '推動公共托育並改善地方交通建設');
});

test('publishes a current CEC bulletin platform for an exact 2024 candidacy', () => {
  const patch = buildPlatformApprovalPatch(claim({
    source_name: '中央選舉委員會：2024年選舉公報',
    source_url: 'https://bulletin.cec.gov.tw/113/source.pdf',
    claim_json: {
      electionContext: { candidateId: '11111111-1111-4111-8111-111111111111' },
      transcriptionCandidates: { bestOcrText: '推動公共托育並改善地方交通建設' },
    },
  }), undefined, '2026-08-15T00:00:00Z');

  assert.equal(patch.claim_value, '推動公共托育並改善地方交通建設');
  assert.equal(patch.is_public, true);
});

test('does not trust a non-CEC host with a CEC-looking source name', () => {
  assert.throws(() => buildPlatformApprovalPatch(claim({
    source_name: '中央選舉委員會：2024年選舉公報',
    source_url: 'https://example.com/113/source.pdf',
  }), '政見文字足以公開', '2026-08-15T00:00:00Z'), /官方來源/u);
});

test('keeps unusable CEC OCR text in review', () => {
  assert.throws(() => buildPlatformApprovalPatch(claim({
    claim_json: {
      electionContext: { candidateId: '11111111-1111-4111-8111-111111111111' },
      transcriptionCandidates: { bestOcrText: '政 見' },
    },
  }), undefined, '2026-08-13T00:00:00Z'), /辨識文字不足/u);
});

test('publishes an official council platform after candidacy matching', () => {
  const patch = buildPlatformApprovalPatch(claim({
    claim_value: '改善地方交通並增加公共托育服務',
    source_name: '臺南市議會：現任議員',
    source_url: 'https://www.tncc.gov.tw/page.asp?id=1',
  }), undefined, '2026-08-13T00:00:00Z');

  assert.equal(patch.claim_value, '改善地方交通並增加公共托育服務');
  assert.equal(patch.is_public, true);
});

test('publishes the reviewed transcription without exposing OCR candidates', () => {
  const patch = buildPlatformApprovalPatch(claim({
    claim_json: {
      electionContext: { candidateId: '11111111-1111-4111-8111-111111111111' },
      publicationGate: { status: 'pending_manual_transcription' },
      transcriptionCandidates: { ocrText: '錯字候選文字' },
    },
  }), '  第一項\n第二項  ', '2026-08-13T00:00:00Z');

  assert.equal(patch.claim_value, '第一項\n第二項');
  assert.equal(patch.claim_json.platformText, '第一項\n第二項');
  assert.equal(patch.claim_json.publicationGate.status, 'passed');
  assert.equal(patch.claim_json.transcriptionCandidates, undefined);
  assert.equal(patch.review_status, 'verified');
  assert.equal(patch.visibility, 'public');
  assert.equal(patch.is_public, true);
});
