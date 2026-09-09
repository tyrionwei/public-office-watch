import assert from 'node:assert/strict';
import test from 'node:test';
import { approveClaim, approveClaimBatch, explainEligibility } from './auto-review-person-claims.mjs';

const options = { minScore: 0 };
const emptySet = new Set();
const emptyMap = new Map();

function explain(claim) {
  return explainEligibility(
    {
      person_id: '11111111-1111-4111-8111-111111111111',
      claim_type: 'gender',
      review_score: 80,
      source_name: '中央選舉委員會選舉資料庫',
      claim_json: {},
      ...claim,
    },
    options,
    emptySet,
    emptySet,
    emptySet,
    emptyMap,
  );
}

test('keeps election-scoped platforms in the dedicated content review flow', () => {
  assert.deepEqual(explain({
    claim_type: 'platform',
    candidate_id: '22222222-2222-4222-8222-222222222222',
    source_name: '中央選舉委員會：2022年選舉公報',
  }), {
    eligible: false,
    reason: 'platform-requires-scoped-content-review',
  });
});

test('keeps VoteTW platforms without a candidacy out of generic auto review', () => {
  assert.deepEqual(explain({
    claim_type: 'platform',
    source_name: 'VoteTW',
    claim_json: {
      identityMatch: { status: 'matched' },
      publicationGate: { status: 'passed' },
    },
  }), {
    eligible: false,
    reason: 'platform-requires-scoped-content-review',
  });
});

test('keeps candidate status changes in manual review', () => {
  assert.equal(explain({ claim_type: 'candidacy' }).eligible, false);
});

test('still permits a non-sensitive official basic field', () => {
  assert.deepEqual(explain({ claim_type: 'gender' }), {
    eligible: true,
    reason: 'non-wikidata-non-sensitive',
  });
});

function snapshot(overrides = {}) {
  return { id: '11111111-1111-4111-8111-111111111111', claim_key: 'fixture-claim',
    person_id: '22222222-2222-4222-8222-222222222222', source_person_id: null, candidate_id: null,
    claim_type: 'education', claim_value: 'Synthetic school', claim_json: {}, confidence_level: 'A', review_score: 100,
    review_status: 'pending', visibility: 'review_only', is_public: false, source_name: 'Official fixture', source_url: 'https://example.invalid',
    scoring_version: null, scoring_reasons: [], updated_at: '2026-09-09T00:00:00+00:00', ...overrides };
}
const applied = { outcome: 'applied', updated_claims: 1, updated_affiliations: 0 };
const conflict = { outcome: 'conflict', updated_claims: 0, updated_affiliations: 0 };
const urlFor = value => new URL('https://fixture.invalid/rest/v1/' + value);

test('auto review submits an exact snapshot in one atomic call and counts actual updates', async () => {
  const calls = [];
  const requestJson = async (url, init) => { calls.push({ url, init }); return applied; };
  assert.deepEqual(await approveClaim(snapshot(), { urlFor, requestJson }), applied);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/auto_approve_person_claim');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_expected_claim: snapshot(), p_expected_affiliations: [] });
  assert.deepEqual(await approveClaimBatch([1, 2, 3], async id => id === 2 ? applied : conflict), { updated: 1, conflicts: 2 });
});

test('party auto review reads the exact affiliation snapshot and never falls back to two PATCHes', async () => {
  const calls = [];
  const affiliations = [{ id: 'fixture-affiliation', source_claim_key: 'fixture-claim', review_status: 'pending' }];
  const requestJson = async (url, init) => {
    calls.push({ url, init });
    if (!init) return affiliations;
    assert.deepEqual(JSON.parse(init.body).p_expected_affiliations, affiliations);
    return conflict;
  };
  assert.deepEqual(await approveClaim(snapshot({ claim_type: 'party_affiliation' }), { urlFor, requestJson }), conflict);
  assert.deepEqual(calls.map(call => call.init?.method ?? 'GET'), ['GET', 'POST']);
  const unavailableCalls = [];
  await assert.rejects(approveClaim(snapshot({ claim_type: 'party_affiliation' }), { urlFor,
    requestJson: async (url, init) => {
      unavailableCalls.push(init?.method ?? 'GET');
      if (!init) return affiliations;
      throw new Error('RPC unavailable');
    } }), /RPC unavailable/);
  assert.deepEqual(unavailableCalls, ['GET', 'POST']);
});

test('missing snapshots, protected claims, and invalid RPC responses cannot count as approval', async () => {
  let calls = 0;
  const requestJson = async () => { calls += 1; return null; };
  await assert.rejects(approveClaim(snapshot({ updated_at: null }), { urlFor, requestJson }), /complete claim snapshot/);
  for (const claim_type of ['legal_case', 'family_relation', 'candidacy', 'platform']) {
    assert.deepEqual(await approveClaim(snapshot({ claim_type }), { urlFor, requestJson }), conflict);
  }
  assert.deepEqual(await approveClaim(snapshot({ review_status: 'rejected' }), { urlFor, requestJson }), conflict);
  assert.equal(calls, 0);
  for (const result of [null, [], { ...applied, updated_claims: 0 }, { ...conflict, updated_affiliations: 1 }]) {
    await assert.rejects(approveClaim(snapshot(), { urlFor, requestJson: async () => result }), /Invalid atomic auto-review result/);
  }
});
