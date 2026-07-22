import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'yunlin-county-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'yunlin-county', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const councilSourceId = 'yunlin-county-council-current-councilors';
const councilSourceName = '雲林縣議會：議員列表';
const councilListUrl = 'https://www.ylcc.gov.tw/cp.aspx?n=22126';
const councilDistrictLabels = new Set(['第一選區', '第二選區', '第三選區', '第四選區', '第五選區', '第六選區']);

const govSourceId = 'yunlin-county-government-leaders';
const govSourceName = '雲林縣政府：縣長、副縣長、秘書長與副秘書長';
const govLeaderRows = [
  { url: 'https://www.yunlin.gov.tw/cp.aspx?n=1347', name: '張麗善', title: '縣長', roleOrigin: 'elected', elected: true },
  { url: 'https://www.yunlin.gov.tw/cp.aspx?n=1348', name: '謝淑亞', title: '副縣長', roleOrigin: 'appointed', elected: false },
  { url: 'https://www.yunlin.gov.tw/cp.aspx?n=34239', name: '陳璧君', title: '副縣長', roleOrigin: 'appointed', elected: false },
  { url: 'https://www.yunlin.gov.tw/cp.aspx?n=1349', name: '曾元煌', title: '秘書長', roleOrigin: 'appointed', elected: false },
  { url: 'https://www.yunlin.gov.tw/cp.aspx?n=34240', name: '黃凱達', title: '副秘書長', roleOrigin: 'appointed', elected: false },
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
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
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
    // New archive directory.
  }
  const sources = Array.isArray(manifest.sources) ? manifest.sources.filter((item) => item.sourceUrl !== url) : [];
  sources.push({
    title: 'Yunlin County official person profile source page',
    sourceUrl: url,
    fetchedAt,
    status: response.status,
    ok: response.ok,
    format: 'raw-response-envelope-json',
    files: [{
      path: filename,
      bytes: Buffer.byteLength(serialized),
      sha256: sha256(serialized),
    }],
  });
  sources.sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));
  fs.writeFileSync(manifestPath, `${JSON.stringify({ generatedAt: fetchedAt, sources }, null, 2)}\n`);
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
  archiveRawPage(url, response, text);
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
    district: row.district ?? '雲林縣',
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
    district: row.district ?? '雲林縣',
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

  if (!best || best.score < 75 || (second && best.score - second.score < 10)) {
    return null;
  }

  return {
    person: best.person,
    method: row.sourceId === govSourceId ? 'yunlin_county_government_profile_match' : 'yunlin_county_council_profile_match',
    score: best.score,
    reasons: best.reasons,
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

function normalizePartyName(value) {
  const text = cleanInlineText(value);
  if (text === '臺灣民眾黨') return '台灣民眾黨';
  if (text === '臺灣基進') return '台灣基進';
  if (text === '無黨' || text === '無黨籍及未經政黨推薦') return '無黨籍';
  return text;
}

function parseCouncilRows(html) {
  const rows = [];
  const groupPattern = /<div class="hd">[\s\S]*?title="(第[一二三四五六]選區)"[\s\S]*?<ul[^>]*data-index="1"[^>]*data-child="\d+"[^>]*>([\s\S]*?)<\/ul>/gu;
  const itemPattern = /href="([^"]*Congress_Detail\.aspx[^"]*)"[\s\S]*?<div class="caption">([\s\S]*?)<\/div>[\s\S]*?<div class="p">[\s\S]*?<p>([\s\S]*?)<\/p>/gu;

  for (const groupMatch of html.matchAll(groupPattern)) {
    const districtLabel = cleanInlineText(groupMatch[1]);
    if (!councilDistrictLabels.has(districtLabel)) continue;

    for (const itemMatch of groupMatch[2].matchAll(itemPattern)) {
      const profileUrl = new URL(decodeHtml(itemMatch[1]), councilListUrl).toString();
      const name = cleanInlineText(itemMatch[2]).replace(/\s+/g, '');
      const party = normalizePartyName(itemMatch[3]);
      if (!/^[\p{Script=Han}]{2,4}$/u.test(name)) continue;

      rows.push({
        sourceId: councilSourceId,
        sourceName: councilSourceName,
        sourceUrl: profileUrl,
        externalId: 'current-councilor-' + hashId([councilListUrl, districtLabel, name].join('|')),
        name,
        gender: 'unknown',
        party,
        position: '雲林縣議員',
        district: '雲林縣',
        education: '',
        experience: '',
        sourcePayload: {
          profileUrl,
          districtLabel,
          roleOrigin: 'elected',
          elected: true,
          identityStatus: 'needs_identity_check',
        },
      });
    }
  }

  if (rows.length === 0) {
    throw new Error('Unable to parse council members from ' + councilListUrl);
  }

  const byExternalId = new Map(rows.map((row) => [row.externalId, row]));
  return [...byExternalId.values()];
}

function councilProfileSection(html, className, nextClassName) {
  const classPattern = new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`, 'u');
  const startMatch = classPattern.exec(html);
  if (!startMatch) return '';

  const start = startMatch.index + startMatch[0].length;
  const nextPattern = new RegExp(`class="[^"]*\\b${nextClassName}\\b[^"]*"`, 'u');
  const nextMatch = nextPattern.exec(html.slice(start));
  const nextClassIndex = nextMatch ? start + nextMatch.index : html.length;
  const nextElementIndex = nextMatch ? html.lastIndexOf('<', nextClassIndex) : -1;
  const end = nextElementIndex >= start ? nextElementIndex : nextClassIndex;
  const section = html.slice(start, end);
  const bodyStart = section.indexOf('<div class="p">');
  return cleanText(bodyStart >= 0 ? section.slice(bodyStart + 15) : section);
}

function parseCouncilProfile(html, row) {
  const content = cleanText(html);
  if (!content.includes(row.name)) {
    throw new Error('Unable to verify official name from ' + row.sourcePayload.profileUrl);
  }

  const education = councilProfileSection(html, 'content-edu', 'content-exp');
  const currentPosition = councilProfileSection(html, 'content-nowjob', 'content-social');
  const rawExperience = councilProfileSection(html, 'content-exp', 'content-nowjob');
  const experience = currentPosition && rawExperience.endsWith(currentPosition[0])
    ? rawExperience.slice(0, -1).trim()
    : rawExperience;

  return {
    ...row,
    education,
    experience,
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
        position: '雲林縣議員',
        district: '雲林縣',
        sourceUrl: councilListUrl,
        reason: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

function parseGovLeaderProfile(html, row) {
  const content = cleanText(html);
  const name = row.name;
  const education = fieldBetweenAny(content, ['學歷︰', '學歷:'], ['經歷︰', '經歷:', '行政經歷︰', '行政經歷:', '簡歷︰', '簡歷:', '獲獎', '現任', '網站功能']);
  const experience = fieldBetweenAny(content, ['經歷︰', '經歷:', '行政經歷︰', '行政經歷:', '簡歷︰', '簡歷:'], ['獲獎', '現任', '富麗善政', '網站功能']);

  if (!content.includes(name)) {
    throw new Error('Unable to verify official name from ' + row.url);
  }

  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: row.url,
    externalId: 'leader-' + hashId([row.url, row.title, name].join('|')),
    name,
    gender: 'unknown',
    party: '',
    position: '雲林縣政府' + row.title,
    district: '雲林縣',
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

function fallbackGovDeputyProfile(row, reason) {
  if (!row.name || !/副縣長/.test(row.title ?? '')) return null;

  return {
    sourceId: govSourceId,
    sourceName: govSourceName,
    sourceUrl: row.url,
    externalId: 'leader-' + hashId([row.url, row.title, row.name].join('|')),
    name: row.name,
    gender: 'unknown',
    party: '',
    position: '雲林縣政府' + row.title,
    district: '雲林縣',
    education: '',
    experience: '',
    sourcePayload: {
      profileUrl: row.url,
      title: row.title,
      roleOrigin: row.roleOrigin,
      elected: row.elected,
      identityStatus: 'official_name_only',
      fallbackReason: reason,
    },
  };
}

async function fetchGovProfiles() {
  const parsedRows = await mapLimit(govLeaderRows, 2, async (row) => {
    try {
      const html = await fetchText(row.url);
      return { profiles: [parseGovLeaderProfile(html, row)], skippedRow: null };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const fallbackProfile = fallbackGovDeputyProfile(row, reason);
      return {
        profiles: fallbackProfile ? [fallbackProfile] : [],
        skippedRow: fallbackProfile ? null : {
          sourceId: govSourceId,
          name: row.name ?? '',
          position: `雲林縣${row.title}`,
          district: '雲林縣',
          sourceUrl: row.url,
          reason,
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
  if (!anonKey) {
    throw new Error('Set SUPABASE_ANON_KEY for Yunlin County official person profile enrichment.');
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

      if (row.sourceId === govSourceId && /副縣長/.test(row.position ?? '')) {
        adoptedPeople.push(adoptedOfficial(row, 'appointed'));
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
    name: 'yunlin-county-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Yunlin County-specific official parser. Council rows cover current councilors by district label from the official Yunlin County Council member list. County government rows cover leader profile pages from official Yunlin County Government pages.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: councilListUrl },
      { id: govSourceId, name: govSourceName, url: 'https://www.yunlin.gov.tw/cp.aspx?n=1347' },
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
  console.error(`Yunlin County official person profile enrichment failed: ${message}`);
  process.exit(1);
});
