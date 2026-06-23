import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'taipei-official-person-profiles.seed.json');

const tccSourceId = 'taipei-city-council-current-councilors';
const tccSourceName = '臺北市議會：現任議員';
const tccListUrl = 'https://www.tcc.gov.tw/cp.aspx?n=13898';
const tccBaseUrl = 'https://www.tcc.gov.tw/';

const taipeiGovSourceId = 'taipei-city-government-leaders';
const taipeiGovSourceName = '臺北市政府：市長、副市長與機關首長';
const taipeiGovBaseUrl = 'https://www.gov.taipei/';
const taipeiGovMayorUrl = 'https://www.gov.taipei/News.aspx?n=5A0C91ADEE6E7C46&sms=7CAF6BD4D3E48630';
const taipeiGovDeputyUrl = 'https://www.gov.taipei/News.aspx?n=19FA75E3DEDDDA1F&sms=74724DD2D5D1AF52';
const taipeiGovLeaderUrl = 'https://www.gov.taipei/News_Leader.aspx?n=1E25E56D8B12C862&sms=7CAF6BD4D3E48630';

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
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
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
  const text = cleanText(value);
  if (text === '臺灣民眾黨') return '台灣民眾黨';
  if (text === '臺灣基進') return '台灣基進';
  if (text === '無黨籍及未經政黨推薦') return '無黨籍';
  return text;
}

function normalizeGender(value) {
  const text = cleanText(value);
  if (text === '男') return 'male';
  if (text === '女') return 'female';
  return 'unknown';
}

function parseRocDate(value) {
  const text = cleanText(value);
  const match = text.match(/民國\s*(\d{1,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);

  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10) + 1911;
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function tccDistrict(zoneText) {
  const text = cleanText(zoneText);
  const match = text.match(/第([一二三四五六七八九十]+)選區/);
  const numerals = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const districtNo = match ? numerals[match[1]] ?? null : null;
  const areaMatch = text.match(/（([^）]+)）/);
  const areas = areaMatch ? areaMatch[1].replace(/、/g, '、') : '';

  return districtNo ? `臺北市第${districtNo}選舉區${areas ? `（${areas}）` : ''}` : text;
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;

  if (replacementCount > 5) {
    return new TextDecoder('big5', { fatal: false }).decode(bytes);
  }

  return utf8;
}

function restUrl(viewName) {
  if (!supabaseUrl) {
    throw new Error('Set SUPABASE_URL for Supabase REST access.');
  }

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

function extractById(html, id) {
  const pattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
  return cleanText(html.match(pattern)?.[1] ?? '');
}

function extractMetaTitle(html) {
  const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
  return cleanText(og ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}

function absoluteUrl(baseUrl, href) {
  return new URL(decodeHtml(href), baseUrl).toString();
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
    district: row.district ?? '臺北市',
    birthDate: row.birthDate ?? null,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    sourceType: 'official_officeholder',
    confidenceSuggestion: 'A',
    sourcePayload: row.sourcePayload ?? {},
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
  }

  if (row.sourceId === tccSourceId && String(person.position ?? '').includes('議員')) {
    score += 10;
    reasons.push('councilor role matched');
  }

  if (row.sourceId === taipeiGovSourceId && String(row.position ?? '').includes('市長') && String(person.position ?? '').includes('市長')) {
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

  if (!best || best.score < 75 || (second && best.score - second.score < 10)) {
    return null;
  }

  return {
    person: best.person,
    method: 'taipei_official_profile_match',
    score: best.score,
    reasons: best.reasons,
  };
}

function tccProfileLinks(html) {
  const links = [];
  const seen = new Set();
  const regex = /href=["'](Councilor_Content\.aspx\?n=13898&s=(\d+))["'][^>]*title=["']([^"']+)["']/gi;

  for (const match of html.matchAll(regex)) {
    const url = absoluteUrl(tccBaseUrl, match[1]);

    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    links.push({
      url,
      externalId: `current-councilor-${match[2]}`,
      listName: cleanText(match[3]),
    });
  }

  return links;
}

function parseTccProfile(html, link) {
  const zoneText = extractById(html, 'ContentPlaceHolder1_FormView1_ElectionZoneLabel');
  const partyMatch = html.match(/<span[^>]*class=["']flex-center["'][^>]*>([\s\S]*?)<\/span>/i);
  const party = normalizePartyName(partyMatch?.[1] ?? '');
  const name = extractById(html, 'ContentPlaceHolder1_FormView1_CouncilorNameLabel') || link.listName;
  const gender = normalizeGender(extractById(html, 'ContentPlaceHolder1_FormView1_GenderLabel'));
  const birthText = extractById(html, 'ContentPlaceHolder1_FormView1_BirthdayLabel');

  return {
    sourceId: tccSourceId,
    sourceName: tccSourceName,
    sourceUrl: link.url,
    externalId: link.externalId,
    name,
    gender,
    party,
    position: '臺北市議員',
    district: tccDistrict(zoneText),
    birthDate: parseRocDate(birthText),
    education: extractById(html, 'ContentPlaceHolder1_FormView1_EducationLabel'),
    experience: extractById(html, 'ContentPlaceHolder1_FormView1_ExperienceLabel'),
    platform: extractById(html, 'ContentPlaceHolder1_FormView1_OpinionLabel'),
    sourcePayload: {
      profileUrl: link.url,
      zoneText: cleanText(zoneText),
      birthText,
    },
  };
}

async function fetchTccProfiles() {
  const listHtml = await fetchText(tccListUrl);
  const links = tccProfileLinks(listHtml);
  return mapLimit(links, 6, async (link) => parseTccProfile(await fetchText(link.url), link));
}

function parseGovTableLinks(html, defaultPosition) {
  const rows = [];
  const regex = /<a\s+href=["']([^"']+)["']\s+title=["']([^"']+?)\[連結\]["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const text = cleanText(match[3]);
    const name = text.replace(/副市長$/, '').replace(/市長$/, '').trim();

    if (!name || match[1].includes('Default.aspx')) {
      continue;
    }

    rows.push({
      name,
      position: text.endsWith('副市長') ? '臺北市副市長' : defaultPosition,
      url: absoluteUrl(taipeiGovBaseUrl, match[1]),
    });
  }

  return rows;
}

function parseGovLeaderList(html) {
  const rows = [];
  const regex = /<p><a\s+href=["']([^"']+)["']\s+title=["']([^"']+?)\[連結\]["'][^>]*>([\s\S]*?)<\/a><\/p>\s*<span>([\s\S]*?)<\/span>\s*<span>([\s\S]*?)<\/span>/gi;

  for (const match of html.matchAll(regex)) {
    const name = cleanText(match[3]);
    const title = cleanText(match[4]);
    const agency = cleanText(match[5]);

    if (!name) {
      continue;
    }

    rows.push({
      name,
      position: title ? `臺北市政府${title}` : '臺北市政府機關首長',
      agency,
      url: absoluteUrl(taipeiGovBaseUrl, match[1]),
    });
  }

  return rows;
}

function extractGovField(html, label) {
  const regex = new RegExp(`<li><span[^>]*class=["']cp interduce-caption["'][^>]*>${label}：<\\/span>([\\s\\S]*?)<\\/li>`, 'i');
  return cleanText(html.match(regex)?.[1] ?? '');
}

async function parseGovProfile(row) {
  const html = await fetchText(row.url);
  const externalId = new URL(row.url).searchParams.get('s') ?? hashId(row.url);
  const rawTitle = extractGovField(html, '職稱');
  const title = rawTitle || row.position;

  return {
    sourceId: taipeiGovSourceId,
    sourceName: taipeiGovSourceName,
    sourceUrl: row.url,
    externalId: `leader-${externalId}`,
    name: row.name || extractMetaTitle(html).replace(/(市長|副市長)$/, ''),
    gender: 'unknown',
    party: '',
    position: title,
    district: '臺北市',
    education: extractGovField(html, '學歷'),
    experience: extractGovField(html, '經歷'),
    sourcePayload: {
      profileUrl: row.url,
      agency: row.agency ?? '',
      title,
    },
  };
}

async function fetchTaipeiGovProfiles() {
  const rows = [];
  const mayorHtml = await fetchText(taipeiGovMayorUrl);
  rows.push(...parseGovTableLinks(mayorHtml, '臺北市市長'));

  const deputyHtml = await fetchText(taipeiGovDeputyUrl);
  rows.push(...parseGovTableLinks(deputyHtml, '臺北市副市長'));

  for (let page = 1; page <= 8; page += 1) {
    const url = `${taipeiGovLeaderUrl}&page=${page}&PageSize=20`;
    rows.push(...parseGovLeaderList(await fetchText(url)));
  }

  const unique = new Map(rows.map((row) => [row.url, row]));
  const profiles = [];

  return mapLimit(Array.from(unique.values()), 6, parseGovProfile);
}

function claimsForMatchedRow(row, match) {
  const fields = [
    ['gender', row.gender],
    ['birth_date', row.birthDate],
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
    throw new Error('Set SUPABASE_ANON_KEY for Taipei official person profile enrichment.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [publicPeople, tccRows, taipeiGovRows] = await Promise.all([
    fetchAllRows('public_people', 'person_id,name,gender,party,position,district,education,experience'),
    fetchTccProfiles(),
    fetchTaipeiGovProfiles(),
  ]);
  const peopleByName = indexPeopleByName(publicPeople);
  const personClaims = [];
  const sourcePeople = [];
  const unmatchedRows = [];

  for (const row of [...tccRows, ...taipeiGovRows]) {
    sourcePeople.push(sourcePerson(row));
    const match = matchPerson(row, peopleByName);

    if (!match) {
      unmatchedRows.push({
        sourceId: row.sourceId,
        name: row.name,
        position: row.position,
        district: row.district,
        sourceUrl: row.sourceUrl,
      });
      continue;
    }

    personClaims.push(...claimsForMatchedRow(row, match));
  }

  const summary = {
    publicPeople: publicPeople.length,
    tccRows: tccRows.length,
    taipeiGovRows: taipeiGovRows.length,
    sourcePeople: sourcePeople.length,
    matchedRows: sourcePeople.length - unmatchedRows.length,
    unmatchedRows: unmatchedRows.length,
    claims: personClaims.length,
  };
  const output = {
    schemaVersion: 1,
    name: 'taipei-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Taipei-specific official parser. Council profile pages expose gender/birth date/education/experience/platform. Taipei City Government leader pages expose title/education/experience but usually not gender.',
    sources: [
      { id: tccSourceId, name: tccSourceName, url: tccListUrl },
      { id: taipeiGovSourceId, name: taipeiGovSourceName, url: taipeiGovLeaderUrl },
    ],
    summary,
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
  console.error(`Taipei official person profile enrichment failed: ${message}`);
  process.exit(1);
});
