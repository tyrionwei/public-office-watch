import assert from 'node:assert/strict';
import test from 'node:test';
import { basicValuesCompatible } from './apply-cec-2022-councilor-profile-local.mjs';

test('treats Chinese and English gender values as equivalent', () => {
  assert.equal(basicValuesCompatible('gender', 'male', '男'), true);
  assert.equal(basicValuesCompatible('gender', 'female', '女'), true);
});

test('treats Wikidata January first as year precision only for that source', () => {
  assert.equal(basicValuesCompatible('birth_date', '1953-01-01', '1953-10-04', 'Wikidata 人物補充資料'), true);
  assert.equal(basicValuesCompatible('birth_date', '1953-01-01', '1953-10-04', '其他來源'), false);
  assert.equal(basicValuesCompatible('birth_date', '1953-02-01', '1953-10-04', 'Wikidata 人物補充資料'), false);
});
