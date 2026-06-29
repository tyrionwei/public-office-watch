import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'taichung-city-official-person-profiles.seed.json');

const councilSourceId = 'taichung-city-council-current-councilors';
const councilSourceName = '臺中市議會：現任議員';
const councilBaseUrl = 'https://www.tccc.gov.tw/';

const govSourceId = 'taichung-city-government-leaders';
const govSourceName = '臺中市政府：市長、副市長、秘書長、副秘書長與局處首長';
const govBaseUrl = 'https://www.taichung.gov.tw/';

const govLeaderRows = [
  {
    url: 'https://www.taichung.gov.tw/8868/9942/9986/9989/1173576/post',
    name: '盧秀燕',
    title: '市長',
    roleOrigin: 'elected',
    elected: true,
  },
  {
    url: 'https://www.taichung.gov.tw/1351193/post',
    name: '黃國榮',
    title: '副市長',
    roleOrigin: 'appointed',
    elected: false,
  },
  {
    url: 'https://www.taichung.gov.tw/2549347/post',
    name: '賴淑惠',
    title: '副市長',
    roleOrigin: 'appointed',
    elected: false,
  },
  {
    url: 'https://www.taichung.gov.tw/2559816/post',
    name: '鄭照新',
    title: '副市長',
    roleOrigin: 'appointed',
    elected: false,
  },
  {
    url: 'https://www.taichung.gov.tw/1173955/post',
    name: '黃崇典',
    title: '秘書長',
    roleOrigin: 'appointed',
    elected: false,
  },
  {
    url: 'https://www.taichung.gov.tw/2549548/post',
    name: '張大春',
    title: '副秘書長',
    roleOrigin: 'appointed',
    elected: false,
  },
  {
    url: 'https://www.taichung.gov.tw/2450790/post',
    name: '林育鴻',
    title: '副秘書長',
    roleOrigin: 'appointed',
    elected: false,
  },
];

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
  return replacementCount > 5 ? new TextDecoder('big5', { fatal: false }).decode(bytes) : utf8;
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
    district: row.district ?? '臺中市',
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
    district: row.district ?? '臺中市',
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

  if (!best || best.score < 75 || (second && best.score - second.score < 10)) {
    return null;
  }

  return {
    person: best.person,
    method: row.sourceId === govSourceId ? 'taichung_city_government_profile_match' : 'taichung_city_council_profile_match',
    score: best.score,
    reasons: best.reasons,
  };
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

function parsePartyFromIcon(value) {
  const text = String(value ?? '');
  if (text.includes('partisun_01')) return '中國國民黨';
  if (text.includes('partisun_02')) return '民主進步黨';
  if (text.includes('partisun_03')) return '親民黨';
  if (text.includes('partisun_04')) return '台灣團結聯盟';
  if (text.includes('partisun_05')) return '無黨籍';
  if (text.includes('partisun_06')) return '台灣民眾黨';
  return '';
}

function parseCouncilorDetail(html, row) {
  const text = cleanText(html);
  const name = row.name;
  const party = normalizePartyName(fieldBetween(text, '黨藉', ['E - mail', '服務處'])) || row.party;
  const education = fieldBetween(text, '學歷', ['經歷']);
  const experience = fieldBetween(text, '經歷', ['政見']);
  const platform = fieldBetween(text, '政見', ['考察園地', '返回']);

  if (!name || !party) {
    return null;
  }

  return {
    sourceId: councilSourceId,
    sourceName: councilSourceName,
    sourceUrl: row.sourceUrl,
    externalId: `current-councilor-${row.councilorId}`,
    name,
    gender: 'unknown',
    party,
    position: '臺中市議員',
    district: row.district,
    education,
    experience,
    platform,
    sourcePayload: {
      profileUrl: row.sourceUrl,
      listUrl: row.listUrl,
      councilorId: row.councilorId,
      zno: row.zno,
      rawDistrict: row.rawDistrict,
      roleOrigin: 'elected',
      elected: true,
      identityStatus: 'needs_identity_check',
    },
  };
}

async function fetchCouncilProfiles() {
  const districts = Array.from({ length: 17 }, (_, index) => ({
    zno: 95 + index,
    label: `第${index + 1}選區`,
  }));
  const listRows = [];

  for (const district of districts) {
    const listUrl = new URL(`wb_introduction03.asp?uno=&zno=${district.zno}`, councilBaseUrl).toString();
    const html = await fetchText(listUrl);
    const districtTitle = cleanInlineText(html.match(/class="Mtitle">([\s\S]*?)<\/div>/i)?.[1] ?? district.label);
    const blockPattern = /<div class="list_block">([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;

    while ((match = blockPattern.exec(html))) {
      const block = match[1];
      const href = block.match(/href="([^"]*main\.asp\?uno=14[^"]+)"/i)?.[1] ?? '';
      const name = cleanInlineText(block.match(/target="_top">([^<]+?)議員<\/a>/i)?.[1] ?? '');
      const party = parsePartyFromIcon(block);
      const councilorId = new URL(href, councilBaseUrl).searchParams.get('cno') ?? hashId(href);

      if (!href || !name) {
        continue;
      }

      listRows.push({
        zno: district.zno,
        councilorId,
        name,
        party,
        rawDistrict: districtTitle,
        district: `臺中市${districtTitle}`,
        listUrl,
        sourceUrl: new URL(`wb_introduction02.asp?uno=&zno=${district.zno}&cno=${councilorId}`, councilBaseUrl).toString(),
      });
    }
  }

  const parsedRows = await mapLimit(listRows, 6, async (row) => {
    try {
      return { profile: parseCouncilorDetail(await fetchText(row.sourceUrl), row), skippedRow: null };
    } catch (error) {
      return {
        profile: null,
        skippedRow: {
          sourceId: councilSourceId,
          name: row.name,
          position: '臺中市議員',
          district: row.district,
          sourceUrl: row.sourceUrl,
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
  const content = contentAfterLast(text, row.name ?? row.title);
  const name = row.name ?? content.match(/姓名\s*([\p{Script=Han}]{2,4})/u)?.[1] ?? '';
  const education = fieldBetweenAny(content, ['學歷', '學 歷：', '學歷：'], ['主要經歷', '經歷', '市府分類', '最後異動日期']);
  const experience = fieldBetweenAny(content, ['主要經歷', '經歷', '經 歷：', '經歷：'], ['市府分類', '最後異動日期', '發布日期']);

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
    party: row.name === '盧秀燕' ? '中國國民黨' : '',
    position: `臺中市${row.title}`,
    district: '臺中市',
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

function parseAgencyHeadListEntry(html, expectedTitle) {
  const listSection = html.match(/<section class="list">([\s\S]*?)<\/section>/i)?.[1] ?? '';
  const tableRow = [...listSection.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .find((rowHtml) => {
      const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
      const title = cleanInlineText(cells[1] ?? '');
      return title === expectedTitle || title === `代理${expectedTitle}`;
    });

  if (tableRow) {
    const cells = [...tableRow.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    const nameCell = cells[2] ?? '';
    const name =
      cleanInlineText(nameCell.match(/<a\b[^>]*title="([^"]+)"/i)?.[1] ?? '') ||
      cleanInlineText(nameCell).replace(/[男女]性?$/u, '').trim();
    const gender = /alt="女"|女性/u.test(nameCell) ? 'female' : /alt="男"|男性/u.test(nameCell) ? 'male' : 'unknown';

    if (/^[\p{Script=Han}]{2,4}$/u.test(name)) {
      return { name, gender };
    }
  }

  const firstListLink = listSection.match(/<li>[\s\S]*?<a\b[^>]*title="([^"]+)"[^>]*>/i)?.[1] ?? '';
  const listName = cleanInlineText(firstListLink);

  if (/^[\p{Script=Han}]{2,4}$/u.test(listName)) {
    return { name: listName, gender: 'unknown' };
  }

  return null;
}

function parseAgencyHeadProfile(html, row) {
  const text = cleanText(html);
  const content = contentAfterLast(text, '字級：');
  const title = row.title;
  const listedHead = parseAgencyHeadListEntry(html, title);
  const namePatterns = [
    /姓\s*名\s*[：:]?\s*([\p{Script=Han}]{2,4})/u,
    /姓名\s*([\p{Script=Han}]{2,4})/u,
    new RegExp(`${title}[：:]\\s*\\n?([\\p{Script=Han}]{2,4})`, 'u'),
    new RegExp(`${title}[ \\t　]+([\\p{Script=Han}]{2,4})\\s*\\n學歷`, 'u'),
    new RegExp(`${title}\\s*\\n([\\p{Script=Han}]{2,4})`, 'u'),
    new RegExp(`\\n([\\p{Script=Han}]{2,4})[ \\t　]+${title}\\s*\\n現職`, 'u'),
    new RegExp(`\\n([\\p{Script=Han}]{2,4})\\s+${title}`, 'u'),
    new RegExp(`(?:${title}介紹|${title}簡介)\\s*[：:]?\\s*\\n([\\p{Script=Han}]{2,4})`, 'u'),
  ];
  const name = listedHead?.name ?? namePatterns.map((pattern) => content.match(pattern)?.[1] ?? '').find((value) => {
    return value && !/介紹|首頁|主要|副處|副局|業務|主管|組織|臺中|台中|預留|行政院|工程|性別|標題/.test(value);
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
    gender: listedHead?.gender ?? 'unknown',
    party: '',
    position: `臺中市政府${row.agency}${title}`,
    district: '臺中市',
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

function officialHeadTitleForAgency(agency) {
  if (agency.endsWith('委員會')) return '主任委員';
  if (agency.endsWith('局')) return '局長';
  if (agency.endsWith('處')) return '處長';
  return '首長';
}

function extractLinks(html) {
  const links = [];
  const pattern = /<a\b([^>]+)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    const attrs = match[1];
    const href = attrs.match(/\bhref="([^"]+)"/i)?.[1] ?? '';
    const title = attrs.match(/\btitle="([^"]+)"/i)?.[1] ?? cleanInlineText(match[2]);

    if (href) {
      links.push({ href, title: cleanInlineText(title), text: cleanInlineText(match[2]) });
    }
  }

  return links;
}

async function fetchAgencyHeadRows() {
  const listUrls = [
    new URL('10128/Lpsimplelist', govBaseUrl).toString(),
    new URL('8868/9957/10128?PageSize=30&Page=2&type=', govBaseUrl).toString(),
  ];
  const listHtmls = await mapLimit(listUrls, 2, (url) => fetchText(url));
  const listSections = listHtmls
    .flatMap((html) => [...html.matchAll(/<section class="list">([\s\S]*?)<\/section>/gi)].map((match) => match[1]));
  const agencyLinks = listSections
    .flatMap((html) => extractLinks(html))
    .filter((link) => /taichung\.gov\.tw/i.test(link.href));
  const seen = new Set();
  const agencies = [];

  for (const link of agencyLinks) {
    const agency = link.title.replace(/\(另開新視窗\)|\(另開視窗\)/g, '').trim();
    const homeUrl = new URL(link.href, govBaseUrl).toString();

    if (!agency || seen.has(agency)) {
      continue;
    }

    seen.add(agency);
    agencies.push({ agency, homeUrl });
  }

  const rows = [];
  const pages = await mapLimit(agencies, 5, async (agency) => {
    try {
      return { agency, html: await fetchText(agency.homeUrl) };
    } catch {
      return { agency, html: '' };
    }
  });

  for (const page of pages) {
    const links = extractLinks(page.html);
    const headLink =
      links.find((link) => link.title === '首長' || link.text === '首長') ??
      links.find((link) => link.title === '首長介紹' || link.text === '首長介紹');

    if (!headLink) {
      continue;
    }

    rows.push({
      agency: page.agency.agency,
      url: new URL(headLink.href, page.agency.homeUrl).toString(),
      title: officialHeadTitleForAgency(page.agency.agency),
      roleOrigin: 'appointed',
      elected: false,
    });
  }

  return rows;
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
          position: `臺中市${row.title}`,
          district: '臺中市',
          sourceUrl: row.url,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
  const agencyHeadRows = await fetchAgencyHeadRows();
  const agencyRows = await mapLimit(agencyHeadRows, 4, async (row) => {
    try {
      return { profile: parseAgencyHeadProfile(await fetchText(row.url), row), skippedRow: null };
    } catch (error) {
      return {
        profile: null,
        skippedRow: {
          sourceId: govSourceId,
          name: '',
          position: `臺中市政府${row.agency}${row.title}`,
          district: '臺中市',
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
    throw new Error('Set SUPABASE_ANON_KEY for Taichung City official person profile enrichment.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [publicPeople, councilResult, govResult] = await Promise.all([
    fetchAllRows('public_people', 'person_id,name,gender,party,position,district,education,experience'),
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
    name: 'taichung-city-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Taichung City-specific official parser. Council profiles are parsed from the official council district iframe and councilor detail iframe. City government profiles cover mayor, deputy mayors, secretary general, deputy secretary generals, and agency heads when an agency site exposes a stable official head profile page. Agency sites without a stable head profile link are intentionally skipped until a per-agency rule is added.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: 'https://www.tccc.gov.tw/main.asp?uno=16' },
      { id: govSourceId, name: govSourceName, url: 'https://www.taichung.gov.tw/10149/Lpsimplelist' },
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
