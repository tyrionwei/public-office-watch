import assert from 'node:assert/strict';
import test from 'node:test';
import { sensitivePublicClaims } from '../src/lib/sensitivePublicClaims.ts';
import type { PublicPersonClaim } from '../src/types/publicViews.ts';
const policy = { version: 'family-publication-v1', decision: 'explicit_user_approved', eligible: true };
const claim = (overrides = {}) => ({ claim_type: 'family_relation', claim_value: '子女：已核准人物', confidence_level: 'C', review_score: 10, claim_json: {}, ...overrides }) as PublicPersonClaim;
test('explicitly approved public family retains text, evidence grade and original score', () => {
  const row = claim({claim_json: {familyPublicationPolicy: policy}});
  assert.deepEqual(sensitivePublicClaims([row]), [row]);
  assert.equal(row.confidence_level, 'C'); assert.equal(row.review_score, 10);
});
test('absent, malformed, denied or unrelated approval cannot bypass sensitive threshold', () => {
  for (const value of [null, [], 'approved', {}, {...policy, eligible: 'true'}, {...policy, eligible: false}, {...policy, decision: 'automatic'}, {...policy, version: 'unknown'}]) {
    assert.deepEqual(sensitivePublicClaims([claim({claim_json: {familyPublicationPolicy: value}})]), []);
  }
  assert.deepEqual(sensitivePublicClaims([claim({claim_type: 'legal_case', claim_json: {familyPublicationPolicy: policy}})]), []);
});
test('existing A/B threshold remains unchanged with empty JSON', () => {
  const row=claim({review_score:70,confidence_level:'B'});
  assert.deepEqual(sensitivePublicClaims([row,claim(),claim({review_score:100})]),[row]);
});
