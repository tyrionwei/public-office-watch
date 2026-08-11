import assert from 'node:assert/strict';
import test from 'node:test';
import {
  documentMetadata,
  injectDocumentMetadata,
  robotsText,
  sitemapIndexXml,
  sitemapXml,
} from '../worker/sites-static.js';

const baseHtml = `<!doctype html><html><head>
  <title>Old title</title>
  <meta name="description" content="Old description" />
  <meta property="og:title" content="Old title" />
  <meta property="og:image" content="/old.png" />
</head><body><div id="root"></div></body></html>`;

const catalog = {
  version: 1,
  generatedAt: '2026-08-11T00:00:00.000Z',
  pages: [
    {
      group: 'people',
      path: '/people/person-1',
      title: '王小明',
      description: '查看王小明的公職、黨籍、參選、政見與公開資料來源。',
      lastModified: '2026-08-10T00:00:00.000Z',
      structuredData: { '@context': 'https://schema.org', '@type': 'Person', name: '王小明' },
    },
    {
      group: 'elections',
      path: '/elections/election-1',
      title: '2026 地方選舉',
      description: '查看2026 地方選舉的候選人、選區、得票結果與公開資料來源。',
      structuredData: { '@context': 'https://schema.org', '@type': 'Event', name: '2026 地方選舉' },
    },
  ],
};

test('injects exact catalog metadata and absolute social URLs', () => {
  const html = injectDocumentMetadata(baseHtml, 'https://watch.example/people/person-1?tab=history', catalog);

  assert.match(html, /<title>王小明｜公職資料觀測站<\/title>/);
  assert.match(html, /查看王小明的公職、黨籍、參選、政見與公開資料來源。/);
  assert.match(html, /rel="canonical" href="https:\/\/watch\.example\/people\/person-1"/);
  assert.match(html, /property="og:type" content="profile"/);
  assert.match(html, /property="og:image" content="https:\/\/watch\.example\/og\.png"/);
  assert.equal((html.match(/property="og:title"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Old title|Old description|old\.png/);
});

test('covers election detail routes and marks private or unknown routes as noindex', () => {
  assert.equal(documentMetadata('/elections/election-1', catalog).title, '2026 地方選舉');
  assert.equal(documentMetadata('/people/missing', catalog).noIndex, true);
  assert.equal(documentMetadata('/internal/chat-admin', catalog).noIndex, true);
  assert.equal(documentMetadata('/missing', catalog).noIndex, true);
  assert.match(
    injectDocumentMetadata(baseHtml, 'https://watch.example/internal/chat-admin', catalog),
    /name="robots" content="noindex,nofollow"/,
  );
});

test('publishes a sitemap index with separated public entity maps', () => {
  const index = sitemapIndexXml('https://watch.example', catalog);
  const people = sitemapXml('https://watch.example', catalog.pages.filter((page) => page.group === 'people'));
  const robots = robotsText('https://watch.example');

  assert.match(index, /https:\/\/watch\.example\/sitemaps\/static\.xml/);
  assert.match(index, /https:\/\/watch\.example\/sitemaps\/people\.xml/);
  assert.match(index, /https:\/\/watch\.example\/sitemaps\/elections\.xml/);
  assert.match(people, /https:\/\/watch\.example\/people\/person-1/);
  assert.match(people, /<lastmod>2026-08-10T00:00:00\.000Z<\/lastmod>/);
  assert.doesNotMatch(people, /internal/);
  assert.match(robots, /Disallow: \/internal\//);
  assert.match(robots, /Sitemap: https:\/\/watch\.example\/sitemap\.xml/);
});
