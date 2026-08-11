import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSnapshot } from './import-official-candidate-snapshot.mjs';
import { buildReviewPlan, candidateWriteRow, parseArgs, reviewTemplate } from './review-official-candidate-snapshot.mjs';

function snapshot() {
  return validateSnapshot({
    schemaVersion: 1,
    electionYear: 2026,
    candidacyStatus: 'registered',
    source: {
      name: '中央選舉委員會',
      url: 'https://web.cec.gov.tw/example',
      publishedAt: '2026-09-01',
      retrievedAt: '2026-09-01T10:00:00+08:00',
    },
    records: [{
      candidateExternalId: 'cec-candidate-1',
      personExternalId: 'cec-person-1',
      raceExternalId: 'cec-race-1',
      personName: '測試人物',
      party: '測試政黨',
    }],
  });
}

test('requires explicit staged review modes instead of a generic write flag', () => {
  assert.deepEqual(parseArgs(['--input', 'snapshot.json', '--stage']), {
    inputPath: 'snapshot.json', mode: 'stage', reviewPath: null,
  });
  assert.throws(() => parseArgs(['--input', 'snapshot.json', '--apply-reviewed']), /requires a review file/);
  assert.throws(() => parseArgs(['--input', 'snapshot.json', '--write']), /Unsupported argument/);
});

test('builds a review item with exact-name identity candidates', () => {
  const input = snapshot();
  const race = { id: 'race-1', external_id: 'cec-race-1', title: '測試選舉' };
  const person = { id: 'person-1', external_id: 'older-source-id', name: '測試人物' };
  const basePlan = { blocking: [], createPeople: [], createCandidates: [], updateCandidates: [], unchanged: [] };
  const plan = buildReviewPlan(input, { races: [race], people: [person], candidates: [] }, basePlan);
  assert.equal(plan.matched[0].identityCandidates[0].id, 'person-1');
  assert.equal(reviewTemplate(plan)[0].suggestedDecision, 'use_existing');
});

test('new reviewed candidates remain private while existing visibility is preserved', () => {
  const input = snapshot();
  const personMap = new Map([['cec-person-1', { id: 'person-1' }]]);
  const planned = { record: input.records[0], race: { id: 'race-1' }, candidate: null };
  assert.equal(candidateWriteRow(input, planned, personMap, '2026-09-01').is_public, false);
  assert.equal(candidateWriteRow(input, {
    ...planned,
    candidate: { external_id: 'party-candidate-1', person_id: 'person-1', race_id: 'race-1', is_public: true },
  }, personMap, '2026-09-01').is_public, true);
});
