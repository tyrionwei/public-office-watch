import assert from 'node:assert/strict';
import test from 'node:test';
import { officialBulletinTextForComparison } from '../src/lib/candidatePlatform.ts';
import type { PublicPersonClaim } from '../src/types/publicViews';

const sourceUrl = 'https://bulletin.cec.gov.tw/example.pdf';
const claim = {
  claim_type: 'platform',
  candidate_id: null,
  claim_value: '這是尚未分項的公報全文。',
  source_url: sourceUrl,
  claim_json: {
    electionContext: { candidateId: 'candidate-1', raceId: 'race-1' },
    sourceDocument: {
      transcriptionStatus: 'reviewed_full_text',
      url: sourceUrl,
      sha256: 'a'.repeat(64),
      page: '2',
    },
  },
} as PublicPersonClaim;

test('reviewed official bulletin survives the anonymous profile RPC with no direct candidacy ID', () => {
  const expected = { text: claim.claim_value, sourceUrl };
  assert.deepEqual(officialBulletinTextForComparison([claim], 'candidate-1', 'race-1'), expected);
  const { candidate_id, ...rawClaim } = claim;
  assert.equal(candidate_id, null);
  assert.deepEqual(officialBulletinTextForComparison([rawClaim as PublicPersonClaim], 'candidate-1', 'race-1'), expected);
  assert.deepEqual(officialBulletinTextForComparison([{ ...claim, candidate_id: 'candidate-1' }], 'candidate-1', 'race-1'), expected);
});

test('does not use a conflicting ID, a different race, an unscoped claim, or mixed versions', () => {
  assert.equal(officialBulletinTextForComparison([{ ...claim, candidate_id: 'candidate-2' }], 'candidate-1', 'race-1'), null);
  assert.equal(officialBulletinTextForComparison([claim], 'candidate-2', 'race-1'), null);
  assert.equal(officialBulletinTextForComparison([claim], 'candidate-1', 'race-2'), null);
  const contextless = { ...claim, candidate_id: 'candidate-1', claim_json: { ...claim.claim_json, electionContext: { raceId: 'race-1' } } };
  assert.equal(officialBulletinTextForComparison([contextless], 'candidate-1', 'race-1'), null);
  assert.equal(officialBulletinTextForComparison([claim, { ...claim, claim_value: '另一版' }], 'candidate-1', 'race-1'), null);
});
