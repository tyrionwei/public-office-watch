import assert from 'node:assert/strict';
import test from 'node:test';

import { parseElectionPage } from './extract-historical-local-chief-winners.mjs';

test('parses a regular winner summary row', () => {
  const html = `
    <h3 id="當選人名單">當選人名單</h3>
    <table><tr><th>縣市別</th><th>當選人</th><th>黨籍</th><th>當選</th></tr>
    <tr><td>臺北縣</td><td><a>戴德發</a></td><td><a>中國國民黨</a></td><td>*</td></tr></table>`;
  const records = parseElectionPage(html, {
    key: '1954', term: 2, electionYear: 1954, votingDate: '1954-05-02', votingPeriod: null,
    headingId: '當選人名單', sourceUrl: 'https://example.test/1954',
  });
  assert.deepEqual(records.map(({ historicalRegionName, name, party, eventType }) => ({
    historicalRegionName, name, party, eventType,
  })), [{
    historicalRegionName: '臺北縣', name: '戴德發', party: '中國國民黨', eventType: 'regular_election',
  }]);
});

test('uses the explicitly elected candidate in the first multi-round election', () => {
  const html = `
    <h3 id="各輪投票最高票候選人">各輪投票最高票候選人</h3>
    <table><tr><th>期別</th><th>縣市別</th><th>初選</th><th>複選</th></tr>
    <tr><td>第五期</td><td>宜蘭縣</td>
    <td>陳旺全（無黨籍）<img src="Yes_check.svg"></td>
    <td>盧纘祥（中國國民黨）<img src="Elected_candidate_symbol.svg"></td></tr></table>`;
  const [record] = parseElectionPage(html, {
    key: '1950-1951', term: 1, electionYear: 1950, votingDate: null, votingPeriod: '1950-10–1951-07',
    headingId: '各輪投票最高票候選人', sourceUrl: 'https://example.test/1950',
  });
  assert.equal(record.name, '盧纘祥');
  assert.equal(record.party, '中國國民黨');
  assert.equal(record.phase, '第五期');
  assert.equal(record.publicationStatus, 'archived');
});

test('keeps an explicitly marked by-election as a separate event', () => {
  const html = `
    <h3 id="各輪投票最高票候選人">各輪投票最高票候選人</h3>
    <table><tr><th>期別</th><th>縣市別</th><th>初選</th><th>複選</th></tr>
    <tr><td>補選</td><td>苗栗縣</td>
    <td>李白濱（中國青年黨）<img src="Yes_check.svg"></td>
    <td>賴順生（中國國民黨）<img src="Elected_candidate_symbol.svg"></td></tr>
    <tr><td>臺東縣</td><td>吳金玉（中國國民黨）<img src="Elected_candidate_symbol.svg"></td>
    <td>－</td></tr></table>`;
  const records = parseElectionPage(html, {
    key: '1950-1951', term: 1, electionYear: 1950, votingDate: null, votingPeriod: '1950-10–1951-07',
    headingId: '各輪投票最高票候選人', sourceUrl: 'https://example.test/1950',
  });
  assert.deepEqual(records.map((record) => record.eventType), ['by_election', 'by_election']);
  assert.equal(records[0].name, '賴順生');
  assert.equal(records[1].name, '吳金玉');
});
