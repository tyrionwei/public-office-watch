import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchWithTrustedTwcaChain } from './trusted-official-fetch.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cecBaseUrl = 'https://eebulletin.cec.gov.tw/';
const defaultOutputPath = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'review.json');
const defaultCacheDir = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'pdfs');

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0
          ? line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
          : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim()
  || localEnv.SUPABASE_URL
  || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY?.trim()
  || localEnv.SUPABASE_ANON_KEY
  || (supabaseUrl.startsWith('http://127.0.0.1:54321')
    ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
    : '');

function parseArgs(argv) {
  const options = {
    year: 2022,
    outputPath: defaultOutputPath,
    sitemapPath: null,
    cacheDir: defaultCacheDir,
    download: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--year') options.year = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--sitemap') options.sitemapPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--cache-dir') options.cacheDir = path.resolve(argv[++index] ?? '');
    else if (arg === '--download') options.download = true;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (options.year !== 2022) throw new Error('Only the verified 2022 archive layout is supported');
  if (options.sitemapPath && !fs.existsSync(options.sitemapPath)) {
    throw new Error(`Sitemap not found: ${options.sitemapPath}`);
  }
  return options;
}

function decodeHtml(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/[\s\u00a0\u3000]+/g, '')
    .toLowerCase();
}

function isOfficialBulletinUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'eebulletin.cec.gov.tw';
  } catch {
    return false;
  }
}

function extractExecutivePdfLinks(html, year = 2022) {
  const rocYear = String(year - 1911);
  const links = new Map();
  const anchorPattern = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    let url;
    try {
      url = new URL(decodeHtml(match[2]), cecBaseUrl);
    } catch {
      continue;
    }
    const decodedPath = decodeURIComponent(url.pathname).replace(/^\//, '');
    if (!decodedPath.startsWith(`${rocYear}/`) || !decodedPath.toLowerCase().endsWith('.pdf')) continue;
    if (!isOfficialBulletinUrl(url.toString())) continue;
    url.hash = '';
    links.set(url.toString(), { url: url.toString(), decodedPath });
  }
  return Array.from(links.values()).sort((left, right) => left.decodedPath.localeCompare(right.decodedPath, 'zh-Hant'));
}

function parseRaceScope(raceTitle) {
  const normalized = normalizeText(raceTitle);
  const township = normalized.match(/^(.+?[縣市])(.+?[鄉鎮市])(?:鄉長|鎮長|市長)選舉$/);
  if (township) return { office: 'township_mayor', jurisdiction: township[1], area: township[2] };
  const local = normalized.match(/^(.+?[縣市])(?:縣長|市長)選舉$/);
  if (local) return { office: 'local_chief', jurisdiction: local[1], area: local[1] };
  const district = normalized.match(/^(.+?市)(.+?區)區長選舉$/);
  if (district) return { office: 'district_chief', jurisdiction: district[1], area: district[2] };
  return null;
}

function matchBulletin(target, links) {
  const scope = parseRaceScope(target.race_title);
  if (!scope) return { status: 'unsupported_race_title', matches: [] };
  const scopedLinks = links.filter((link) => {
    const pathText = normalizeText(link.decodedPath);
    return pathText.includes(scope.jurisdiction) && pathText.includes(scope.area);
  });
  let matches;
  let repeatedSection = false;
  if (scope.office === 'local_chief') {
    matches = scopedLinks.filter((link) => /\/01(?:縣|市|直轄市)長\//.test(normalizeText(link.decodedPath)));
  } else if (scope.office === 'district_chief') {
    const areaStem = scope.area.replace(/區$/, '');
    matches = links.filter((link) => {
      const pathText = normalizeText(link.decodedPath);
      return pathText.includes(scope.jurisdiction) && pathText.includes('/03原住民區長/') && pathText.includes(areaStem);
    });
    repeatedSection = matches.length > 1;
  } else {
    const primary = scopedLinks.filter((link) => normalizeText(link.decodedPath).includes('/03鄉鎮市長/'));
    matches = primary.length > 0
      ? primary
      : scopedLinks.filter((link) => normalizeText(link.decodedPath).includes('/04鄉鎮市民代表/'));
    repeatedSection = matches.length > 1;
  }
  const status = matches.length === 0
    ? 'missing_bulletin'
    : repeatedSection
      ? 'matched_repeated_section'
      : matches.length === 1
        ? 'matched'
        : 'ambiguous_bulletin';
  const raceFileStem = normalizeText(target.race_title)
    .replace(normalizeText(scope.jurisdiction), '')
    .replace(/選舉$/, '選舉公報');
  const selected = matches.find((link) => {
    const fileStem = normalizeText(path.posix.basename(link.decodedPath, '.pdf'));
    return fileStem === raceFileStem;
  }) ?? matches[0] ?? null;
  return {
    status,
    matches,
    selected: status.startsWith('matched') ? selected : null,
    fallbackMatches: status.startsWith('matched') && scope.office !== 'local_chief'
      ? scopedLinks.filter((link) => !matches.includes(link)
        && /\/(?:04鄉鎮市民代表|05村里長)\//.test(normalizeText(link.decodedPath)))
      : [],
  };
}

async function fetchText(url) {
  const response = await fetchWithTrustedTwcaChain(url, {
    headers: { accept: 'text/html,*/*', 'user-agent': 'PublicOfficeWatch/1.0 (+CEC elected platform review)' },
  });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  if (!isOfficialBulletinUrl(response.url || url)) throw new Error(`CEC request redirected outside official host: ${response.url}`);
  return response.text();
}

async function supabaseJson(url) {
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'accept-profile': 'published',
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`GET ${url.pathname} failed: ${body?.message ?? response.statusText}`);
  return body;
}

async function fetchAllRows(viewName, select, params = {}, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${viewName}`);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const page = await supabaseJson(url);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function fetchTargets(year) {
  const rows = await fetchAllRows(
    'candidates',
    'candidate_id,person_id,person_name,race_id,race_title,election_id,election_name,region_id,region_name,candidate_no,election_year,election_result,is_elected',
    { election_year: `eq.${year}` },
  );
  const raceCandidates = new Map();
  for (const row of rows) {
    if (!raceCandidates.has(row.race_id)) raceCandidates.set(row.race_id, []);
    raceCandidates.get(row.race_id).push({
      candidateId: row.candidate_id,
      personName: row.person_name,
      candidateNo: row.candidate_no,
    });
  }
  return rows
    .filter((row) => row.is_elected === true && row.election_result === 'elected' && parseRaceScope(row.race_title))
    .map((row) => ({ ...row, raceCandidates: raceCandidates.get(row.race_id) ?? [] }));
}

function safeFileName(target, url) {
  const sourceHash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
  return `${target.candidate_id}-${sourceHash}.pdf`;
}

async function downloadPdf(url, outputPath) {
  if (fs.existsSync(outputPath)) return fs.readFileSync(outputPath);
  const response = await fetchWithTrustedTwcaChain(url, {
    headers: { accept: 'application/pdf', 'user-agent': 'PublicOfficeWatch/1.0 (+CEC elected platform review)' },
    timeoutMs: 60000,
  });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('pdf')) throw new Error(`GET ${url} did not return a PDF`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`GET ${url} returned an invalid PDF`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, body);
  return body;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sitemapHtml = options.sitemapPath
    ? fs.readFileSync(options.sitemapPath, 'utf8')
    : await fetchText(`${cecBaseUrl}?action=sitemap`);
  const links = extractExecutivePdfLinks(sitemapHtml, options.year);
  const targets = await fetchTargets(options.year);
  const entries = [];

  for (const target of targets) {
    const bulletinMatch = matchBulletin(target, links);
    const entry = {
      ...target,
      scope: parseRaceScope(target.race_title),
      matchStatus: bulletinMatch.status,
      bulletinCandidates: bulletinMatch.matches,
      publicationStatus: 'private_review_required',
      publicationReason: 'Candidate-specific platform text must be verified against the official bulletin render',
    };
    if (options.download && bulletinMatch.status.startsWith('matched')) {
      const attempts = [bulletinMatch.selected, ...bulletinMatch.fallbackMatches];
      const errors = [];
      for (let index = 0; index < attempts.length; index += 1) {
        try {
          const cachePath = path.join(options.cacheDir, safeFileName(target, attempts[index].url));
          const body = await downloadPdf(attempts[index].url, cachePath);
          entry.sourceDocument = {
            file: path.relative(repoRoot, cachePath),
            url: attempts[index].url,
            sha256: crypto.createHash('sha256').update(body).digest('hex'),
            bytes: body.length,
            usedFallback: index > 0,
          };
          break;
        } catch (error) {
          errors.push({ url: attempts[index].url, message: error instanceof Error ? error.message : String(error) });
        }
      }
      if (!entry.sourceDocument) {
        entry.downloadError = errors;
      } else if (errors.length > 0) {
        entry.downloadWarnings = errors;
      }
    }
    entries.push(entry);
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: { name: '中央選舉委員會選舉公報', url: cecBaseUrl, sitemapSha256: crypto.createHash('sha256').update(sitemapHtml).digest('hex') },
    scope: { year: options.year, offices: ['local_chief', 'township_mayor'], electedOnly: true },
    summary: {
      targetCount: entries.length,
      bulletinCount: links.length,
      matchedCount: entries.filter((entry) => entry.matchStatus.startsWith('matched')).length,
      repeatedSectionCount: entries.filter((entry) => entry.matchStatus === 'matched_repeated_section').length,
      missingCount: entries.filter((entry) => entry.matchStatus === 'missing_bulletin').length,
      ambiguousCount: entries.filter((entry) => entry.matchStatus === 'ambiguous_bulletin').length,
      downloadedCount: entries.filter((entry) => entry.sourceDocument).length,
      fallbackDownloadCount: entries.filter((entry) => entry.sourceDocument?.usedFallback).length,
      downloadErrorCount: entries.filter((entry) => entry.downloadError).length,
    },
    entries,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.missingCount || report.summary.ambiguousCount || report.summary.downloadErrorCount) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { extractExecutivePdfLinks, isOfficialBulletinUrl, matchBulletin, normalizeText, parseArgs, parseRaceScope };
