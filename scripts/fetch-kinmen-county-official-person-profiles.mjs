import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithTrustedTwcaChain } from './trusted-official-fetch.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'kinmen-county-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'kinmen-county', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const councilSourceId = 'kinmen-county-council-current-councilors';
const councilSourceName = '金門縣議會：本屆縣議員';
const councilListUrl = 'https://www.kmcc.gov.tw/8844/54357/55476/';

const govSourceId = 'kinmen-county-government-leaders';
const govSourceName = '金門縣政府：縣長介紹';
const magistrateUrl = 'https://www.kinmen.gov.tw/cp.aspx?n=ADFC186F490AC26E';
const govLeaderRows = [
  { url: magistrateUrl, name: '陳福海', title: '縣長', roleOrigin: 'elected', elected: true, kind: 'magistrateProfile' },
];

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
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^[ '"]|[ '"]$/g, '') : '';
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
  const options = { outputPath: defaultOutputPath, write: false };
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
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
    .replace(/<\/tr>\s*<tr[^>]*>/gi, '\n')
    .replace(/<\/td>\s*<td[^>]*>/gi, '\n')
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
  const filename = `${safeFilename(url)}-${hashId(url)}.json`;
  const filePath = path.join(rawArchiveDir, filename);
  const envelope = {
    url,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    fetchedAt,
    body: bodyText,
  };
  const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
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
    title: 'Kinmen County official person profile source',
    sourceUrl: url,
    fetchedAt,
    status: response.status,
    ok: response.ok,
    format: 'raw-response-envelope-json',
    files: [{ path: filename, bytes: Buffer.byteLength(serialized), sha256: sha256(serialized) }],
  });
  sources.sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));
  fs.writeFileSync(manifestPath, `${JSON.stringify({ generatedAt: fetchedAt, sources }, null, 2)}\n`);
}

async function fetchText(url) {
  const response = await fetchWithTrustedTwcaChain(url, {
    headers: { 'user-agent': 'Mozilla/5.0 public-office-watch local data sync' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);

  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/�/g) ?? []).length;
  const text = replacementCount > 5 ? new TextDecoder('big5', { fatal: false }).decode(bytes) : utf8;
  archiveRaw(url, response, text);
  return text;
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function restUrl(viewName) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${viewName}`);
}

async function supabaseJson(url) {
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'accept-profile': 'published',
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`GET ${url.pathname} failed: ${body?.message ?? response.statusText}`);
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
    if (page.length < pageSize) return rows;
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
    district: row.district ?? '金門縣',
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
    district: row.district ?? '金門縣',
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
      identityMatch: { status: 'matched', method: match.method, score: match.score, reasons: match.reasons },
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
  return Boolean(normalizedLeft && normalizedRight && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
}

const chineseNumberValues = new Map([
  ['零', 0],
  ['一', 1],
  ['二', 2],
  ['兩', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6],
  ['七', 7],
  ['八', 8],
  ['九', 9],
]);

function parseChineseNumber(value) {
  const text = String(value ?? '').trim().replaceAll('廿', '二十');
  if (!text) return null;
  if (/^\d+$/u.test(text)) return Number(text);
  if (chineseNumberValues.has(text)) return chineseNumberValues.get(text);

  const tenIndex = text.indexOf('十');
  if (tenIndex >= 0) {
    const leftText = text.slice(0, tenIndex);
    const rightText = text.slice(tenIndex + 1);
    const left = leftText ? chineseNumberValues.get(leftText) : 1;
    const right = rightText ? chineseNumberValues.get(rightText) : 0;
    if (typeof left === 'number' && typeof right === 'number') return left * 10 + right;
  }

  return null;
}

function parseDistrictOrdinal(value) {
  const text = normalizeIdentityText(value);
  if (!text) return null;
  if (/^\d+$/u.test(text)) return Number(text);

  const arabicMatch = text.match(/第(\d+)(?:選區|選舉區)?/u);
  if (arabicMatch) return Number(arabicMatch[1]);

  const chineseMatch = text.match(/第([一二兩三四五六七八九十廿]+)(?:選區|選舉區)?/u);
  if (chineseMatch) return parseChineseNumber(chineseMatch[1]);

  return null;
}

function councilDistrictOrdinal(row) {
  const payload = row.sourcePayload ?? {};
  return (
    parseDistrictOrdinal(payload.electoralDistrictNumber) ??
    parseDistrictOrdinal(payload.districtLabel) ??
    parseDistrictOrdinal(payload.rawDistrict) ??
    parseDistrictOrdinal(payload.districtType) ??
    parseDistrictOrdinal(row.district)
  );
}

function regionKey(value) {
  const text = normalizeIdentityText(value).replaceAll('台', '臺');
  const regions = ['彰化縣', '新竹縣', '高雄市', '基隆市', '金門縣', '澎湖縣', '臺南市', '臺東縣', '宜蘭縣'];
  return regions.find((region) => text.includes(region)) ?? null;
}

function sameRegion(left, right) {
  const leftRegion = regionKey(left);
  const rightRegion = regionKey(right);
  return Boolean(leftRegion && rightRegion && leftRegion === rightRegion);
}

function indigenousType(value) {
  const text = normalizeIdentityText(value);
  if (text.includes('平地原住民')) return 'flat';
  if (text.includes('山地原住民')) return 'mountain';
  return null;
}

function sameIndigenousType(row, person) {
  const payloadText = JSON.stringify(row.sourcePayload ?? {});
  const rowType = indigenousType(row.district) ?? indigenousType(row.position) ?? indigenousType(payloadText);
  const personType = indigenousType(person.district) ?? indigenousType(person.position);
  return !rowType || !personType || rowType === personType;
}

function hasIndigenousDistrict(value) {
  return normalizeIdentityText(value).includes('原住民');
}

function councilDistrictOrdinalMatched(row, person) {
  if (row.sourceId !== councilSourceId) return false;
  const rowOrdinal = councilDistrictOrdinal(row);
  const personOrdinal = parseDistrictOrdinal(person.district);
  return Boolean(
    rowOrdinal &&
    personOrdinal &&
    rowOrdinal === personOrdinal &&
    sameRegion(row.district, person.district) &&
    sameIndigenousType(row, person),
  );
}

function indigenousCouncilDistrictMatched(row, person) {
  if (row.sourceId !== councilSourceId) return false;
  return Boolean(
    String(row.position ?? '').includes('議員') &&
    String(person.position ?? '').includes('議員') &&
    sameRegion(row.district, person.district) &&
    (hasIndigenousDistrict(row.district) || hasIndigenousDistrict(row.position)) &&
    (hasIndigenousDistrict(person.district) || hasIndigenousDistrict(person.position)) &&
    sameIndigenousType(row, person),
  );
}

function councilLeadershipRoleMatched(row, person) {
  return Boolean(
    row.sourceId === councilSourceId &&
    /議長|副議長/u.test(String(row.position ?? '')) &&
    String(person.position ?? '').includes('議員') &&
    sameRegion(row.district, person.district),
  );
}

function councilDistrictOverlapMatched(row, person) {
  if (!row.district || !overlap(row.district, person.district)) return false;
  return !(row.sourceId === councilSourceId && councilDistrictOrdinal(row) && !sameRegion(row.district, person.district));
}

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
  if (councilDistrictOverlapMatched(row, person)) {
    score += 15;
    reasons.push('district matched');
  } else if (councilDistrictOrdinalMatched(row, person)) {
    score += 15;
    reasons.push('council district ordinal matched');
  } else if (indigenousCouncilDistrictMatched(row, person)) {
    score += 15;
    reasons.push('indigenous council district matched');
  }
  if (String(row.position ?? '').includes('議員') && String(person.position ?? '').includes('議員')) {
    score += 10;
    reasons.push('councilor role matched');
  } else if (councilLeadershipRoleMatched(row, person)) {
    score += 10;
    reasons.push('council leadership role matched');
  }
  if (row.sourceId === govSourceId && String(row.position ?? '').includes('縣政府') && String(person.position ?? '').includes('縣')) {
    score += 10;
    reasons.push('county government role matched');
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
  const scored = candidates.map((person) => ({ person, ...scoreMatch(row, person) })).sort((left, right) => right.score - left.score);
  const best = scored[0] ?? null;
  const second = scored[1] ?? null;
  if (!best || best.score < 75 || (second && best.score - second.score < 10)) return null;
  return {
    person: best.person,
    method: row.sourceId === govSourceId ? 'kinmen_county_government_profile_match' : 'kinmen_county_council_profile_match',
    score: best.score,
    reasons: best.reasons,
  };
}

function fieldBetween(text, startLabel, endLabels) {
  const start = text.indexOf(startLabel);
  if (start < 0) return '';
  const contentStart = start + startLabel.length;
  const nextIndexes = endLabels.map((label) => text.indexOf(label, contentStart)).filter((index) => index >= 0);
  const contentEnd = nextIndexes.length > 0 ? Math.min(...nextIndexes) : text.length;
  return text.slice(contentStart, contentEnd).trim();
}

function absoluteUrl(href) {
  return new URL(href, councilListUrl).toString();
}

function normalizeCouncilorName(value) {
  return cleanInlineText(value)
    .replace(/(議長|副議長|議員)/gu, '')
    .replace(/[\s\u00A0\u3000]+/g, '')
    .trim();
}

function sectionBetween(text, startLabel, endLabels) {
  return fieldBetween(text, startLabel, endLabels).replace(/^[:：]/u, '').trim();
}

function parseCouncilListRows(html) {
  const linkPattern = /href=["'](\/8844\/54357\/55476\/\d+\/)["'][^>]*>([\s\S]*?)<\/a>/giu;
  const rows = [];
  const seen = new Set();
  const districtByName = new Map();
  const text = fieldBetween(cleanText(html), '金門縣議員各選區議員席次一覽表', ['點閱次數']);
  const districtSections = [
    ['第一選區/金城鎮、金寧鄉、烏坵鄉', '第二選區/金湖鎮、金沙鎮', '金門縣第一選區(金城鎮、金寧鄉、烏坵鄉)'],
    ['第二選區/金湖鎮、金沙鎮', '第三選區/烈嶼鄉', '金門縣第二選區(金湖鎮、金沙鎮)'],
    ['第三選區/烈嶼鄉', '', '金門縣第三選區(烈嶼鄉)'],
  ];
  for (const [startLabel, endLabel, districtLabel] of districtSections) {
    const section = endLabel ? fieldBetween(text, startLabel, [endLabel]) : text.slice(text.indexOf(startLabel) + startLabel.length);
    for (const line of section.split('\n').map((item) => item.trim()).filter(Boolean)) {
      if (/^[\d一二三四五六七八九十]+\s*席$/u.test(line)) continue;
      if (line.includes('選區')) continue;
      if (/^[\u4e00-\u9fff]{2,5}$/u.test(line)) districtByName.set(line, districtLabel);
    }
  }

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    if (seen.has(href)) continue;
    const originalLabel = cleanInlineText(match[2]);
    const name = normalizeCouncilorName(originalLabel);
    if (!districtByName.has(name)) continue;
    seen.add(href);
    rows.push({
      officialId: href.split('/').filter(Boolean).at(-1),
      name,
      originalLabel,
      districtLabel: districtByName.get(name),
      detailUrl: absoluteUrl(href),
    });
  }

  if (rows.length === 0) throw new Error('Unable to parse council members from ' + councilListUrl);
  return rows;
}

function titleForCouncilDetail(detailText, name) {
  const profileLine = detailText.split('\n').find((line) => line.startsWith(name));
  if (profileLine?.includes('副議長')) return '副議長';
  if (profileLine?.includes('議長')) return '議長';
  return '議員';
}

function councilRowFromDetail(listRow, detailHtml) {
  const detailText = cleanText(detailHtml);
  if (!detailText.includes(listRow.name)) throw new Error('Unable to verify councilor name from ' + listRow.detailUrl);
  const title = titleForCouncilDetail(detailText, listRow.name);
  const party = sectionBetween(detailText, '政黨', ['聯絡電話', '服務地址', '電子郵件', '學歷']);
  const education = sectionBetween(detailText, '學歷', ['經歷', '政見', '點閱次數']);
  const experience = sectionBetween(detailText, '經歷', ['政見', '點閱次數']);

  return {
    sourceId: councilSourceId,
    sourceName: councilSourceName,
    sourceUrl: listRow.detailUrl,
    externalId: 'current-councilor-' + hashId([listRow.officialId, listRow.name].join('|')),
    name: listRow.name,
    gender: 'unknown',
    party: party.replace(/^無$/u, '無黨籍'),
    position: title === '議員' ? '金門縣議員' : '金門縣議會' + title,
    district: listRow.districtLabel,
    education,
    experience,
    sourcePayload: {
      listUrl: councilListUrl,
      profileUrl: listRow.detailUrl,
      officialId: listRow.officialId,
      originalLabel: listRow.originalLabel,
      title,
      districtLabel: listRow.districtLabel,
      roleOrigin: 'elected',
      elected: true,
      identityStatus: 'needs_identity_check',
    },
  };
}

async function fetchCouncilProfiles() {
  try {
    const listHtml = await fetchText(councilListUrl);
    const listRows = parseCouncilListRows(listHtml);
    const detailRows = await mapLimit(listRows, 4, async (listRow) => ({ listRow, html: await fetchText(listRow.detailUrl) }));
    return { profiles: detailRows.map(({ listRow, html }) => councilRowFromDetail(listRow, html)), skippedRows: [] };
  } catch (error) {
    return {
      profiles: [],
      skippedRows: [{
        sourceId: councilSourceId,
        name: '',
        position: '金門縣議員',
        district: '金門縣',
        sourceUrl: councilListUrl,
        reason: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

function parseMagistrateProfile(html, row) {
  const content = cleanText(html);
  if (!content.includes(row.name) || !content.includes(row.title)) throw new Error('Unable to verify official name from ' + row.url);
  const education = sectionBetween(content, '學歷', ['主要經歷', '回上一頁']);
  const experience = sectionBetween(content, '主要經歷', ['回上一頁', '回最上面']);

  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: row.url,
    externalId: 'leader-' + hashId([row.url, row.title, row.name].join('|')),
    name: row.name,
    gender: 'male',
    party: '',
    position: '金門縣政府' + row.title,
    district: '金門縣',
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

async function fetchGovProfiles() {
  const skippedRows = [];
  const profiles = [];

  try {
    const html = await fetchText(magistrateUrl);
    profiles.push(parseMagistrateProfile(html, govLeaderRows[0]));
  } catch (error) {
    skippedRows.push({
      sourceId: govSourceId,
      name: govLeaderRows[0].name,
      position: `金門縣政府${govLeaderRows[0].title}`,
      district: '金門縣',
      sourceUrl: govLeaderRows[0].url,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return { profiles, skippedRows };
}

function claimsForMatchedRow(row, match) {
  const fields = [
    ['gender', row.gender],
    ['party', row.party],
    ['position', row.position],
    ['district', row.district],
    ['education', row.education],
    ['experience', row.experience],
    ['external_id', sourcePersonKey(row.sourceId, row.externalId)],
  ];
  return fields
    .filter(([, value]) => value && value !== 'unknown')
    .map(([claimType, claimValue]) => claimRecord({ row, person: match.person, match, claimType, claimValue }));
}

async function main() {
  if (!anonKey) throw new Error('Set SUPABASE_ANON_KEY for Kinmen County official person profile enrichment.');

  const options = parseArgs(process.argv.slice(2));
  const [publicPeople, councilResult, govResult] = await Promise.all([
    fetchAllRows('people', 'person_id,name,gender,party,position,district,education,experience'),
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
    adoptedPeople: adoptedPeople.length,
    sourcePeople: sourcePeople.length,
    matchedRows,
    unmatchedRows: unmatchedRows.length,
    skippedRows: skippedRows.length,
    claims: personClaims.length,
  };
  const output = {
    schemaVersion: 1,
    name: 'kinmen-county-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Kinmen County-specific official parser. Council rows cover current councilors from the official Kinmen County Council member list and profile pages. County government rows cover the official magistrate profile.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: councilListUrl },
      { id: govSourceId, name: `${govSourceName}：縣長介紹`, url: magistrateUrl },
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

  console.log(JSON.stringify({ status: options.write ? 'written' : 'dry-run', outputPath: options.outputPath, summary }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Kinmen County official person profile enrichment failed: ${message}`);
  process.exit(1);
});
