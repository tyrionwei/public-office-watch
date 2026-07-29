import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateSnapshot } from './import-party-candidate-snapshot.mjs';

const sourceUrl = 'https://youth.pfpnext.com/2026/';
const officialHostnames = new Set(['pfpnext.com', 'www.pfpnext.com', 'youth.pfpnext.com']);
const nominationDates = new Map([
  ['pfp2026-001', '2026-05-26'],
  ['pfp2026-002', '2026-05-26'],
  ['pfp2026-003', '2026-05-26'],
  ['pfp2026-004', '2026-05-26'],
  ['pfp2026-005', '2026-05-26'],
  ['pfp2026-006', '2026-07-09'],
]);

function parseArgs(argv) {
  let outputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') {
      outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!outputPath) throw new Error('--output is required');
  return { outputPath };
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
    .replace(/[•●]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRegion(value) {
  return cleanText(value).replaceAll('台', '臺');
}

function requireOfficialUrl(value) {
  const url = new URL(value, sourceUrl);
  if (url.protocol !== 'https:' || !officialHostnames.has(url.hostname.toLowerCase())) {
    throw new Error(`Unexpected PFP campaign URL: ${url.href}`);
  }
  return url.href;
}

function parseCandidatePayloads(html) {
  const records = [];
  for (const match of html.matchAll(/onclick='showCandidate\((\{[\s\S]*?\})\)'/g)) {
    let record;
    try {
      record = JSON.parse(match[1]);
    } catch (error) {
      throw new Error(`Invalid PFP candidate payload: ${error instanceof Error ? error.message : String(error)}`);
    }
    records.push(record);
  }
  if (records.length === 0) throw new Error('PFP campaign page contains no candidate payloads');
  return records;
}

function parseDistrict(value, position) {
  const normalized = cleanText(value);
  const regionName = normalizeRegion(normalized.match(/^(.+?[縣市])(?:\s|$)/)?.[1]);
  const districtMatch = normalized.match(/第\s*([零一二三四五六七八九十百\d]+)\s*選區/);
  const subtype = normalized.includes('山地原住民')
    ? '山地原住民'
    : normalized.includes('平地原住民')
      ? '平地原住民'
      : null;
  const office = cleanText(position);
  const raceType = office.includes('市議員')
    ? 'city_councilor'
    : office.includes('縣議員')
      ? 'county_councilor'
      : null;
  return {
    raceType,
    regionName,
    districtName: districtMatch
      ? `第${districtMatch[1]}選區${subtype ? `｜${subtype}` : ''}`
      : null,
  };
}

function experienceValues(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const label = cleanText(entry?.year);
    const title = cleanText(entry?.title);
    const content = cleanText(entry?.content);
    return [label, title, content].filter(Boolean).join('：');
  }).filter(Boolean);
}

function platformValues(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const title = cleanText(entry?.title);
    const content = cleanText(entry?.content);
    return [title, content].filter(Boolean).join('：');
  }).filter(Boolean);
}

function socialValues(raw) {
  const keys = ['fb_url', 'ig_url', 'yt_url', 'threads', 'tiktok', 'line_url'];
  return Array.from(new Set(keys.map((key) => String(raw?.[key] ?? '').trim()).filter(Boolean)));
}

function normalizeCandidate(raw) {
  const id = cleanText(raw?.id);
  if (!/^pfp2026-\d{3}$/.test(id)) throw new Error(`Invalid PFP candidate id: ${id || '(empty)'}`);
  const personName = cleanText(raw?.name);
  if (!personName) throw new Error(`PFP candidate ${id} is missing a name`);
  const { raceType, regionName, districtName } = parseDistrict(raw?.district, raw?.pos);
  if (!raceType || !regionName || !districtName) {
    throw new Error(`PFP candidate ${id} has an unsupported or incomplete race`);
  }
  return {
    sourceCandidateKey: `pfp-2026-${id}`,
    personName,
    candidacyStatus: 'party_nominee',
    raceType,
    regionName,
    districtName,
    nominationAnnouncedAt: nominationDates.get(id) ?? null,
    profileUrl: requireOfficialUrl(`candidate-detail.php?id=${id}`),
    photoUrl: raw?.photo ? requireOfficialUrl(raw.photo) : null,
    education: [],
    experience: experienceValues(raw?.exp),
    platform: platformValues(raw?.platform),
    socialLinks: socialValues(raw),
  };
}

function buildSnapshot(html, retrievedAt = new Date().toISOString()) {
  const seenIds = new Set();
  const records = parseCandidatePayloads(html).map((raw) => {
    const id = cleanText(raw?.id);
    if (seenIds.has(id)) throw new Error(`Duplicate PFP candidate id: ${id}`);
    seenIds.add(id);
    return normalizeCandidate(raw);
  });
  return validateSnapshot({
    schemaVersion: 1,
    electionYear: 2026,
    sourceType: 'official_party_nomination',
    party: '親民黨',
    source: {
      name: '親民黨青年團 2026 年選舉專區',
      url: sourceUrl,
      publishedAt: null,
      retrievedAt,
    },
    records,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': 'PublicOfficeWatch/1.0 (public election data research)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`PFP campaign request failed (${response.status})`);
  const snapshot = buildSnapshot(await response.text());
  const outputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: 'ok', outputPath, recordCount: snapshot.records.length }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { buildSnapshot, normalizeCandidate, parseCandidatePayloads, parseDistrict };
