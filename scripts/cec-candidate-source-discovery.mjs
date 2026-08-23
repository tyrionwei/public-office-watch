import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultManifestPath = 'data-sources/cec-2026-candidate-source-manifest.json';

function parseArgs(argv) {
  const options = {
    manifestPath: defaultManifestPath,
    previousPath: null,
    outputPath: null,
    snapshotDir: null,
    statePath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') options.manifestPath = argv[++index] ?? null;
    else if (arg === '--previous') options.previousPath = argv[++index] ?? null;
    else if (arg === '--output') options.outputPath = argv[++index] ?? null;
    else if (arg === '--snapshot-dir') options.snapshotDir = argv[++index] ?? null;
    else if (arg === '--state') {
      options.statePath = argv[++index] ?? null;
      options.previousPath = options.statePath;
      options.outputPath = options.statePath;
    }
    else throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!options.manifestPath) throw new Error('--manifest requires a file path');
  if (options.previousPath && !options.statePath && !fs.existsSync(path.resolve(options.previousPath))) {
    throw new Error(`Previous report not found: ${path.resolve(options.previousPath)}`);
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

function requireText(value, field, errors) {
  const normalized = String(value ?? '').trim();
  if (!normalized) errors.push(`${field} is required`);
  return normalized;
}

function validateManifest(raw) {
  const errors = [];
  if (raw?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const electionYear = Number(raw?.electionYear);
  if (!Number.isInteger(electionYear)) errors.push('electionYear must be an integer');

  const rules = raw?.rules ?? {};
  const yearTerms = Array.isArray(rules.yearTerms) ? rules.yearTerms.map(String) : [];
  const candidateTerms = Array.isArray(rules.candidateTerms) ? rules.candidateTerms.map(String) : [];
  const artifactTerms = Array.isArray(rules.artifactTerms) ? rules.artifactTerms.map(String) : [];
  const termGroups = Array.isArray(rules.termGroups)
    ? rules.termGroups.map((group) => Array.isArray(group) ? group.map(String) : [])
    : [yearTerms, candidateTerms, artifactTerms];
  if (termGroups.length === 0 || termGroups.some((group) => group.length === 0)) {
    errors.push('rules must define non-empty termGroups or year/candidate/artifact terms');
  }

  const rawSources = Array.isArray(raw?.sources) ? raw.sources : [];
  if (rawSources.length === 0) errors.push('sources must contain at least one source');
  const seenKeys = new Set();
  const sources = rawSources.map((source, index) => {
    const key = requireText(source?.key, `sources[${index}].key`, errors);
    const name = requireText(source?.name, `sources[${index}].name`, errors);
    const url = requireText(source?.url, `sources[${index}].url`, errors);
    if (seenKeys.has(key)) errors.push(`sources[${index}].key is duplicated`);
    seenKeys.add(key);
    if (url && !isCecUrl(url)) errors.push(`sources[${index}].url must be an HTTPS cec.gov.tw URL`);
    return { key, name, url };
  });

  if (errors.length > 0) throw new Error(`Invalid CEC source manifest:\n- ${errors.join('\n- ')}`);
  return {
    schemaVersion: 1,
    electionYear,
    rules: { yearTerms, candidateTerms, artifactTerms, termGroups },
    sources,
  };
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

function termMatches(value, terms) {
  return terms.some((term) => value.includes(term));
}

function discoveryMatches(text, url, rules) {
  const searchable = `${decodeHtml(text)} ${decodeURIComponent(url)}`;
  const termGroups = Array.isArray(rules.termGroups)
    ? rules.termGroups
    : [rules.yearTerms, rules.candidateTerms, rules.artifactTerms];
  return termGroups.every((terms) => termMatches(searchable, terms));
}

function extractCandidateLinks(html, baseUrl, rules) {
  const links = new Map();
  const addSyntheticDiscovery = (title) => {
    if (!discoveryMatches(title, baseUrl, rules)) return;
    const itemUrl = new URL(baseUrl);
    itemUrl.hash = `item-${crypto.createHash('sha256').update(title).digest('hex').slice(0, 16)}`;
    links.set(itemUrl.toString(), { title, url: itemUrl.toString() });
  };
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
    if (!isCecUrl(normalizedUrl)) continue;
    const text = decodeHtml(match[5]);
    if (!discoveryMatches(text, normalizedUrl, rules)) continue;
    links.set(normalizedUrl, { title: text || normalizedUrl, url: normalizedUrl });
  }
  const listItemPattern = /<li\b[^>]*class\s*=\s*(["'])[^"']*\barticleItem\b[^"']*\1[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(listItemPattern)) addSyntheticDiscovery(decodeHtml(match[2]));

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
          if (title.length >= 10 && !title.startsWith('<')) addSyntheticDiscovery(title);
        }
      }
    } catch {
      // A malformed framework payload must not hide valid server-rendered links.
    }
  }
  return Array.from(links.values()).sort((left, right) => left.url.localeCompare(right.url));
}

function contentHash(body) {
  return crypto.createHash('sha256').update(body).digest('hex');
}

function compareDiscoveries(current, previous = null) {
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

function snapshotExtension(contentType) {
  if (contentType.includes('html')) return 'html';
  if (contentType.includes('json')) return 'json';
  if (contentType.includes('pdf')) return 'pdf';
  return 'bin';
}

async function fetchSource(source, rules) {
  const response = await fetch(source.url, {
    headers: { 'user-agent': 'PublicOfficeWatch/1.0 (+CEC candidate source monitor)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${source.key} returned HTTP ${response.status}`);
  if (!isCecUrl(response.url)) throw new Error(`${source.key} redirected outside cec.gov.tw`);
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const discoveries = contentType.includes('html')
    ? extractCandidateLinks(body.toString('utf8'), response.url, rules)
    : [];
  return {
    key: source.key,
    name: source.name,
    requestedUrl: source.url,
    resolvedUrl: response.url,
    contentType,
    contentHash: contentHash(body),
    discoveries,
    body,
  };
}

function writeSnapshot(snapshotDir, source) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  const filename = `${source.key}-${source.contentHash.slice(0, 16)}.${snapshotExtension(source.contentType)}`;
  const outputPath = path.join(snapshotDir, filename);
  if (!fs.existsSync(outputPath)) fs.writeFileSync(outputPath, source.body);
  return path.resolve(outputPath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifestPath);
  const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  const previous = options.previousPath && fs.existsSync(path.resolve(options.previousPath))
    ? JSON.parse(fs.readFileSync(path.resolve(options.previousPath), 'utf8'))
    : null;
  const fetchedAt = new Date().toISOString();
  const fetched = [];
  const errors = [];

  for (const source of manifest.sources) {
    try {
      fetched.push(await fetchSource(source, manifest.rules));
    } catch (error) {
      errors.push({ key: source.key, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const compared = compareDiscoveries(fetched, previous);
  const sources = compared.map((source) => {
    const snapshotPath = options.snapshotDir ? writeSnapshot(path.resolve(options.snapshotDir), source) : null;
    const { body, ...reportSource } = source;
    return { ...reportSource, snapshotPath };
  });
  const report = {
    schemaVersion: 1,
    electionYear: manifest.electionYear,
    fetchedAt,
    status: errors.length === 0 ? 'ok' : fetched.length > 0 ? 'partial' : 'failed',
    sourceCount: manifest.sources.length,
    changedSourceCount: sources.filter((source) => source.changed).length,
    newDiscoveryCount: sources.reduce((sum, source) => sum + source.newDiscoveries.length, 0),
    sources,
    errors,
  };

  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
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

export { compareDiscoveries, discoveryMatches, extractCandidateLinks, isCecUrl, parseArgs, validateManifest };
