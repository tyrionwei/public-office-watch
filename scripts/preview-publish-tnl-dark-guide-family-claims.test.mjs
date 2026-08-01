import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFamilyReleasePreview } from './preview-publish-tnl-dark-guide-family-claims.mjs';

function claim(overrides = {}) {
  return {
    id: 'claim-1',
    claim_key: 'research:tnl-dark-guide-family:example',
    person_id: 'person-1',
    claim_type: 'family_relation',
    claim_value: '父親：人物乙',
    claim_json: {
      relationType: 'father',
      relationLabel: '父親',
      relativePersonId: 'person-2',
      relativeName: '人物乙',
    },
    confidence_level: 'A',
    review_score: 100,
    review_status: 'verified',
    visibility: 'review_only',
    is_public: false,
    source_name: '官方來源',
    source_url: 'https://official.example/family',
    ...overrides,
  };
}

const people = [
  { id: 'person-1', name: '人物甲', is_public: true },
  { id: 'person-2', name: '人物乙', is_public: true },
];

test('previews one verified claim without writing or publishing it', () => {
  const preview = buildFamilyReleasePreview({ claims: [claim()], people, publicFamilyClaims: [] });

  assert.equal(preview.policy.databaseWrites, false);
  assert.equal(preview.summary.eligibleClaims, 1);
  assert.equal(preview.summary.blockedClaims, 0);
  assert.equal(preview.eligibleClaims[0].claimValue, '父親：人物乙');
  assert.deepEqual(preview.eligibleClaims[0].publicationUpdate, { visibility: 'public', is_public: true });
});

test('keeps A and B counts while enforcing the person-page threshold', () => {
  const preview = buildFamilyReleasePreview({
    claims: [
      claim(),
      claim({
        id: 'claim-2',
        claim_key: 'research:tnl-dark-guide-family:second',
        confidence_level: 'B',
        review_score: 85,
      }),
    ],
    people,
    publicFamilyClaims: [],
  });

  assert.equal(preview.summary.confidenceA, 1);
  assert.equal(preview.summary.confidenceB, 1);
  assert.equal(preview.summary.maxClaimsPerPerson, 2);
});

test('blocks private people, display drift, unsafe URLs and public duplicates', () => {
  const privatePeople = [{ ...people[0], is_public: false }, people[1]];
  assert.equal(buildFamilyReleasePreview({
    claims: [claim()], people: privatePeople, publicFamilyClaims: [],
  }).blockedClaims[0].reason, 'primary_person_not_public');

  assert.equal(buildFamilyReleasePreview({
    claims: [claim({ claim_value: '父親：另一人' })], people, publicFamilyClaims: [],
  }).blockedClaims[0].reason, 'display_value_mismatch');

  assert.equal(buildFamilyReleasePreview({
    claims: [claim({ source_url: 'http://unsafe.example/family' })], people, publicFamilyClaims: [],
  }).blockedClaims[0].reason, 'source_url_missing_or_not_https');

  assert.equal(buildFamilyReleasePreview({
    claims: [claim()], people, publicFamilyClaims: [{ ...claim(), visibility: 'public', is_public: true }],
  }).blockedClaims[0].reason, 'already_public_duplicate');
});
