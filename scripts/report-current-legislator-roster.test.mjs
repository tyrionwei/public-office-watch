import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareRosters,
  extractCurrentLegislatorNames,
  normalizePersonName,
} from './report-current-legislator-roster.mjs';

test('extracts current legislators without including departed legislators', () => {
  const html = `
    <section id="six-legislatorListBox">
      <h2>第 11 屆立法委員名單</h2>
      <div class="legislatorname">江啟臣</div>
      <div class="legislatorname">伍麗華 Saidhai‧Tahovecahe</div>
      <h2>離職立法委員名單</h2>
      <div class="legislatorname">已離職者</div>
    </section>
  `;

  assert.deepEqual(extractCurrentLegislatorNames(html), [
    '江啟臣',
    '伍麗華 Saidhai‧Tahovecahe',
  ]);
});

test('normalizes harmless spacing and middle-dot variants', () => {
  assert.equal(
    normalizePersonName('伍麗華 Saidhai・Tahovecahe'),
    normalizePersonName('伍麗華Saidhai‧Tahovecahe'),
  );
});

test('reports both missing and unexpected roster members', () => {
  const comparison = compareRosters(
    ['甲', '乙', ...Array.from({ length: 111 }, (_, index) => `委員${index}`)],
    ['甲', '丙', ...Array.from({ length: 111 }, (_, index) => `委員${index}`)],
  );

  assert.equal(comparison.officialCount, 113);
  assert.equal(comparison.localCount, 113);
  assert.deepEqual(comparison.missingLocally, ['乙']);
  assert.deepEqual(comparison.unexpectedLocally, ['丙']);
  assert.equal(comparison.passed, false);
});

test('passes only when all 113 unique members match', () => {
  const names = Array.from({ length: 113 }, (_, index) => `委員${index}`);
  const comparison = compareRosters(names, [...names]);

  assert.equal(comparison.passed, true);
});
