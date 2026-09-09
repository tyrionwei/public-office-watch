import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  main,
  parseArgs,
  parseDetailPage,
  parseListingRows,
  priorRocYear,
} from './fetch-moi-party-annual-finance.mjs';

test('a failed detail saves incomplete evidence, blocks import, and can recover on rerun', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-moi-gate-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'report.json');
  let failedParty = 1;
  let timeout = false;
  const listing = [1, 2, 3].map(id => `<td data-title="年度">114</td><td data-title="政黨編號">${id}</td><td data-title="政黨名稱"><a href="PartyFinancialChecklistContent.aspx?id=${id}">Fixture ${id}</a></td><td data-title="申報狀態">已申報</td><td data-title="追認狀態">已追認</td>`).join('');
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('PartyFinancialChecklist.aspx')) return new Response(url.searchParams.has('page') ? '' : listing);
    if (Number(url.searchParams.get('id')) === failedParty) {
      if (timeout) throw new DOMException('Controlled timeout', 'TimeoutError');
      return new Response('Controlled failure', { status: 503 });
    }
    return new Response('<a href="https://ws.moi.gov.tw/fixture.pdf">PDF</a>');
  });
  t.mock.method(console, 'log', () => {});
  for (const id of [1, 2, 3]) {
    failedParty = id;
    timeout = id === 2;
    await assert.rejects(main(['--year', '114', '--output', output]), /Incomplete MOI.*saved/);
    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(report.status, 'needs_attention');
    assert.equal(report.failedDetailCount, 1);
    assert.equal(report.records.length, 3);
    assert.equal(report.records[id - 1].detailStatus, 'failed');
    assert.ok(report.records[id - 1].sourceError);
  }
  failedParty = 0;
  await main(['--year', '114', '--output', output]);
  const recovered = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(recovered.status, 'ok');
  assert.equal(recovered.failedDetailCount, 0);
  assert.ok(recovered.records.every(row => row.detailStatus === 'ok' && row.reportPdfUrl));
});

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
