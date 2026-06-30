import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'tainan-city-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'tainan-city', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const councilSourceId = 'tainan-city-council-current-councilors';
const councilSourceName = '臺南市議會：現任議員';
const councilBaseUrl = 'https://www.tncc.gov.tw/';

const govSourceId = 'tainan-city-government-leaders';
const govSourceName = '臺南市政府：市長與局處首長';
const govBaseUrl = 'https://www.tainan.gov.tw/';

const govLeaderRows = [
  {
    url: 'https://www.tainan.gov.tw/cp.aspx?n=5034',
    name: '黃偉哲',
    title: '市長',
    roleOrigin: 'elected',
    elected: true,
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
    district: row.district ?? '臺南市',
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
    district: row.district ?? '臺南市',
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
    method: row.sourceId === govSourceId ? 'tainan_city_government_profile_match' : 'tainan_city_council_profile_match',
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

function parseCouncilorDetail(html, row) {
  const text = cleanText(html);
  const name = row.name;
  const party = normalizePartyName(fieldBetweenAny(text, ['黨籍：', '黨籍'], ['參加黨團', '電話'])) || row.party;
  const education = fieldBetween(text, '學歷', ['經歷']);
  const experience = fieldBetween(text, '經歷', ['政見']);
  const platform = fieldBetween(text, '政見', ['議會快訊', '更多議會快訊', '更多議員提案']);

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
    position: '臺南市議員',
    district: row.district,
    education,
    experience,
    platform,
    sourcePayload: {
      profileUrl: row.sourceUrl,
      listUrl: row.listUrl,
      councilorId: row.councilorId,
      rawDistrict: row.rawDistrict,
      roleOrigin: 'elected',
      elected: true,
      identityStatus: 'needs_identity_check',
    },
  };
}

async function fetchCouncilProfiles() {
  const indexUrl = new URL('subhome.asp?orcaid=C56635AE-3C35-4233-8561-7B2CAA2DF01F', councilBaseUrl).toString();
  const indexHtml = await fetchText(indexUrl);
  const districtPattern = /href="([^"]*subhome\.asp\?orcaid=C56635AE-3C35-4233-8561-7B2CAA2DF01F(?:&amp;|&)orcaid2=[^"]+)"[^>]*title="([^"]+)">([^<]+)<\/a>/g;
  const districts = [];
  let districtMatch;

  while ((districtMatch = districtPattern.exec(indexHtml))) {
    const href = decodeHtml(districtMatch[1]).replace(/[{}]/g, '');
    const label = cleanInlineText(districtMatch[3]);
    const description = cleanInlineText(districtMatch[2]).replace(/[()]/g, ' ');

    if (label && !districts.some((district) => district.label === label)) {
      districts.push({
        label,
        description,
        url: new URL(href, councilBaseUrl).toString(),
      });
    }
  }

  if (districts.length === 0) {
    throw new Error('Unable to parse Tainan council district links.');
  }

  const listRows = [];
  const skippedRows = [];

  for (const district of districts) {
    const html = await fetchText(district.url);
    const districtTitle = cleanInlineText(html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? `${district.label} ${district.description}`);
    const blockPattern = /<div class="col-lg-3">([\s\S]*?)(?=<div class="col-lg-3">|<\/div>\s*<\/div>\s*<div style="clear:both)/g;
    let match;

    while ((match = blockPattern.exec(html))) {
      const block = match[1];
      const href = block.match(/href="([^"]*councilorpage\.asp\?mainid=[^"]+)"/i)?.[1] ?? '';
      const rawName = cleanInlineText(block.match(/class="peoplebold"[^>]*>([^<]+)<\/span>/i)?.[1] ?? '');
      const name = rawName.replace(/[（(]歿[）)]/g, '').trim();
      const party = normalizePartyName(cleanInlineText(block.match(/<p class="mb-10"[^>]*>([^<]+)<\/p>/i)?.[1] ?? ''));
      const councilorId = new URL(href, councilBaseUrl).searchParams.get('mainid')?.replace(/[{}]/g, '') ?? hashId(href);

      if (!href || !name) {
        continue;
      }

      if (/[（(]歿[）)]/.test(rawName)) {
        // The official list keeps deceased councilors in-place; they are not parse gaps.
        continue;
      }

      listRows.push({
        councilorId,
        name,
        party,
        rawDistrict: districtTitle,
        district: `臺南市${districtTitle}`,
        listUrl: district.url,
        sourceUrl: new URL(href, councilBaseUrl).toString(),
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
          position: '臺南市議員',
          district: row.district,
          sourceUrl: row.sourceUrl,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  return {
    profiles: parsedRows.map((row) => row.profile).filter(Boolean),
    skippedRows: [...skippedRows, ...parsedRows.map((row) => row.skippedRow).filter(Boolean)],
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
    party: row.name === '黃偉哲' ? '民主進步黨' : '',
    position: `臺南市${row.title}`,
    district: '臺南市',
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

function parseGovLeaderTableRows(html, tableUrl) {
  const rows = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html))) {
    const cells = {};
    const cellPattern = /<td\b[^>]*data-title="([^"]+)"[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
      cells[decodeHtml(cellMatch[1]).trim()] = cellMatch[2];
    }

    const agencyCell = cells['機關名稱'];
    const titleCell = cells['職稱'];
    const nameCell = cells['姓名'];

    if (!agencyCell || !titleCell || !nameCell) {
      continue;
    }

    const agencyLink = agencyCell.match(/href="([^"]+)"/i)?.[1] ?? '';
    const agencyHtml = agencyCell.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? agencyCell;
    const agency = cleanInlineText(agencyHtml).replace(/\*/g, '').trim();
    const title = cleanInlineText(titleCell).replace(/\*/g, '').trim();
    const name = cleanInlineText(nameCell).replace(/\*/g, '').trim();

    if (!agency || !title || !/^[\p{Script=Han}]{2,5}$/u.test(name)) {
      continue;
    }

    const sourceUrl = agencyLink ? new URL(decodeHtml(agencyLink), tableUrl).toString() : tableUrl;

    rows.push({
      sourceId: govSourceId,
      sourceName: govSourceName,
      sourceUrl,
      externalId: `agency-head-${hashId(`${agency}:${title}:${name}`)}`,
      name,
      gender: 'unknown',
      party: '',
      position: `臺南市政府${agency}${title}`,
      district: '臺南市',
      education: '',
      experience: '',
      sourcePayload: {
        sourceUrl,
        agency,
        title,
        roleOrigin: 'appointed',
        elected: false,
        identityStatus: 'needs_identity_check',
      },
    });
  }

  return rows;
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
    return value && !/介紹|首頁|主要|副處|副局|業務|主管|組織|臺南|台南|預留|行政院|工程|性別|標題/.test(value);
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
    position: `臺南市政府${row.agency}${title}`,
    district: '臺南市',
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
    .filter((link) => /tainan\.gov\.tw/i.test(link.href));
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
          position: `臺南市${row.title}`,
          district: '臺南市',
          sourceUrl: row.url,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
  const tableUrl = new URL('News_Leader.aspx?n=14212&sms=16577', govBaseUrl).toString();
  let agencyRows = [];

  try {
    agencyRows = parseGovLeaderTableRows(await fetchText(tableUrl), tableUrl)
      .map((profile) => ({ profile, skippedRow: null }));
  } catch (error) {
    agencyRows = [{
      profile: null,
      skippedRow: {
        sourceId: govSourceId,
        name: '',
        position: '臺南市政府局處首長',
        district: '臺南市',
        sourceUrl: tableUrl,
        reason: error instanceof Error ? error.message : String(error),
      },
    }];
  }

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
    throw new Error('Set SUPABASE_ANON_KEY for Tainan City official person profile enrichment.');
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
    name: 'tainan-city-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Tainan City-specific official parser. Council profiles are parsed from the official council district pages and councilor detail pages. City government profiles cover the mayor and official leader table for first-level units and agencies.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: 'https://www.tncc.gov.tw/subhome.asp?orcaid=C56635AE-3C35-4233-8561-7B2CAA2DF01F' },
      { id: govSourceId, name: govSourceName, url: 'https://www.tainan.gov.tw/News_Leader.aspx?n=14212&sms=16577' },
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
  console.error(`Tainan City official person profile enrichment failed: ${message}`);
  process.exit(1);
});
