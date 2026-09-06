import assert from 'node:assert/strict';
import test from 'node:test';
import { getHomeCandidateOfficeTitle } from '../src/lib/homeCandidateOfficeTitle.ts';

test('prefers a confirmed current office to former office history', () => {
  assert.deepEqual(
    getHomeCandidateOfficeTitle({
      current_office_label: '第11屆立法委員',
      former_office_label: '臺中市議員',
    }),
    { kind: 'current', label: '第11屆立法委員' },
  );
});

test('uses the most recent confirmed former office when no current office exists', () => {
  assert.deepEqual(
    getHomeCandidateOfficeTitle({
      current_office_label: null,
      former_office_label: '新竹縣議員',
    }),
    { kind: 'former', label: '新竹縣議員' },
  );
});

test('normalizes an existing former-office prefix for localized rendering', () => {
  assert.deepEqual(
    getHomeCandidateOfficeTitle({
      current_office_label: null,
      former_office_label: '曾任 臺北市議員',
    }),
    { kind: 'former', label: '臺北市議員' },
  );
});

test('never presents a candidacy label as an office title', () => {
  assert.equal(
    getHomeCandidateOfficeTitle({
      current_office_label: '立法委員候選人',
      former_office_label: 'Mayor candidate',
    }),
    null,
  );
});

test('leaves the title blank when neither office is confirmed', () => {
  assert.equal(
    getHomeCandidateOfficeTitle({ current_office_label: null, former_office_label: null }),
    null,
  );
});
