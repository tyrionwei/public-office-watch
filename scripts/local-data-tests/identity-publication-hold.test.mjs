import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identityPublicationHoldsFromClaims,
  preserveIdentityHeldPeople,
  preserveIdentityHeldAffiliations,
  writeSeed,
} from '../sync-real-public-data.mjs';

const marker = {
  person_id: 'old-person', review_status: 'pending', visibility: 'review_only', is_public: false,
  claim_json: {
    sourcePersonKey: 'cec-historical:old-source',
    identityAudit: {
      status: 'pending', personPublicationHold: true,
      personExternalId: 'old-external', sourcePersonKey: 'cec-historical:old-source',
    },
  },
};
const people = [
  { external_id: 'old-external', name: '同名', is_public: true },
  { external_id: 'current-external', name: '同名', is_public: true },
];
const affiliations = [
  { person_id: 'old-person', source_payload: { sourcePersonKey: 'cec-historical:old-source' }, review_status: 'verified', is_public: true },
  { person_id: 'current-person', source_payload: { sourcePersonKey: 'cec-historical:old-source' }, review_status: 'verified', is_public: true },
  { person_id: 'old-person', source_payload: { sourcePersonKey: 'current-source' }, review_status: 'verified', is_public: true },
];

test('explicit reviewed marker preserves the exact old person and source affiliation as nonpublic', () => {
  const holds = identityPublicationHoldsFromClaims([marker, structuredClone(marker)]);
  const heldPeople = preserveIdentityHeldPeople(people, holds);
  const heldAffiliations = preserveIdentityHeldAffiliations(affiliations, holds);
  assert.equal(heldPeople[0].is_public, false);
  assert.deepEqual(heldPeople[1], people[1]);
  assert.equal(heldAffiliations[0].review_status, 'pending');
  assert.equal(heldAffiliations[0].is_public, false);
  assert.deepEqual(heldAffiliations.slice(1), affiliations.slice(1));
  assert.equal(people[0].is_public, true);
  assert.equal(affiliations[0].review_status, 'verified');
});

test('ordinary pending, research-only, malformed and nonprivate markers do not withdraw anyone', () => {
  const audits = [
    { status: 'pending' },
    { ...marker.claim_json.identityAudit, personPublicationHold: 'true' },
    { ...marker.claim_json.identityAudit, personPublicationHold: false },
    { ...marker.claim_json.identityAudit, sourcePersonKey: 'different-source' },
    { ...marker.claim_json.identityAudit, personExternalId: '' },
  ];
  const claims = audits.map((identityAudit) => ({ ...marker, claim_json: { ...marker.claim_json, identityAudit } }));
  claims.push({ ...marker, is_public: true }, { ...marker, review_status: 'verified' }, { ...marker, visibility: 'public' });
  assert.deepEqual(identityPublicationHoldsFromClaims(claims), []);
  assert.deepEqual(preserveIdentityHeldPeople(people, []), people);
  assert.deepEqual(preserveIdentityHeldAffiliations(affiliations, []), affiliations);
});

test('removing or releasing the marker restores normal import behavior without a persistent local denylist', () => {
  for (const claims of [[], [{ ...marker, claim_json: { ...marker.claim_json, identityAudit: { ...marker.claim_json.identityAudit, status: 'released' } } }]]) {
    const holds = identityPublicationHoldsFromClaims(claims);
    assert.deepEqual(holds, []);
    assert.deepEqual(preserveIdentityHeldPeople(people, holds), people);
    assert.deepEqual(preserveIdentityHeldAffiliations(affiliations, holds), affiliations);
  }
});

test('writeSeed fails closed before any write if the private marker lookup fails', async (t) => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'http://identity-hold.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: new URL(url), method: options.method });
    return new Response(JSON.stringify({ message: 'synthetic marker read failure' }), { status: 403 });
  });
  await assert.rejects(writeSeed({ people: [], candidates: [], sourcePeople: [] }, 'test-hash', {}), /synthetic marker read failure/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].url.pathname, '/rest/v1/person_claims');
  assert.equal(calls[0].url.searchParams.get('claim_json->identityAudit->>personPublicationHold'), 'eq.true');
});
