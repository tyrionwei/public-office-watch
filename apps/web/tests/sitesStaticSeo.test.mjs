import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import worker, {
  addSecurityHeaders,
  documentMetadata,
  documentResponseStatus,
  injectDocumentMetadata,
  robotsText,
  shareCardForUrl,
  shareCardSvg,
  sitemapIndexXml,
  sitemapXml,
} from '../worker/sites-static.js';

const wranglerConfig = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));

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
      sharePolicies: [{ key: 'claim-1:item-1', text: '增設公共托育據點，降低家庭照顧負擔。' }],
      structuredData: { '@context': 'https://schema.org', '@type': 'Person', name: '王小明' },
    },
    {
      group: 'events',
      path: '/elections/events/2026-11-28-local',
      title: '2026 地方公職人員選舉',
      description: '查看2026 地方公職人員選舉的選區、候選人、政黨表現與公開資料。',
      structuredData: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '2026 地方公職人員選舉' },
    },
    {
      group: 'elections',
      path: '/elections/election-1',
      title: '2026 地方選舉',
      description: '查看2026 地方選舉的候選人、選區、得票結果與公開資料來源。',
      structuredData: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '2026 地方選舉' },
    },
    {
      group: 'races',
      path: '/elections/races/race-1',
      title: '臺北市市長選舉',
      description: '查看臺北市市長選舉的候選人、政黨、得票結果與政見比較。',
      shareCandidates: [
        { personId: 'person-1', name: '王小明' },
        { personId: 'person-2', name: '李小華' },
      ],
      structuredData: { '@context': 'https://schema.org', '@type': 'WebPage', name: '臺北市市長選舉' },
    },
  ],
};

test('routes every document path through the Worker while bypassing static assets', () => {
  assert.deepEqual(wranglerConfig.assets.run_worker_first, [
    '/*',
    '!/assets/*',
    '!/seo-catalog/*',
    '!/seo-catalog.json',
    '!/og.png',
    '!/og-policy.png',
    '!/og-comparison.png',
    '!/site.webmanifest',
    '!/service-worker.js',
    '!/offline.html',
    '!/index.html',
  ]);
});

test('document responses allow same-origin geolocation with matching static policy', async () => {
  const expectedPolicy = 'camera=(), geolocation=(self), microphone=(), payment=(), usb=()';
  const staticHeaders = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.equal(staticHeaders.match(/^  Permissions-Policy: (.+)$/m)?.[1], expectedPolicy);

  for (const method of ['GET', 'HEAD']) {
    const response = await worker.fetch(new Request('https://pow4vote.org/', {
      method,
      headers: { accept: 'text/html' },
    }), {
      ASSETS: {
        fetch: async () => new Response(baseHtml, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('permissions-policy'), expectedPolicy);
  }
});

test('returns a real 404 document for a generic unknown route', async () => {
  const response = await worker.fetch(new Request('https://pow4vote.org/not-a-real-route', {
    headers: { accept: 'text/html' },
  }), {
    ASSETS: {
      fetch: async () => new Response(baseHtml, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    },
  });

  assert.equal(response.status, 404);
  assert.match(await response.text(), /<title>找不到頁面｜公職資料觀測站<\/title>/);
});

test('injects exact catalog metadata and absolute social URLs', () => {
  const html = injectDocumentMetadata(baseHtml, 'https://preview.example/people/person-1?tab=history', catalog);

  assert.match(html, /<title>王小明｜公職資料觀測站<\/title>/);
  assert.match(html, /查看王小明的公職、黨籍、參選、政見與公開資料來源。/);
  assert.match(html, /<div id="root"><main data-server-rendered-fallback="true">/);
  assert.match(html, /<h1>王小明<\/h1>/);
  assert.match(html, /<p>查看王小明的公職、黨籍、參選、政見與公開資料來源。<\/p>/);
  assert.match(html, /rel="canonical" href="https:\/\/pow4vote\.org\/people\/person-1"/);
  assert.match(html, /property="og:type" content="profile"/);
  assert.match(html, /property="og:image" content="https:\/\/pow4vote\.org\/og\.png"/);
  assert.equal((html.match(/property="og:title"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Old title|Old description|old\.png/);
});

test('injects policy and candidate-comparison share previews from exact share URLs', () => {
  const policyHtml = injectDocumentMetadata(
    baseHtml,
    'https://pow4vote.org/people/person-1?policy=claim-1%3Aitem-1#policy-claim-1-item-1',
    catalog,
  );
  const comparisonHtml = injectDocumentMetadata(
    baseHtml,
    'https://pow4vote.org/elections/races/race-1?compare=person-1%2Cperson-2#candidate-comparison',
    catalog,
  );

  assert.match(policyHtml, /<title>王小明的政見｜公職資料觀測站<\/title>/);
  assert.match(policyHtml, /rel="canonical" href="https:\/\/pow4vote\.org\/people\/person-1\?policy=claim-1%3Aitem-1"/);
  assert.match(policyHtml, /property="og:image" content="https:\/\/pow4vote\.org\/og\/share\.png\?path=%2Fpeople%2Fperson-1&amp;policy=claim-1%3Aitem-1&amp;v=2026-08-11T00%3A00%3A00\.000Z"/);
  assert.match(comparisonHtml, /<title>臺北市市長選舉候選人比較｜公職資料觀測站<\/title>/);
  assert.match(comparisonHtml, /rel="canonical" href="https:\/\/pow4vote\.org\/elections\/races\/race-1\?compare=person-1%2Cperson-2"/);
  assert.match(comparisonHtml, /property="og:image" content="https:\/\/pow4vote\.org\/og\/share\.png\?path=%2Felections%2Fraces%2Frace-1&amp;compare=person-1%2Cperson-2&amp;v=2026-08-11T00%3A00%3A00\.000Z"/);
});

test('resolves only published catalog content into compact share cards', () => {
  const policy = shareCardForUrl(new URL(
    'https://pow4vote.org/og/share.png?path=%2Fpeople%2Fperson-1&policy=claim-1%3Aitem-1',
  ), catalog);
  const comparison = shareCardForUrl(new URL(
    'https://pow4vote.org/og/share.png?path=%2Felections%2Fraces%2Frace-1&compare=person-2%2Cperson-1',
  ), catalog);

  assert.deepEqual(policy, {
    kind: 'policy',
    eyebrow: '單一政見',
    title: '王小明',
    body: '增設公共托育據點，降低家庭照顧負擔。',
  });
  assert.deepEqual(comparison, {
    kind: 'comparison',
    eyebrow: '候選人比較',
    title: '臺北市市長選舉',
    body: '李小華、王小明',
  });
  assert.equal(shareCardForUrl(new URL(
    'https://pow4vote.org/og/share.png?path=%2Fpeople%2Fperson-1&policy=claim-1%3Aforged',
  ), catalog), null);

  const svg = shareCardSvg(policy);
  assert.match(svg, /單一政見/);
  assert.match(svg, /王小明/);
  assert.match(svg, /增設公共托育據點/);
  assert.match(svg, /y="276" class="title"/);
  assert.match(svg, /y="390" class="body"/);
  assert.doesNotMatch(svg, /<script/iu);
});

test('covers election detail routes and marks private or unknown routes as noindex', () => {
  assert.equal(documentMetadata('/elections/election-1', catalog).title, '2026 地方選舉');
  assert.equal(documentMetadata('/elections/events/2026-11-28-local', catalog).title, '2026 地方公職人員選舉');
  assert.equal(documentMetadata('/support', catalog).title, '支持本站');
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
  assert.equal(documentResponseStatus('/support', catalog), 200);
  assert.equal(documentResponseStatus('/internal/chat-admin', catalog), 200);
  assert.equal(documentResponseStatus('/people/person-1', catalog), 200);
  assert.equal(documentResponseStatus('/people/missing', catalog), 404);
  assert.equal(documentResponseStatus('/elections/events/missing', catalog), 404);
  assert.equal(documentResponseStatus('/missing', catalog), 404);
  assert.equal(documentResponseStatus('/people/missing'), 503);
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
  assert.match(publicResponse.headers.get('content-security-policy') ?? '', /default-src 'self'/u);
  assert.match(
    publicResponse.headers.get('content-security-policy') ?? '',
    /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/u,
  );
  assert.match(
    publicResponse.headers.get('content-security-policy') ?? '',
    /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/u,
  );
  assert.equal(publicResponse.headers.get('strict-transport-security'), 'max-age=31536000');
  assert.equal(publicResponse.headers.get('x-permitted-cross-domain-policies'), 'none');
});

test('publishes a sitemap index with separated public entity maps', () => {
  const index = sitemapIndexXml('https://watch.example', catalog);
  const people = sitemapXml('https://watch.example', catalog.pages.filter((page) => page.group === 'people'));
  const robots = robotsText('https://watch.example');

  assert.match(index, /https:\/\/watch\.example\/sitemaps\/static\.xml/);
  assert.match(sitemapXml('https://watch.example'), /https:\/\/watch\.example\/support/);
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

test('serves metadata endpoint HEAD requests with the same content types as GET', async () => {
  const { env } = assetFixture();
  const cases = [
    ['/robots.txt', 'text/plain; charset=utf-8'],
    ['/sitemap.xml', 'application/xml; charset=utf-8'],
    ['/sitemaps/people.xml', 'application/xml; charset=utf-8'],
  ];

  for (const [pathname, contentType] of cases) {
    const response = await worker.fetch(new Request(`https://pow4vote.org${pathname}`, { method: 'HEAD' }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), contentType);
    assert.equal(await response.text(), '');
  }
});

function assetFixture() {
  const groups = ['people', 'parties', 'regions', 'elections', 'events', 'races'];
  const state = {
    calls: [], failures: new Set(), overrides: new Map(), rootStatus: 200,
    manifest: { version: 3, groups: Object.fromEntries(groups.map(group => [group, { paths: [`/seo-catalog/${group}.json`] }])) },
  };
  const env = { ASSETS: { fetch: async request => {
    const path = new URL(request.url).pathname;
    state.calls.push({ path, method: request.method, headers: Object.fromEntries(request.headers) });
    if (state.failures.has(path)) return new Response('Controlled unavailable', { status: 503 });
    if (state.overrides.has(path)) return new Response(state.overrides.get(path), { headers: { 'content-type': 'application/json' } });
    if (path === '/seo-catalog.json') return Response.json(state.manifest);
    if (path.startsWith('/seo-catalog/')) return Response.json({ version: 1, pages: catalog.pages.filter(page => path === `/seo-catalog/${page.group}.json`) });
    return new Response([204, 304].includes(state.rootStatus) ? null : baseHtml, {
      status: state.rootStatus, headers: { 'content-type': 'text/html', etag: 'root-only', 'content-length': '123', 'last-modified': 'Wed, 09 Sep 2026 00:00:00 GMT' },
    });
  } } };
  return { env, state };
}
const documentRequest = (path, method = 'GET', headers = {}) => new Request('https://pow4vote.org' + path, { method, headers: { accept: 'text/html', ...headers } });

test('document GET and HEAD use unconditional root GET and remove transformed validators', async () => {
  const { env, state } = assetFixture();
  const headers = { 'if-none-match': 'root-only', 'if-modified-since': 'Wed, 09 Sep 2026 00:00:00 GMT', range: 'bytes=0-10' };
  const get = await worker.fetch(documentRequest('/people/person-1', 'GET', headers), env);
  const head = await worker.fetch(documentRequest('/people/person-1', 'HEAD', headers), env);
  assert.equal(get.status, 200); assert.equal(head.status, 200);
  assert.match(await get.text(), /王小明/); assert.equal(await head.text(), '');
  assert.deepEqual([...get.headers], [...head.headers]);
  for (const name of ['etag', 'last-modified', 'content-length']) assert.equal(get.headers.get(name), null);
  for (const call of state.calls.filter(call => call.path === '/')) {
    assert.equal(call.method, 'GET');
    assert.equal(call.headers['if-none-match'], undefined);
    assert.equal(call.headers['if-modified-since'], undefined);
    assert.equal(call.headers.range, undefined);
  }
});

for (const status of [204, 304, 404, 503]) {
  test(`root asset ${status} never becomes a successful empty document`, async () => {
    const { env, state } = assetFixture(); state.rootStatus = status;
    for (const method of ['GET', 'HEAD']) {
      const response = await worker.fetch(documentRequest('/about', method), env);
      assert.equal(response.status, status === 204 || status === 304 ? 503 : status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  });
}

for (const failingPath of ['/seo-catalog.json', '/seo-catalog/people.json']) {
  test(`${failingPath} failure retries after cooldown in the same isolate`, async t => {
    let now = 1000; t.mock.method(Date, 'now', () => now);
    const { env, state } = assetFixture(); state.failures.add(failingPath);
    let response = await worker.fetch(documentRequest('/people/person-1'), env);
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    state.failures.clear();
    response = await worker.fetch(documentRequest('/people/person-1'), env);
    assert.equal(response.status, 503);
    assert.equal(state.calls.filter(call => call.path === failingPath).length, 1);
    now += 1001;
    response = await worker.fetch(documentRequest('/people/person-1'), env);
    assert.equal(response.status, 200); assert.match(await response.text(), /王小明/);
    await worker.fetch(documentRequest('/people/person-1'), env);
    assert.equal(state.calls.filter(call => call.path === failingPath).length, 2);
  });
}

test('a valid empty catalog is an authoritative missing entity for both GET and HEAD', async () => {
  const { env, state } = assetFixture();
  state.overrides.set('/seo-catalog/people.json', JSON.stringify({ version: 1, pages: [] }));
  for (const method of ['GET', 'HEAD']) {
    const response = await worker.fetch(documentRequest('/people/missing', method), env);
    assert.equal(response.status, 404);
    if (method === 'GET') assert.match(await response.text(), /noindex,nofollow/);
    else assert.equal(await response.text(), '');
  }
});

test('invalid JSON, invalid page shape, or missing required group is unavailable, not missing', async () => {
  for (const invalid of ['not-json', JSON.stringify({ version: 1, pages: [{}] }), JSON.stringify({ version: 9, pages: [] })]) {
    const { env, state } = assetFixture(); state.overrides.set('/seo-catalog/people.json', invalid);
    const response = await worker.fetch(documentRequest('/people/missing'), env);
    assert.equal(response.status, 503);
  }
  const { env, state } = assetFixture(); delete state.manifest.groups.people;
  assert.equal((await worker.fetch(documentRequest('/people/missing'), env)).status, 503);
});

test('unavailable dynamic sitemaps and previews do not return partial successful content', async () => {
  const { env, state } = assetFixture();
  state.manifest.groups.people.paths.push('/seo-catalog/people-extra.json');
  state.failures.add('/seo-catalog/people-extra.json');
  state.failures.add('/seo-catalog/races.json');
  for (const method of ['GET', 'HEAD']) {
    assert.equal((await worker.fetch(new Request('https://pow4vote.org/sitemaps/people.xml', { method }), env)).status, 503);
    assert.equal((await worker.fetch(new Request('https://pow4vote.org/og/share.png?path=%2Felections%2Fraces%2Frace-1&compare=person-1,person-2', { method }), env)).status, 503);
    assert.equal((await worker.fetch(new Request('https://pow4vote.org/sitemaps/static.xml', { method }), env)).status, 200);
  }
});

test('successful catalogs are isolated by asset binding', async () => {
  const first = assetFixture(), second = assetFixture();
  second.state.overrides.set('/seo-catalog/people.json', JSON.stringify({ version: 1, pages: [] }));
  assert.equal((await worker.fetch(documentRequest('/people/person-1'), first.env)).status, 200);
  assert.equal((await worker.fetch(documentRequest('/people/person-1'), second.env)).status, 404);
});

test('a shared shard path across groups cannot turn unavailable data into a cached missing entity', async () => {
  const { env, state } = assetFixture();
  state.manifest.groups.races.paths = state.manifest.groups.people.paths;
  assert.equal((await worker.fetch(documentRequest('/people/person-1'), env)).status, 503);
  assert.equal((await worker.fetch(documentRequest('/elections/races/missing'), env)).status, 503);
});
