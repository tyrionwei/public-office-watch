import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'hualien-county-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'hualien-county', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const councilSourceId = 'hualien-county-council-current-councilors';
const councilSourceName = '花蓮縣議會：議員團隊';
const councilListUrl = 'https://www.hlcc.gov.tw/councillor.php';

const govSourceId = 'hualien-county-government-leaders';
const govSourceName = '花蓮縣政府：縣府團隊';
const magistrateUrl = 'https://www.hl.gov.tw/cp.aspx?n=32793';
const govTeamUrl = 'https://www.hl.gov.tw/cp.aspx?n=32861';
const govLeaderRows = [
  { url: magistrateUrl, name: '徐榛蔚', title: '縣長', roleOrigin: 'elected', elected: true, kind: 'magistrateProfile' },
  { url: govTeamUrl, name: '顏新章', title: '副縣長', roleOrigin: 'appointed', elected: false, kind: 'teamRow' },
  { url: govTeamUrl, name: '饒忠', title: '代理秘書長', roleOrigin: 'appointed', elected: false, kind: 'teamRow' },
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
    title: 'Hualien County official person profile source',
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
    district: row.district ?? '花蓮縣',
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
    district: row.district ?? '花蓮縣',
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
  } else if (row.sourceId === councilSourceId && parseChineseOrdinal(row.district) && parseChineseOrdinal(row.district) === parseChineseOrdinal(person.district) && sameCounty(row.district, person.district)) {
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
  const scored = candidates.map((person) => ({ person, ...scoreMatch(row, person) })).sort((left, right) => right.score - left.score);
  const best = scored[0] ?? null;
  const second = scored[1] ?? null;
  if (!best || best.score < 75 || (second && best.score - second.score < 10)) return null;
  return {
    person: best.person,
    method: row.sourceId === govSourceId ? 'hualien_county_government_profile_match' : 'hualien_county_council_profile_match',
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

function councilDetailUrl(id) {
  return new URL('councillor-data.php?index_no=' + encodeURIComponent(String(id)), councilListUrl).toString();
}

function normalizeCouncilorName(value) {
  return cleanInlineText(value)
    .replace(/(議長|副議長|議員)/gu, '')
    .replace(/[\s\u00A0\u3000]+/g, '')
    .trim();
}

function fieldFromDetailTable(html, label) {
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/giu;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/giu)].map((cell) => cell[1]);
    if (cells.length < 2) continue;
    if (cleanInlineText(cells[0]) === label) return cleanText(cells[1]).replace(/&nbsp;/g, '').trim();
  }
  return '';
}

function parseCouncilListRows(html) {
  const headings = [...html.matchAll(/<h3 class="text-normal">([\s\S]*?)<\/h3>/giu)]
    .map((match) => ({ index: match.index, districtLabel: cleanInlineText(match[1]) }))
    .filter((heading) => /^第.+選區$/u.test(heading.districtLabel));
  const rows = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const sectionHtml = html.slice(heading.index, nextHeading?.index ?? html.length);
    const itemPattern = /href="councillor-data\.php\?index_no=(\d+)"[\s\S]*?<p class="text-header"><a[^>]*>([\s\S]*?)<\/a><\/p>/giu;

    for (const itemMatch of sectionHtml.matchAll(itemPattern)) {
      const officialId = itemMatch[1];
      const originalLabel = cleanInlineText(itemMatch[2]);
      const name = normalizeCouncilorName(originalLabel);
      if (!name) continue;
      rows.push({ officialId, name, originalLabel, districtLabel: heading.districtLabel, detailUrl: councilDetailUrl(officialId) });
    }
  }

  if (rows.length === 0) throw new Error('Unable to parse council members from ' + councilListUrl);
  return [...new Map(rows.map((row) => [row.officialId, row])).values()];
}

function councilRowFromDetail(listRow, detailHtml) {
  const party = fieldFromDetailTable(detailHtml, '黨籍').replace(/^無$/u, '無黨籍');
  const education = fieldFromDetailTable(detailHtml, '學歷');
  const experience = fieldFromDetailTable(detailHtml, '經歷');

  return {
    sourceId: councilSourceId,
    sourceName: councilSourceName,
    sourceUrl: listRow.detailUrl,
    externalId: 'current-councilor-' + hashId([listRow.officialId, listRow.name].join('|')),
    name: listRow.name,
    gender: 'unknown',
    party,
    position: '花蓮縣議員',
    district: '花蓮縣' + listRow.districtLabel,
    education,
    experience,
    sourcePayload: {
      listUrl: councilListUrl,
      profileUrl: listRow.detailUrl,
      officialId: listRow.officialId,
      originalLabel: listRow.originalLabel,
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
        position: '花蓮縣議員',
        district: '花蓮縣',
        sourceUrl: councilListUrl,
        reason: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

function parseMagistrateProfile(html, row) {
  const content = cleanText(html);
  const education = fieldBetween(content, '學歷', ['經歷', '施政願景', '施政目標', '更新日期']);
  const experience = fieldBetween(content, '經歷', ['施政願景', '施政目標', '更新日期']);
  if (!content.includes(row.name)) throw new Error('Unable to verify official name from ' + row.url);
  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: row.url,
    externalId: 'leader-' + hashId([row.url, row.title, row.name].join('|')),
    name: row.name,
    gender: 'female',
    party: '',
    position: '花蓮縣政府' + row.title,
    district: '花蓮縣',
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

function leaderProfile(row) {
  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: row.url,
    externalId: 'leader-' + hashId([row.url, row.title, row.name].join('|')),
    name: row.name,
    gender: 'unknown',
    party: '',
    position: '花蓮縣政府' + row.title,
    district: '花蓮縣',
    education: '',
    experience: '',
    sourcePayload: {
      profileUrl: row.url,
      title: row.title,
      roleOrigin: row.roleOrigin,
      elected: row.elected,
      identityStatus: 'needs_identity_check',
    },
  };
}

function parseTeamRows(html, sourceRows) {
  const content = cleanText(html);
  const teamRows = [];

  for (const row of sourceRows) {
    if (content.includes(row.title) && content.includes(row.name)) teamRows.push(leaderProfile(row));
  }

  const agencyStart = content.indexOf('局處主管');
  const agencyEnd = content.indexOf('回上一頁', agencyStart);
  const agencyText = agencyStart >= 0 ? content.slice(agencyStart, agencyEnd >= 0 ? agencyEnd : undefined).replace(/^局處主管\s*/, '') : '';
  const rowPattern = /([\p{Script=Han}]{2,16}(?:局|處))\s*((?:代理)?(?:局長|處長))\s*([\p{Script=Han}]{2,4})/gu;
  const seen = new Set(teamRows.map((profile) => profile.position + ':' + profile.name));

  for (const match of agencyText.matchAll(rowPattern)) {
    const agency = match[1];
    const title = match[2];
    const name = match[3];
    const position = '花蓮縣政府' + agency + title;
    const key = position + ':' + name;
    if (seen.has(key)) continue;
    seen.add(key);
    teamRows.push({
      sourceId: govSourceId,
      sourceName: govSourceName,
      sourceUrl: govTeamUrl,
      externalId: 'agency-head-' + hashId([govTeamUrl, agency, title, name].join('|')),
      name,
      gender: 'unknown',
      party: '',
      position,
      district: '花蓮縣',
      education: '',
      experience: '',
      sourcePayload: {
        profileUrl: govTeamUrl,
        agency,
        title,
        roleOrigin: 'appointed',
        elected: false,
        identityStatus: 'needs_identity_check',
      },
    });
  }

  return teamRows;
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
      position: `花蓮縣政府${govLeaderRows[0].title}`,
      district: '花蓮縣',
      sourceUrl: govLeaderRows[0].url,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const html = await fetchText(govTeamUrl);
    profiles.push(...parseTeamRows(html, govLeaderRows.filter((row) => row.kind === 'teamRow')));
  } catch (error) {
    skippedRows.push({
      sourceId: govSourceId,
      name: govLeaderRows.filter((row) => row.kind === 'teamRow').map((row) => row.name).join('、'),
      position: '花蓮縣政府副縣長/秘書長',
      district: '花蓮縣',
      sourceUrl: govTeamUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  for (const row of govLeaderRows) {
    if (!profiles.some((profile) => profile.name === row.name && profile.position === `花蓮縣政府${row.title}`)) {
      skippedRows.push({
        sourceId: govSourceId,
        name: row.name,
        position: `花蓮縣政府${row.title}`,
        district: '花蓮縣',
        sourceUrl: row.url,
        reason: 'Official leader row was not parsed from source page',
      });
    }
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
  if (!anonKey) throw new Error('Set SUPABASE_ANON_KEY for Hualien County official person profile enrichment.');

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
    adoptedPeople: adoptedPeople.length,
    sourcePeople: sourcePeople.length,
    matchedRows,
    unmatchedRows: unmatchedRows.length,
    skippedRows: skippedRows.length,
    claims: personClaims.length,
  };
  const output = {
    schemaVersion: 1,
    name: 'hualien-county-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Hualien County-specific official parser. Council rows cover current councilors from the official Hualien County Council member list and profile pages. County government rows cover the official magistrate profile and county government team page.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: councilListUrl },
      { id: govSourceId, name: `${govSourceName}：縣長專欄`, url: magistrateUrl },
      { id: govSourceId, name: `${govSourceName}：縣府團隊`, url: govTeamUrl },
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
  console.error(`Hualien County official person profile enrichment failed: ${message}`);
  process.exit(1);
});
