import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_ELECTION_RACE_PAGE_SIZE,
  PUBLIC_PEOPLE_PAGE_SIZE,
  PUBLIC_SEARCH_RESULT_LIMIT,
  normalizePublishedSearchQuery,
  toPublicPageRange,
} from '../src/lib/publicReadContracts.ts';

test('published list contracts stay within one 20-row request', () => {
  assert.equal(PUBLIC_PEOPLE_PAGE_SIZE, 20);
  assert.equal(PUBLIC_ELECTION_RACE_PAGE_SIZE, 20);
  assert.deepEqual(toPublicPageRange(1, PUBLIC_PEOPLE_PAGE_SIZE), { from: 0, to: 19 });
  assert.deepEqual(toPublicPageRange(3, PUBLIC_ELECTION_RACE_PAGE_SIZE), { from: 40, to: 59 });
  assert.deepEqual(toPublicPageRange(1, 200), { from: 0, to: 19 });
});

test('invalid pagination input falls back to the first 20-row page', () => {
  assert.deepEqual(toPublicPageRange(0, 0), { from: 0, to: 19 });
  assert.deepEqual(toPublicPageRange(Number.NaN, Number.NaN), { from: 0, to: 19 });
});

test('published search uses the promote-time normalization contract', () => {
  assert.equal(PUBLIC_SEARCH_RESULT_LIMIT, 12);
  assert.equal(
    normalizePublishedSearchQuery('  臺北\tABC  '),
    '台北 abc',
  );
  assert.equal(normalizePublishedSearchQuery('Cafe\u0301'), 'café');
});
