import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'new-taipei-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'new-taipei', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const ntpcCouncilSourceId = 'new-taipei-city-council-current-councilors';
const ntpcCouncilSourceName = '新北市議會：現任議員';
const ntpcCouncilBaseUrl = 'https://www.ntp.gov.tw/';
const ntpcCouncilListUrl = 'https://www.ntp.gov.tw/councilor-all?program=37';

const ntpcGovSourceId = 'new-taipei-city-government-leaders';
const ntpcGovSourceName = '新北市政府：市長、副市長與機關首長';
const ntpcGovBaseUrl = 'https://www.ntpc.gov.tw/ch/';
const ntpcGovMayorUrl = 'https://www.ntpc.gov.tw/ch/home.jsp?id=03e0d4f8fe4bf200';
const ntpcGovDeputyUrl = 'https://www.ntpc.gov.tw/ch/home.jsp?id=4754a60e32ed2ffe';
const ntpcGovAgenciesUrl = 'https://www.ntpc.gov.tw/ch/home.jsp?id=461536299de62891';

const districtByArea = new Map([
  ['1', '新北市第1選舉區（淡水區、八里區、三芝區、石門區）'],
  ['2', '新北市第2選舉區（五股區、泰山區、林口區）'],
  ['3', '新北市第3選舉區（新莊區）'],
  ['4', '新北市第4選舉區（三重區、蘆洲區）'],
  ['5', '新北市第5選舉區（板橋區）'],
  ['6', '新北市第6選舉區（中和區）'],
  ['7', '新北市第7選舉區（永和區）'],
  ['8', '新北市第8選舉區（土城區、樹林區、鶯歌區、三峽區）'],
  ['9', '新北市第9選舉區（新店區、深坑區、石碇區、坪林區、烏來區）'],
  ['10', '新北市第10選舉區（瑞芳區、平溪區、雙溪區、貢寮區）'],
  ['11', '新北市第11選舉區（汐止區、金山區、萬里區）'],
  ['12', '新北市第12選舉區（平地原住民）'],
  ['13', '新北市第13選舉區（山地原住民）'],
]);

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
  if (text === '無黨籍及未經政黨推薦') return '無黨籍';
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
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

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

function absoluteUrl(baseUrl, href) {
  return new URL(decodeHtml(href).trim(), baseUrl).toString();
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
    district: row.district ?? '新北市',
    birthDate: row.birthDate ?? null,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    sourceType: 'official_officeholder',
    confidenceSuggestion: 'A',
    sourcePayload: row.sourcePayload ?? {},
  };
}

function adoptedCouncilor(row) {
  const sourceKey = sourcePersonKey(row.sourceId, row.externalId);

  return {
    externalId: `official-current:${sourceKey}`,
    sourcePersonKey: sourceKey,
    sourceId: row.sourceId,
    sourceType: 'official_officeholder',
    confidenceSuggestion: 'A',
    name: row.name,
    gender: row.gender ?? 'unknown',
    party: row.party ?? '',
    position: row.position ?? '',
    district: row.district ?? '新北市',
    education: row.education ?? '',
    experience: row.experience ?? '',
    sourceUrl: row.sourceUrl,
    sourcePayload: {
      ...(row.sourcePayload ?? {}),
      roleOrigin: 'elected',
      elected: true,
      identityStatus: 'official_name_only',
      adoptionReason: 'official current councilor with no existing public person sharing the same normalized name',
    },
  };
}

function adoptedAppointedOfficial(row) {
  const sourceKey = sourcePersonKey(row.sourceId, row.externalId);

  return {
    externalId: `official-appointed:${sourceKey}`,
    sourcePersonKey: sourceKey,
    sourceId: row.sourceId,
    sourceType: 'official_officeholder',
    confidenceSuggestion: 'A',
    name: row.name,
    gender: row.gender ?? 'unknown',
    party: row.party ?? '',
    position: row.position ?? '',
    district: row.district ?? '新北市',
    education: row.education ?? '',
    experience: row.experience ?? '',
    sourceUrl: row.sourceUrl,
    sourcePayload: {
      ...(row.sourcePayload ?? {}),
      roleOrigin: 'appointed',
      elected: false,
      identityStatus: 'official_name_only',
      adoptionReason: 'official appointed officeholder with no existing public person sharing the same normalized name',
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

  if (String(person.position ?? '').includes('議員')) {
    score += 10;
    reasons.push('councilor role matched');
  }

  if (row.sourceId === ntpcGovSourceId && String(row.position ?? '').includes('市長') && String(person.position ?? '').includes('市長')) {
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
    method: row.sourceId === ntpcGovSourceId ? 'new_taipei_government_profile_match' : 'new_taipei_council_profile_match',
    score: best.score,
    reasons: best.reasons,
  };
}

function ntpcCouncilorLinks(html) {
  const links = [];
  const seen = new Set();
  const regex = /href=["'](councilor-detail\?program=37&A=(\d+)&C=(\d+)\s*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const href = match[1].trim();
    const url = absoluteUrl(ntpcCouncilBaseUrl, href);

    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    links.push({
      url,
      area: match[2],
      councilorId: match[3],
      listName: cleanInlineText(match[4]),
    });
  }

  return links;
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

function parseCouncilorDetail(html, link) {
  const text = cleanInlineText(html);
  const party = normalizePartyName(text.match(/政黨：(.+?)\s+電話：/)?.[1] ?? '');
  const name = text.match(/第\d+選區議員介紹\s+(.+?)\s+政黨：/)?.[1]?.trim() || link.listName;

  return {
    sourceId: ntpcCouncilSourceId,
    sourceName: ntpcCouncilSourceName,
    sourceUrl: link.url,
    externalId: `current-councilor-${link.councilorId}`,
    name,
    gender: 'unknown',
    party,
    position: '新北市議員',
    district: districtByArea.get(link.area) ?? `新北市第${link.area}選舉區`,
    education: fieldBetween(text, '學歷', ['經歷', '現任', '政見']),
    experience: [fieldBetween(text, '經歷', ['現任', '政見']), fieldBetween(text, '現任', ['政見'])]
      .filter(Boolean)
      .join('\n'),
    platform: fieldBetween(text, '政見', ['友善列印', '轉寄', '回上層']),
    sourcePayload: {
      profileUrl: link.url,
      area: link.area,
      councilorId: link.councilorId,
      roleOrigin: 'elected',
      elected: true,
      identityStatus: 'needs_identity_check',
    },
  };
}

function mainContentText(html) {
  const text = cleanInlineText(html);
  const start = text.indexOf('::: 首頁');
  const endLabels = ['展開/收合', '如何到市府', '隱私權及資訊安全宣告'];
  const content = start >= 0 ? text.slice(start) : text;
  const endIndexes = endLabels.map((label) => content.indexOf(label)).filter((index) => index >= 0);
  return endIndexes.length > 0 ? content.slice(0, Math.min(...endIndexes)).trim() : content;
}

function pageLinks(html) {
  const links = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    links.push({
      href: decodeHtml(match[1]).trim(),
      text: cleanInlineText(match[2]),
    });
  }

  return links;
}

function parseGovLeaderProfile(html, row) {
  const text = mainContentText(html);
  const titleMatch =
    text.match(/(代理局長)：?(.+?)\s+學歷/) ??
    text.match(/(市長|副市長|秘書長|副秘書長|局長|處長|主任委員|主任|董事長)\s+(.+?)\s+(?:職務列等\s+.+?\s+)?學歷/);
  const title = row.title ?? titleMatch?.[1] ?? '新北市政府首長';
  const name = row.name ?? titleMatch?.[2] ?? '';
  const education = fieldBetween(text, '學歷', ['經歷', '個人簡歷', '督導機關']);
  const experience = fieldBetween(text, '經歷', ['督導機關']) || fieldBetween(text, '個人簡歷', ['督導機關']);

  if (!name) {
    throw new Error(`Unable to parse official name from ${row.url}`);
  }

  return {
    sourceId: ntpcGovSourceId,
    sourceName: ntpcGovSourceName,
    sourceUrl: row.url,
    externalId: `leader-${new URL(row.url).searchParams.get('id') ?? hashId(row.url)}`,
    name,
    gender: 'unknown',
    party: '',
    position: row.agency && !title.includes(row.agency) ? `新北市政府${row.agency}${title}` : `新北市${title}`,
    district: '新北市',
    education,
    experience,
    sourcePayload: {
      profileUrl: row.url,
      agency: row.agency ?? '',
      title,
      roleOrigin: row.roleOrigin ?? 'appointed',
      elected: row.elected ?? false,
      identityStatus: 'needs_identity_check',
    },
  };
}

async function fetchNtpcGovLeaderRows() {
  const rows = [
    {
      url: ntpcGovMayorUrl,
      name: '侯友宜',
      title: '市長',
      agency: '',
      roleOrigin: 'elected',
      elected: true,
    },
  ];
  const deputyHtml = await fetchText(ntpcGovDeputyUrl);
  const deputyLinks = pageLinks(deputyHtml)
    .filter((link) => ['劉和然', '朱惕之', '陳純敬'].includes(link.text))
    .map((link) => ({
      url: absoluteUrl(ntpcGovBaseUrl, link.href),
      name: link.text,
      title: '副市長',
      agency: '',
      roleOrigin: 'appointed',
      elected: false,
    }));
  const deputyByUrl = new Map(deputyLinks.map((row) => [row.url, row]));
  rows.push(...deputyByUrl.values());

  const agenciesHtml = await fetchText(ntpcGovAgenciesUrl);
  const agencyLinks = pageLinks(agenciesHtml)
    .filter((link) => /^(秘書處|民政局|財政局|教育局|經濟發展局|工務局|水利局|農業局|城鄉發展局|社會局|地政局|勞工局|交通局|觀光旅遊局|法制局|警察局|衛生局|環境保護局|消防局|文化局|原住民族行政局|新聞局|人事處|主計處|政風處|研究發展考核委員會|客家事務局|捷運工程局|青年局|體育局)$/.test(link.text));
  const agencyHeadRows = [];

  for (const agency of agencyLinks) {
    const agencyHtml = await fetchText(absoluteUrl(ntpcGovBaseUrl, agency.href));
    const headLink = pageLinks(agencyHtml).find((link) => link.text === '機關首長');

    if (!headLink) {
      continue;
    }

    agencyHeadRows.push({
      url: absoluteUrl(ntpcGovBaseUrl, headLink.href),
      agency: agency.text,
      roleOrigin: 'appointed',
      elected: false,
    });
  }

  rows.push(...agencyHeadRows);
  return rows;
}

async function fetchNtpcGovProfiles() {
  const rows = await fetchNtpcGovLeaderRows();
  const parsedRows = await mapLimit(rows, 6, async (row) => {
    try {
      return { profile: parseGovLeaderProfile(await fetchText(row.url), row), skippedRow: null };
    } catch (error) {
      return {
        profile: null,
        skippedRow: {
          sourceId: ntpcGovSourceId,
          name: row.name ?? '',
          position: row.title ?? '新北市政府首長',
          district: '新北市',
          sourceUrl: row.url,
          reason: error.message,
        },
      };
    }
  });

  return {
    profiles: parsedRows.map((row) => row.profile).filter(Boolean),
    skippedRows: parsedRows.map((row) => row.skippedRow).filter(Boolean),
  };
}

async function fetchNtpcCouncilProfiles() {
  const listHtml = await fetchText(ntpcCouncilListUrl);
  const links = ntpcCouncilorLinks(listHtml);
  return mapLimit(links, 6, async (link) => parseCouncilorDetail(await fetchText(link.url), link));
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

function mergeOfficialRole(target, row) {
  const positions = new Set(
    String(target.position ?? '')
      .split('；')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  positions.add(row.position);
  target.position = Array.from(positions).join('；');

  if (row.education && !target.education) {
    target.education = row.education;
  }

  if (row.experience && !target.experience) {
    target.experience = row.experience;
  }

  const sourcePayload = target.sourcePayload ?? {};
  sourcePayload.additionalOfficialRoles = [
    ...(Array.isArray(sourcePayload.additionalOfficialRoles) ? sourcePayload.additionalOfficialRoles : []),
    {
      sourcePersonKey: sourcePersonKey(row.sourceId, row.externalId),
      position: row.position,
      sourceUrl: row.sourceUrl,
      agency: row.sourcePayload?.agency ?? '',
      title: row.sourcePayload?.title ?? '',
    },
  ];
  target.sourcePayload = sourcePayload;
}

async function main() {
  if (!anonKey) {
    throw new Error('Set SUPABASE_ANON_KEY for New Taipei official person profile enrichment.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [publicPeople, ntpcCouncilRows, ntpcGovResult] = await Promise.all([
    fetchAllRows('public_people', 'person_id,name,gender,party,position,district,education,experience'),
    fetchNtpcCouncilProfiles(),
    fetchNtpcGovProfiles(),
  ]);
  const ntpcGovRows = ntpcGovResult.profiles;
  const skippedRows = ntpcGovResult.skippedRows;
  const peopleByName = indexPeopleByName(publicPeople);
  const personClaims = [];
  const sourcePeople = [];
  const unmatchedRows = [];
  const adoptedPeople = [];
  const adoptedPeopleByName = new Map();
  let matchedRows = 0;

  for (const row of [...ntpcCouncilRows, ...ntpcGovRows]) {
    sourcePeople.push(sourcePerson(row));
    const match = matchPerson(row, peopleByName);

    if (!match) {
      const sameNamePeople = peopleByName.get(normalizeIdentityText(row.name)) ?? [];

      if (row.sourceId === ntpcCouncilSourceId && sameNamePeople.length === 0) {
        adoptedPeople.push(adoptedCouncilor(row));
        continue;
      }

      if (row.sourceId === ntpcGovSourceId && sameNamePeople.length === 0) {
        const key = normalizeIdentityText(row.name);
        const existing = adoptedPeopleByName.get(key);

        if (existing) {
          mergeOfficialRole(existing, row);
        } else {
          const adopted = adoptedAppointedOfficial(row);
          adoptedPeople.push(adopted);
          adoptedPeopleByName.set(key, adopted);
        }
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
    ntpcCouncilRows: ntpcCouncilRows.length,
    ntpcGovRows: ntpcGovRows.length,
    adoptedPeople: adoptedPeople.length,
    sourcePeople: sourcePeople.length,
    matchedRows,
    unmatchedRows: unmatchedRows.length,
    skippedRows: skippedRows.length,
    claims: personClaims.length,
  };
  const output = {
    schemaVersion: 1,
    name: 'new-taipei-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'New Taipei-specific official parser. Council detail pages expose party, district, contact, education, experience/current office and platform. City government pages expose mayor, deputy mayors and agency heads with education/experience; these pages usually do not expose gender or birth date.',
    sources: [
      { id: ntpcCouncilSourceId, name: ntpcCouncilSourceName, url: ntpcCouncilListUrl },
      { id: ntpcGovSourceId, name: ntpcGovSourceName, url: ntpcGovAgenciesUrl },
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
  console.error(`New Taipei official person profile enrichment failed: ${message}`);
  process.exit(1);
});
