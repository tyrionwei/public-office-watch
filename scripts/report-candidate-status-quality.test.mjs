import test from 'node:test';
import assert from 'node:assert/strict';

import { auditCandidateStatuses } from './report-candidate-status-quality.mjs';

test('candidate status audit separates legacy omissions from contradictions', () => {
  const races = [{ id: 'race-complete', status: 'completed' }];
  const candidates = [
    {
      id: 'candidate-null-legacy',
      race_id: 'race-complete',
      candidacy_status: 'qualified',
      election_result: 'elected',
      status_updated_at: '2026-07-16T00:00:00Z',
      registration_status: 'elected',
      is_elected: null,
      source_name: 'CEC',
      source_url: 'https://example.test',
    },
    {
      id: 'candidate-conflict',
      race_id: 'race-complete',
      candidacy_status: 'qualified',
      election_result: 'not_elected',
      status_updated_at: '2026-07-16T00:00:00Z',
      registration_status: 'not_elected',
      is_elected: true,
      source_name: 'CEC',
      source_url: 'https://example.test',
    },
  ];

  const report = auditCandidateStatuses(candidates, races);

  assert.equal(report.issues.legacyResultMissing.count, 1);
  assert.equal(report.issues.legacyResultContradiction.count, 1);
  assert.equal(report.blockingIssueCount, 1);
});

test('candidate status audit flags final results before a race is completed', () => {
  const report = auditCandidateStatuses([
    {
      id: 'candidate-early-result',
      race_id: 'race-upcoming',
      candidacy_status: 'qualified',
      election_result: 'elected',
      status_updated_at: '2026-07-16T00:00:00Z',
      registration_status: 'qualified',
      is_elected: true,
      source_name: 'CEC',
      source_url: 'https://example.test',
    },
  ], [{ id: 'race-upcoming', status: 'upcoming' }]);

  assert.equal(report.issues.finalResultBeforeCompletion.count, 1);
  assert.equal(report.blockingIssueCount, 1);
});

test('candidate status audit accepts a nominee who did not file before registration closed', () => {
  const report = auditCandidateStatuses([
    {
      id: 'candidate-did-not-register',
      race_id: 'race-upcoming',
      candidacy_status: 'did_not_register',
      election_result: 'pending',
      status_updated_at: '2026-09-05T00:00:00Z',
      registration_status: 'not_registered',
      is_elected: null,
      source_name: 'CEC',
      source_url: 'https://example.test/final-registration-list',
    },
  ], [{ id: 'race-upcoming', status: 'upcoming' }]);

  assert.equal(report.candidacyStatusCounts.did_not_register, 1);
  assert.equal(report.blockingIssueCount, 0);
});
