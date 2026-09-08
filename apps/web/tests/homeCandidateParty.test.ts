import assert from 'node:assert/strict';
import test from 'node:test';
import { getHomeCandidateParty } from '../src/lib/homeCandidateParty.ts';

test('uses the confirmed person affiliation as the primary party', () => {
  assert.deepEqual(
    getHomeCandidateParty({ person_party: '台灣綠黨', party: '民主進步黨' }),
    {
      affiliationParty: '台灣綠黨',
      recommendation: { kind: 'party', party: '民主進步黨' },
    },
  );
});

test('does not repeat a matching candidacy recommendation', () => {
  assert.deepEqual(
    getHomeCandidateParty({ person_party: '臺灣民眾黨', party: '台灣民眾黨' }),
    { affiliationParty: '台灣民眾黨', recommendation: null },
  );
});

test('distinguishes an unendorsed candidacy from party affiliation', () => {
  assert.deepEqual(
    getHomeCandidateParty({ person_party: '中國國民黨', party: '無黨籍' }),
    {
      affiliationParty: '中國國民黨',
      recommendation: { kind: 'unendorsed' },
    },
  );
});

test('does not treat an unconfirmed affiliation as the recommendation party', () => {
  assert.deepEqual(
    getHomeCandidateParty({ person_party: null, party: '民主進步黨' }),
    {
      affiliationParty: null,
      recommendation: { kind: 'party', party: '民主進步黨' },
    },
  );
});

test('leaves the recommendation note empty when recommendation data is unavailable', () => {
  assert.deepEqual(
    getHomeCandidateParty({ person_party: '時代力量', party: null }),
    { affiliationParty: '時代力量', recommendation: null },
  );
});
