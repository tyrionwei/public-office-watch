import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareDiscoveries,
  discoveryMatches,
  extractCandidateLinks,
  isCecUrl,
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

test('rejects manifests that include non-CEC sources', () => {
  assert.throws(() => validateManifest({
    schemaVersion: 1,
    electionYear: 2026,
    rules,
    sources: [{ key: 'bad', name: 'bad', url: 'https://example.com' }],
  }), /must be an HTTPS cec.gov.tw URL/);
});
