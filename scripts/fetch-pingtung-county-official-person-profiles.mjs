import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'pingtung-county-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'pingtung-county', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const councilSourceId = 'pingtung-county-council-current-councilors';
const councilSourceName = '屏東縣議會：議員介紹';
const councilListUrl = 'https://www.ptcc.gov.tw/?Page=Persional&Guid=1c445ed1-8f2f-4c7f-75f6-6d6aafa3516e';

const govSourceId = 'pingtung-county-government-leaders';
const govSourceName = '屏東縣政府：首長專區';
const govLeaderPages = [
  { url: 'https://www.pthg.gov.tw/cp.aspx?n=2CD2D022F4AA2FE5', title: '縣長', expectedNames: ['周春米'], roleOrigin: 'elected', elected: true, parser: 'magistrate' },
  { url: 'https://www.pthg.gov.tw/cp.aspx?n=3C05F8BFDDB01089', title: '副縣長', expectedNames: ['黃國榮', '鄞鳳蘭'], roleOrigin: 'appointed', elected: false, parser: 'profileTables' },
  { url: 'https://www.pthg.gov.tw/cp.aspx?n=4EBBA2ADFDDC2174', title: '秘書長', expectedNames: ['楊慶哲'], roleOrigin: 'appointed', elected: false, parser: 'profileTables' },
  { url: 'https://www.pthg.gov.tw/cp.aspx?n=25A8BEDDFD056E23', title: '副秘書長', expectedNames: ['江國豐'], roleOrigin: 'appointed', elected: false, parser: 'profileTables' },
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
    .replace(/[鳯]/g, '鳳')
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

function archiveRawPage(url, response, bodyText) {
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
    // First archived source for this county.
  }
  const sources = Array.isArray(manifest.sources) ? manifest.sources.filter((item) => item.sourceUrl !== url) : [];
  sources.push({
    title: 'Pingtung County official person profile source page',
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
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 public-office-watch local data sync' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);

  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  const text = replacementCount > 5 ? new TextDecoder('big5', { fatal: false }).decode(bytes) : utf8;
  archiveRawPage(url, response, text);
  return text;
}

function restUrl(viewName) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${viewName}`);
}

async function supabaseJson(url) {
  const response = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
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
    district: row.district ?? '屏東縣',
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
    district: row.district ?? '屏東縣',
    education: row.education ?? '',
    experience: row.experience ?? '',
    sourceUrl: row.sourceUrl,
    sourcePayload: {
      ...(row.sourcePayload ?? {}),
      roleOrigin: origin,
      elected: origin === 'elected',
      identityStatus: 'official_name_only',
      adoptionReason: row.sourcePayload?.adoptionReason ?? `official ${origin} officeholder with no existing public person sharing the same normalized name`,
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
  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)),
  );
}

const chineseNumberValues = new Map([
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6],
  ['七', 7],
  ['八', 8],
  ['九', 9],
  ['十', 10],
]);

function parseChineseOrdinal(value) {
  const text = normalizeIdentityText(value);
  const digitMatch = text.match(/第(\d+)選[舉區]*/u);
  if (digitMatch) return Number.parseInt(digitMatch[1], 10);

  const chineseMatch = text.match(/第([一二三四五六七八九十]+)選[舉區]*/u);
  const chinese = chineseMatch?.[1] ?? '';
  if (!chinese) return null;
  if (chinese === '十') return 10;
  if (chinese.startsWith('十')) return 10 + (chineseNumberValues.get(chinese.slice(1)) ?? 0);
  if (chinese.endsWith('十')) return (chineseNumberValues.get(chinese.slice(0, -1)) ?? 0) * 10;
  if (chinese.includes('十')) {
    const [tens, ones] = chinese.split('十');
    return (chineseNumberValues.get(tens) ?? 0) * 10 + (chineseNumberValues.get(ones) ?? 0);
  }
  return chineseNumberValues.get(chinese) ?? null;
}

function sameCounty(left, right) {
  const leftCounty = normalizeIdentityText(left).match(/[\p{Script=Han}]{2,3}[縣市]/u)?.[0] ?? '';
  const rightCounty = normalizeIdentityText(right).match(/[\p{Script=Han}]{2,3}[縣市]/u)?.[0] ?? '';
  return Boolean(leftCounty && rightCounty && leftCounty === rightCounty);
}

function councilDistrictOrdinal(row) {
  return parseChineseOrdinal(row.sourcePayload?.districtLabel ?? row.district);
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
  } else if (row.sourceId === councilSourceId && councilDistrictOrdinal(row) && councilDistrictOrdinal(row) === parseChineseOrdinal(person.district) && sameCounty(row.district, person.district)) {
    score += 15;
    reasons.push('district ordinal matched');
  }
  if (String(row.position ?? '').includes('議員') && String(person.position ?? '').includes('議員')) {
    score += 10;
    reasons.push('councilor role matched');
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
  const scored = candidates
    .map((person) => ({ person, ...scoreMatch(row, person) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0] ?? null;
  const second = scored[1] ?? null;

  if (!best) return null;

  if (best.score >= 75 && (!second || best.score - second.score >= 10)) {
    return {
      person: best.person,
      method: row.sourceId === govSourceId ? 'pingtung_county_government_profile_match' : 'pingtung_county_council_profile_match',
      score: best.score,
      reasons: best.reasons,
    };
  }

  if (
    candidates.length === 1 &&
    row.sourceId === councilSourceId &&
    row.sourcePayload?.elected &&
    best.score >= 50 &&
    sameCounty(row.district, best.person.district) &&
    String(best.person.position ?? '').includes('候選人')
  ) {
    return {
      person: best.person,
      method: 'pingtung_county_unique_current_councilor_candidate_match',
      score: 75,
      reasons: [...best.reasons, 'unique same-name candidate in same county matched to current official councilor'],
    };
  }

  return null;
}

function isClearlyDifferentSameNamePerson(row, person) {
  return Boolean(
    row.sourceId === govSourceId &&
    row.sourcePayload?.elected === false &&
    row.district &&
    person.district &&
    !overlap(row.district, person.district) &&
    row.position &&
    person.position &&
    !overlap(row.position, person.position)
  );
}

function shouldAdoptOfficial(row, sameNamePeople) {
  return sameNamePeople.length === 0 || sameNamePeople.every((person) => isClearlyDifferentSameNamePerson(row, person));
}

function adoptionSourceRow(row, sameNamePeople) {
  if (sameNamePeople.length === 0) return row;

  return {
    ...row,
    sourcePayload: {
      ...(row.sourcePayload ?? {}),
      adoptionReason: 'official appointed officeholder only matched same-name public people with incompatible region and role',
    },
  };
}

function fieldBetween(text, startLabel, endLabels) {
  const start = text.indexOf(startLabel);
  if (start < 0) return '';

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
    if (value) return value;
  }
  return '';
}

function normalizeCouncilorName(value) {
  const cleaned = cleanInlineText(value)
    .replace(/(議長|副議長|議員)/u, '')
    .replace(/[鳯]/g, '鳳')
    .replace(/[\s\u00A0\u3000]+/g, ' ')
    .trim();
  return cleaned.match(/[\p{Script=Han}]{2,5}/u)?.[0] ?? cleaned;
}

function parseCouncilRows(html) {
  const rows = [];
  const blockPattern = /<td rowspan="2"[^>]*class="list evacategory"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td class="evasubject borderleft">([\s\S]*?)<\/td>[\s\S]*?<td class="list borderleft"[^>]*>([\s\S]*?)<\/td>/gu;
  const linkPattern = /<a href="([^"]*Page=PersionalDetail[^"]*)">([\s\S]*?)<\/a>/gu;

  for (const blockMatch of html.matchAll(blockPattern)) {
    const districtLabel = cleanInlineText(blockMatch[1]);
    const townships = cleanInlineText(blockMatch[2]);

    for (const linkMatch of blockMatch[3].matchAll(linkPattern)) {
      const profileUrl = new URL(decodeHtml(linkMatch[1]), councilListUrl).toString();
      const originalLabel = cleanInlineText(linkMatch[2]);
      const name = normalizeCouncilorName(originalLabel);
      if (!/^[\p{Script=Han}]{2,5}$/u.test(name)) continue;

      rows.push({
        sourceId: councilSourceId,
        sourceName: councilSourceName,
        sourceUrl: profileUrl,
        externalId: 'current-councilor-' + hashId([profileUrl, districtLabel, townships, name].join('|')),
        name,
        gender: 'unknown',
        party: '',
        position: '屏東縣議員',
        district: `屏東縣${townships}`,
        education: '',
        experience: '',
        sourcePayload: {
          profileUrl,
          districtLabel,
          townships,
          originalLabel,
          roleOrigin: 'elected',
          elected: true,
          identityStatus: 'needs_identity_check',
        },
      });
    }
  }

  if (rows.length === 0) throw new Error('Unable to parse council members from ' + councilListUrl);
  return [...new Map(rows.map((row) => [row.externalId, row])).values()];
}

function parseCouncilProfile(html, row) {
  const content = cleanText(html);
  if (!content.includes(row.name)) {
    throw new Error('Unable to verify official name from ' + row.sourcePayload.profileUrl);
  }

  const historyMatch = html.match(
    /學經歷\s*[：:]\s*<br\s*\/?>([\s\S]*?)(?:<br\s*\/?>(?:\s|&nbsp;)*){2}/iu,
  );
  const historyLines = cleanText(historyMatch?.[1] ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const officePattern = /(議員|代表|里長|鄉長|鎮長|市長|會長|主任|顧問|理事|監事|助理|秘書|黨代表|委員)/u;
  const educationPattern = /(大學|學院|專科|高中|高職|國中|國小|研究所|博士|碩士|學士|畢業|肄業)/u;
  const educationLines = historyLines.filter(
    (line) => educationPattern.test(line) && !officePattern.test(line),
  );
  const experienceLines = historyLines.filter((line) => !educationLines.includes(line));

  return {
    ...row,
    education: educationLines.join('\n'),
    experience: experienceLines.join('\n'),
  };
}

async function fetchCouncilProfiles() {
  try {
    const html = await fetchText(councilListUrl);
    const rows = parseCouncilRows(html);
    const skippedRows = [];
    const profiles = await mapLimit(rows, 4, async (row) => {
      try {
        const profileHtml = await fetchText(row.sourcePayload.profileUrl);
        return parseCouncilProfile(profileHtml, row);
      } catch (error) {
        skippedRows.push({
          sourceId: row.sourceId,
          name: row.name,
          position: row.position,
          district: row.district,
          sourceUrl: row.sourcePayload.profileUrl,
          reason: error instanceof Error ? error.message : String(error),
        });
        return row;
      }
    });

    return { profiles, skippedRows };
  } catch (error) {
    return {
      profiles: [],
      skippedRows: [{
        sourceId: councilSourceId,
        name: '',
        position: '屏東縣議員',
        district: '屏東縣',
        sourceUrl: councilListUrl,
        reason: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

function profileRowFromPage(page, name, education, experience) {
  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: page.url,
    externalId: 'leader-' + hashId([page.url, page.title, name].join('|')),
    name,
    gender: 'unknown',
    party: '',
    position: '屏東縣政府' + page.title,
    district: '屏東縣',
    education,
    experience,
    sourcePayload: {
      profileUrl: page.url,
      title: page.title,
      roleOrigin: page.roleOrigin,
      elected: page.elected,
      identityStatus: 'needs_identity_check',
    },
  };
}

function parseMagistrateProfile(html, page) {
  const content = cleanText(html);
  const name = page.expectedNames[0];
  const education = fieldBetweenAny(content, ['縣長學歷', '學歷'], ['網站功能']);
  const experience = fieldBetweenAny(content, ['縣長經歷', '經歷'], ['縣長學歷', '學歷', '網站功能']);

  if (!html.includes(name) && !content.includes(name)) {
    throw new Error('Unable to verify official name from ' + page.url);
  }

  return [profileRowFromPage(page, name, education, experience)];
}

function parseProfileTables(html, page) {
  const rows = [];
  const tablePattern = /<table\b[\s\S]*?<\/table>/giu;

  for (const tableMatch of html.matchAll(tablePattern)) {
    const content = cleanText(tableMatch[0]);
    const name = fieldBetweenAny(content, ['姓名'], ['學歷', '經歷']);
    const education = fieldBetweenAny(content, ['學歷'], ['經歷']);
    const experience = fieldBetweenAny(content, ['經歷'], ['網站功能']);
    const expectedName = page.expectedNames.find((expected) => normalizeIdentityText(expected) === normalizeIdentityText(name));

    if (expectedName) rows.push(profileRowFromPage(page, expectedName, education, experience));
  }

  if (rows.length !== page.expectedNames.length) {
    throw new Error(`Expected ${page.expectedNames.length} ${page.title} profiles from ${page.url}, parsed ${rows.length}`);
  }

  return rows;
}

function parseGovLeaderProfile(html, page) {
  return page.parser === 'magistrate' ? parseMagistrateProfile(html, page) : parseProfileTables(html, page);
}

async function fetchGovProfiles() {
  const parsedRows = await mapLimit(govLeaderPages, 2, async (page) => {
    try {
      const html = await fetchText(page.url);
      return { profiles: parseGovLeaderProfile(html, page), skippedRow: null };
    } catch (error) {
      return {
        profiles: [],
        skippedRow: {
          sourceId: govSourceId,
          name: page.expectedNames.join('、'),
          position: `屏東縣政府${page.title}`,
          district: '屏東縣',
          sourceUrl: page.url,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  return {
    profiles: parsedRows.flatMap((row) => row.profiles),
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
    ['external_id', sourcePersonKey(row.sourceId, row.externalId)],
  ];

  return fields
    .filter(([, value]) => value && value !== 'unknown')
    .map(([claimType, claimValue]) => claimRecord({ row, person: match.person, match, claimType, claimValue }));
}

async function main() {
  if (!anonKey) throw new Error('Set SUPABASE_ANON_KEY for Pingtung County official person profile enrichment.');

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
      if (shouldAdoptOfficial(row, sameNamePeople)) {
        adoptedPeople.push(adoptedOfficial(adoptionSourceRow(row, sameNamePeople), row.sourceId === councilSourceId || row.sourcePayload?.elected ? 'elected' : 'appointed'));
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
    name: 'pingtung-county-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Pingtung County-specific official parser. Council rows cover current councilors from the official Pingtung County Council member table. County government rows cover official Pingtung County Government leader profile pages.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: councilListUrl },
      ...govLeaderPages.map((page) => ({ id: govSourceId, name: `${govSourceName}：${page.title}`, url: page.url })),
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
  console.error(`Pingtung County official person profile enrichment failed: ${message}`);
  process.exit(1);
});
