import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicPersonClaim } from '../src/types/publicViews.ts';
import { isOfficialProfileClaim, officialBirthDateValue, retainOfficialProfileClaims } from '../src/lib/officialProfilePolicy.ts';

const officialPolicy = {
  version: 'official-profile-v1', eligible: true, identityVerified: true, contentVerified: true,
  datePrecision: 'year',
};

function claim(type: PublicPersonClaim['claim_type'], policy: unknown): PublicPersonClaim {
  return {
    claim_id: type, person_id: 'person-1', claim_type: type, claim_value: '1981',
    claim_json: policy ? { officialProfilePolicy: policy } : {},
    confidence_level: 'A', review_score: 100, source_name: '官方網站',
    source_url: 'https://example.test/official', observed_at: null, updated_at: '2026-01-01',
  };
}

test('profile claims require explicit identity and content review, regardless of source label', () => {
  assert.equal(isOfficialProfileClaim(claim('birth_date', officialPolicy)), true);
  assert.equal(isOfficialProfileClaim(claim('education', null)), false);
  assert.equal(isOfficialProfileClaim(claim('experience', { ...officialPolicy, contentVerified: false })), false);
  assert.equal(isOfficialProfileClaim(claim('birth_date', { ...officialPolicy, identityVerified: false })), false);
  assert.equal(isOfficialProfileClaim(claim('birth_date', { ...officialPolicy, eligible: false })), false);
  assert.equal(isOfficialProfileClaim(claim('birth_date', { ...officialPolicy, datePrecision: null })), false);
  assert.deepEqual(retainOfficialProfileClaims([
    claim('birth_date', officialPolicy), claim('education', null), claim('platform', null),
  ]).map((item) => item.claim_type), ['birth_date', 'platform']);
});

test('official partial birth dates keep source precision even if stored text has a fuller date', () => {
  const birth = claim('birth_date', officialPolicy);
  assert.equal(officialBirthDateValue({ ...birth, claim_value: '1981-01-01' }), '1981');
  assert.equal(officialBirthDateValue({ ...birth, claim_value: '1981-07-01', claim_json: {
    officialProfilePolicy: { ...officialPolicy, datePrecision: 'month' },
  } }), '1981-07');
  assert.equal(officialBirthDateValue({ ...birth, claim_value: '1981-01-01', claim_json: {
    officialProfilePolicy: { ...officialPolicy, datePrecision: 'day' },
  } }), '1981-01-01');
});
