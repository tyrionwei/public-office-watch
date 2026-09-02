import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEventLeads,
  buildFeedUrl,
  directEventMatch,
  groupEventLeads,
  normalizeWatchlist,
  parseRssItems,
  validateManifest,
} from './discover-daily-person-news.mjs';

const manifest = validateManifest({
  schemaVersion: 1,
  lookbackHours: 36,
  feed: {
    provider: 'Google News RSS',
    baseUrl: 'https://news.google.com/rss/search',
    language: 'zh-TW',
    country: 'TW',
    edition: 'TW:zh-Hant',
  },
  categories: [{
    key: 'party_affiliation',
    label: '黨籍異動',
    queryTerms: ['退黨', '開除黨籍'],
    eventTerms: ['退黨', '開除黨籍'],
  }],
  trustedPublishers: ['中央社'],
});

test('builds a bounded Traditional Chinese Taiwan feed query', () => {
  const url = new URL(buildFeedUrl(manifest.feed, manifest.categories[0], 36));
  assert.equal(url.hostname, 'news.google.com');
  assert.match(url.searchParams.get('q'), /退黨 OR 開除黨籍/);
  assert.match(url.searchParams.get('q'), /when:2d/);
  assert.equal(url.searchParams.get('ceid'), 'TW:zh-Hant');
});

test('parses RSS metadata without retaining article bodies', () => {
  const xml = `<rss><channel><item>
    <title>王小明宣布退黨 - 中央社</title>
    <link>https://news.google.com/articles/1</link>
    <pubDate>Mon, 10 Aug 2026 08:00:00 GMT</pubDate>
    <description><![CDATA[<p>王小明表示即日起退黨。</p>]]></description>
    <source url="https://www.cna.com.tw/">中央社</source>
  </item></channel></rss>`;
  assert.deepEqual(parseRssItems(xml), [{
    title: '王小明宣布退黨 - 中央社',
    url: 'https://news.google.com/articles/1',
    publishedAt: 'Mon, 10 Aug 2026 08:00:00 GMT',
    summary: '王小明表示即日起退黨。',
    publisherName: '中央社',
    publisherUrl: 'https://www.cna.com.tw/',
  }]);
});

test('prioritizes current, 2026, and 2022 people while excluding older inactive records', () => {
  const watchlist = normalizeWatchlist([
    { person_id: 'current', name: '現任者', current_office_label: '立法委員' },
    { person_id: 'candidate', name: '候選人', election_year: 2026 },
    { person_id: 'previous', name: '上屆人', election_year: 2022 },
    { person_id: 'old', name: '歷史人', election_year: 2010 },
  ]);
  assert.deepEqual(watchlist.map((person) => person.personId).sort(), ['candidate', 'current', 'previous']);
});

test('creates pending leads and downgrades ambiguous same-name matches', () => {
  const watchlist = normalizeWatchlist([
    { person_id: 'person-1', name: '王小明', election_year: 2026 },
    { person_id: 'person-2', name: '王小明', current_office_label: '議員' },
  ]);
  const leads = buildEventLeads([{
    category: manifest.categories[0],
    items: [{
      title: '王小明宣布退黨 - 中央社',
      url: 'https://news.google.com/articles/1',
      publishedAt: '2026-08-10T08:00:00Z',
      summary: '王小明表示即日起退黨。',
      publisherName: '中央社',
      publisherUrl: 'https://www.cna.com.tw/',
    }],
  }], watchlist, manifest, new Date('2026-08-11T00:00:00Z'));
  assert.equal(leads.length, 2);
  assert.equal(leads[0].identityStatus, 'ambiguous_same_name');
  assert.equal(leads[0].matchScore, 50);
  assert.equal(leads[0].reviewStatus, 'pending');
  assert.equal(leads[0].autoPublish, false);
});

test('keeps event articles whose person is not yet in the directory', () => {
  const leads = buildEventLeads([{
    category: manifest.categories[0],
    items: [{
      title: '新面孔宣布退黨 - 地方媒體',
      url: 'https://news.google.com/unmatched',
      publishedAt: '2026-08-10T08:00:00Z',
      summary: '',
      publisherName: '地方媒體',
    }],
  }], [], manifest, new Date('2026-08-11T00:00:00Z'));
  assert.equal(leads.length, 1);
  assert.equal(leads[0].identityStatus, 'unmatched_person');
  assert.equal(leads[0].personId, null);
  assert.equal(leads[0].reviewStatus, 'pending');
});

test('drops articles outside the lookback window or without event terms', () => {
  const watchlist = normalizeWatchlist([{ person_id: 'person-1', name: '王小明', election_year: 2026 }]);
  const leads = buildEventLeads([{
    category: manifest.categories[0],
    items: [
      { title: '王小明談政策', url: 'https://news.google.com/1', publishedAt: '2026-08-10T08:00:00Z', summary: '', publisherName: '中央社' },
      { title: '王小明宣布退黨', url: 'https://news.google.com/2', publishedAt: '2026-08-01T08:00:00Z', summary: '', publisherName: '中央社' },
    ],
  }], watchlist, manifest, new Date('2026-08-11T00:00:00Z'));
  assert.equal(leads.length, 0);
});

test('rejects longer-name and commentator-context false positives', () => {
  assert.equal(directEventMatch('王小明完成登記參選市議員', '王小明', ['登記參選', '完成登記'], 'candidacy_status'), true);
  assert.equal(directEventMatch('李政軒突請辭', '李政', ['請辭'], 'office_status'), false);
  assert.equal(directEventMatch('北市發言人才請辭 馬郁雯批評市府', '馬郁雯', ['請辭'], 'office_status'), false);
  assert.equal(directEventMatch('詹江村嗆聲：知廉恥就退選', '詹江村', ['退選'], 'candidacy_status'), false);
  assert.equal(directEventMatch('盧秀燕愛將涉洩密交保', '盧秀燕', ['交保'], 'legal_procedure'), false);
  assert.equal(directEventMatch('蔣萬安發言人李政軒請辭', '蔣萬安', ['請辭'], 'office_status'), false);
  assert.equal(directEventMatch('蔣萬安自打臉？起訴書現蹤影', '蔣萬安', ['起訴'], 'legal_procedure'), false);
  assert.equal(directEventMatch('藍議員要沈伯洋退選', '沈伯洋', ['退選'], 'candidacy_status'), false);
  assert.equal(directEventMatch('范織欽交保 陳麗娜批評新潮流', '陳麗娜', ['交保'], 'legal_procedure'), false);
  assert.equal(directEventMatch('徐巧芯困在大罷免還沒醒', '徐巧芯', ['罷免'], 'office_status'), false);
  assert.equal(directEventMatch('李正皓嗆先辭職', '李正皓', ['辭職'], 'office_status'), false);
  assert.equal(directEventMatch('王小明宣布退出政黨', '王小明', ['退出'], 'party_affiliation'), true);
  assert.equal(directEventMatch('王小明決定退出選舉', '王小明', ['退出'], 'candidacy_status'), true);
  assert.equal(directEventMatch('戴寧遭法院判刑', '戴寧', ['判刑'], 'legal_procedure'), true);
});

test('groups coverage of the same person event while retaining every source lead', () => {
  const groups = groupEventLeads([
    {
      leadKey: 'lead-1', personId: 'person-1', personName: '王小明', category: 'party_affiliation',
      categoryLabel: '黨籍異動', headline: '王小明宣布退黨', publishedAt: '2026-08-10T08:00:00Z',
      matchedTerms: ['退黨'], publisherName: '中央社', autoPublish: false,
    },
    {
      leadKey: 'lead-2', personId: 'person-1', personName: '王小明', category: 'party_affiliation',
      categoryLabel: '黨籍異動', headline: '王小明退黨', publishedAt: '2026-08-10T09:00:00Z',
      matchedTerms: ['退黨'], publisherName: '公視', autoPublish: false,
    },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].sourceCount, 2);
  assert.deepEqual(groups[0].publisherNames, ['中央社', '公視']);
  assert.equal(groups[0].representativeHeadline, '王小明退黨');
  assert.equal(groups[0].autoPublish, false);
});
