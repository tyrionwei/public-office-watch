import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSources = [
  {
    key: 'cec-referendum-home',
    name: '中選會公投專區',
    url: 'https://web.cec.gov.tw/referendum',
  },
  {
    key: 'cec-referendum-results',
    name: '中選會公投投票結果',
    url: 'https://web.cec.gov.tw/referendum/article/list/3863?page=1',
  },
  {
    key: 'cec-local-referendum-results',
    name: '中選會地方性公投',
    url: 'https://web.cec.gov.tw/referendum/article/32310',
  },
];

function parseArgs(argv) {
  const options = { previousPath: null, outputPath: null, snapshotDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--previous') options.previousPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--snapshot-dir') options.snapshotDir = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (options.previousPath && !fs.existsSync(options.previousPath)) {
    throw new Error(`Previous report not found: ${options.previousPath}`);
  }
  return options;
}

function isCecUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (hostname === 'cec.gov.tw' || hostname.endsWith('.cec.gov.tw'));
  } catch {
    return false;
  }
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function isReferendumDiscovery(title, url) {
  const searchable = `${title} ${decodeURIComponent(url)}`;
  return /公民投票|公投|複決|領銜提出之/.test(searchable);
}

function extractReferendumLinks(html, baseUrl) {
  const links = new Map();
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    let url;
    try {
      url = new URL(decodeHtml(match[3]), baseUrl);
    } catch {
      continue;
    }
    url.hash = '';
    const normalizedUrl = url.toString();
    const title = decodeHtml(match[5]);
    if (!isCecUrl(normalizedUrl) || !isReferendumDiscovery(title, normalizedUrl)) continue;
    links.set(normalizedUrl, { title: title || normalizedUrl, url: normalizedUrl });
  }
  const listItemPattern = /<li\b[^>]*class\s*=\s*(["'])[^"']*\barticleItem\b[^"']*\1[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(listItemPattern)) {
    const title = decodeHtml(match[2]);
    if (!isReferendumDiscovery(title, baseUrl)) continue;
    const itemUrl = new URL(baseUrl);
    itemUrl.hash = `item-${crypto.createHash('sha256').update(title).digest('hex').slice(0, 16)}`;
    links.set(itemUrl.toString(), { title, url: itemUrl.toString() });
  }
  const homeArticlePattern = /<div\b[^>]*class\s*=\s*(["'])[^"']*\barticle-item\b[^"']*\1[^>]*>([\s\S]*?)<div\b[^>]*class\s*=\s*(["'])[^"']*\bdivider-with-balls\b[^"']*\3/gi;
  for (const match of html.matchAll(homeArticlePattern)) {
    const titleMatch = match[2].match(/<span\b[^>]*class\s*=\s*(["'])[^"']*\barticle-link\b[^"']*\1[^>]*>([\s\S]*?)<\/span>/i);
    const dateMatch = match[2].match(/<div\b[^>]*class\s*=\s*(["'])[^"']*\barticle-time\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/i);
    const title = decodeHtml(`${dateMatch?.[2] ?? ''} ${titleMatch?.[2] ?? ''}`);
    if (!isReferendumDiscovery(title, baseUrl)) continue;
    const itemUrl = new URL(baseUrl);
    itemUrl.hash = `item-${crypto.createHash('sha256').update(title).digest('hex').slice(0, 16)}`;
    links.set(itemUrl.toString(), { title, url: itemUrl.toString() });
  }
  const nuxtDataMatch = html.match(/<script\b[^>]*id\s*=\s*(["'])__NUXT_DATA__\1[^>]*>([\s\S]*?)<\/script>/i);
  if (nuxtDataMatch) {
    try {
      const pending = [JSON.parse(nuxtDataMatch[2])];
      while (pending.length > 0) {
        const value = pending.pop();
        if (Array.isArray(value)) pending.push(...value);
        else if (value && typeof value === 'object') pending.push(...Object.values(value));
        else if (typeof value === 'string') {
          const title = decodeHtml(value);
          if (title.length < 20 || title.startsWith('<') || !isReferendumDiscovery(title, baseUrl)) continue;
          const itemUrl = new URL(baseUrl);
          itemUrl.hash = `item-${crypto.createHash('sha256').update(title).digest('hex').slice(0, 16)}`;
          links.set(itemUrl.toString(), { title, url: itemUrl.toString() });
        }
      }
    } catch {
      // A malformed framework payload must not hide valid server-rendered links.
    }
  }
  return Array.from(links.values()).sort((left, right) => left.url.localeCompare(right.url));
}

function contentHash(discoveries) {
  return crypto.createHash('sha256').update(JSON.stringify(discoveries)).digest('hex');
}

function compareSources(current, previous = null) {
  const previousSources = new Map((previous?.sources ?? []).map((source) => [source.key, source]));
  return current.map((source) => {
    const before = previousSources.get(source.key);
    const beforeUrls = new Set((before?.discoveries ?? []).map((item) => item.url));
    const currentUrls = new Set(source.discoveries.map((item) => item.url));
    return {
      ...source,
      baseline: before == null,
      changed: before != null && before.contentHash !== source.contentHash,
      newDiscoveries: before == null
        ? []
        : source.discoveries.filter((item) => !beforeUrls.has(item.url)),
      removedDiscoveries: before == null
        ? []
        : (before.discoveries ?? []).filter((item) => !currentUrls.has(item.url)),
    };
  });
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: { 'user-agent': 'PublicOfficeWatch/1.0 (+CEC referendum source monitor)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${source.key} returned HTTP ${response.status}`);
  if (!isCecUrl(response.url)) throw new Error(`${source.key} redirected outside cec.gov.tw`);
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const discoveries = contentType.includes('html')
    ? extractReferendumLinks(body.toString('utf8'), response.url)
    : [];
  return {
    ...source,
    requestedUrl: source.url,
    resolvedUrl: response.url,
    contentType,
    contentHash: contentHash(discoveries),
    discoveries,
    body,
  };
}

function writeSnapshot(snapshotDir, source) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  const outputPath = path.join(snapshotDir, `${source.key}-${source.contentHash.slice(0, 16)}.html`);
  if (!fs.existsSync(outputPath)) fs.writeFileSync(outputPath, source.body);
  return path.resolve(outputPath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const previous = options.previousPath
    ? JSON.parse(fs.readFileSync(options.previousPath, 'utf8'))
    : null;
  const fetched = [];
  const errors = [];

  for (const source of defaultSources) {
    try {
      fetched.push(await fetchSource(source));
    } catch (error) {
      errors.push({ key: source.key, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const sources = compareSources(fetched, previous).map((source) => {
    const snapshotPath = options.snapshotDir ? writeSnapshot(options.snapshotDir, source) : null;
    const { body, ...reportSource } = source;
    return { ...reportSource, snapshotPath };
  });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: errors.length === 0 ? 'ok' : fetched.length > 0 ? 'partial' : 'failed',
    sourceCount: defaultSources.length,
    changedSourceCount: sources.filter((source) => source.changed).length,
    newDiscoveryCount: sources.reduce((sum, source) => sum + source.newDiscoveries.length, 0),
    sources,
    errors,
  };

  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'failed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { compareSources, extractReferendumLinks, isCecUrl, parseArgs };
