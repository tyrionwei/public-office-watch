import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareSources,
  extractReferendumLinks,
  isCecUrl,
  parseArgs,
} from './cec-referendum-source-monitor.mjs';

test('accepts only official HTTPS CEC URLs', () => {
  assert.equal(isCecUrl('https://web.cec.gov.tw/referendum'), true);
  assert.equal(isCecUrl('https://example.com/cec.gov.tw'), false);
  assert.equal(isCecUrl('http://web.cec.gov.tw/referendum'), false);
});

test('extracts referendum links and rejects unrelated or external links', () => {
  const html = `
    <a href="/referendum/article/1">全國性公民投票第22案</a>
    <a href="/news/2">一般新聞</a>
    <a href="https://example.com/referendum">公投轉載</a>
  `;
  assert.deepEqual(extractReferendumLinks(html, 'https://web.cec.gov.tw/referendum'), [
    {
      title: '全國性公民投票第22案',
      url: 'https://web.cec.gov.tw/referendum/article/1',
    },
  ]);
});

test('extracts server-rendered CEC article list items without hrefs', () => {
  const html = '<li class="articleItem" role="link"><span class="date">114.08.29</span> 114年全國性公民投票第21案投票結果</li>';
  const discoveries = extractReferendumLinks(html, 'https://web.cec.gov.tw/referendum/article/list/3863?page=1');
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].title, '114.08.29 114年全國性公民投票第21案投票結果');
  assert.match(discoveries[0].url, /^https:\/\/web\.cec\.gov\.tw\/referendum\/article\/list\/3863\?page=1#item-/);
});

test('extracts referendum homepage article cards', () => {
  const html = `
    <div class="article-item">
      <span class="article-link">公告全國性公民投票案舉行聽證</span>
      <div class="article-time">115.07.06</div>
      <div class="divider-with-balls"></div>
    </div>
  `;
  const discoveries = extractReferendumLinks(html, 'https://web.cec.gov.tw/referendum');
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].title, '115.07.06 公告全國性公民投票案舉行聽證');
});

test('extracts referendum proposals embedded in the Nuxt payload', () => {
  const payload = JSON.stringify([{ articleList: [{ title: '張三領銜提出之「您是否同意新增測試規範？」全國性公民投票案' }] }]);
  const html = `<script type="application/json" id="__NUXT_DATA__">${payload}</script>`;
  const discoveries = extractReferendumLinks(html, 'https://web.cec.gov.tw/referendum');
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].title, '張三領銜提出之「您是否同意新增測試規範？」全國性公民投票案');
});

test('first run is a baseline and later runs report only new discoveries', () => {
  const first = [{
    key: 'results',
    contentHash: 'one',
    discoveries: [{ title: '第21案', url: 'https://web.cec.gov.tw/referendum/article/21' }],
  }];
  assert.deepEqual(compareSources(first)[0].newDiscoveries, []);
  assert.equal(compareSources(first)[0].baseline, true);

  const next = [{
    key: 'results',
    contentHash: 'two',
    discoveries: [
      { title: '第21案', url: 'https://web.cec.gov.tw/referendum/article/21' },
      { title: '第22案', url: 'https://web.cec.gov.tw/referendum/article/22' },
    ],
  }];
  const compared = compareSources(next, { sources: first })[0];
  assert.equal(compared.changed, true);
  assert.deepEqual(compared.newDiscoveries, [
    { title: '第22案', url: 'https://web.cec.gov.tw/referendum/article/22' },
  ]);
});

test('parses local report paths', () => {
  const options = parseArgs(['--output', 'tmp/report.json']);
  assert.equal(options.previousPath, null);
  assert.match(options.outputPath, /tmp[\\/]report\.json$/);
  assert.equal(options.snapshotDir, null);
});
