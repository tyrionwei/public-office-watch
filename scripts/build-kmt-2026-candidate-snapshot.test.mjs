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
