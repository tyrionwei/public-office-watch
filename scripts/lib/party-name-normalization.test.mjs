import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalPartyName } from './party-name-normalization.mjs';

test('canonicalizes source party aliases', () => {
  assert.equal(canonicalPartyName('基進黨'), '台灣基進');
  assert.equal(canonicalPartyName('綠黨'), '台灣綠黨');
  assert.equal(canonicalPartyName('台灣團結聯盟'), '台聯黨');
  assert.equal(canonicalPartyName('台灣革命黨'), '台灣照生黨');
  assert.equal(canonicalPartyName('無黨'), '無黨籍');
});

test('keeps distinct alliances and unknown parties unchanged', () => {
  assert.equal(canonicalPartyName('綠黨社會民主黨聯盟'), '綠黨社會民主黨聯盟');
  assert.equal(canonicalPartyName('勞動黨'), '勞動黨');
});
