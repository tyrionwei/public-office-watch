import assert from 'node:assert/strict';
import test from 'node:test';
import { profileBinding } from './lib/official-profile-policy.mjs';
import { adoptedProfilePeople, eligibleReleaseClaim } from './build-production-profile-finance-release.mjs';
import { buildPublicDeltaMigration } from './build-production-release-snapshots.mjs';

function claim(overrides = {}) {
  const row = {
    person_id: 'person-local', claim_type: 'education', claim_value: '官方大學',
    review_status: 'verified', visibility: 'public', is_public: true,
    source_url: 'https://web.cec.gov.tw/profile', claim_json: {}, ...overrides,
  };
  row.claim_json = { ...row.claim_json, officialProfilePolicy: {
    version: 'official-profile-v1', eligible: true, identityVerified: true,
    contentVerified: true, binding: profileBinding(row),
    ...row.claim_json?.officialProfilePolicy,
  } };
  return row;
}

test('release permits only verified, bound official profile claims and retains other public claim types', () => {
  const official = claim();
  assert.equal(eligibleReleaseClaim(official), true);
  assert.equal(eligibleReleaseClaim(claim({ review_status: 'pending' })), false);
  assert.equal(eligibleReleaseClaim(claim({ visibility: 'private' })), false);
  assert.equal(eligibleReleaseClaim(claim({ source_url: 'https://votetw.com/person' })), false);
  assert.equal(eligibleReleaseClaim(claim({ claim_json: { officialProfilePolicy: { binding: 'wrong' } } })), false);
  assert.equal(eligibleReleaseClaim({ ...official, claim_type: 'platform', claim_json: {} }), true);
});

test('release rebuilds education and experience from accepted official claims only', () => {
  const people = [{ id: 'person-local', education: '第三方學校', experience: '第三方職涯' },
    { id: 'person-other', education: '未核對學校', experience: '未核對職涯' }];
  const result = adoptedProfilePeople(people, [
    claim(),
    claim({ claim_type: 'experience', claim_value: '官方經歷' }),
    claim({ claim_value: '第三方學校', source_url: 'https://votetw.com/person' }),
  ]);
  assert.deepEqual(result, [
    { id: 'person-local', education: '官方大學', experience: '官方經歷' },
    { id: 'person-other', education: null, experience: null },
  ]);
  assert.equal(people[0].education, '第三方學校');
});

test('delta SQL preserves full profile metadata and rebinds approved claims after person mapping', () => {
  const official = claim();
  const sql = buildPublicDeltaMigration({ people: [], candidates: [], claims: [official],
    candidatePersonKeys: [], candidateRaces: [] });
  assert.match(sql, /"officialProfilePolicy"/u);
  assert.match(sql, /"contentVerified":true/u);
  assert.match(sql, /_delta_claims\) <> 1/u);
  assert.match(sql, /SET claim_json = jsonb_set\(incoming.claim_json/u);
});
