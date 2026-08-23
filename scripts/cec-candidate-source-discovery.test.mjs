import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareDiscoveries,
  discoveryMatches,
  extractCandidateLinks,
  isCecUrl,
  parseArgs,
  validateManifest,
} from './cec-candidate-source-discovery.mjs';

const rules = {
  yearTerms: ['115年', '2026'],
  candidateTerms: ['候選人'],
  artifactTerms: ['登記概況', '候選人名單', '資格審定', '選舉公報', '號次'],
};

test('accepts only HTTPS CEC URLs', () => {
  assert.equal(isCecUrl('https://web.cec.gov.tw/central'), true);
  assert.equal(isCecUrl('http://web.cec.gov.tw/central'), false);
  assert.equal(isCecUrl('https://cec.gov.tw.example.com/central'), false);
});

test('requires year, candidate, and artifact signals', () => {
  assert.equal(discoveryMatches('115年候選人登記概況', 'https://web.cec.gov.tw/a', rules), true);
  assert.equal(discoveryMatches('115年候選人保證金', 'https://web.cec.gov.tw/a', rules), false);
  assert.equal(discoveryMatches('111年候選人名單', 'https://web.cec.gov.tw/a', rules), false);
});

test('supports grouped rules for election announcements without a candidate term', () => {
  const announcementRules = {
    termGroups: [
      ['115年', '2026'],
      ['選舉種類', '選舉公告', '候選人登記日期及必備事項'],
    ],
  };
  assert.equal(discoveryMatches('公告115年地方選舉之選舉種類與投票日期', 'https://web.cec.gov.tw/a', announcementRules), true);
  assert.equal(discoveryMatches('115年媒體政策及業務宣導', 'https://web.cec.gov.tw/a', announcementRules), false);
});

test('extracts matching CEC links and ignores external or unrelated links', () => {
  const html = `
    <a href="/central/article/1"><span>115年候選人登記概況</span></a>
    <a href="https://example.com/115年候選人名單">external</a>
    <a href="/central/article/2">115年候選人保證金</a>
  `;
  assert.deepEqual(extractCandidateLinks(html, 'https://web.cec.gov.tw/central', rules), [{
    title: '115年候選人登記概況',
    url: 'https://web.cec.gov.tw/central/article/1',
  }]);
});

test('reports content and discovery changes against the prior run', () => {
  const current = [{
    key: 'central', contentHash: 'new', discoveries: [
      { title: 'kept', url: 'https://web.cec.gov.tw/kept' },
      { title: 'new', url: 'https://web.cec.gov.tw/new' },
    ],
  }];
  const previous = { sources: [{
    key: 'central', contentHash: 'old', discoveries: [
      { title: 'kept', url: 'https://web.cec.gov.tw/kept' },
      { title: 'removed', url: 'https://web.cec.gov.tw/removed' },
    ],
  }] };
  const [result] = compareDiscoveries(current, previous);
  assert.equal(result.changed, true);
  assert.deepEqual(result.newDiscoveries.map((item) => item.title), ['new']);
  assert.deepEqual(result.removedDiscoveries.map((item) => item.title), ['removed']);
});

test('treats a missing state file as a baseline and can discover Nuxt payload titles', () => {
  const state = parseArgs(['--state', 'tmp/missing-cec-state.json']);
  assert.equal(state.previousPath, 'tmp/missing-cec-state.json');
  assert.equal(state.outputPath, 'tmp/missing-cec-state.json');

  const announcementRules = {
    termGroups: [['115年'], ['選舉公告']],
  };
  const html = `<script id="__NUXT_DATA__">${JSON.stringify([
    '115年山地原住民區長、村里長之選舉公告',
    '115年媒體政策及業務宣導',
  ])}</script>`;
  const discoveries = extractCandidateLinks(html, 'https://web.cec.gov.tw/central/article/list/144?page=1', announcementRules);
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].title, '115年山地原住民區長、村里長之選舉公告');
  assert.match(discoveries[0].url, /#item-[a-f0-9]{16}$/);

  const [baseline] = compareDiscoveries([{ key: 'central', contentHash: 'current', discoveries }]);
  assert.equal(baseline.baseline, true);
  assert.equal(baseline.changed, false);
  assert.deepEqual(baseline.newDiscoveries, []);
});

test('rejects manifests that include non-CEC sources', () => {
  assert.throws(() => validateManifest({
    schemaVersion: 1,
    electionYear: 2026,
    rules,
    sources: [{ key: 'bad', name: 'bad', url: 'https://example.com' }],
  }), /must be an HTTPS cec.gov.tw URL/);
});

test('validates a generic grouped election announcement manifest', () => {
  const manifest = validateManifest({
    schemaVersion: 1,
    electionYear: 2026,
    rules: { termGroups: [['115年', '2026'], ['選舉公告', '候選人登記日期及必備事項']] },
    sources: [{ key: 'central', name: '中央公告', url: 'https://web.cec.gov.tw/central/article/list/144?page=1' }],
  });
  assert.equal(manifest.rules.termGroups.length, 2);
});
