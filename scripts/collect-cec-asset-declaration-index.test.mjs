import assert from 'node:assert/strict';
import test from 'node:test';
import { declarationLinks, collectIndex } from './collect-cec-asset-declaration-index.mjs';

test('accepts only official county/city category links and ignores other levels or foreign links', () => {
  const html = '<a href="Page5_01.html">臺北市</a><a href="Page9_01.html">村里長</a><a href="https://other.test/Page5_01.html">外站</a>';
  assert.deepEqual(declarationLinks(html, 'https://pdps-dec.cec.gov.tw/release/formal/Page5.html', 'region'), [
    { name: '臺北市', url: 'https://pdps-dec.cec.gov.tw/release/formal/Page5_01.html' },
  ]);
});

test('keeps document index separate from financial contents', () => {
  const html = '<a href="./files/123.pdf"><span>測試候選人</span></a><a href="HomePage.html">首頁</a>';
  assert.deepEqual(declarationLinks(html, 'https://pdps-dec.cec.gov.tw/release/formal/Page5_01.html', 'document'), [
    { name: '測試候選人', url: 'https://pdps-dec.cec.gov.tw/release/formal/files/123.pdf' },
  ]);
});

test('walks council districts and preserves multiple documents without merging people', async () => {
  const result = await collectIndex({ scope: 'all', fetchImpl: async (url) => {
    const file = new URL(url).pathname.split('/').at(-1);
    const top = /^Page([5-8])\.html$/.exec(file);
    const county = /^Page([5-8])_(\d+)\.html$/.exec(file);
    let html;
    if (top) html = Array.from({ length: ['5','7'].includes(top[1]) ? 6 : 16 }, (_, i) => `<a href="Page${top[1]}_${i}.html">縣市${i}</a>`).join('');
    else if (county && ['7','8'].includes(county[1])) html = `<a href="Page${county[1]}_${county[2]}_1.html">第1選舉區</a>`;
    else html = '<a href="./files/100.pdf">合成候選人</a><a href="./files/101.pdf">合成候選人</a>';
    return new Response(html);
  } });
  assert.equal(result.records.length, 88);
  assert.equal(result.multipleDocuments.length, 44);
  assert.equal(result.sources.length, 70);
  assert.ok(result.records.filter((r) => r.office.endsWith('councilor')).every((r) => r.district === '第1選舉區'));
  assert.ok(result.records.every((r) => r.amountsReviewed === false));
});
