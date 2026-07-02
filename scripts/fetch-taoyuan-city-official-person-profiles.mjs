import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'taoyuan-city-official-person-profiles.seed.json');
const rawArchiveDir = path.join(repoRoot, 'local-data', 'raw', 'local', 'taoyuan-city', 'official-person-profiles', 'current');
const fetchedAt = new Date().toISOString();

const councilSourceId = 'taoyuan-city-council-current-councilors';
const councilSourceName = '桃園市議會：現任議員';
const councilBaseUrl = 'https://www.tycc.gov.tw/TC/';

const govSourceId = 'taoyuan-city-government-leaders';
const govSourceName = '桃園市政府：市長與市府本部首長';
const govBaseUrl = 'https://www.tycg.gov.tw/';

const govLeaderRows = [];

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
    district: row.district ?? '桃園市',
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
    district: row.district ?? '桃園市',
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
    method: row.sourceId === govSourceId ? 'taoyuan_city_government_profile_match' : 'taoyuan_city_council_profile_match',
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

function partyFromCouncilClass(html) {
  const className = html.match(/class="group current-member-content ([^"]+)"/i)?.[1] ?? '';
  if (className.includes('dpp')) return '民主進步黨';
  if (className.includes('kmt')) return '中國國民黨';
  if (className.includes('tpp')) return '台灣民眾黨';
  if (className.includes('npp')) return '時代力量';
  if (className.includes('none') || className.includes('non')) return '無黨籍';
  return '';
}

function parseCouncilorDetail(html, row) {
  const text = cleanText(html);
  const name = row.name;
  const party = normalizePartyName(fieldBetweenAny(text, ['黨籍：', '黨籍'], ['參加黨團', '電話'])) || partyFromCouncilClass(html) || row.party;
  const education = fieldBetween(text, '學歷', ['經歷']);
  const experience = fieldBetween(text, '經歷', ['當屆議事資料', '議員個人總質詢', '市政總質詢', '相關新聞']);
  const platform = '';

  if (!name) {
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
    position: row.position ?? '桃園市議員',
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
  const listRows = [];
  const skippedRows = [];
  const areas = Array.from({ length: 14 }, (_, index) => index + 1);

  for (const area of areas) {
    const listUrl = new URL(`councilor-all.aspx?mid=39&area=${area}`, councilBaseUrl).toString();
    const html = await fetchText(listUrl);
    const heading = cleanInlineText(html.match(/<h4><span>([\s\S]*?)介紹<\/span><\/h4>/i)?.[1] ?? `第${String(area).padStart(2, '0')}選區`);
    const districtTitle = heading.replace(/\s+/g, ' ').trim();
    const position = area === 13 ? '桃園市平地原住民議員' : area === 14 ? '桃園市山地原住民議員' : '桃園市議員';
    const linkPattern = /<a\b[^>]*href="([^"]*councilor-detail\.aspx[^"]*num=(\d+)[^"]*)"[\s\S]*?<img\b[^>]*title="([^"]*)"[\s\S]*?\/>\s*([\s\S]*?)(?=<\/a>)/gi;
    let match;

    while ((match = linkPattern.exec(html))) {
      const href = decodeHtml(match[1]);
      const councilorId = match[2];
      const title = cleanInlineText(match[3]);
      const rawName = cleanInlineText(match[4]) || title;
      const name = rawName
        .replace(/[（(](?:辭職|轉任立委|歿)[）)]/g, '')
        .replace(/(?:議長|副議長|議員)$/u, '')
        .trim();

      if (!href || !name) {
        continue;
      }

      if (/[（(](?:辭職|轉任立委|歿)[）)]/.test(rawName) || /辭職|轉任立委|歿/.test(title)) {
        skippedRows.push({
          sourceId: councilSourceId,
          name,
          position,
          district: `桃園市${districtTitle}`,
          sourceUrl: new URL(href, councilBaseUrl).toString(),
          reason: /轉任立委/.test(rawName) || /轉任立委/.test(title)
            ? 'official council page marks this councilor as transferred to legislator'
            : /辭職/.test(rawName) || /辭職/.test(title)
              ? 'official council page marks this councilor as resigned'
              : 'official council page marks this councilor as deceased',
        });
        continue;
      }

      listRows.push({
        councilorId,
        name,
        party: '',
        position,
        rawDistrict: districtTitle,
        district: `桃園市${districtTitle}`,
        listUrl,
        sourceUrl: new URL(href, councilBaseUrl).toString(),
      });
    }
  }

  if (listRows.length === 0) {
    throw new Error('Unable to parse Taoyuan councilor list.');
  }

  const parsedRows = listRows.map((row) => ({ profile: parseCouncilorDetail('', row), skippedRow: null }));

  return {
    profiles: parsedRows.map((row) => row.profile).filter(Boolean),
    skippedRows: [...skippedRows, ...parsedRows.map((row) => row.skippedRow).filter(Boolean)],
  };
}

function contentAfterLast(text, marker) {
  const index = text.lastIndexOf(marker);
  return index >= 0 ? text.slice(index) : text;
}

function namesFromGovLeaderPage(html, row) {
  const names = [];
  const imagePattern = /<img\b[^>]*alt="([^"]+)"[^>]*>/gi;
  let match;

  while ((match = imagePattern.exec(html))) {
    const alt = cleanInlineText(match[1]);
    if (!alt.includes(row.title)) continue;

    const name =
      alt.match(new RegExp(`${row.title}[-－]?([\\p{Script=Han}]{2,4})`, 'u'))?.[1] ??
      alt.match(/[-－]([\p{Script=Han}]{2,4})$/u)?.[1] ??
      alt.match(/([\p{Script=Han}]{2,4})$/u)?.[1] ??
      '';

    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  if (row.name && !names.includes(row.name)) {
    names.unshift(row.name);
  }

  return names;
}

function parseGovLeaderProfiles(html, row) {
  const text = cleanText(html);
  const names = namesFromGovLeaderPage(html, row);

  if (names.length === 0) {
    throw new Error(`Unable to parse official name from ${row.url}`);
  }

  return names.map((name) => {
    const content = contentAfterLast(text, name);
    const education = fieldBetweenAny(content, ['學歷', '學 歷：', '學歷：'], ['主要經歷', '經歷', '市府分類', '最後異動日期']);
    const experience = fieldBetweenAny(content, ['主要經歷', '經歷', '經 歷：', '經歷：'], ['市府分類', '最後異動日期', '發布日期']);

    return {
      sourceId: govSourceId,
      sourceName: govSourceName,
      sourceUrl: row.url,
      externalId: `leader-${hashId(`${row.url}:${row.title}:${name}`)}`,
      name,
      gender: 'unknown',
      party: '',
      position: `桃園市${row.title}`,
      district: '桃園市',
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
  });
}

async function fetchGovProfiles() {
  const leaderRows = await mapLimit(govLeaderRows, 4, async (row) => {
    try {
      return { profiles: parseGovLeaderProfiles(await fetchText(row.url), row), skippedRow: null };
    } catch (error) {
      return {
        profiles: [],
        skippedRow: {
          sourceId: govSourceId,
          name: row.name ?? '',
          position: `桃園市${row.title}`,
          district: '桃園市',
          sourceUrl: row.url,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  return {
    profiles: leaderRows.flatMap((row) => row.profiles),
    skippedRows: leaderRows.map((row) => row.skippedRow).filter(Boolean),
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
    throw new Error('Set SUPABASE_ANON_KEY for Taoyuan City official person profile enrichment.');
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
    name: 'taoyuan-city-official-person-profiles',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: 'Taoyuan City-specific official parser. Council profiles are parsed from the official council district pages. City government profile pages currently return HiNet Anti-DDoS 428 to non-browser fetches, so city government leaders are intentionally not written in this seed.',
    sources: [
      { id: councilSourceId, name: councilSourceName, url: 'https://www.tycc.gov.tw/TC/councilor-info.aspx?mid=39' },
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
  console.error(`Taoyuan City official person profile enrichment failed: ${message}`);
  process.exit(1);
});
