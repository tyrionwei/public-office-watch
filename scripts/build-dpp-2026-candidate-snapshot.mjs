import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateSnapshot } from './import-party-candidate-snapshot.mjs';

const mayorSourceUrl = 'https://teamtaiwan.dpp.org.tw/asset/types/election/js/script_mayor.js?v=1.06';
const councilorSourceUrl = 'https://teamtaiwan.dpp.org.tw/councilor';
const assetBaseUrl = 'https://teamtaiwan.dpp.org.tw/asset/types/election/';
const municipalityNames = new Set(['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市']);
const regionCodes = new Map([
  ['台北市', '63000'],
  ['新北市', '65000'],
  ['桃園市', '68000'],
  ['台中市', '66000'],
  ['台南市', '67000'],
  ['高雄市', '64000'],
  ['宜蘭縣', '10002'],
  ['新竹縣', '10004'],
  ['苗栗縣', '10005'],
  ['彰化縣', '10007'],
  ['南投縣', '10008'],
  ['雲林縣', '10009'],
  ['嘉義縣', '10010'],
  ['屏東縣', '10013'],
  ['台東縣', '10014'],
  ['花蓮縣', '10015'],
  ['澎湖縣', '10016'],
  ['基隆市', '10017'],
  ['新竹市', '10018'],
  ['嘉義市', '10020'],
  ['金門縣', '09020'],
  ['連江縣', '09007'],
]);
const councilorCities = Array.from(
  municipalityNames,
  (name) => ({ name, code: regionCodes.get(name) }),
);

function parseArgs(argv) {
  const options = { scope: null, outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scope') {
      options.scope = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!['mayors', 'councilors'].includes(options.scope)) {
    throw new Error('--scope must be mayors or councilors');
  }
  if (!options.outputPath) throw new Error('--output is required');
  return options;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  const entities = new Map([
    ['amp', '&'],
    ['apos', "'"],
    ['gt', '>'],
    ['lt', '<'],
    ['nbsp', ' '],
    ['quot', '"'],
  ]);
  return cleanText(String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return entities.get(entity.toLowerCase()) ?? match;
  }));
}

function regionCode(regionName) {
  const code = regionCodes.get(regionName);
  if (!code) throw new Error(`Unsupported DPP region: ${regionName}`);
  return code;
}

function nameHash(name) {
  return crypto.createHash('sha256').update(name, 'utf8').digest('hex').slice(0, 12);
}

function mayorPhotoUrl(imagePath) {
  if (!imagePath) return null;
  const url = new URL(imagePath, assetBaseUrl);
  if (url.hostname !== 'teamtaiwan.dpp.org.tw' || !url.pathname.startsWith('/asset/types/election/img/')) {
    throw new Error(`Unexpected DPP mayor image URL: ${url.href}`);
  }
  return url.href;
}

function parseMayorScript(source) {
  const match = String(source).match(/var\s+mayor_data\s*=\s*(\[[\s\S]*?\r?\n\s*\]);/);
  if (!match) throw new Error('DPP mayor_data array was not found');

  let rows;
  try {
    rows = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`DPP mayor_data is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 22) {
    throw new Error(`Unexpected DPP mayor candidate count: ${Array.isArray(rows) ? rows.length : 'not-an-array'}`);
  }

  const seenRegions = new Set();
  return rows.map((row, index) => {
    const regionName = cleanText(row?.city);
    const personName = cleanText(row?.name);
    if (!regionName || !personName) throw new Error(`DPP mayor row ${index} is missing city or name`);
    if (seenRegions.has(regionName)) throw new Error(`DPP mayor region is duplicated: ${regionName}`);
    seenRegions.add(regionName);
    const code = regionCode(regionName);
    const imagePath = cleanText(row?.img);

    return {
      sourceCandidateKey: `dpp-2026-mayor-${code}`,
      personName,
      candidacyStatus: 'party_nominee',
      raceType: municipalityNames.has(regionName) ? 'municipality_mayor' : 'county_mayor',
      regionName,
      districtName: null,
      nominationAnnouncedAt: null,
      profileUrl: 'https://teamtaiwan.dpp.org.tw/#mayor',
      photoUrl: mayorPhotoUrl(imagePath),
    };
  });
}

function parseCouncilorPage(source, expectedCity) {
  const records = [];
  const pattern = /class="councilor_name">\s*([^<]+?)\s*<\/div>[\s\S]*?class="councilor_area">\s*<div class="councilor_city_label">\s*([^<]+?)\s*<\/div>([\s\S]*?)<\/div>/g;
  for (const match of String(source).matchAll(pattern)) {
    const personName = decodeHtml(match[1]);
    const regionName = decodeHtml(match[2]);
    const areaSource = match[3];
    const districtMatch = areaSource.match(/第\s*0*(\d+)\s*選區/);
    if (!districtMatch) throw new Error(`DPP councilor district is missing for ${personName}`);
    if (regionName !== expectedCity) {
      throw new Error(`DPP councilor page for ${expectedCity} returned ${regionName}`);
    }

    const districtNumber = Number(districtMatch[1]);
    const subtype = areaSource.includes('山地原住民')
      ? '山地原住民'
      : areaSource.includes('平地原住民')
        ? '平地原住民'
        : null;
    const code = regionCode(regionName);
    const sourceDistrict = `第${String(districtNumber).padStart(2, '0')}選區`;
    const profileUrl = new URL(councilorSourceUrl);
    profileUrl.searchParams.set('city', code);
    profileUrl.searchParams.set('district', sourceDistrict);

    records.push({
      sourceCandidateKey: `dpp-2026-councilor-${code}-${districtNumber}-${nameHash(personName)}`,
      personName,
      candidacyStatus: 'party_nominee',
      raceType: 'city_councilor',
      regionName,
      districtName: `第${districtNumber}選區${subtype ? `｜${subtype}` : ''}`,
      nominationAnnouncedAt: null,
      profileUrl: profileUrl.href,
      photoUrl: null,
    });
  }

  if (records.length === 0) throw new Error(`No DPP councilor candidates found for ${expectedCity}`);
  return records;
}

async function fetchText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'PublicOfficeWatch/1.0 official-source-adapter' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  const body = await response.text();
  if (body.length < 100) throw new Error(`Unexpectedly short response from ${url}`);
  return body;
}

async function buildSnapshot(scope, options = {}) {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  let source;
  let records;

  if (scope === 'mayors') {
    source = {
      name: '民主進步黨 2026 選舉官網－縣市長候選人',
      url: mayorSourceUrl,
      publishedAt: null,
      retrievedAt,
    };
    records = parseMayorScript(await fetchText(mayorSourceUrl, options.fetchImpl));
  } else if (scope === 'councilors') {
    source = {
      name: '民主進步黨 2026 選舉官網－直轄市議員候選人',
      url: councilorSourceUrl,
      publishedAt: null,
      retrievedAt,
    };
    records = [];
    for (const city of councilorCities) {
      const url = new URL(councilorSourceUrl);
      url.searchParams.set('city', city.code);
      records.push(...parseCouncilorPage(await fetchText(url, options.fetchImpl), city.name));
    }
  } else {
    throw new Error(`Unsupported DPP snapshot scope: ${scope}`);
  }

  return validateSnapshot({
    schemaVersion: 1,
    electionYear: 2026,
    sourceType: 'official_party_nomination',
    party: '民主進步黨',
    source,
    records,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await buildSnapshot(options.scope);
  const outputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status: 'ok',
    scope: options.scope,
    outputPath,
    recordCount: snapshot.records.length,
    sourceUrl: snapshot.source.url,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  buildSnapshot,
  decodeHtml,
  parseCouncilorPage,
  parseMayorScript,
};
