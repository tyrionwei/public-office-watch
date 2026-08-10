import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPersonLegalStatisticsKey,
  LEGAL_STATISTICS_SCOPE_NOTE_ZH_TW,
} from '../src/lib/legalStatistics.ts';

test('prioritizes a confirmed final conviction when a person has multiple records', () => {
  assert.equal(getPersonLegalStatisticsKey([
    { recordType: 'criminal', caseStage: 'criminal_judgment_non_final' },
    { recordType: 'criminal', caseStage: 'criminal_judgment_final' },
  ]), 'final_conviction');
});

test('separates unresolved and acquittal-only criminal records', () => {
  assert.equal(getPersonLegalStatisticsKey([
    { recordType: 'criminal', caseStage: 'indicted' },
  ]), 'non_final_or_unspecified');
  assert.equal(getPersonLegalStatisticsKey([
    { recordType: 'criminal', caseStage: 'criminal_acquittal_final' },
  ]), 'acquittal_only');
});

test('does not count civil election or administrative records as criminal records', () => {
  assert.equal(getPersonLegalStatisticsKey([
    { recordType: 'election_civil', caseStage: 'election_invalidated_final' },
    { recordType: 'administrative', caseStage: 'administrative_sanction' },
  ]), null);
});

test('scope note avoids claiming that an incomplete count can only increase', () => {
  assert.match(LEGAL_STATISTICS_SCOPE_NOTE_ZH_TW, /未收錄不代表無相關紀錄/u);
  assert.match(LEGAL_STATISTICS_SCOPE_NOTE_ZH_TW, /可能隨後續查證與司法進度調整/u);
  assert.doesNotMatch(LEGAL_STATISTICS_SCOPE_NOTE_ZH_TW, /只會.*更多/u);
});
