import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addSecurityHeaders,
  documentMetadata,
  documentResponseStatus,
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
      group: 'events',
      path: '/elections/events/2026-11-28-local',
      title: '2026 地方公職人員選舉',
      description: '查看2026 地方公職人員選舉的選區、候選人、政黨表現與公開資料。',
      structuredData: { '@context': 'https://schema.org', '@type': 'Event', name: '2026 地方公職人員選舉' },
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
  const html = injectDocumentMetadata(baseHtml, 'https://preview.example/people/person-1?tab=history', catalog);

  assert.match(html, /<title>王小明｜公職資料觀測站<\/title>/);
  assert.match(html, /查看王小明的公職、黨籍、參選、政見與公開資料來源。/);
  assert.match(html, /rel="canonical" href="https:\/\/pow4vote\.org\/people\/person-1"/);
  assert.match(html, /property="og:type" content="profile"/);
  assert.match(html, /property="og:image" content="https:\/\/pow4vote\.org\/og\.png"/);
  assert.equal((html.match(/property="og:title"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Old title|Old description|old\.png/);
});

test('covers election detail routes and marks private or unknown routes as noindex', () => {
  assert.equal(documentMetadata('/elections/election-1', catalog).title, '2026 地方選舉');
  assert.equal(documentMetadata('/elections/events/2026-11-28-local', catalog).title, '2026 地方公職人員選舉');
  assert.equal(documentMetadata('/people/missing', catalog).noIndex, true);
  assert.equal(documentMetadata('/internal/chat-admin', catalog).noIndex, true);
  assert.equal(documentMetadata('/missing', catalog).noIndex, true);
  assert.match(
    injectDocumentMetadata(baseHtml, 'https://watch.example/internal/chat-admin', catalog),
    /name="robots" content="noindex,nofollow"/,
  );
});

test('returns real document statuses for known, missing entity, and unknown routes', () => {
  assert.equal(documentResponseStatus('/about', catalog), 200);
  assert.equal(documentResponseStatus('/internal/chat-admin', catalog), 200);
  assert.equal(documentResponseStatus('/people/person-1', catalog), 200);
  assert.equal(documentResponseStatus('/people/missing', catalog), 404);
  assert.equal(documentResponseStatus('/elections/events/missing', catalog), 404);
  assert.equal(documentResponseStatus('/missing', catalog), 404);
  assert.equal(documentResponseStatus('/people/missing'), 200);
});

test('forces private cache and crawler headers on internal routes', () => {
  const response = addSecurityHeaders(new Response('private', {
    headers: { 'cache-control': 'public, max-age=0' },
  }), '/internal/review-queue');
  const publicResponse = addSecurityHeaders(new Response('public', {
    headers: { 'cache-control': 'public, max-age=0' },
  }), '/about');

  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(publicResponse.headers.get('cache-control'), 'public, max-age=0');
  assert.equal(publicResponse.headers.get('x-robots-tag'), null);
});

test('publishes a sitemap index with separated public entity maps', () => {
  const index = sitemapIndexXml('https://watch.example', catalog);
  const people = sitemapXml('https://watch.example', catalog.pages.filter((page) => page.group === 'people'));
  const robots = robotsText('https://watch.example');

  assert.match(index, /https:\/\/watch\.example\/sitemaps\/static\.xml/);
  assert.match(index, /https:\/\/watch\.example\/sitemaps\/people\.xml/);
  assert.match(index, /https:\/\/watch\.example\/sitemaps\/elections\.xml/);
  assert.match(index, /https:\/\/watch\.example\/sitemaps\/events\.xml/);
  assert.match(people, /https:\/\/watch\.example\/people\/person-1/);
  assert.match(people, /<lastmod>2026-08-10T00:00:00\.000Z<\/lastmod>/);
  assert.doesNotMatch(people, /internal/);
  assert.match(robots, /Disallow: \/internal\//);
  assert.match(robots, /Sitemap: https:\/\/watch\.example\/sitemap\.xml/);
});

test('publishes sitemap groups from a split catalog manifest', () => {
  const manifest = {
    version: 3,
    generatedAt: '2026-08-11T00:00:00.000Z',
    groups: {
      people: { paths: ['/seo-catalog/people-0.json'], count: 1 },
      races: { paths: ['/seo-catalog/races-0.json'], count: 1 },
    },
  };
  const index = sitemapIndexXml('https://watch.example', manifest);

  assert.match(index, /sitemaps\/people\.xml/);
  assert.match(index, /sitemaps\/races\.xml/);
  assert.doesNotMatch(index, /sitemaps\/elections\.xml/);
});
