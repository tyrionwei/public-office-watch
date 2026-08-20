import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchWithTrustedTwcaChain } from './trusted-official-fetch.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bulletinBaseUrl = 'https://bulletin.cec.gov.tw/';
const supportedScopes = new Set(['2022-councilor', '2024-legislator']);
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, '')];
      }),
  );
}

function scopeDefaults(scope) {
  return {
    outputPath: path.join(repoRoot, 'tmp', 'cec-representative-platforms', scope, 'review.json'),
    cacheDir: path.join(repoRoot, 'tmp', 'cec-representative-platforms', scope, 'pdfs'),
  };
}

function parseArgs(argv) {
  const options = {
    scope: null,
    sitemapPath: null,
    outputPath: null,
    cacheDir: null,
    download: false,
    includeExistingPlatforms: false,
    targetPersonIdsPath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scope') options.scope = argv[++index] ?? '';
    else if (arg === '--sitemap') options.sitemapPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--cache-dir') options.cacheDir = path.resolve(argv[++index] ?? '');
    else if (arg === '--download') options.download = true;
    else if (arg === '--include-existing-platforms') options.includeExistingPlatforms = true;
    else if (arg === '--target-person-ids') options.targetPersonIdsPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!supportedScopes.has(options.scope)) {
    throw new Error('--scope must be 2022-councilor or 2024-legislator');
  }
  const defaults = scopeDefaults(options.scope);
  options.outputPath ??= defaults.outputPath;
  options.cacheDir ??= defaults.cacheDir;
  if (options.sitemapPath && !fs.existsSync(options.sitemapPath)) {
    throw new Error(`Sitemap not found: ${options.sitemapPath}`);
  }
  if (options.targetPersonIdsPath && !fs.existsSync(options.targetPersonIdsPath)) {
    throw new Error(`Target person ID report not found: ${options.targetPersonIdsPath}`);
  }
  return options;
}

function readTargetPersonIds(reportPath) {
  if (!reportPath) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const ids = new Set((report.entries ?? [])
    .map((entry) => entry.personId ?? entry.person_id)
    .filter(Boolean));
  if (ids.size === 0) {
    throw new Error(`Target person ID report has no entries: ${reportPath}`);
  }
  return ids;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/[\s\u00a0\u3000]+/gu, '')
    .toLowerCase();
}

function candidateNameKeys(value) {
  const normalized = normalizeText(value);
  const hanOnly = Array.from(normalized).filter((character) => /\p{Script=Han}/u.test(character)).join('');
  return Array.from(new Set([normalized, hanOnly].filter((key) => key.length >= 2)));
}

function isOfficialBulletinUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'bulletin.cec.gov.tw';
  } catch {
    return false;
  }
}

function decodeHtml(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)));
}

function parseOfficialPdfLinks(html) {
  const links = new Map();
  const anchorPattern = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>/giu;
  for (const match of html.matchAll(anchorPattern)) {
    let url;
    try {
      url = new URL(decodeHtml(match[2]), bulletinBaseUrl);
    } catch {
      continue;
    }
    if (!url.pathname.toLowerCase().endsWith('.pdf') || !isOfficialBulletinUrl(url.toString())) continue;
    url.hash = '';
    const decodedPath = decodeURIComponent(url.pathname).replace(/^\//u, '');
    links.set(url.toString(), { url: url.toString(), decodedPath });
  }
  return Array.from(links.values()).sort((left, right) =>
    left.decodedPath.localeCompare(right.decodedPath, 'zh-Hant'));
}

const chineseDigits = new Map([
  ['零', 0], ['〇', 0], ['一', 1], ['二', 2], ['兩', 2], ['三', 3], ['四', 4],
  ['五', 5], ['六', 6], ['七', 7], ['八', 8], ['九', 9],
]);

function parseChineseNumber(value) {
  const text = String(value ?? '');
  if (/^\d+$/u.test(text)) return Number.parseInt(text, 10);
  if (text === '十') return 10;
  const tenIndex = text.indexOf('十');
  if (tenIndex >= 0) {
    const tens = tenIndex === 0 ? 1 : chineseDigits.get(text[tenIndex - 1]);
    const ones = tenIndex === text.length - 1 ? 0 : chineseDigits.get(text[tenIndex + 1]);
    if (Number.isInteger(tens) && Number.isInteger(ones)) return (tens * 10) + ones;
  }
  if (text.length === 1 && chineseDigits.has(text)) return chineseDigits.get(text);
  return null;
}

function expandDistrictExpression(expression) {
  const numbers = new Set();
  for (const part of String(expression ?? '').split(/[、,.，及]/u)) {
    const range = part.replace(/^第/u, '').split(/[-~～至]/u).map(parseChineseNumber);
    if (range.length === 2 && range.every(Number.isInteger)) {
      const [start, end] = range;
      for (let value = Math.min(start, end); value <= Math.max(start, end); value += 1) numbers.add(value);
    } else if (range.length === 1 && Number.isInteger(range[0])) {
      numbers.add(range[0]);
    }
  }
  return numbers;
}

function extractDistrictNumbers(value) {
  const normalized = normalizeText(value);
  const numbers = new Set();
  const pattern = /第([0-9零〇一二兩三四五六七八九十第、,.，及\-~～至]+)(?:選(?:舉)?)?區/gu;
  for (const match of normalized.matchAll(pattern)) {
    for (const number of expandDistrictExpression(match[1])) numbers.add(number);
  }
  return numbers;
}

function parseRepresentativeScope(target) {
  const raceTitle = normalizeText(target.race_title);
  const legislator = Number(target.election_year) === 2024;
  if (legislator && raceTitle.includes('平地原住民')) {
    return { office: 'plain_indigenous_legislator', jurisdiction: '全國', districtNumber: null };
  }
  if (legislator && raceTitle.includes('山地原住民')) {
    return { office: 'mountain_indigenous_legislator', jurisdiction: '全國', districtNumber: null };
  }
  const match = raceTitle.match(/^(.+?[縣市])第0*(\d+)選舉區(?:(?:平地|山地)原住民)?(?:立法委員|議員)?選舉$/u)
    ?? raceTitle.match(/^(.+?[縣市])第0*(\d+)選舉區$/u);
  if (!match) return null;
  return {
    office: legislator ? 'regional_legislator' : 'councilor',
    jurisdiction: match[1],
    districtNumber: Number.parseInt(match[2], 10),
  };
}

function scopeLinks(scope, links) {
  if (scope === '2022-councilor') {
    return links.filter((link) => {
      const text = normalizeText(link.decodedPath);
      return text.includes('/111年/')
        && (text.includes('01選舉公報/05直轄市議員/') || text.includes('01選舉公報/06縣市議員/'));
    });
  }
  return links.filter((link) => {
    const text = normalizeText(link.decodedPath);
    return text.includes('01選舉公報/02立法委員/113年第11屆/')
      && !text.includes('投開票所')
      && (text.includes('/02區域立法委員/')
        || text.includes('/03平地原住民立法委員/')
        || text.includes('/04山地原住民立法委員/'));
  });
}

function matchBulletinCandidates(target, links) {
  const scope = parseRepresentativeScope(target);
  if (!scope) return { status: 'unsupported_race_title', scope, matches: [] };
  let matches;
  if (scope.office === 'plain_indigenous_legislator') {
    matches = links.filter((link) => normalizeText(link.decodedPath).includes('/03平地原住民立法委員/'));
  } else if (scope.office === 'mountain_indigenous_legislator') {
    matches = links.filter((link) => normalizeText(link.decodedPath).includes('/04山地原住民立法委員/'));
  } else {
    matches = links.filter((link) => {
      const pathText = normalizeText(link.decodedPath);
      return pathText.includes(scope.jurisdiction)
        && extractDistrictNumbers(pathText).has(scope.districtNumber);
    });
  }
  if (matches.length === 0 && scope.office === 'councilor' && normalizeText(target.race_title).includes('原住民')) {
    const jurisdictionLinks = links.filter((link) =>
      normalizeText(link.decodedPath).includes(scope.jurisdiction));
    if (jurisdictionLinks.length > 0) matches = [jurisdictionLinks[0]];
  }
  if (matches.length === 0 && scope.office === 'regional_legislator') {
    const jurisdictionLinks = links.filter((link) =>
      normalizeText(link.decodedPath).includes(scope.jurisdiction));
    if (jurisdictionLinks.length === 1) matches = jurisdictionLinks;
  }
  return {
    status: matches.length === 0 ? 'missing_bulletin' : matches.length === 1 ? 'matched_path' : 'matched_multiple_paths',
    scope,
    matches,
  };
}

function assertLocalSupabase(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  if (!localHostnames.has(hostname)) {
    throw new Error(`Representative platform collection is local-only; received Supabase host ${hostname}`);
  }
}

function restHeaders(serviceRoleKey, profile = 'public') {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    accept: 'application/json',
    ...(profile ? { 'accept-profile': profile } : {}),
  };
}

async function responseJson(response, label) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${label}: ${body?.message ?? response.statusText}`);
  return body;
}

async function fetchAllRows(config, table, select, params = {}, profile = 'public', pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const page = await responseJson(await fetch(url, {
      headers: restHeaders(config.serviceRoleKey, profile),
      signal: AbortSignal.timeout(30000),
    }), `Failed to fetch ${table}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function isScopeTarget(scope, row) {
  if (row.is_elected !== true || row.election_result !== 'elected') return false;
  if (scope === '2022-councilor') {
    return row.election_year === 2022 && normalizeText(row.race_title).includes('議員選舉');
  }
  return row.election_year === 2024 && normalizeText(row.election_name).includes('第11屆立法委員選舉');
}

async function fetchTargets(config, scope, options = {}) {
  const year = scope === '2022-councilor' ? 2022 : 2024;
  const [candidates, existingClaims] = await Promise.all([
    fetchAllRows(
      config,
      'public_candidates',
      'candidate_id,person_id,person_name,race_id,race_title,election_id,election_name,region_id,region_name,candidate_no,election_year,election_result,is_elected',
      { election_year: `eq.${year}` },
    ),
    fetchAllRows(config, 'person_claims', 'candidate_id', {
      claim_type: 'eq.platform',
      candidate_id: 'not.is.null',
      review_status: 'in.(verified,pending)',
    }),
  ]);
  const existingCandidateIds = new Set(existingClaims.map((claim) => claim.candidate_id));
  const targetPersonIds = options.targetPersonIds ?? null;
  const raceCandidates = new Map();
  for (const row of candidates) {
    if (!raceCandidates.has(row.race_id)) raceCandidates.set(row.race_id, []);
    raceCandidates.get(row.race_id).push({
      candidateId: row.candidate_id,
      personName: row.person_name,
      candidateNo: row.candidate_no,
    });
  }
  return candidates
    .filter((row) => isScopeTarget(scope, row))
    .filter((row) => options.includeExistingPlatforms || !existingCandidateIds.has(row.candidate_id))
    .filter((row) => !targetPersonIds || targetPersonIds.has(row.person_id))
    .map((row) => ({ ...row, raceCandidates: raceCandidates.get(row.race_id) ?? [] }));
}

async function fetchText(url) {
  const response = await fetchWithTrustedTwcaChain(url, {
    headers: { accept: 'text/html,*/*', 'user-agent': 'PublicOfficeWatch/1.0 (+CEC representative platform review)' },
    timeoutMs: 60000,
  });
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return response.text();
}

function cacheFileName(url) {
  return `${crypto.createHash('sha256').update(url).digest('hex').slice(0, 24)}.pdf`;
}

async function downloadPdf(link, cacheDir) {
  const outputPath = path.join(cacheDir, cacheFileName(link.url));
  if (fs.existsSync(outputPath)) return { outputPath, body: fs.readFileSync(outputPath) };
  const response = await fetchWithTrustedTwcaChain(link.url, {
    headers: { accept: 'application/pdf', 'user-agent': 'PublicOfficeWatch/1.0 (+CEC representative platform review)' },
    timeoutMs: 90000,
  });
  if (!response.ok) throw new Error(`GET ${link.url} failed: HTTP ${response.status}`);
  if (!isOfficialBulletinUrl(link.url)) throw new Error(`Refused non-official bulletin URL: ${link.url}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error(`GET ${link.url} returned an invalid PDF`);
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(outputPath, body);
  return { outputPath, body };
}

function normalizedPdfText(pdfPath) {
  const result = spawnSync('pdftotext', ['-layout', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) return '';
  return normalizeText(result.stdout);
}

const pdfOcrTextCache = new Map();

function normalizedPdfOcrText(pdfPath) {
  if (pdfOcrTextCache.has(pdfPath)) return pdfOcrTextCache.get(pdfPath);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-cec-bulletin-ocr-'));
  try {
    const prefix = path.join(tempDir, 'page');
    const render = spawnSync('pdftoppm', ['-r', '150', '-jpeg', pdfPath, prefix], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    if (render.status !== 0) {
      pdfOcrTextCache.set(pdfPath, '');
      return '';
    }
    const text = fs.readdirSync(tempDir)
      .filter((file) => /^page-\d+\.jpg$/u.test(file))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .map((file) => {
        const ocr = spawnSync('tesseract', [path.join(tempDir, file), 'stdout', '-l', 'chi_tra+eng', '--psm', '11'], {
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
        });
        return ocr.status === 0 ? ocr.stdout : '';
      })
      .filter(Boolean)
      .join('\n');
    const normalized = normalizeText(text);
    pdfOcrTextCache.set(pdfPath, normalized);
    return normalized;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function selectKnownOfficialPublication(target, attempts) {
  const downloaded = attempts.filter((attempt) => attempt.downloaded);
  const scope = parseRepresentativeScope(target);
  let selected = null;
  if (scope?.jurisdiction === '屏東縣' && scope.districtNumber === 1) {
    const candidateNumber = Number.parseInt(String(target.candidate_no ?? ''), 10);
    if (candidateNumber >= 1 && candidateNumber <= 25) {
      const part = candidateNumber <= 20 ? '第01選舉區1.pdf' : '第01選舉區2.pdf';
      selected = downloaded.find((attempt) => normalizeText(attempt.link.decodedPath).endsWith(normalizeText(part))) ?? null;
    }
  } else if (['台東縣', '屏東縣'].includes(scope?.jurisdiction)
    && Number.isInteger(scope.districtNumber) && downloaded.length > 1) {
    const matching = downloaded.filter((attempt) =>
      extractDistrictNumbers(attempt.link.decodedPath).has(scope.districtNumber));
    selected = matching.sort((left, right) =>
      left.link.decodedPath.localeCompare(right.link.decodedPath, 'zh-Hant'))[0] ?? null;
  }
  if (selected) selected.matchMethod = 'verified_official_bulletin_layout';
  return selected;
}

async function selectSourceDocument(target, bulletinMatch, cacheDir) {
  const attempts = [];
  for (const link of bulletinMatch.matches) {
    try {
      const downloaded = await downloadPdf(link, cacheDir);
      const text = normalizedPdfText(downloaded.outputPath);
      const matchedNameKey = candidateNameKeys(target.person_name).find((key) => text.includes(key)) ?? null;
      attempts.push({
        link,
        downloaded,
        exactNameFound: Boolean(matchedNameKey),
        matchedNameKey,
        matchMethod: matchedNameKey ? 'text_layer' : null,
        textLength: text.length,
      });
    } catch (error) {
      attempts.push({ link, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const uniqueMatchingAttempts = () => Array.from(new Map(
    attempts
      .filter((attempt) => attempt.exactNameFound)
      .map((attempt) => [
        crypto.createHash('sha256').update(attempt.downloaded.body).digest('hex'),
        attempt,
      ]),
  ).values());
  let uniqueNameMatches = uniqueMatchingAttempts();
  const knownPublication = uniqueNameMatches.length === 0
    ? selectKnownOfficialPublication(target, attempts)
    : null;
  if (uniqueNameMatches.length === 0 && !knownPublication && bulletinMatch.matches.length > 1) {
    for (const attempt of attempts) {
      if (!attempt.downloaded) continue;
      const ocrText = normalizedPdfOcrText(attempt.downloaded.outputPath);
      const matchedNameKey = candidateNameKeys(target.person_name).find((key) => ocrText.includes(key)) ?? null;
      attempt.ocrTextLength = ocrText.length;
      if (!matchedNameKey) continue;
      attempt.exactNameFound = true;
      attempt.matchedNameKey = matchedNameKey;
      attempt.matchMethod = 'ocr';
    }
    uniqueNameMatches = uniqueMatchingAttempts();
  }
  const selected = uniqueNameMatches.length >= 1
    ? uniqueNameMatches[0]
    : knownPublication ?? (bulletinMatch.matches.length === 1 && attempts[0]?.downloaded
      ? attempts[0]
      : null);
  if (!selected) {
    return {
      matchStatus: uniqueNameMatches.length > 1 ? 'ambiguous_candidate_name' : 'candidate_name_not_unique',
      sourceDocument: null,
      attempts,
    };
  }
  const body = selected.downloaded.body;
  return {
    matchStatus: selected.exactNameFound
      ? 'matched_unique_name'
      : selected.matchMethod === 'verified_official_bulletin_layout' ? 'matched_verified_official_layout' : 'matched_unique_path_name_unverified',
    sourceDocument: {
      file: path.relative(repoRoot, selected.downloaded.outputPath),
      url: selected.link.url,
      matchMethod: selected.matchMethod ?? null,
      decodedPath: selected.link.decodedPath,
      sha256: crypto.createHash('sha256').update(body).digest('hex'),
      bytes: body.length,
      exactNameFound: selected.exactNameFound,
    },
    attempts,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...readLocalEnv(), ...process.env };
  const config = {
    supabaseUrl: String(env.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/u, ''),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
  };
  assertLocalSupabase(config.supabaseUrl);
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for local gap filtering');
  const sitemapHtml = options.sitemapPath
    ? fs.readFileSync(options.sitemapPath, 'utf8')
    : await fetchText(`${bulletinBaseUrl}?action=sitemap`);
  const allLinks = parseOfficialPdfLinks(sitemapHtml);
  const links = scopeLinks(options.scope, allLinks);
  const targetPersonIds = readTargetPersonIds(options.targetPersonIdsPath);
  const targets = await fetchTargets(config, options.scope, {
    includeExistingPlatforms: options.includeExistingPlatforms,
    targetPersonIds,
  });
  const entries = [];
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    console.error(`[${index + 1}/${targets.length}] ${target.person_name} ${target.race_title}`);
    const bulletinMatch = matchBulletinCandidates(target, links);
    const entry = {
      ...target,
      representativeScope: bulletinMatch.scope,
      matchStatus: bulletinMatch.status,
      bulletinCandidates: bulletinMatch.matches,
      publicationStatus: 'private_review_required',
      publicationReason: 'Official bulletin, exact elected candidacy and candidate-specific platform text require review',
    };
    if (options.download && bulletinMatch.matches.length > 0) {
      const selection = await selectSourceDocument(target, bulletinMatch, options.cacheDir);
      entry.matchStatus = selection.matchStatus;
      entry.sourceDocument = selection.sourceDocument;
      entry.downloadAttempts = selection.attempts.map((attempt) => ({
        url: attempt.link.url,
        exactNameFound: attempt.exactNameFound ?? false,
        textLength: attempt.textLength ?? 0,
        error: attempt.error ?? null,
      }));
    }
    entries.push(entry);
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      name: '中央選舉委員會選舉及公民投票公報',
      url: bulletinBaseUrl,
      sitemapSha256: crypto.createHash('sha256').update(sitemapHtml).digest('hex'),
    },
    scope: {
      name: options.scope,
      electedOnly: true,
      missingOnly: !options.includeExistingPlatforms,
      targetPersonCount: targetPersonIds?.size ?? null,
    },
    summary: {
      targetCount: entries.length,
      bulletinCount: links.length,
      matchedCount: entries.filter((entry) => entry.sourceDocument).length,
      exactNameMatchedCount: entries.filter((entry) => entry.matchStatus === 'matched_unique_name').length,
      nameUnverifiedCount: entries.filter((entry) => entry.matchStatus === 'matched_unique_path_name_unverified').length,
      unsupportedCount: entries.filter((entry) => entry.matchStatus === 'unsupported_race_title').length,
      missingCount: entries.filter((entry) => entry.matchStatus === 'missing_bulletin').length,
      ambiguousCount: entries.filter((entry) => ['candidate_name_not_unique', 'ambiguous_candidate_name'].includes(entry.matchStatus)).length,
    },
    entries,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.unsupportedCount || report.summary.missingCount || report.summary.ambiguousCount || report.summary.nameUnverifiedCount) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  expandDistrictExpression,
  extractDistrictNumbers,
  isOfficialBulletinUrl,
  matchBulletinCandidates,
  normalizeText,
  parseArgs,
  selectKnownOfficialPublication,
  parseOfficialPdfLinks,
  parseRepresentativeScope,
  readTargetPersonIds,
  scopeLinks,
};
