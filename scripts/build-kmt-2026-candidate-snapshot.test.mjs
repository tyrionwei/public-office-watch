import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSnapshot, parseAnnouncementPage } from './build-kmt-2026-candidate-snapshot.mjs';

function page(body, date = '2026-03-04') {
  return `<!doctype html><html><head><title>正式提名公告 - 中國國民黨全球資訊網</title><meta itemprop="datePublished" content="${date}T15:09:00+08:00"></head><body><article>${body}</article></body></html>`;
}

test('parses only an explicit KMT nomination decision sentence', () => {
  const parsed = parseAnnouncementPage(page(`
    <p>初選登記人選包括其他甲與其他乙，後續仍待中央審議。</p>
    <p>中國國民黨中常會今通過縣市長選舉第二梯次建議徵召案：雲林縣徵召張嘉郡同志參選，花蓮縣徵召游淑貞同志參選，金門縣徵召陳玉珍同志參選。</p>
  `), 'https://www.kmt.org.tw/2026/03/example.html');
  assert.deepEqual(parsed.records.map((record) => [record.regionName, record.personName]), [
    ['雲林縣', '張嘉郡'],
    ['花蓮縣', '游淑貞'],
    ['金門縣', '陳玉珍'],
  ]);
  assert.equal(parsed.records[0].nominationAnnouncedAt, '2026-03-04');
});

test('parses candidate-first wording and strips official titles', () => {
  const parsed = parseAnnouncementPage(page(`
    <p>中常會通過115年直轄市市長暨縣市長選舉第一梯次建議輔選方式暨名單，徵召立委謝龍介參選台南市長、立委柯志恩參選高雄市長、議長吳秀華參選台東縣長。</p>
  `, '2025-12-24'), 'https://www.kmt.org.tw/2025/12/example.html');
  assert.deepEqual(parsed.records.map((record) => [record.regionName, record.personName]), [
    ['台南市', '謝龍介'],
    ['高雄市', '柯志恩'],
    ['台東縣', '吳秀華'],
  ]);
});

test('parses a final batch of incumbent mayors formally nominated for reelection', () => {
  const parsed = parseAnnouncementPage(page(`
    <p>今日中常會完成最後一波縣市長提名作業，正式徵召尋求連任的台北市長蔣萬安、桃園市長張善政、基隆市長謝國樑、南投縣長許淑華、苗栗縣長鍾東錦及連江縣長王忠銘。</p>
  `, '2026-07-22'), 'https://www.kmt.org.tw/2026/07/final.html');
  assert.deepEqual(parsed.records.map((record) => [record.regionName, record.personName]), [
    ['台北市', '蔣萬安'],
    ['桃園市', '張善政'],
    ['基隆市', '謝國樑'],
    ['南投縣', '許淑華'],
    ['苗栗縣', '鍾東錦'],
    ['連江縣', '王忠銘'],
  ]);
  assert.ok(parsed.records.every((record) => record.isIncumbent === true));
  assert.ok(parsed.records.every((record) => record.incumbencyEvidence.includes('正式徵召尋求連任')));
  assert.ok(parsed.records.every((record) => record.incumbencySourceUrl === 'https://www.kmt.org.tw/2026/07/final.html'));
});

test('removes an earlier nominee superseded by an official joint primary result', async () => {
  const urls = [
    'https://www.kmt.org.tw/nomination',
    'https://www.kmt.org.tw/coordination',
  ];
  const pages = new Map([
    [urls[0], page('<p>中常會通過徵召案：嘉義市徵召翁壽良同志參選，台南市徵召謝龍介同志參選。</p>', '2026-03-11')],
    [urls[1], page(`
      <p>兩黨依據2026年中國國民黨與台灣民眾黨聯合治理暨地方選舉合作協議，公布嘉義市長初選民調結果，由台灣民眾黨嘉義市長參選人張啓楷勝出。</p>
      <p>中國國民黨嘉義市長參選人翁壽良恭喜張啓楷民調勝出。</p>
    `, '2026-04-07')],
  ]);
  const fetchImpl = async (url) => ({ ok: true, text: async () => pages.get(url).padEnd(600, ' ') });
  const snapshot = await buildSnapshot(urls, {
    fetchImpl,
    retrievedAt: '2026-08-24T00:00:00.000Z',
  });
  assert.deepEqual(snapshot.records.map((record) => [record.regionName, record.personName]), [['台南市', '謝龍介']]);
});

test('rejects pages that only discuss a primary or pending nomination', () => {
  assert.throws(() => parseAnnouncementPage(page(`
    <p>新竹縣已展開初選，民調勝出者仍須呈報中常會通過。</p>
  `), 'https://www.kmt.org.tw/2026/03/pending.html'), /No explicit KMT nomination decision/);
});

test('deduplicates repeated official announcements and rejects conflicting nominees', async () => {
  const pages = new Map([
    ['https://www.kmt.org.tw/a', page('<p>中常會通過徵召案：彰化縣徵召魏平政同志參選。</p>')],
    ['https://www.kmt.org.tw/b', page('<p>中常會通過提名案：彰化縣提名魏平政同志參選。</p>')],
    ['https://www.kmt.org.tw/c', page('<p>中常會通過提名案：彰化縣提名另一人同志參選。</p>')],
  ]);
  const fetchImpl = async (url) => ({ ok: true, text: async () => pages.get(url).padEnd(600, ' ') });
  const snapshot = await buildSnapshot(
    ['https://www.kmt.org.tw/a', 'https://www.kmt.org.tw/b'],
    { fetchImpl, retrievedAt: '2026-07-29T00:00:00.000Z' },
  );
  assert.equal(snapshot.records.length, 1);
  await assert.rejects(() => buildSnapshot(
    ['https://www.kmt.org.tw/a', 'https://www.kmt.org.tw/c'],
    { fetchImpl, retrievedAt: '2026-07-29T00:00:00.000Z' },
  ), /Conflicting KMT nominees/);
});
