import assert from 'node:assert/strict';
import test from 'node:test';

import { assertWriteWindow, planOfficialCandidateImport, validateSnapshot } from './import-official-candidate-snapshot.mjs';

function snapshot(overrides = {}) {
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
      candidateExternalId: 'cec-2026-candidate-001',
      personExternalId: 'cec-2026-person-001',
      raceExternalId: 'cec-2026-race-taipei-mayor',
      personName: '測試人物',
      party: '測試政黨',
    }],
    ...overrides,
  });
}

test('rejects non-election-authority sources for official statuses', () => {
  assert.throws(() => snapshot({
    source: {
      name: 'News source',
      url: 'https://example.com/candidates',
      publishedAt: '2026-09-01',
      retrievedAt: '2026-09-01',
    },
  }), /source.url must be hosted on cec.gov.tw/);
});

test('creates a source-scoped person instead of matching by name', () => {
  const plan = planOfficialCandidateImport(snapshot(), {
    races: [{ id: 'race-1', external_id: 'cec-2026-race-taipei-mayor', title: '臺北市市長選舉' }],
    people: [{ id: 'person-existing', external_id: 'other-source-person', name: '測試人物' }],
    candidates: [],
  });

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.createPeople.length, 1);
  assert.equal(plan.createCandidates.length, 1);
  assert.equal(plan.createPeople[0].external_id, 'cec-2026-person-001');
});

test('plans status and ballot-number updates for an exact external-id match', () => {
  const input = snapshot({
    candidacyStatus: 'qualified',
    records: [{
      candidateExternalId: 'cec-2026-candidate-001',
      personExternalId: 'cec-2026-person-001',
      raceExternalId: 'cec-2026-race-taipei-mayor',
      personName: '測試人物',
      party: '測試政黨',
      candidateNo: 3,
    }],
  });
  const plan = planOfficialCandidateImport(input, {
    races: [{ id: 'race-1', external_id: 'cec-2026-race-taipei-mayor', title: '臺北市市長選舉' }],
    people: [{ id: 'person-1', external_id: 'cec-2026-person-001', name: '測試人物' }],
    candidates: [{
      id: 'candidate-1',
      external_id: 'cec-2026-candidate-001',
      person_id: 'person-1',
      race_id: 'race-1',
      party: '測試政黨',
      candidate_no: null,
      registration_status: 'registered',
      candidacy_status: 'registered',
      source_name: '中央選舉委員會',
      source_url: 'https://web.cec.gov.tw/example',
      is_public: true,
    }],
  });

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.updateCandidates.length, 1);
  assert.equal(plan.updateCandidates[0].next.candidacy_status, 'qualified');
  assert.equal(plan.updateCandidates[0].next.candidate_no, '3');
});

test('blocks an existing candidate whose person identity conflicts', () => {
  const plan = planOfficialCandidateImport(snapshot(), {
    races: [{ id: 'race-1', external_id: 'cec-2026-race-taipei-mayor', title: '臺北市市長選舉' }],
    people: [{ id: 'person-1', external_id: 'cec-2026-person-001', name: '測試人物' }],
    candidates: [{
      id: 'candidate-1',
      external_id: 'cec-2026-candidate-001',
      person_id: 'different-person',
      race_id: 'race-1',
    }],
  });

  assert.equal(plan.blocking.length, 1);
  assert.equal(plan.blocking[0].reason, 'candidate_identity_conflict');
});

test('blocks 2026 writes before registration and ballot-number dates', () => {
  const registration = snapshot();
  assert.throws(
    () => assertWriteWindow(registration, new Date('2026-08-30T23:59:59+08:00')),
    /disabled before registration opens/,
  );
  assert.doesNotThrow(
    () => assertWriteWindow(registration, new Date('2026-08-31T00:00:00+08:00')),
  );

  const withNumber = snapshot({ records: [{
    candidateExternalId: 'cec-2026-candidate-001',
    personExternalId: 'cec-2026-person-001',
    raceExternalId: 'cec-2026-race-taipei-mayor',
    personName: '測試人物',
    candidateNo: 1,
  }] });
  assert.throws(
    () => assertWriteWindow(withNumber, new Date('2026-10-22T23:59:59+08:00')),
    /disabled before the official draw/,
  );
});
