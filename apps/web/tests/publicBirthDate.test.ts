import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPublicBirthDate, parsePublicDisplaySettings } from '../src/lib/publicBirthDate.ts';
import { normalizeBirthDateDisplay } from '../../../supabase/functions/_shared/publicUpdateAdmin.ts';

test('full and year-only display preserve the source, including partial dates', () => {
  const claim = Object.freeze({ claim_value: '1981-07-23' });
  assert.equal(formatPublicBirthDate(claim.claim_value, false), '1981-07-23');
  for (const value of [claim.claim_value, '1981', '1981/7/23', '1981年7月23日', '+1981-07-23T00:00:00Z']) {
    assert.equal(formatPublicBirthDate(value, true), '1981');
  }
  assert.equal(claim.claim_value, '1981-07-23');
  assert.equal(formatPublicBirthDate('1981', false), '1981');
});

test('year-only display never falls back to unrecognized full-date text', () => {
  for (const value of [undefined, null, '', 'unknown', '民國70年7月23日', '07/23/1981', '19810723']) {
    assert.equal(formatPublicBirthDate(value, true), null);
  }
});

test('settings and updates require explicit booleans and valid revisions', () => {
  const row = { birth_date_year_only: false, revision: 0, updated_at: '2026-09-09T08:00:00Z' };
  assert.deepEqual(parsePublicDisplaySettings(row), row);
  for (const value of [null, {}, { ...row, birth_date_year_only: 'false' }, { ...row, revision: -1 }, { ...row, updated_at: '' }]) {
    assert.throws(() => parsePublicDisplaySettings(value));
  }
  assert.deepEqual(normalizeBirthDateDisplay({ yearOnly: true, expectedRevision: 0 }), { yearOnly: true, expectedRevision: 0 });
  for (const value of [{}, { yearOnly: 'false', expectedRevision: 0 }, { yearOnly: true }, { yearOnly: false, expectedRevision: -1 }, { yearOnly: true, expectedRevision: 0.5 }, { yearOnly: true, expectedRevision: 2147483648 }]) {
    assert.equal(normalizeBirthDateDisplay(value), null);
  }
});
