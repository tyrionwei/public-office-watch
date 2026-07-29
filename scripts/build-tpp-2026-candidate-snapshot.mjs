import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateSnapshot } from './import-party-candidate-snapshot.mjs';

const sourceUrl = 'https://www.tpp.org.tw/election2026/index.php';
const municipalityNames = new Set(['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市']);
const profileHostnames = new Set(['tpp.org.tw', 'www.tpp.org.tw']);

function parseArgs(argv) {
  const options = { inputPath: null, outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      options.inputPath = argv[index + 1] ?? null;
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
  if (!options.inputPath) throw new Error('--input is required');
  if (!options.outputPath) throw new Error('--output is required');
  return options;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeRegion(value) {
  return cleanText(value).replaceAll('台', '臺');
}

function requireOfficialProfileUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:'
    || !profileHostnames.has(url.hostname)
    || url.pathname !== '/election2026/candidatedetail.php'
    || !/^\d+$/.test(url.searchParams.get('cid') ?? '')
  ) {
    throw new Error(`Unexpected TPP candidate profile URL: ${value}`);
  }
  return url.href;
}

function parseDistrict(value) {
  const normalized = cleanText(value);
  const [rawRegion, ...rest] = normalized.split('｜');
  const regionName = normalizeRegion(rawRegion);
  const detail = rest.join('｜');
  const districtMatch = detail.match(/第[零一二三四五六七八九十百\d]+選區/);
  const subtype = detail.includes('山地原住民')
    ? '山地原住民'
    : detail.includes('平地原住民')
      ? '平地原住民'
      : null;
  return {
    regionName,
    districtName: districtMatch ? `${districtMatch[0]}${subtype ? `｜${subtype}` : ''}` : null,
  };
}

function classifyRace(officeTitle, regionName, districtName) {
  if (officeTitle === `${regionName}長`) {
    return municipalityNames.has(regionName) ? 'municipality_mayor' : 'county_mayor';
  }
  if (['市議員', '縣議員', '議員'].includes(officeTitle) && districtName) {
    return regionName.endsWith('市') ? 'city_councilor' : 'county_councilor';
  }
  return null;
}

function normalizeCaptureRecord(raw) {
  const cid = cleanText(raw?.cid);
  if (!/^\d+$/.test(cid)) throw new Error(`Invalid TPP candidate cid: ${cid || '(empty)'}`);
  const personName = cleanText(raw?.personName);
  if (!personName) throw new Error(`TPP candidate ${cid} is missing personName`);
  const officeTitle = cleanText(raw?.officeTitle);
  const { regionName, districtName } = parseDistrict(raw?.districtText);
  if (!regionName) throw new Error(`TPP candidate ${cid} is missing regionName`);
  const profileUrl = requireOfficialProfileUrl(raw?.profileUrl);
  const raceType = classifyRace(officeTitle, regionName, districtName);

  if (!raceType) {
    return {
      supported: false,
      skipped: { cid, personName, officeTitle, regionName, districtName, profileUrl },
    };
  }

  return {
    supported: true,
    record: {
      sourceCandidateKey: `tpp-2026-${raceType}-${cid}`,
      personName,
      candidacyStatus: 'party_nominee',
      raceType,
      regionName,
      districtName: raceType.endsWith('_mayor') ? null : districtName,
      nominationAnnouncedAt: null,
      profileUrl,
      photoUrl: raw?.photoUrl ? cleanText(raw.photoUrl) : null,
      education: Array.isArray(raw?.education) ? raw.education : [],
      experience: Array.isArray(raw?.experience) ? raw.experience : [],
      platform: Array.isArray(raw?.platform) ? raw.platform : [],
      socialLinks: Array.isArray(raw?.socialLinks) ? raw.socialLinks : [],
    },
  };
}

function buildSnapshot(capture) {
  if (capture?.schemaVersion !== 1) throw new Error('TPP browser capture schemaVersion must be 1');
  if (!Array.isArray(capture?.records) || capture.records.length === 0) {
    throw new Error('TPP browser capture must contain records');
  }
  const retrievedAt = cleanText(capture.retrievedAt);
  if (!retrievedAt || Number.isNaN(Date.parse(retrievedAt))) {
    throw new Error('TPP browser capture retrievedAt must be a valid date');
  }

  const records = [];
  const skipped = [];
  const seenCids = new Set();
  for (const raw of capture.records) {
    const cid = cleanText(raw?.cid);
    if (seenCids.has(cid)) throw new Error(`TPP browser capture contains duplicate cid: ${cid}`);
    seenCids.add(cid);
    const normalized = normalizeCaptureRecord(raw);
    if (normalized.supported) records.push(normalized.record);
    else skipped.push(normalized.skipped);
  }

  return {
    snapshot: validateSnapshot({
      schemaVersion: 1,
      electionYear: 2026,
      sourceType: 'official_party_nomination',
      party: '台灣民眾黨',
      source: {
        name: '台灣民眾黨 2026 選戰專區',
        url: sourceUrl,
        publishedAt: null,
        retrievedAt,
      },
      records,
    }),
    skipped,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.inputPath);
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);
  const capture = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { snapshot, skipped } = buildSnapshot(capture);
  const outputPath = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status: 'ok',
    inputPath,
    outputPath,
    capturedCount: capture.records.length,
    supportedCount: snapshot.records.length,
    skippedCount: skipped.length,
    skippedByOffice: Object.fromEntries(
      Array.from(new Set(skipped.map((row) => row.officeTitle))).sort()
        .map((officeTitle) => [officeTitle, skipped.filter((row) => row.officeTitle === officeTitle).length]),
    ),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { buildSnapshot, classifyRace, normalizeCaptureRecord, parseDistrict };
