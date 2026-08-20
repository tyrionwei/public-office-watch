import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseArgs,
  parseDetailPage,
  parseListingRows,
  priorRocYear,
} from './fetch-moi-party-annual-finance.mjs';

test('defaults to the prior ROC report year', () => {
  assert.equal(priorRocYear(new Date('2026-08-20T00:00:00Z')), 114);
  assert.equal(parseArgs(['--year', '114', '--output', 'tmp/report.json']).rocYear, 114);
});

test('parses only the requested report year from the listing', () => {
  const html = `
    <table>
      <td data-title="年度">114</td><td data-title="政黨編號">350</td><td data-title="政黨名稱"><a href="PartyFinancialChecklistContent.aspx?fs=2366&amp;s=409">台灣民眾黨</a></td><td data-title="申報狀態">已申報</td><td data-title="追認狀態">未追認</td>
      <td data-title="年度">113</td><td data-title="政黨編號">350</td><td data-title="政黨名稱"><a href="PartyFinancialChecklistContent.aspx?fs=2200&amp;s=409">台灣民眾黨</a></td><td data-title="申報狀態">已申報</td><td data-title="追認狀態">已追認</td>
    </table>`;
  assert.deepEqual(parseListingRows(html, 114), [{
    rocYear: 114,
    reportYear: 2025,
    partyNumber: 350,
    partyName: '台灣民眾黨',
    filingStatus: '已申報',
    ratificationStatus: '未追認',
    detailUrl: 'https://party.moi.gov.tw/PartyFinancialChecklistContent.aspx?fs=2366&s=409',
  }]);
});

test('parses filing detail metadata and the official PDF URL', () => {
  const html = `
    <table>
      <tr><th>政黨狀態</th><td>一般</td></tr>
      <tr><th>有無經黨員(代表)大會通過</th><td>尚未經黨員（代表）大會通過</td></tr>
    </table>
    <a href="https://ws.moi.gov.tw/report.pdf">財務報表</a>`;
  assert.deepEqual(parseDetailPage(html, 'https://party.moi.gov.tw/detail'), {
    partyStatus: '一般',
    assemblyApprovalStatus: '尚未經黨員（代表）大會通過',
    reportPdfUrl: 'https://ws.moi.gov.tw/report.pdf',
  });
});
