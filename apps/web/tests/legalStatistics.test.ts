import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPartyLegalStatistics,
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

test('party statistics count each person once while preserving every criminal record', () => {
  const people = [
    { person_id: 'person-1', party: '民主進步黨' },
    { person_id: 'person-2', party: '民主進步黨' },
    { person_id: 'person-3', party: '民主進步黨' },
    { person_id: 'person-4', party: '中國國民黨' },
  ] as never[];
  const claims = [
    {
      person_id: 'person-1',
      claim_type: 'legal_case',
      claim_json: { recordType: 'criminal', caseStage: 'criminal_acquittal_final' },
    },
    {
      person_id: 'person-1',
      claim_type: 'legal_case',
      claim_json: { recordType: 'criminal', caseStage: 'criminal_judgment_final' },
    },
    {
      person_id: 'person-1',
      claim_type: 'legal_case',
      claim_json: { recordType: 'criminal', caseStage: 'criminal_judgment_non_final' },
    },
    {
      person_id: 'person-2',
      claim_type: 'legal_case',
      claim_json: { recordType: 'criminal', caseStage: 'criminal_acquittal_final' },
    },
    {
      person_id: 'person-3',
      claim_type: 'legal_case',
      claim_json: { recordType: 'administrative', caseStage: 'administrative_sanction' },
    },
  ] as never[];

  assert.deepEqual(buildPartyLegalStatistics('民主進步黨', people, claims), {
    party_name: '民主進步黨',
    total_people: 3,
    final_conviction_people: 1,
    non_final_people: 0,
    other_record_people: 0,
    acquittal_only_people: 1,
    no_confirmed_record_people: 1,
    confirmed_record_people: 2,
    record_count: 4,
    final_conviction_records: 1,
    non_final_records: 1,
    other_records: 0,
    acquittal_records: 2,
  });
});
