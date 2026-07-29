import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateSnapshot } from './import-party-candidate-snapshot.mjs';

const overviewUrl = 'https://taiwangogo.tw/candidates/';
const officialHostnames = new Set(['taiwangogo.tw', 'www.taiwangogo.tw']);
const municipalityNames = new Set(['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市']);
const partyAliases = new Map([
  ['時代力量', '時代力量'],
  ['台灣基進', '台灣基進'],
  ['小歐盟', '小民參政歐巴桑聯盟'],
  ['小民參政歐巴桑聯盟', '小民參政歐巴桑聯盟'],
  ['台灣綠黨', '台灣綠黨'],
]);
const partyOutputSlugs = new Map([
  ['時代力量', 'new-power-party'],
  ['台灣基進', 'taiwan-statebuilding-party'],
  ['小民參政歐巴桑聯盟', 'obasan-alliance'],
  ['台灣綠黨', 'green-party-taiwan'],
]);

function parseArgs(argv) {
  const options = { outputDir: null, captureOutput: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-dir') {
      options.outputDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--capture-output') {
      options.captureOutput = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!options.outputDir) throw new Error('--output-dir is required');
  return options;
}

function decodeHtml(value) {
  return String(value ?? '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function cleanText(value) {
  return decodeHtml(String(value ?? '').replace(/<br\s*\/?>/gi, ' '))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRegion(value) {
  return cleanText(value).replaceAll('台', '臺');
}

function parseAttributes(value) {
  const attributes = {};
  for (const match of value.matchAll(/([:\w-]+)=(['"])(.*?)\2/gs)) {
    attributes[match[1]] = decodeHtml(match[3]);
  }
  return attributes;
}

function requireOfficialUrl(value) {
  const url = new URL(value, overviewUrl);
  if (url.protocol !== 'https:' || !officialHostnames.has(url.hostname.toLowerCase())) {
    throw new Error(`Unexpected Taiwan Forward URL: ${url.href}`);
  }
  return url.href;
}

function parseOverview(html) {
  const records = [];
  for (const match of html.matchAll(/<a\b([^>]*\bclass=(['"])[^'"]*\bcl-cd\b[^'"]*\2[^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = parseAttributes(match[1]);
    const body = match[3];
    const nameMatch = body.match(/<span\b[^>]*\bclass=(['"])[^'"]*\bnm\b[^'"]*\1[^>]*>([\s\S]*?)<\/span>/i);
    const areaMatch = body.match(/<span\b[^>]*\bclass=(['"])[^'"]*\bar\b[^'"]*\1[^>]*>([\s\S]*?)<\/span>/i);
    const officeMatch = body.match(/<span\b[^>]*\bclass=(['"])[^'"]*\blv\b[^'"]*\1[^>]*>([\s\S]*?)<\/span>/i);
    const imageAttributes = parseAttributes(body.match(/<img\b([^>]*)>/i)?.[1] ?? '');
    const personName = cleanText(nameMatch?.[2]);
    if (!personName) throw new Error('Taiwan Forward candidate card is missing a name');
    const profileUrl = requireOfficialUrl(attributes.href);
    records.push({
      slug: new URL(profileUrl).pathname.replaceAll('/', ''),
      profileUrl,
      overviewParty: cleanText(attributes['data-party']),
      overviewRegion: normalizeRegion(attributes['data-city']),
      overviewArea: cleanText(areaMatch?.[2]),
      overviewOffice: cleanText(officeMatch?.[2]),
      personName,
      cardPhotoUrl: imageAttributes.src ? requireOfficialUrl(imageAttributes.src) : null,
    });
  }
  if (records.length === 0) throw new Error('Taiwan Forward overview contains no candidate cards');
  return records;
}

function parsePersonJsonLd(html) {
  for (const match of html.matchAll(/<script\b[^>]*type=(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[2]);
      const candidates = Array.isArray(value?.['@graph']) ? value['@graph'] : [value];
      const person = candidates.find((entry) => entry?.['@type'] === 'Person');
      if (person) return person;
    } catch {
      // Ignore unrelated malformed structured data and keep looking.
    }
  }
  throw new Error('Taiwan Forward candidate page is missing Person JSON-LD');
}

function listItems(html) {
  return Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi), (match) => cleanText(match[1]))
    .filter(Boolean);
}

function parseBackground(html) {
  const card = html.match(/<div\b[^>]*\bclass=(['"])[^'"]*\bcv-biocard\b[^'"]*\1[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i)?.[2] ?? '';
  const education = [];
  const experience = [];
  for (const section of card.matchAll(/<div\b[^>]*>\s*<h4>([\s\S]*?)<\/h4>([\s\S]*?)<\/div>/gi)) {
    const heading = cleanText(section[1]).replace(/\s/g, '');
    const values = listItems(section[2]);
    if (heading.includes('學歷')) education.push(...values);
    if (heading.includes('經歷')) experience.push(...values);
  }
  return { education, experience };
}

function parsePlatform(html) {
  return Array.from(html.matchAll(/<article\b[^>]*\bclass=(['"])[^'"]*\bcv-pcard\b[^'"]*\1[^>]*>([\s\S]*?)<\/article>/gi), (match) => {
    const body = match[2];
    const heading = cleanText(body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    const detail = cleanText(body.match(/<div\b[^>]*\bclass=(['"])[^'"]*\bcv-pbody\b[^'"]*\1[^>]*>([\s\S]*?)<\/div>/i)?.[2]);
    return [heading, detail].filter(Boolean).join('：');
  }).filter(Boolean);
}

function parseDetail(html, expectedProfileUrl) {
  const jsonLd = parsePersonJsonLd(html);
  const profileUrl = requireOfficialUrl(jsonLd.url ?? expectedProfileUrl);
  if (new URL(profileUrl).pathname !== new URL(expectedProfileUrl).pathname) {
    throw new Error(`Taiwan Forward profile URL mismatch: ${profileUrl}`);
  }
  const { education, experience } = parseBackground(html);
  return {
    profileUrl,
    personName: cleanText(jsonLd.name),
    jobTitle: cleanText(jsonLd.jobTitle),
    affiliations: (Array.isArray(jsonLd.affiliation) ? jsonLd.affiliation : [jsonLd.affiliation])
      .map((entry) => cleanText(entry?.name ?? entry))
      .filter(Boolean),
    photoUrl: jsonLd.image ? requireOfficialUrl(jsonLd.image) : null,
    education,
    experience,
    platform: parsePlatform(html),
    socialLinks: (Array.isArray(jsonLd.sameAs) ? jsonLd.sameAs : [])
      .map((url) => String(url).trim())
      .filter(Boolean),
  };
}

function parseRace(jobTitle) {
  const normalized = cleanText(jobTitle);
  const regionName = normalizeRegion(normalized.match(/^(.+?[縣市])/)?.[1]);
  const districtMatch = normalized.match(/第\s*([零一二三四五六七八九十百\d]+)\s*選(?:舉)?區/);
  const subtype = normalized.includes('山地原住民')
    ? '山地原住民'
    : normalized.includes('平地原住民')
      ? '平地原住民'
      : null;
  let raceType = null;
  if (normalized.includes('市長候選人') || normalized.includes('縣長候選人')) {
    raceType = municipalityNames.has(regionName) ? 'municipality_mayor' : 'county_mayor';
  } else if ((normalized.includes('市議員候選人') || normalized.includes('縣議員候選人')) && districtMatch) {
    raceType = regionName.endsWith('市') ? 'city_councilor' : 'county_councilor';
  }
  return {
    raceType,
    regionName,
    districtName: districtMatch
      ? `第${districtMatch[1]}選區${subtype ? `｜${subtype}` : ''}`
      : null,
  };
}

function normalizeCaptureRecord(record) {
  const overviewParty = cleanText(record.overviewParty);
  const canonicalParty = partyAliases.get(overviewParty) ?? null;
  if (!canonicalParty) {
    return { supported: false, skipped: { ...record, reason: 'party_not_supported' } };
  }
  if (!record.affiliations.includes(overviewParty) && !record.affiliations.includes(canonicalParty)) {
    throw new Error(`Party mismatch on Taiwan Forward profile: ${record.personName}`);
  }
  if (cleanText(record.personName) !== cleanText(record.detailPersonName)) {
    throw new Error(`Name mismatch on Taiwan Forward profile: ${record.personName}`);
  }
  const { raceType, regionName, districtName } = parseRace(record.jobTitle);
  if (!raceType) {
    return { supported: false, skipped: { ...record, reason: 'race_not_supported' } };
  }
  if (regionName !== normalizeRegion(record.overviewRegion)) {
    throw new Error(`Region mismatch on Taiwan Forward profile: ${record.personName}`);
  }
  return {
    supported: true,
    party: canonicalParty,
    record: {
      sourceCandidateKey: `taiwan-forward-2026-${record.slug}`,
      personName: cleanText(record.personName),
      candidacyStatus: 'party_nominee',
      raceType,
      regionName,
      districtName: raceType.endsWith('_mayor') ? null : districtName,
      nominationAnnouncedAt: null,
      profileUrl: requireOfficialUrl(record.profileUrl),
      photoUrl: record.photoUrl ? requireOfficialUrl(record.photoUrl) : null,
      education: Array.isArray(record.education) ? record.education : [],
      experience: Array.isArray(record.experience) ? record.experience : [],
      platform: Array.isArray(record.platform) ? record.platform : [],
      socialLinks: Array.isArray(record.socialLinks) ? record.socialLinks : [],
    },
  };
}

function buildSnapshots(capture) {
  if (capture?.schemaVersion !== 1) throw new Error('Taiwan Forward capture schemaVersion must be 1');
  if (!Array.isArray(capture?.records) || capture.records.length === 0) {
    throw new Error('Taiwan Forward capture must contain records');
  }
  const retrievedAt = cleanText(capture.retrievedAt);
  if (!retrievedAt || Number.isNaN(Date.parse(retrievedAt))) {
    throw new Error('Taiwan Forward capture retrievedAt must be a valid date');
  }
  const grouped = new Map(Array.from(partyAliases.values(), (party) => [party, []]));
  const skipped = [];
  const seenSlugs = new Set();
  for (const record of capture.records) {
    if (seenSlugs.has(record.slug)) throw new Error(`Duplicate Taiwan Forward candidate slug: ${record.slug}`);
    seenSlugs.add(record.slug);
    const normalized = normalizeCaptureRecord(record);
    if (normalized.supported) grouped.get(normalized.party).push(normalized.record);
    else skipped.push(normalized.skipped);
  }
  const snapshots = new Map();
  for (const [party, records] of grouped) {
    if (records.length === 0) continue;
    snapshots.set(party, validateSnapshot({
      schemaVersion: 1,
      electionYear: 2026,
      sourceType: 'official_party_nomination',
      party,
      source: {
        name: `台灣前進 2026 聯合競選網站－${party}候選人`,
        url: overviewUrl,
        publishedAt: null,
        retrievedAt,
      },
      records,
    }));
  }
  return { snapshots, skipped };
}

async function fetchText(url) {
  const response = await fetch(requireOfficialUrl(url), {
    headers: { 'user-agent': 'PublicOfficeWatch/1.0 (public election data research)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Taiwan Forward request failed (${response.status}): ${url}`);
  return response.text();
}

async function captureWebsite() {
  const cards = parseOverview(await fetchText(overviewUrl));
  const records = [];
  for (const card of cards) {
    const detail = parseDetail(await fetchText(card.profileUrl), card.profileUrl);
    records.push({
      ...card,
      detailPersonName: detail.personName,
      jobTitle: detail.jobTitle,
      affiliations: detail.affiliations,
      photoUrl: detail.photoUrl ?? card.cardPhotoUrl,
      education: detail.education,
      experience: detail.experience,
      platform: detail.platform,
      socialLinks: detail.socialLinks,
    });
  }
  return { schemaVersion: 1, sourceUrl: overviewUrl, retrievedAt: new Date().toISOString(), records };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const capture = await captureWebsite();
  const { snapshots, skipped } = buildSnapshots(capture);
  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputs = {};
  for (const [party, snapshot] of snapshots) {
    const outputPath = path.join(outputDir, `${partyOutputSlugs.get(party)}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    outputs[party] = { outputPath, recordCount: snapshot.records.length };
  }
  if (options.captureOutput) {
    const capturePath = path.resolve(options.captureOutput);
    fs.mkdirSync(path.dirname(capturePath), { recursive: true });
    fs.writeFileSync(capturePath, `${JSON.stringify(capture, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({
    status: 'ok',
    capturedCount: capture.records.length,
    supportedCount: Array.from(snapshots.values()).reduce((sum, snapshot) => sum + snapshot.records.length, 0),
    skippedCount: skipped.length,
    skippedByReason: Object.fromEntries(
      Array.from(new Set(skipped.map((row) => row.reason))).sort()
        .map((reason) => [reason, skipped.filter((row) => row.reason === reason).length]),
    ),
    captureOutput: options.captureOutput ? path.resolve(options.captureOutput) : null,
    outputs,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { buildSnapshots, normalizeCaptureRecord, parseDetail, parseOverview, parseRace };
