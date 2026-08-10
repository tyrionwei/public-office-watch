import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalPartyName } from '../src/lib/partyNames.ts';

test('maps known historical and source aliases to canonical display names', () => {
  assert.equal(canonicalPartyName('基進黨'), '台灣基進');
  assert.equal(canonicalPartyName('綠黨'), '台灣綠黨');
  assert.equal(canonicalPartyName('臺灣團結聯盟'), '台聯黨');
  assert.equal(canonicalPartyName('台灣革命黨'), '台灣照生黨');
  assert.equal(canonicalPartyName('無政黨'), '無黨籍');
});

test('does not collapse a distinct electoral alliance into a member party', () => {
  assert.equal(canonicalPartyName('綠黨社會民主黨聯盟'), '綠黨社會民主黨聯盟');
});

test('trims input and preserves unknown official names', () => {
  assert.equal(canonicalPartyName('  民主進步黨  '), '民主進步黨');
  assert.equal(canonicalPartyName(''), null);
  assert.equal(canonicalPartyName(null), null);
});
