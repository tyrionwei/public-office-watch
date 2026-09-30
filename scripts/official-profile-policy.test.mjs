import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptedOfficialProfileClaim,
  datePrecision,
  preserveProfilePolicy,
  profileBinding,
  reviewExistingOfficialClaim,
} from './lib/official-profile-policy.mjs';

function profileClaim(overrides = {}) {
  return {
    person_id: 'person-1', source_person_id: 'source-1', claim_key: 'official-profile:person-1:education',
    claim_type: 'education', claim_value: '官方大學', claim_json: { value: '官方大學', sourcePersonKey: 'source-key' },
    source_url: 'https://web.cec.gov.tw/profile', review_status: 'verified', visibility: 'public', is_public: true,
    ...overrides,
  };
}

function reviewedMarker(row) {
  return { version: 'official-profile-v1', eligible: true, identityVerified: true,
    contentVerified: true, binding: profileBinding(row) };
}

test('incoming payload cannot attest its own official review', () => {
  const row = profileClaim();
  row.claim_json = { ...row.claim_json, officialProfilePolicy: reviewedMarker(row) };
  const result = preserveProfilePolicy(row, null);
  assert.equal(acceptedOfficialProfileClaim(row), true);
  assert.equal(result.review_status, 'pending');
  assert.equal(result.visibility, 'private');
  assert.equal(result.is_public, false);
  assert.equal(result.claim_json.officialProfilePolicy.eligible, false);
  assert.equal(result.claim_json.officialProfilePolicy.reason, 'official_evidence_pending');
});

test('unchanged existing official evidence retains its review and visibility', () => {
  const old = profileClaim();
  old.claim_json = { ...old.claim_json, officialProfilePolicy: reviewedMarker(old) };
  const incoming = profileClaim({ review_status: 'pending', visibility: 'private', is_public: false });
  const result = preserveProfilePolicy(incoming, old);
  assert.equal(result.review_status, 'verified');
  assert.equal(result.visibility, 'public');
  assert.equal(result.is_public, true);
  assert.deepEqual(result.claim_json.officialProfilePolicy, old.claim_json.officialProfilePolicy);
  assert.equal(acceptedOfficialProfileClaim(result), true);
});

test('changed value, person, or source cannot inherit the prior official marker', () => {
  const old = profileClaim();
  old.claim_json = { ...old.claim_json, officialProfilePolicy: reviewedMarker(old) };
  for (const change of [
    { claim_value: '另一學校' },
    { person_id: 'person-2' },
    { source_url: 'https://web.cec.gov.tw/other-profile' },
  ]) {
    const result = preserveProfilePolicy(profileClaim(change), old);
    assert.equal(result.review_status, 'pending');
    assert.equal(result.claim_json.officialProfilePolicy.eligible, false);
    assert.equal(result.is_public, false);
  }
});

test('third-party source is archived by policy without an error finding', () => {
  const result = preserveProfilePolicy(profileClaim({ source_url: 'https://votetw.com/person' }), null);
  assert.equal(result.review_status, 'archived');
  assert.equal(result.visibility, 'private');
  assert.equal(result.claim_json.officialProfilePolicy.reason, 'source_policy_disabled');
  assert.equal(result.claim_json.officialProfilePolicy.notAnErrorFinding, true);
});

test('year, month, and real January 1 remain distinct date precisions', () => {
  assert.equal(datePrecision('1981'), 'year');
  assert.equal(datePrecision('1981-01'), 'month');
  assert.equal(datePrecision('1981-01-01'), 'day');
  assert.equal(datePrecision('1981-02-30'), null);
  const birth = profileClaim({ claim_type: 'birth_date', claim_value: '1981-01-01', claim_json: {} });
  birth.claim_json.officialProfilePolicy = { ...reviewedMarker(birth), datePrecision: 'day' };
  assert.equal(acceptedOfficialProfileClaim(birth), true);
  birth.claim_json.officialProfilePolicy.datePrecision = 'year';
  assert.equal(acceptedOfficialProfileClaim(birth), false);
});

test('existing official review requires matching source field and a passed publication gate', () => {
  const claim = profileClaim();
  const context = {
    people: new Map([['person-1', { name: '同名' }]]),
    sources: new Map([['source-1', {
      source_person_key: 'source-key', source_url: 'https://web.cec.gov.tw/profile',
      raw_name: '同名', external_person_id: 'cec-person-1', source_payload: { education: '官方大學' },
    }]]),
  };
  assert.equal(reviewExistingOfficialClaim(claim, context).eligible, true);
  assert.equal(reviewExistingOfficialClaim(claim, context).evidenceMethod, 'reviewed_official_source_field');
  assert.equal(reviewExistingOfficialClaim(profileClaim({ claim_value: '其他學校', claim_json: {
    value: '其他學校', sourcePersonKey: 'source-key',
  } }), context).eligible, false);
  assert.equal(reviewExistingOfficialClaim(profileClaim({ claim_json: {
    value: '官方大學', sourcePersonKey: 'source-key', publicationGate: { status: 'pending' },
  } }), context).reason, 'official_content_review_pending');
  assert.equal(reviewExistingOfficialClaim(profileClaim({ review_status: 'pending' }), context).eligible, false);
});
