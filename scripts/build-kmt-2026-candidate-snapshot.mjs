import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateSnapshot } from './import-party-candidate-snapshot.mjs';

const defaultAnnouncementUrls = [
  'https://www.kmt.org.tw/2025/12/blog-post_69.html',
  'https://www.kmt.org.tw/2026/03/blog-post_4.html',
  'https://www.kmt.org.tw/2026/03/blog-post_78.html',
  'https://www.kmt.org.tw/2026/04/blog-post_1.html',
  'https://www.kmt.org.tw/2026/04/blog-post_42.html',
  'https://www.kmt.org.tw/2026/05/blog-post_299.html',
  'https://www.kmt.org.tw/2026/07/725_01955410286.html',
];
const municipalityNames = new Set(['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市']);
const regionCodes = new Map([
  ['台北市', '63000'], ['新北市', '65000'], ['桃園市', '68000'], ['台中市', '66000'],
  ['台南市', '67000'], ['高雄市', '64000'], ['宜蘭縣', '10002'], ['新竹縣', '10004'],
  ['苗栗縣', '10005'], ['彰化縣', '10007'], ['南投縣', '10008'], ['雲林縣', '10009'],
  ['嘉義縣', '10010'], ['屏東縣', '10013'], ['台東縣', '10014'], ['花蓮縣', '10015'],
  ['澎湖縣', '10016'], ['基隆市', '10017'], ['新竹市', '10018'], ['嘉義市', '10020'],
  ['金門縣', '09020'], ['連江縣', '09007'],
]);
const regionPattern = Array.from(regionCodes.keys())
  .sort((left, right) => right.length - left.length)
  .map((name) => name.replace('台', '[台臺]'))
  .join('|');

function parseArgs(argv) {
  const options = { outputPath: null, urls: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') {
      options.outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--url') {
      options.urls.push(argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!options.outputPath) throw new Error('--output is required');
  if (options.urls.length === 0) options.urls = [...defaultAnnouncementUrls];
  for (const value of options.urls) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['kmt.org.tw', 'www.kmt.org.tw'].includes(url.hostname)) {
      throw new Error(`KMT announcement must use the official kmt.org.tw domain: ${value}`);
    }
  }
  return options;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  const entities = new Map([
    ['amp', '&'], ['apos', "'"], ['gt', '>'], ['lt', '<'], ['nbsp', ' '], ['quot', '"'],
  ]);
  return cleanText(String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return entities.get(entity.toLowerCase()) ?? match;
  }));
}

function htmlToText(html) {
  return decodeHtml(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '。')
    .replace(/<\/p\s*>/gi, '。')
    .replace(/<[^>]+>/g, ' '));
}

function normalizeRegion(value) {
  return cleanText(value).replaceAll('臺', '台');
}

function cleanCandidateName(value) {
  return cleanText(value)
    .replace(/^(?:前)?(?:立委|議長|縣長|市長|副市長|醫師)/, '')
    .replace(/同志$/, '');
}

function publicationDate(html) {
  const isoMatch = String(html).match(/(?:datePublished|published_time)[^>]{0,160}?(20\d{2}-\d{2}-\d{2})/i)
    ?? String(html).match(/(20\d{2}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/);
  return isoMatch?.[1] ?? null;
}

function titleFromHtml(html) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]).replace(/\s*[-–|].*中國國民黨.*$/u, '') : null;
}

function nameHash(name) {
  return crypto.createHash('sha256').update(name, 'utf8').digest('hex').slice(0, 12);
}

function parseAnnouncementPage(html, sourceUrl) {
  const text = htmlToText(html);
  const sentences = text.split(/[。]/).filter((sentence) => (
    (sentence.includes('通過') && /徵召|提名|核定/.test(sentence) && sentence.includes('參選'))
    || sentence.includes('正式徵召尋求連任')
  ));
  const records = [];
  const supersededRecords = [];
  const seen = new Set();
  const regionFirst = new RegExp(`(${regionPattern})(?:選舉)?(?:徵召|提名|核定)([^，、。：]{2,14}?)(?:同志)?參選`, 'g');
  const candidateFirst = new RegExp(`(?:徵召|提名|核定|[，、](?:徵召|提名|核定)?)([^，、。：]{2,14}?)參選(${regionPattern})長`, 'g');
  const incumbentBatch = new RegExp(`(${regionPattern})長([\\p{Script=Han}·]{2,6})(?=[、及，。]|$)`, 'gu');
  const announcedAt = publicationDate(html);

  function add(rawRegion, rawName, incumbencyEvidence = null) {
    const regionName = normalizeRegion(rawRegion);
    const personName = cleanCandidateName(rawName);
    if (!regionCodes.has(regionName) || !/^[\p{Script=Han}·]{2,6}$/u.test(personName)) return;
    const key = `${regionName}:${personName}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      sourceCandidateKey: `kmt-2026-mayor-${regionCodes.get(regionName)}-${nameHash(personName)}`,
      personName,
      candidacyStatus: 'party_nominee',
      raceType: municipalityNames.has(regionName) ? 'municipality_mayor' : 'county_mayor',
      regionName,
      districtName: null,
      nominationAnnouncedAt: announcedAt,
      profileUrl: sourceUrl,
      photoUrl: null,
      ...(incumbencyEvidence ? {
        isIncumbent: true,
        incumbencyEvidence,
        incumbencySourceUrl: sourceUrl,
      } : {}),
    });
  }

  for (const sentence of sentences) {
    for (const match of sentence.matchAll(regionFirst)) add(match[1], match[2]);
    for (const match of sentence.matchAll(candidateFirst)) add(match[2], match[1]);
    if (sentence.includes('正式徵召尋求連任')) {
      for (const match of sentence.matchAll(incumbentBatch)) {
        add(match[1], match[2], '國民黨公告載明為現任縣市長並正式徵召尋求連任');
      }
    }
  }

  if (text.includes('聯合治理暨地方選舉合作協議') && text.includes('民調結果') && text.includes('勝出')) {
    const supersededPattern = new RegExp(`中國國民黨(${regionPattern})長參選人([\\p{Script=Han}·]{2,6})(?=恭喜|表示|說|、|，|。|\\s|$)`, 'gu');
    for (const match of text.matchAll(supersededPattern)) {
      const regionName = normalizeRegion(match[1]);
      const personName = cleanCandidateName(match[2]);
      if (!regionCodes.has(regionName) || !/^[\p{Script=Han}·]{2,6}$/u.test(personName)) continue;
      supersededRecords.push({ regionName, personName, supersededAt: announcedAt, sourceUrl });
    }
  }

  if (records.length === 0 && supersededRecords.length === 0) {
    throw new Error(`No explicit KMT nomination decision or supersession found in ${sourceUrl}`);
  }
  return { title: titleFromHtml(html), announcedAt, records, supersededRecords };
}

async function fetchText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'PublicOfficeWatch/1.0 official-source-adapter' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  const body = await response.text();
  if (body.length < 500) throw new Error(`Unexpectedly short response from ${url}`);
  return body;
}

async function buildSnapshot(urls = defaultAnnouncementUrls, options = {}) {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const byRegion = new Map();
  for (const url of urls) {
    const parsed = parseAnnouncementPage(await fetchText(url, options.fetchImpl), url);
    for (const superseded of parsed.supersededRecords) {
      const existing = byRegion.get(superseded.regionName);
      if (existing?.personName === superseded.personName) {
        byRegion.delete(superseded.regionName);
      }
    }
    for (const record of parsed.records) {
      const existing = byRegion.get(record.regionName);
      if (existing && existing.personName !== record.personName) {
        throw new Error(`Conflicting KMT nominees for ${record.regionName}: ${existing.personName}, ${record.personName}`);
      }
      byRegion.set(record.regionName, record);
    }
  }
  return validateSnapshot({
    schemaVersion: 1,
    electionYear: 2026,
    sourceType: 'official_party_nomination',
    party: '中國國民黨',
    source: {
      name: '中國國民黨 2026 縣市長正式提名公告',
      url: 'https://www.kmt.org.tw/',
      publishedAt: null,
      retrievedAt,
    },
    records: Array.from(byRegion.values()),
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await buildSnapshot(options.urls);
  const outputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status: 'ok',
    outputPath,
    announcementCount: options.urls.length,
    recordCount: snapshot.records.length,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { buildSnapshot, defaultAnnouncementUrls, parseAnnouncementPage };
