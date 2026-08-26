const siteName = '公職資料觀測站';
const englishSiteName = 'Public Office Watch';
const defaultDescription = '查詢臺灣公職人物、政黨、選舉、候選人政見、政治獻金與公開資料來源。';
const canonicalSiteOrigin = 'https://pow4vote.org';
const staticSitemapPaths = ['/', '/people', '/elections', '/parties', '/updates', '/data-guidance', '/about'];
const dynamicSitemapGroups = ['people', 'parties', 'regions', 'elections', 'events', 'races'];
const internalDocumentPaths = new Set([
  '/internal/chat-admin',
  '/internal/data-progress',
  '/internal/review-queue',
  '/internal/update-admin',
]);
const emptySeoCatalog = { version: 1, generatedAt: null, pages: [] };
const emptySeoManifest = { version: 3, generatedAt: null, groups: {} };

let cachedSeoManifestPromise = null;
const cachedSeoCatalogPromises = new Map();

function addSecurityHeaders(response, pathname = '') {
  const headers = new Headers(response.headers);
  headers.set('permissions-policy', 'camera=(), geolocation=(), microphone=()');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  if (pathname.startsWith('/internal/')) {
    headers.set('cache-control', 'no-store');
    headers.set('x-robots-tag', 'noindex, nofollow');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isDocumentRoute(request) {
  if (request.method !== 'GET' || !request.headers.get('accept')?.includes('text/html')) {
    return false;
  }

  const pathSegment = new URL(request.url).pathname.split('/').at(-1) ?? '';
  return !pathSegment.includes('.');
}

function normalizeCatalog(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.pages)) return emptySeoCatalog;

  const pages = value.pages.filter((page) => (
    page
    && typeof page.path === 'string'
    && page.path.startsWith('/')
    && typeof page.title === 'string'
    && typeof page.description === 'string'
    && dynamicSitemapGroups.includes(page.group)
  ));

  return {
    version: 1,
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : null,
    pages,
    pageByPath: new Map(pages.map((page) => [page.path, page])),
  };
}

async function loadSeoCatalog(env, origin) {
  cachedSeoManifestPromise ??= env.ASSETS
    .fetch(new Request(new URL('/seo-catalog.json', origin)))
    .then(async (response) => {
      if (!response.ok) return emptySeoManifest;
      const value = await response.json();
      if (!value || value.version !== 3 || !value.groups || typeof value.groups !== 'object') {
        return emptySeoManifest;
      }
      const groups = Object.fromEntries(Object.entries(value.groups).filter(([group, item]) => (
        dynamicSitemapGroups.includes(group)
        && item
        && Array.isArray(item.paths)
        && item.paths.length > 0
        && item.paths.every((path) => typeof path === 'string' && path.startsWith('/seo-catalog/'))
      )));
      return {
        version: 3,
        generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : null,
        groups,
      };
    })
    .catch(() => emptySeoManifest);

  return cachedSeoManifestPromise;
}

function catalogShardIndex(path, shardCount) {
  let hash = 2166136261;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % shardCount;
}

async function loadSeoCatalogGroup(env, origin, group, pathname = null) {
  if (!group || !dynamicSitemapGroups.includes(group)) return emptySeoCatalog;
  const manifest = await loadSeoCatalog(env, origin);
  const entry = manifest.groups[group];
  if (!entry) return emptySeoCatalog;

  const paths = pathname
    ? [entry.paths[catalogShardIndex(pathname, entry.paths.length)]]
    : entry.paths;
  const catalogs = await Promise.all(paths.map((path) => {
    if (!cachedSeoCatalogPromises.has(path)) {
      cachedSeoCatalogPromises.set(path, env.ASSETS
        .fetch(new Request(new URL(path, origin)))
        .then(async (response) => (response.ok ? normalizeCatalog(await response.json()) : emptySeoCatalog))
        .catch(() => emptySeoCatalog));
    }
    return cachedSeoCatalogPromises.get(path);
  }));

  return normalizeCatalog({
    version: 1,
    generatedAt: manifest.generatedAt,
    pages: catalogs.flatMap((catalog) => catalog.pages),
  });
}

function catalogGroupForPathname(pathname) {
  if (/^\/people\/[^/]+$/.test(pathname)) return 'people';
  if (/^\/parties\/[^/]+$/.test(pathname)) return 'parties';
  if (/^\/regions\/[^/]+$/.test(pathname)) return 'regions';
  if (/^\/elections\/races\/[^/]+$/.test(pathname)) return 'races';
  if (/^\/elections\/events\/[^/]+$/.test(pathname)) return 'events';
  if (/^\/elections\/[^/]+$/.test(pathname)) return 'elections';
  return null;
}

function getCatalogPage(pathname, catalog) {
  if (catalog?.pageByPath instanceof Map) return catalog.pageByPath.get(pathname) ?? null;
  return catalog?.pages?.find((page) => page.path === pathname) ?? null;
}

function documentMetadata(pathname, catalog = emptySeoCatalog) {
  if (pathname.startsWith('/internal/')) {
    return { title: '內部管理', description: '本站內部管理頁面。', noIndex: true };
  }

  const catalogPage = getCatalogPage(pathname, catalog);
  if (catalogPage) {
    return {
      title: catalogPage.title,
      description: catalogPage.description,
      type: catalogPage.structuredData?.['@type'] === 'Person' ? 'profile' : 'website',
      structuredData: catalogPage.structuredData,
    };
  }

  const hasCatalog = Array.isArray(catalog.pages) && catalog.pages.length > 0;

  if (/^\/people\/[^/]+$/.test(pathname)) {
    return { title: '人物資料', description: '查看公職人物的經歷、黨籍、參選紀錄、政見與公開資料來源。', noIndex: hasCatalog };
  }
  if (/^\/parties\/[^/]+$/.test(pathname)) {
    return { title: '政黨資料', description: '查看政黨現任人員、候選人、政治獻金與公開資料統計。', noIndex: hasCatalog };
  }
  if (/^\/regions\/[^/]+$/.test(pathname)) {
    return { title: '區域資料', description: '查看各地公職人員、選舉、候選人與地方議題資料。', noIndex: hasCatalog };
  }
  if (/^\/elections\/races\/[^/]+$/.test(pathname)) {
    return { title: '選區與候選人', description: '查看選區候選人、政黨、得票結果與政見比較。', noIndex: hasCatalog };
  }
  if (/^\/elections\/events\/[^/]+$/.test(pathname)) {
    return { title: '選舉事件', description: '查看選舉事件、選區、候選人、政黨表現與公開資料。', noIndex: hasCatalog };
  }
  if (/^\/elections\/[^/]+$/.test(pathname)) {
    return { title: '選舉資料', description: '查看候選人、選區、得票結果與公開選舉資料來源。', noIndex: hasCatalog };
  }

  const staticMetadata = {
    '/': { title: siteName, description: defaultDescription, home: true },
    '/people': { title: '人物', description: '瀏覽臺灣公職人物的經歷、黨籍、參選紀錄、政見與公開資料來源。' },
    '/elections': { title: '選舉', description: '瀏覽臺灣歷屆選舉、選區、候選人、當選結果與政見比較。' },
    '/parties': { title: '政黨與政治獻金', description: '比較臺灣政黨、現任人員、候選人、政治獻金與公開資料統計。' },
    '/updates': { title: '公開更新動態', description: '查看公職資料觀測站最近已審核並公開的資料新增、修正與功能更新。' },
    '/data-guidance': { title: '資料說明', description: '了解公職資料觀測站如何蒐集、審核、引用與呈現公開資料。' },
    '/about': { title: '關於本站', description: '認識公職資料觀測站的目標、資料原則與開源開發方式。' },
  };

  return staticMetadata[pathname] ?? {
    title: '找不到頁面',
    description: '找不到指定的公開頁面。',
    noIndex: true,
  };
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeXml(value) {
  return escapeAttribute(value).replaceAll("'", '&apos;');
}

function stripManagedMetadata(html) {
  const managedMeta = /<meta\s+(?=[^>]*(?:name|property)=["'](?:description|robots|og:type|og:site_name|og:locale|og:title|og:description|og:url|og:image|og:image:alt|twitter:card|twitter:title|twitter:description|twitter:image)["'])[^>]*>\s*/gi;
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(managedMeta, '')
    .replace(/<link\s+(?=[^>]*rel=["']canonical["'])[^>]*>\s*/gi, '')
    .replace(/<script\s+id=["']public-office-watch-server-structured-data["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
}

function documentResponseStatus(pathname, catalog = emptySeoCatalog) {
  if (staticSitemapPaths.includes(pathname) || internalDocumentPaths.has(pathname)) return 200;
  const group = catalogGroupForPathname(pathname);
  if (!group) return 404;
  const hasCatalog = Array.isArray(catalog.pages) && catalog.pages.length > 0;
  return hasCatalog && !getCatalogPage(pathname, catalog) ? 404 : 200;
}

function injectDocumentMetadata(html, requestUrl, catalog = emptySeoCatalog, siteOrigin = canonicalSiteOrigin) {
  const url = new URL(requestUrl);
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const metadata = documentMetadata(pathname, catalog);
  const canonicalUrl = new URL(pathname, siteOrigin).toString();
  const imageUrl = new URL('/og.png', siteOrigin).toString();
  const fullTitle = metadata.home
    ? `${siteName}｜${englishSiteName}`
    : `${metadata.title}｜${siteName}`;
  const robots = metadata.noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';
  const structuredData = JSON.stringify({
    ...(metadata.structuredData ?? {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      alternateName: englishSiteName,
    }),
    url: metadata.home ? new URL('/', siteOrigin).toString() : canonicalUrl,
  }).replaceAll('<', '\\u003c');
  const tags = `
    <title>${escapeAttribute(fullTitle)}</title>
    <meta name="description" content="${escapeAttribute(metadata.description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />
    <meta property="og:type" content="${metadata.type ?? 'website'}" />
    <meta property="og:site_name" content="${siteName}" />
    <meta property="og:locale" content="zh_TW" />
    <meta property="og:title" content="${escapeAttribute(fullTitle)}" />
    <meta property="og:description" content="${escapeAttribute(metadata.description)}" />
    <meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />
    <meta property="og:image" content="${escapeAttribute(imageUrl)}" />
    <meta property="og:image:alt" content="${siteName}｜${englishSiteName}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(fullTitle)}" />
    <meta name="twitter:description" content="${escapeAttribute(metadata.description)}" />
    <meta name="twitter:image" content="${escapeAttribute(imageUrl)}" />
    <script id="public-office-watch-server-structured-data" type="application/ld+json">${structuredData}</script>`;

  return stripManagedMetadata(html).replace('</head>', `${tags}\n  </head>`);
}

function sitemapXml(origin, entries = staticSitemapPaths) {
  const urls = entries.map((entry) => (typeof entry === 'string' ? { path: entry } : entry));
  const body = urls
    .map((entry) => {
      const location = escapeXml(new URL(entry.path, origin).toString());
      const lastModified = entry.lastModified ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>` : '';
      return `  <url><loc>${location}</loc>${lastModified}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function sitemapEntries(catalog, group) {
  if (group === 'static') return staticSitemapPaths;
  return catalog.pages
    .filter((page) => page.group === group)
    .map((page) => ({ path: page.path, lastModified: page.lastModified }));
}

function sitemapIndexXml(origin, catalog = emptySeoCatalog) {
  const availableGroups = catalog.version === 3
    ? dynamicSitemapGroups.filter((group) => catalog.groups?.[group])
    : dynamicSitemapGroups.filter((group) => catalog.pages.some((page) => page.group === group));
  const groups = ['static', ...availableGroups];
  const entries = groups
    .map((group) => `  <sitemap><loc>${escapeXml(new URL(`/sitemaps/${group}.xml`, origin).toString())}</loc></sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

function robotsText(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /internal/\nSitemap: ${new URL('/sitemap.xml', origin)}\n`;
}

function textResponse(body, contentType) {
  return addSecurityHeaders(new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=3600',
    },
  }));
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/robots.txt') {
      return textResponse(robotsText(canonicalSiteOrigin), 'text/plain; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/sitemap.xml') {
      const manifest = await loadSeoCatalog(env, url.origin);
      return textResponse(sitemapIndexXml(canonicalSiteOrigin, manifest), 'application/xml; charset=utf-8');
    }
    const sitemapMatch = url.pathname.match(/^\/sitemaps\/([a-z]+)\.xml$/);
    if (request.method === 'GET' && sitemapMatch) {
      const group = sitemapMatch[1];
      if (group !== 'static' && !dynamicSitemapGroups.includes(group)) {
        return addSecurityHeaders(new Response('Not found', { status: 404 }));
      }
      const catalog = group === 'static'
        ? emptySeoCatalog
        : await loadSeoCatalogGroup(env, url.origin, group);
      return textResponse(sitemapXml(canonicalSiteOrigin, sitemapEntries(catalog, group)), 'application/xml; charset=utf-8');
    }
    if (isDocumentRoute(request)) {
      const group = catalogGroupForPathname(url.pathname.replace(/\/$/, '') || '/');
      const [indexResponse, catalog] = await Promise.all([
        env.ASSETS.fetch(new Request(new URL('/', request.url), request)),
        loadSeoCatalogGroup(env, url.origin, group, url.pathname.replace(/\/$/, '') || '/'),
      ]);
      const pathname = url.pathname.replace(/\/$/, '') || '/';
      const html = injectDocumentMetadata(await indexResponse.text(), request.url, catalog, canonicalSiteOrigin);
      const headers = new Headers(indexResponse.headers);
      headers.set('content-type', 'text/html; charset=utf-8');
      return addSecurityHeaders(new Response(html, {
        status: documentResponseStatus(pathname, catalog),
        headers,
      }), url.pathname);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return addSecurityHeaders(assetResponse, url.pathname);
  },
};

export default worker;
export {
  addSecurityHeaders,
  documentMetadata,
  documentResponseStatus,
  injectDocumentMetadata,
  robotsText,
  sitemapIndexXml,
  sitemapXml,
};
