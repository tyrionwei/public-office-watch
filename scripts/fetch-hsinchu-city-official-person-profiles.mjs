import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'hsinchu-city-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'hsinchu-city', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const councilSourceId = 'hsinchu-city-council-current-councilors';
const councilSourceName = '新竹市議會：現任議員';
const councilBaseUrl = 'https://www.hsinchu-cc.gov.tw/tc/';

const govSourceId = 'hsinchu-city-government-leaders';
const govSourceName = '新竹市政府：市長、副市長、秘書長、副秘書長與局處首長';

const govLeaderRows = [
  {
    url: 'https://www.hccg.gov.tw/hccg/app/artwebsite?module=artwebsite&id=900&serno=null',
    name: '高虹安',
    title: '市長',
    roleOrigin: 'elected',
    elected: true,
  },
  {
    url: 'https://www.hccg.gov.tw/hccg/app/artwebsite?module=artwebsite&id=30514&serno=null',
    title: '副市長',
    roleOrigin: 'appointed',
    elected: false,
  },
  {
    url: 'https://www.hccg.gov.tw/hccg/app/artwebsite?module=artwebsite&id=1100&serno=null',
    title: '秘書長',
    roleOrigin: 'appointed',
    elected: false,
  },
  {
    url: 'https://www.hccg.gov.tw/hccg/app/artwebsite?module=artwebsite&id=30515&serno=null',
    title: '副秘書長',
    roleOrigin: 'appointed',
    elected: false,
  },
];

const agencyHeadRows = [
  ['民政處', 'https://dep-civil.hccg.gov.tw/ch/home.jsp?id=224&parentpath=0,2,223'],
  ['財政處', 'https://dep-finance.hccg.gov.tw/ch/home.jsp?id=9&parentpath=0,1'],
  ['產業發展處', 'https://dep-construction.hccg.gov.tw/ch/home.jsp?id=11&parentpath=0,2'],
  ['都市發展處', 'https://urban.hccg.gov.tw/ch/home.jsp?id=6&parentpath=0,4'],
  ['交通處', 'https://dep-traffic.hccg.gov.tw/ch/home.jsp?id=7&parentpath=0,5'],
  ['社會處', 'https://society.hccg.gov.tw/ch/home.jsp?id=64&parentpath=0,1,10'],
  ['養護工程處', 'https://www.hccg.gov.tw/parks/app/artwebsite?module=artwebsite&id=50&serno=null'],
  ['地政處', 'https://land.hccg.gov.tw/content/?parent_id=10216&type_id=10216'],
  ['行政處', 'https://dep-administration.hccg.gov.tw/ch/home.jsp?id=70&parentpath=0,2,69'],
  ['勞工及青年處', 'https://dep-labor-youth.hccg.gov.tw/ch/home.jsp?id=20114&parentpath=0,2,20113'],
  ['城市行銷處', 'https://dep-tourism.hccg.gov.tw/ch/home.jsp?id=24&parentpath=0,2,21'],
  ['數位發展處', 'https://www.hccg.gov.tw/doda/app/artwebsite?module=artwebsite&id=25&serno=null'],
  ['政風處', 'https://dep-ethics.hccg.gov.tw/ch/home.jsp?id=2&parentpath=0,1'],
].map(([agency, url]) => ({
  agency,
  url,
  title: agency.endsWith('局') ? '局長' : '處長',
  roleOrigin: 'appointed',
  elected: false,
}));

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '') : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  localEnv.SUPABASE_ANON_KEY ||
  (supabaseUrl.startsWith('http://127.0.0.1:54321') ? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' : '');

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

function hashId(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number.parseInt(number, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function cleanInlineText(value) {
  return cleanText(value).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeIdentityText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '')
    .toLowerCase();
}

function normalizePartyName(value) {
  const text = cleanInlineText(value);
  if (text === '臺灣民眾黨') return '台灣民眾黨';
  if (text === '臺灣基進') return '台灣基進';
  if (text === '無黨' || text === '無黨籍及未經政黨推薦') return '無黨籍';
  return text;
}

function safeFilename(value) {
  return String(value)
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .toLowerCase();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function archiveRaw(url, response, bodyText) {
  fs.mkdirSync(rawArchiveDir, { recursive: true });
  const filename = safeFilename(url) + '-' + hashId(url) + '.json';
  const filePath = path.join(rawArchiveDir, filename);
  const envelope = {
    url,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    fetchedAt,
    body: bodyText,
  };
  const serialized = JSON.stringify(envelope, null, 2) + '\n';
  fs.writeFileSync(filePath, serialized);

  const manifestPath = path.join(rawArchiveDir, 'manifest.json');
  let manifest = { generatedAt: fetchedAt, sources: [] };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    // New archive directory.
  }
  const sources = Array.isArray(manifest.sources) ? manifest.sources.filter((item) => item.sourceUrl !== url) : [];
  sources.push({
    title: 'Official person profile source',
    sourceUrl: url,
    fetchedAt,
    status: response.status,
    ok: response.ok,
    format: 'raw-response-envelope-json',
    files: [{ path: filename, bytes: Buffer.byteLength(serialized), sha256: sha256(serialized) }],
  });
  sources.sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));
  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: fetchedAt, sources }, null, 2) + '\n');
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 public-office-watch local data sync' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  const text = replacementCount > 5 ? new TextDecoder('big5', { fatal: false }).decode(bytes) : utf8;
  archiveRaw(url, response, text);
  return text;
}

function restUrl(viewName) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${viewName}`);
}

async function supabaseJson(url) {
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`GET ${url.pathname} failed: ${body?.message ?? response.statusText}`);
  }

  return body;
}

async function fetchAllRows(viewName, select, pageSize = 1000) {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(viewName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));

    const page = await supabaseJson(url);
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function sourcePersonKey(sourceId, externalId) {
  return `${sourceId}:${externalId}`;
}

function sourcePerson(row) {
  return {
    sourcePersonKey: sourcePersonKey(row.sourceId, row.externalId),
    sourceId: row.sourceId,
    externalRecordId: row.externalId,
    rawName: row.name,
    normalizedName: normalizeIdentityText(row.name),
    gender: row.gender ?? 'unknown',
    party: row.party ?? '',
    position: row.position ?? '',
    district: row.district ?? '新竹市',
    birthDate: row.birthDate ?? null,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    sourceType: 'official_officeholder',
    confidenceSuggestion: 'A',
    sourcePayload: row.sourcePayload ?? {},
  };
}

function adoptedOfficial(row, origin) {
  const sourceKey = sourcePersonKey(row.sourceId, row.externalId);

  return {
    externalId: origin === 'elected' ? `official-current:${sourceKey}` : `official-appointed:${sourceKey}`,
    sourcePersonKey: sourceKey,
    sourceId: row.sourceId,
    sourceType: 'official_officeholder',
    confidenceSuggestion: 'A',
    name: row.name,
    gender: row.gender ?? 'unknown',
    party: row.party ?? '',
    position: row.position ?? '',
    district: row.district ?? '新竹市',
    education: row.education ?? '',
    experience: row.experience ?? '',
    sourceUrl: row.sourceUrl,
    sourcePayload: {
      ...(row.sourcePayload ?? {}),
      roleOrigin: origin,
      elected: origin === 'elected',
      identityStatus: 'official_name_only',
      adoptionReason: `official ${origin} officeholder with no existing public person sharing the same normalized name`,
    },
  };
}

function claimRecord({ row, person, match, claimType, claimValue }) {
  return {
    claimKey: `official-profile:${row.sourceId}:${hashId(row.externalId)}:${person.person_id}:${claimType}`,
    personId: person.person_id,
    personName: person.name,
    claimType,
    claimValue,
    claimJson: {
      value: claimValue,
      officialExternalId: row.externalId,
      sourcePersonKey: sourcePersonKey(row.sourceId, row.externalId),
      officeTitle: row.position,
      district: row.district,
      identityMatch: {
        status: 'matched',
        method: match.method,
        score: match.score,
        reasons: match.reasons,
      },
    },
    confidenceLevel: 'A',
    reviewStatus: 'verified',
    visibility: 'public',
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
  };
}

function overlap(left, right) {
  const normalizedLeft = normalizeIdentityText(left);
  const normalizedRight = normalizeIdentityText(right);
  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)),
  );
}

function sameRegion(left, right) {
  const leftRegion = normalizeIdentityText(left).match(/[\p{Script=Han}]{2,3}[縣市]/u)?.[0] ?? '';
  const rightRegion = normalizeIdentityText(right).match(/[\p{Script=Han}]{2,3}[縣市]/u)?.[0] ?? '';
  return Boolean(leftRegion && rightRegion && leftRegion === rightRegion);
}

function isSameIndigenousCouncilRole(row, person) {
  return Boolean(
    row.sourceId === councilSourceId &&
    String(row.district ?? '').includes('平地原住民') &&
    String(person.position ?? '').includes('平地原住民') &&
    String(row.position ?? '').includes('議員') &&
    String(person.position ?? '').includes('議員') &&
    sameRegion(row.district, person.district)
  );
}

const verifiedGovernmentCandidateNames = new Set(['施淑婷', '吳達偉']);

function scoreMatch(row, person) {
  let score = 0;
  const reasons = [];

  if (normalizeIdentityText(row.name) === normalizeIdentityText(person.name)) {
    score += 50;
    reasons.push('name matched');
  }

  if (row.gender && row.gender !== 'unknown' && person.gender && row.gender === person.gender) {
    score += 15;
    reasons.push('gender matched');
  } else if (row.gender && row.gender !== 'unknown' && person.gender && person.gender !== 'unknown') {
    score -= 50;
    reasons.push('gender mismatched');
  }

  if (row.party && overlap(row.party, person.party)) {
    score += 10;
    reasons.push('party matched');
  }

  if (row.position && overlap(row.position, person.position)) {
    score += 15;
    reasons.push('position matched');
  }

  if (row.district && overlap(row.district, person.district)) {
    score += 15;
    reasons.push('district matched');
  } else if (isSameIndigenousCouncilRole(row, person)) {
    score += 15;
    reasons.push('indigenous council district matched');
  }

  if (String(row.position ?? '').includes('議員') && String(person.position ?? '').includes('議員')) {
    score += 10;
    reasons.push('councilor role matched');
  }

  if (row.sourceId === govSourceId && String(row.position ?? '').includes('市長') && String(person.position ?? '').includes('市長')) {
    score += 10;
    reasons.push('local executive role matched');
  }

  return { score, reasons };
}

function indexPeopleByName(people) {
  const byName = new Map();

  for (const person of people) {
    const key = normalizeIdentityText(person.name);
    const group = byName.get(key) ?? [];
    group.push(person);
    byName.set(key, group);
  }

  return byName;
}

function matchPerson(row, peopleByName) {
  const candidates = peopleByName.get(normalizeIdentityText(row.name)) ?? [];
  const scored = candidates
    .map((person) => ({ person, ...scoreMatch(row, person) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0] ?? null;
  const second = scored[1] ?? null;

  if (!best) {
    return null;
  }

  if (best.score >= 75 && (!second || best.score - second.score >= 10)) {
    return {
      person: best.person,
      method: row.sourceId === govSourceId ? 'hsinchu_city_government_profile_match' : 'hsinchu_city_council_profile_match',
      score: best.score,
      reasons: best.reasons,
    };
  }

  if (
    candidates.length === 1 &&
    row.sourceId === govSourceId &&
    row.sourcePayload?.elected === false &&
    verifiedGovernmentCandidateNames.has(row.name) &&
    String(best.person.position ?? '').includes('候選人')
  ) {
    return {
      person: best.person,
      method: 'hsinchu_city_verified_government_candidate_identity_match',
      score: 75,
      reasons: [...best.reasons, 'verified same person has both government officeholder and candidate records'],
    };
  }

  return null;
}

function fieldBetween(text, startLabel, endLabels) {
  const start = text.indexOf(startLabel);
  if (start < 0) {
    return '';
  }

  const contentStart = start + startLabel.length;
  const nextIndexes = endLabels
    .map((label) => text.indexOf(label, contentStart))
    .filter((index) => index >= 0);
  const contentEnd = nextIndexes.length > 0 ? Math.min(...nextIndexes) : text.length;

  return text.slice(contentStart, contentEnd).trim();
}

function fieldBetweenAny(text, startLabels, endLabels) {
  for (const startLabel of startLabels) {
    const value = fieldBetween(text, startLabel, endLabels);
    if (value) {
      return value;
    }
  }

  return '';
}

function parseCouncilorDetail(html, id, sourceUrl) {
  const text = cleanText(html);
  const name = text.match(/\n([\p{Script=Han}]{2,4})\s*(?:議長|副議長|議員)?\n簡介\n政黨/u)?.[1] ?? '';
  const party = normalizePartyName(fieldBetween(text, '政黨', ['選區']));
  const rawDistrict = fieldBetween(text, '選區', ['服務處', '電話', 'facebook', '議長的話', '副議長的話', '政見']);
  const districtArea = rawDistrict.replace(/^第\d+屆\s*/, '').trim();

  if (!name || !party || !districtArea) {
    return null;
  }

  return {
    sourceId: councilSourceId,
    sourceName: councilSourceName,
    sourceUrl,
    externalId: `current-councilor-${id}`,
    name,
    gender: 'unknown',
    party,
    position: '新竹市議員',
    district: `新竹市${districtArea}`,
    education: '',
    experience: '',
    platform: fieldBetween(text, '政見', ['提案資料', '質詢資料', '影音專區', '回上一頁']),
    sourcePayload: {
      profileUrl: sourceUrl,
      councilorId: id,
      rawDistrict,
      roleOrigin: 'elected',
      elected: true,
      identityStatus: 'needs_identity_check',
    },
  };
}

async function fetchCouncilProfiles() {
  const ids = Array.from({ length: 80 }, (_, index) => index + 1);
  const parsedRows = await mapLimit(ids, 6, async (id) => {
    const url = new URL(`councilor.aspx?mid=39&c=${id}`, councilBaseUrl).toString();

    try {
      return { profile: parseCouncilorDetail(await fetchText(url), id, url), skippedRow: null };
    } catch (error) {
      return {
        profile: null,
        skippedRow: {
          sourceId: councilSourceId,
          name: '',
          position: '新竹市議員',
          district: '新竹市',
          sourceUrl: url,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  return {
    profiles: parsedRows.map((row) => row.profile).filter(Boolean),
    skippedRows: parsedRows.map((row) => row.skippedRow).filter(Boolean),
  };
}

function contentAfterLast(text, marker) {
  const index = text.lastIndexOf(marker);
  return index >= 0 ? text.slice(index) : text;
}

function parseGovLeaderProfile(html, row) {
  const text = cleanText(html);
  const content = contentAfterLast(text, '發布日期');
  const name = row.name ?? content.match(/姓\s*名\s*[：:]\s*([\p{Script=Han}]{2,4})/u)?.[1] ?? '';
  const education = fieldBetween(content, '學 歷：', ['經 歷：']) || fieldBetween(content, '學歷：', ['經歷：']);
  const experience = fieldBetween(content, '經 歷：', ['市長室', '回上一頁', '相關連結']) || fieldBetween(content, '經歷：', ['市長室', '回上一頁', '相關連結']);

  if (!name) {
    throw new Error(`Unable to parse official name from ${row.url}`);
  }

  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: row.url,
    externalId: `leader-${new URL(row.url).searchParams.get('id') ?? hashId(row.url)}`,
    name,
    gender: 'unknown',
    party: row.name === '高虹安' ? '台灣民眾黨' : '',
    position: `新竹市${row.title}`,
    district: '新竹市',
    education,
    experience,
    sourcePayload: {
      profileUrl: row.url,
      title: row.title,
      roleOrigin: row.roleOrigin,
      elected: row.elected,
      identityStatus: 'needs_identity_check',
    },
  };
}

function parseAgencyHeadProfile(html, row) {
  const text = cleanText(html);
  const content = contentAfterLast(text, '字級：');
  const title = row.title;
  const namePatterns = [
    /姓\s*名\s*[：:]?\s*([\p{Script=Han}]{2,4})/u,
    /姓名\s*([\p{Script=Han}]{2,4})/u,
    new RegExp(`${title}[：:]\\s*\\n?([\\p{Script=Han}]{2,4})`, 'u'),
    new RegExp(`${title}[ \\t　]+([\\p{Script=Han}]{2,4})\\s*\\n學歷`, 'u'),
    new RegExp(`\\n([\\p{Script=Han}]{2,4})[ \\t　]+${title}\\s*\\n現職`, 'u'),
    new RegExp(`\\n([\\p{Script=Han}]{2,4})\\s+${title}`, 'u'),
    new RegExp(`(?:${title}介紹|${title}簡介)\\s*[：:]?\\s*\\n([\\p{Script=Han}]{2,4})`, 'u'),
  ];
  const name = namePatterns.map((pattern) => content.match(pattern)?.[1] ?? '').find((value) => {
    return value && !/介紹|首頁|主要|副處|副局|業務|主管|組織|新竹|預留|行政院|工程/.test(value);
  }) ?? '';
  const education = fieldBetweenAny(content, ['學 歷：', '學歷：', '學歷'], ['經 歷：', '經歷：', '經歷', '瀏覽人次', '回上頁', '上一頁']);
  const experience = fieldBetweenAny(content, ['經 歷：', '經歷：', '經歷'], ['瀏覽人次', '回上頁', '上一頁', 'E-mail', '電子郵件']);

  if (!name) {
    throw new Error(`Unable to parse agency head name from ${row.url}`);
  }

  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: row.url,
    externalId: `agency-head-${hashId(row.url)}`,
    name,
    gender: 'unknown',
    party: '',
    position: `新竹市政府${row.agency}${title}`,
    district: '新竹市',
    education,
    experience,
    sourcePayload: {
      profileUrl: row.url,
      agency: row.agency,
      title,
      roleOrigin: row.roleOrigin,
      elected: row.elected,
      identityStatus: 'needs_identity_check',
    },
  };
}

async function fetchGovProfiles() {
  const leaderRows = await mapLimit(govLeaderRows, 4, async (row) => {
    try {
      return { profile: parseGovLeaderProfile(await fetchText(row.url), row), skippedRow: null };
    } catch (error) {
      return {
        profile: null,
        skippedRow: {
          sourceId: govSourceId,
          name: row.name ?? '',
          position: `新竹市${row.title}`,
          district: '新竹市',
          sourceUrl: row.url,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
  const agencyRows = await mapLimit(agencyHeadRows, 4, async (row) => {
    try {
      return { profile: parseAgencyHeadProfile(await fetchText(row.url), row), skippedRow: null };
    } catch (error) {
      return {
        profile: null,
        skippedRow: {
          sourceId: govSourceId,
          name: '',
          position: `新竹市政府${row.agency}${row.title}`,
          district: '新竹市',
          sourceUrl: row.url,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
  const parsedRows = [...leaderRows, ...agencyRows];

  return {
    profiles: parsedRows.map((row) => row.profile).filter(Boolean),
    skippedRows: parsedRows.map((row) => row.skippedRow).filter(Boolean),
  };
}

function claimsForMatchedRow(row, match) {
  const fields = [
    ['gender', row.gender],
    ['party', row.party],
    ['position', row.position],
    ['district', row.district],
    ['education', row.education],
    ['experience', row.experience],
    ['platform', row.platform],
    ['external_id', sourcePersonKey(row.sourceId, row.externalId)],
  ];

  return fields
    .filter(([, value]) => value && value !== 'unknown')
    .map(([claimType, claimValue]) => claimRecord({ row, person: match.person, match, claimType, claimValue }));
}

async function main() {
  if (!anonKey) {
    throw new Error('Set SUPABASE_ANON_KEY for Hsinchu City official person profile enrichment.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [publicPeople, councilResult, govResult] = await Promise.all([
    fetchAllRows('public_people_directory', 'person_id,name,gender,party,position,district,education,experience'),
    fetchCouncilProfiles(),
    fetchGovProfiles(),
  ]);
  const councilRows = councilResult.profiles;
  const govRows = govResult.profiles;
  const skippedRows = [...councilResult.skippedRows, ...govResult.skippedRows];
  const peopleByName = indexPeopleByName(publicPeople);
  const personClaims = [];
  const sourcePeople = [];
  const unmatchedRows = [];
  const adoptedPeople = [];
  let matchedRows = 0;

  for (const row of [...councilRows, ...govRows]) {
    sourcePeople.push(sourcePerson(row));
    const match = matchPerson(row, peopleByName);

    if (!match) {
      const sameNamePeople = peopleByName.get(normalizeIdentityText(row.name)) ?? [];

      if (sameNamePeople.length === 0) {
        adoptedPeople.push(adoptedOfficial(row, row.sourceId === councilSourceId || row.sourcePayload?.elected ? 'elected' : 'appointed'));
        continue;
      }

      unmatchedRows.push({
        sourceId: row.sourceId,
        name: row.name,
        position: row.position,
        party: row.party,
        district: row.district,
        sourceUrl: row.sourceUrl,
      });
      continue;
    }

    personClaims.push(...claimsForMatchedRow(row, match));
    matchedRows += 1;
  }

  const summary = {
    publicPeople: publicPeople.length,
    councilRows: councilRows.length,
    govRows: govRows.length,
    agencyHeadRows: govRows.filter((row) => row.sourcePayload?.agency).length,
    adoptedPeople: adoptedPeople.length,
    sourcePeople: sourcePeople.length,
    matchedRows,
    unmatchedRows: unmatchedRows.length,
    skippedRows: skippedRows.length,
    claims: personClaims.length,
  };
  const output = {
    schemaVersion: 1,
    name: 'hsinchu-city-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Hsinchu City-specific official parser. Council list uses ASP.NET postback, so this script scans stable councilor detail ids and keeps only pages with current councilor profile fields. City government profiles cover mayor, deputy mayor, secretary general, deputy secretary general and agency heads with stable official profile pages. Agency sites without a stable head profile page are intentionally skipped until a per-agency rule is added.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: 'https://www.hsinchu-cc.gov.tw/tc/councilors.aspx?mid=39' },
      { id: govSourceId, name: govSourceName, url: 'https://www.hccg.gov.tw/hccg/app/folder/30198' },
    ],
    summary,
    people: adoptedPeople,
    skippedRows: skippedRows.slice(0, 100),
    unmatchedRows: unmatchedRows.slice(0, 100),
    sourcePeople,
    personClaims,
  };

  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    status: options.write ? 'written' : 'dry-run',
    outputPath: options.outputPath,
    summary,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Hsinchu City official person profile enrichment failed: ${message}`);
  process.exit(1);
});
