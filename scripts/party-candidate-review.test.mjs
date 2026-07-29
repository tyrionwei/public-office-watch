import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertLocalSupabase,
  buildStagingRows,
  validateReviewFile,
} from './party-candidate-review.mjs';

const record = {
  sourceCandidateKey: 'dpp-2026-taipei-mayor-test',
  personName: '測試人物',
  candidacyStatus: 'party_nominee',
  raceType: 'municipality_mayor',
  regionName: '台北市',
  districtName: null,
  nominationAnnouncedAt: '2026-07-01',
  profileUrl: 'https://teamtaiwan.dpp.org.tw/test',
  photoUrl: null,
};

const snapshot = {
  schemaVersion: 1,
  electionYear: 2026,
  party: '民主進步黨',
  source: {
    name: '民主進步黨 2026 選舉官網',
    url: 'https://teamtaiwan.dpp.org.tw/',
    publishedAt: null,
  },
  records: [record],
};

const planItem = {
  record,
  race: { id: 'race-1', title: '台北市市長選舉' },
  people: [{ id: 'person-1', name: '測試人物' }],
  canonicalGroups: [{
    canonicalPersonId: 'person-1',
    people: [{ id: 'person-1', name: '測試人物' }],
    evidence: ['party', 'geography'],
  }],
  selectedGroup: {
    canonicalPersonId: 'person-1',
    people: [{ id: 'person-1', name: '測試人物' }],
    evidence: ['party', 'geography'],
  },
  identityResolution: 'high_confidence_match',
};

const plan = { matched: [planItem], blocking: [] };

test('builds private pending source records and a non-confirming identity suggestion', () => {
  const rows = buildStagingRows(snapshot, plan, '2026-07-29T08:00:00.000Z');
  assert.equal(rows.sourcePeople.length, 1);
  assert.equal(rows.sourcePeople[0].source_type, 'official_site');
  assert.equal(rows.sourcePeople[0].source_person_key, 'party-candidate:dpp-2026-taipei-mayor-test');
  assert.equal(rows.sourcePeople[0].source_payload.identitySuggestion.resolution, 'high_confidence_match');
  assert.equal(rows.claims[0].claim_type, 'candidacy');
  assert.equal(rows.claims[0].review_status, undefined);
  assert.equal(rows.suggestions[0].match_status, 'probable_match');
  assert.notEqual(rows.suggestions[0].match_status, 'auto_matched');
});

test('accepts an explicit reviewed identity and rejects unrelated person ids', () => {
  const valid = validateReviewFile({
    schemaVersion: 1,
    party: '民主進步黨',
    reviewedBy: 'reviewer@example.test',
    decisions: [{
      sourceCandidateKey: record.sourceCandidateKey,
      personName: record.personName,
      decision: 'use_existing',
      personId: 'person-1',
      reviewedAt: '2026-07-29T09:00:00.000Z',
    }],
  }, snapshot, plan);
  assert.equal(valid.decisions[0].personId, 'person-1');

  assert.throws(() => validateReviewFile({
    schemaVersion: 1,
    party: '民主進步黨',
    reviewedBy: 'reviewer@example.test',
    decisions: [{
      sourceCandidateKey: record.sourceCandidateKey,
      personName: record.personName,
      decision: 'use_existing',
      personId: 'unrelated-person',
      reviewedAt: '2026-07-29T09:00:00.000Z',
    }],
  }, snapshot, plan), /not one of the exact-name identity candidates/);
});

test('rejects production Supabase writes for the review workflow', () => {
  assert.doesNotThrow(() => assertLocalSupabase({ supabaseUrl: 'http://127.0.0.1:54321' }));
  assert.throws(
    () => assertLocalSupabase({ supabaseUrl: 'https://example.supabase.co' }),
    /local-only/,
  );
});
