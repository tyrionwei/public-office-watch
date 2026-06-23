import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'real-public-data.seed.json');
const defaultLegalRecordLeadsPath = path.join(repoRoot, 'data-sources', 'legal-record-leads.seed.json');
const defaultPersonEnrichmentClaimsPath = path.join(repoRoot, 'data-sources', 'person-enrichment-claims.seed.json');
const defaultPersonEnrichmentSkippedPath = path.join(repoRoot, 'data-sources', 'person-enrichment-skipped.json');

function parseArgs(argv) {
  const args = {
    seedPath: defaultSeedPath,
    write: false,
    recordRun: false,
    mode: 'weekly',
    skipLiveFetch: false,
    includeHistoricalCec: false,
    autoApproveReview: false,
    identityAutoApproveThreshold: 90,
    claimAutoApproveThreshold: 90,
    includeLegalRecordLeads: false,
    legalRecordLeadsPath: defaultLegalRecordLeadsPath,
    includePersonEnrichmentClaims: false,
    personEnrichmentClaimsPath: defaultPersonEnrichmentClaimsPath,
    personEnrichmentSkippedPath: defaultPersonEnrichmentSkippedPath,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      args.write = true;
      continue;
    }

    if (arg === '--record-run') {
      args.recordRun = true;
      continue;
    }

    if (arg === '--skip-live-fetch') {
      args.skipLiveFetch = true;
      continue;
    }

    if (arg === '--include-historical-cec') {
      args.includeHistoricalCec = true;
      continue;
    }

    if (arg === '--auto-approve-review') {
      args.autoApproveReview = true;
      continue;
    }

    if (arg === '--include-legal-record-leads') {
      args.includeLegalRecordLeads = true;
      continue;
    }

    if (arg === '--include-person-enrichment-claims') {
      args.includePersonEnrichmentClaims = true;
      continue;
    }

    if (arg === '--identity-auto-approve-threshold') {
      args.identityAutoApproveThreshold = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--claim-auto-approve-threshold') {
      args.claimAutoApproveThreshold = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--daily' || arg === '--weekly') {
      args.mode = arg.slice(2);
      continue;
    }

    if (arg === '--seed') {
      args.seedPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--legal-record-leads') {
      args.legalRecordLeadsPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--person-enrichment-claims') {
      args.personEnrichmentClaimsPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--person-enrichment-skipped') {
      args.personEnrichmentSkippedPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return args;
}

const knownPartyProfiles = {
  民主進步黨: { shortName: '民進黨', slug: 'dpp', themeKey: 'dpp', officialSiteUrl: 'https://www.dpp.org.tw/' },
  中國國民黨: { shortName: '國民黨', slug: 'kmt', themeKey: 'kmt', officialSiteUrl: 'https://www.kmt.org.tw/' },
  台灣民眾黨: { shortName: '民眾黨', slug: 'tpp', themeKey: 'tpp', officialSiteUrl: 'https://www.tpp.org.tw/' },
  臺灣民眾黨: { shortName: '民眾黨', slug: 'tpp', themeKey: 'tpp', officialSiteUrl: 'https://www.tpp.org.tw/' },
  時代力量: { shortName: '時力', slug: 'npp', themeKey: 'npp', officialSiteUrl: 'https://www.newpowerparty.tw/' },
  台灣基進: { shortName: '基進', slug: 'tsp', themeKey: 'tsp', officialSiteUrl: 'https://www.statebuilding.tw/' },
  臺灣基進: { shortName: '基進', slug: 'tsp', themeKey: 'tsp', officialSiteUrl: 'https://www.statebuilding.tw/' },
  親民黨: { shortName: '親民黨', slug: 'pfp', themeKey: 'pfp', officialSiteUrl: null },
};

const relevantPartyNames = new Set([
  '民主進步黨',
  '中國國民黨',
  '台灣民眾黨',
  '臺灣民眾黨',
  '時代力量',
  '台灣基進',
  '臺灣基進',
  '親民黨',
  '新黨',
  '台灣團結聯盟',
  '社會民主黨',
  '綠黨',
  '小民參政歐巴桑聯盟',
]);

function hashId(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function slugifyPartyName(name) {
  const known = knownPartyProfiles[name];

  if (known?.slug) {
    return known.slug;
  }

  return `moi-party-${hashId(name)}`;
}

function detectDelimiter(headerLine) {
  const candidates = [',', ';', '\t'];
  return candidates
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function parseDelimited(content) {
  const rows = parseDelimitedRows(content);

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function parseDelimitedRows(content, delimiterOverride = null) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  const headerLine = content.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = delimiterOverride ?? detectDelimiter(headerLine);

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function pickField(row, candidates) {
  for (const candidate of candidates) {
    const value = row[candidate]?.trim();
    if (value) {
      return value;
    }
  }

  return '';
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;

  if (replacementCount > 5) {
    try {
      return new TextDecoder('big5', { fatal: false }).decode(bytes);
    } catch {
      return utf8;
    }
  }

  return utf8;
}

async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

const zipPathDecoder = new TextDecoder('big5', { fatal: false });

function findZipEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 65557);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }

  throw new Error('ZIP end of central directory was not found.');
}

function listZipEntries(buffer) {
  const endOffset = findZipEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory entry.');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameBytes = buffer.subarray(offset + 46, offset + 46 + fileNameLength);

    entries.push({
      name: zipPathDecoder.decode(fileNameBytes),
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function extractZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;

  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header for ${entry.name}.`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraFieldLength = buffer.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    return zlib.inflateRawSync(compressed, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
  }

  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}.`);
}

function readZipTextBySuffix(buffer, suffix) {
  const entry = listZipEntries(buffer).find((item) => item.name.endsWith(suffix));

  if (!entry) {
    throw new Error(`ZIP entry not found: ${suffix}`);
  }

  const bytes = extractZipEntry(buffer, entry);

  if (entry.uncompressedSize && bytes.length !== entry.uncompressedSize) {
    throw new Error(`ZIP entry size mismatch: ${suffix}`);
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function readZipTextByEntry(buffer, entryName) {
  const entry = listZipEntries(buffer).find((item) => item.name === entryName);

  if (!entry) {
    throw new Error(`ZIP entry not found: ${entryName}`);
  }

  const bytes = extractZipEntry(buffer, entry);

  if (entry.uncompressedSize && bytes.length !== entry.uncompressedSize) {
    throw new Error(`ZIP entry size mismatch: ${entryName}`);
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function zipDirname(entryName) {
  const index = entryName.lastIndexOf('/');
  return index === -1 ? '' : entryName.slice(0, index);
}

function normalizePartyName(name) {
  if (name === '臺灣民眾黨') return '台灣民眾黨';
  if (name === '臺灣基進') return '台灣基進';
  if (name === '台灣綠黨') return '綠黨';
  if (name === '臺灣社會民主黨') return '社會民主黨';
  if (name === '無黨籍及未經政黨推薦') return '無黨籍';
  return name;
}

function toGregorianYear(value) {
  const year = Number.parseInt(String(value ?? '').trim(), 10);

  if (!Number.isFinite(year)) {
    return null;
  }

  return year < 1911 ? year + 1911 : year;
}

function inferCecYearFromPath(entryName) {
  const gregorian = entryName.match(/(?:^|\/)((?:19|20)\d{2})/);

  if (gregorian) {
    return Number.parseInt(gregorian[1], 10);
  }

  const rocYear = entryName.match(/(?:^|\/)(\d{2,3})年/);

  if (rocYear) {
    return toGregorianYear(rocYear[1]);
  }

  const prefixedRocYear = entryName.match(/(?:^|\/)\d{4}-(\d{2,3})年/);

  if (prefixedRocYear) {
    return toGregorianYear(prefixedRocYear[1]);
  }

  return null;
}

function parseAmount(value) {
  const normalized = String(value ?? '').replaceAll(',', '').trim();
  const amount = Number.parseFloat(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function normalizeUnifiedBusinessNo(value) {
  const normalized = String(value ?? '').replace(/\D/g, '');
  return /^\d{8}$/.test(normalized) ? normalized : null;
}

function normalizeGender(value) {
  const text = String(value ?? '').trim();
  if (text === '1' || text === '男' || text.toLowerCase() === 'male') return 'male';
  if (text === '2' || text === '女' || text.toLowerCase() === 'female') return 'female';
  return 'unknown';
}

function normalizeIdentityText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '')
    .toLowerCase();
}

function normalizeSourcePersonName(name) {
  return normalizeIdentityText(name);
}

function sourcePersonKeyFor(person) {
  return `${person.sourceId}:${person.externalId}`;
}

function sourceTypeForSourceId(sourceId) {
  if (sourceId.includes('cec')) return 'official_election';
  if (sourceId.includes('ly')) return 'official_officeholder';
  if (sourceId.includes('cy') || sourceId.includes('political-finance')) return 'official_party_finance';
  if (sourceId.includes('wikidata')) return 'wikidata';
  if (sourceId.includes('moi')) return 'government_open_data';
  return 'other';
}

function confidenceForSourceId(sourceId) {
  return sourceTypeForSourceId(sourceId).startsWith('official') || sourceTypeForSourceId(sourceId) === 'government_open_data'
    ? 'A'
    : sourceTypeForSourceId(sourceId) === 'wikidata'
      ? 'C'
    : 'D';
}

const reviewScoringVersion = '2026-05-23-v1';

function scoreClaim({ claimType, sourceType, confidenceLevel, hasMatchedPerson }) {
  let score = 0;
  const reasons = [];

  if (confidenceLevel === 'A') {
    score += 45;
    reasons.push('A-level source');
  } else if (confidenceLevel === 'B') {
    score += 35;
    reasons.push('B-level source');
  } else if (confidenceLevel === 'C') {
    score += 20;
    reasons.push('C-level source');
  } else {
    score += 10;
    reasons.push('D-level source');
  }

  if (sourceType.startsWith('official') || sourceType === 'government_open_data') {
    score += 25;
    reasons.push('official structured source');
  }

  if (hasMatchedPerson) {
    score += 15;
    reasons.push('linked to canonical person');
  }

  if (['name', 'gender', 'party', 'position', 'district', 'external_id'].includes(claimType)) {
    score += 10;
    reasons.push('low-ambiguity identity field');
  }

  if (['education', 'experience'].includes(claimType) && (sourceType.startsWith('official') || sourceType === 'government_open_data')) {
    score += 10;
    reasons.push('official public profile field');
  }

  if (['legal_case', 'family_relation'].includes(claimType)) {
    score -= 25;
    reasons.push('sensitive claim requires stronger evidence');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

function normalizedRoleForPosition(position) {
  const text = String(position ?? '');
  if (text.includes('副總統')) return 'vice_president';
  if (text.includes('總統')) return 'president';
  if (text.includes('立法委員') || text.includes('立委')) return 'legislator';
  if (text.includes('議員')) return 'councilor';
  if (text.includes('副市長') || text.includes('副縣長') || text.includes('副縣市長')) return 'local_deputy';
  if (text.includes('市長') || text.includes('縣長')) return 'local_chief';
  if (text.includes('黨主席') || text.includes('主席') || text.includes('秘書長')) return 'party_officer';
  if (text.includes('候選人')) return 'candidate';
  return 'other';
}

function mergeByExternalId(collections) {
  const merged = new Map();

  for (const collection of collections) {
    for (const item of collection ?? []) {
      merged.set(item.externalId, item);
    }
  }

  return Array.from(merged.values());
}

function mergeBySourcePersonKey(collections) {
  const merged = new Map();

  for (const collection of collections) {
    for (const item of collection ?? []) {
      merged.set(item.sourcePersonKey, item);
    }
  }

  return Array.from(merged.values());
}

const plannedLocalElection = {
  externalId: 'planned-2026-local-public-officials',
  name: '115年地方公職人員選舉',
  year: 2026,
  electionType: 'local',
  votingDate: '2026-11-28',
  status: 'announced',
  sourceId: 'cec-2026-local-election-calendar',
};

const plannedLocalRaceTypes = new Set(['municipality_mayor', 'county_mayor', 'city_councilor', 'county_councilor']);

function toPlannedLocalRaceExternalId(sourceRace) {
  return `planned-2026-local-from-${sourceRace.externalId}`;
}

function enrichSeedWithPlannedLocalElections(seed) {
  const baseRaces = (seed.races ?? [])
    .filter((race) => {
      return (
        race.electionExternalId === 'cec-2022-local-public-officials' &&
        race.status === 'completed' &&
        plannedLocalRaceTypes.has(race.raceType) &&
        race.externalId
      );
    })
    .sort((left, right) => left.externalId.localeCompare(right.externalId));

  const plannedRaces = baseRaces.map((race) => ({
    externalId: toPlannedLocalRaceExternalId(race),
    electionExternalId: plannedLocalElection.externalId,
    regionExternalId: race.regionExternalId,
    raceType: race.raceType,
    title: race.title,
    votingDate: plannedLocalElection.votingDate,
    status: 'announced',
    sourceId: plannedLocalElection.sourceId,
  }));

  return {
    seed: {
      ...seed,
      elections: mergeByExternalId([seed.elections, [plannedLocalElection]]),
      races: mergeByExternalId([seed.races, plannedRaces]),
    },
    plannedLocalElections: {
      status: plannedRaces.length > 0 ? 'ok' : 'fallback',
      count: plannedRaces.length,
      baseElectionExternalId: 'cec-2022-local-public-officials',
      votingDate: plannedLocalElection.votingDate,
      scope: 'planned 2026 mayor and councilor race shells copied from completed 2022 local race districts',
    },
  };
}

function toCecCountyKey(countyCode, countySubCode) {
  if (countyCode === '09' || countyCode === '10') {
    return `${countyCode}${countySubCode}`;
  }

  return `${countyCode}000`;
}

const historicalCecCountyNameByKey = {
  '01000': '臺北市',
  '02000': '新北市',
  '03000': '臺中市',
  '04000': '臺南市',
  '05000': '高雄市',
  '06000': '桃園市',
  '07000': '基隆市',
  '09007': '連江縣',
  '09020': '金門縣',
  '10002': '宜蘭縣',
  '10004': '新竹縣',
  '10005': '苗栗縣',
  '10007': '彰化縣',
  '10008': '南投縣',
  '10009': '雲林縣',
  '10010': '嘉義縣',
  '10013': '屏東縣',
  '10014': '臺東縣',
  '10015': '花蓮縣',
  '10016': '澎湖縣',
  '10017': '基隆市',
  '10018': '新竹市',
  '10020': '嘉義市',
  '63000': '臺北市',
  '64000': '高雄市',
  '65000': '新北市',
  '66000': '臺中市',
  '67000': '臺南市',
  '68000': '桃園市',
};

function cleanCecCell(value) {
  return String(value ?? '').trim().replace(/^'+/, '');
}

function toCecRaceTitle(regionName, districtCode) {
  return `${regionName}第${Number(districtCode)}選舉區立法委員選舉`;
}

function buildCecRegionByCountyKey(seed) {
  return new Map(
    seed.regions
      .filter((region) => region.officialCode)
      .map((region) => [region.officialCode, region]),
  );
}

function toLegislativeCandidateRows({ rows, partyByCode, raceExternalIdForRow, districtNameForRow, roleLabel, source }) {
  return rows
    .map((row) => {
      const candidateNo = row[5];
      const name = row[6];
      const party = normalizePartyName(partyByCode.get(row[7]) ?? '');
      const gender = normalizeGender(row[8]);
      const incumbent = row[13]?.trim() === 'Y';
      const elected = row[14]?.trim() === '*';
      const raceExternalId = raceExternalIdForRow(row);
      const districtName = districtNameForRow(row);
      const personExternalId = `cec-2024-${roleLabel}-person-${hashId([raceExternalId, candidateNo, name].join('|'))}`;
      const candidateExternalId = `cec-2024-${roleLabel}-candidate-${hashId([raceExternalId, candidateNo, name].join('|'))}`;

      if (!name || !raceExternalId) {
        return null;
      }

      return {
        person: {
          externalId: personExternalId,
          name,
          alias: null,
          party,
          position: `第11屆立法委員${incumbent ? '候選人（現任）' : '候選人'}`,
          electionYear: 2024,
          district: districtName,
          sourceUrl: source.url,
          isPublic: true,
          sourceId: 'cec-2024-votedata',
          gender,
        },
        candidate: {
          externalId: candidateExternalId,
          personExternalId,
          raceExternalId,
          party,
          candidateNo,
          registrationStatus: elected ? 'elected' : 'not_elected',
          sourceUrl: source.url,
          isPublic: true,
          sourceId: 'cec-2024-votedata',
        },
      };
    })
    .filter((item) => item !== null);
}

function toLocalMayorOfficeTitle(region) {
  return region.regionType === 'municipality' || region.regionType === 'city' ? `${region.name}市長` : `${region.name}縣長`;
}

function toLocalCouncilorOfficeTitle(region, kindLabel = '') {
  return `${region.name}${kindLabel}議員`;
}

function toLocalCouncilorRaceType(region) {
  return region.regionType === 'county' ? 'county_councilor' : 'city_councilor';
}

function classifyHistoricalCecCandidateEntry(entryName) {
  if (!entryName.endsWith('/elcand.csv')) {
    return null;
  }

  if (entryName.includes('不分區政黨')) {
    return null;
  }

  if (entryName.includes('2024總統立委') || entryName.includes('2022-111年地方公職人員選舉')) {
    return null;
  }

  const year = inferCecYearFromPath(entryName);

  if (!year || year < 1989) {
    return null;
  }

  if (entryName.includes('/總統/')) {
    return { year, kind: 'president', districtLabel: '全國', roleLabel: '總統' };
  }

  if (entryName.includes('/區域立委/')) {
    return { year, kind: 'legislator-district', roleLabel: '立法委員' };
  }

  if (entryName.includes('/平地立委/')) {
    return { year, kind: 'legislator-plain-indigenous', districtLabel: '平地原住民', roleLabel: '立法委員' };
  }

  if (entryName.includes('/山地立委/')) {
    return { year, kind: 'legislator-mountain-indigenous', districtLabel: '山地原住民', roleLabel: '立法委員' };
  }

  if (entryName.includes('/C1/')) {
    return { year, kind: 'local-mayor', roleLabel: '縣市首長' };
  }

  if (entryName.includes('/T1/')) {
    return { year, kind: 'local-councilor-regional', roleLabel: '議員' };
  }

  if (entryName.includes('/T2/')) {
    return { year, kind: 'local-councilor-plain-indigenous', districtLabel: '平地原住民', roleLabel: '議員' };
  }

  if (entryName.includes('/T3/')) {
    return { year, kind: 'local-councilor-mountain-indigenous', districtLabel: '山地原住民', roleLabel: '議員' };
  }

  return null;
}

function toHistoricalCecDistrictName(row, classification, regionByCountyKey) {
  if (classification.districtLabel) {
    return classification.districtLabel;
  }

  const countyKey = toCecCountyKey(cleanCecCell(row[0]), cleanCecCell(row[1]));
  const region = regionByCountyKey.get(countyKey);
  const regionName = region?.name ?? historicalCecCountyNameByKey[countyKey] ?? null;
  const districtCode = Number(cleanCecCell(row[2]));

  if (classification.kind === 'legislator-district') {
    return regionName ? `${regionName}第${districtCode}選舉區` : `縣市代碼${countyKey}第${districtCode}選舉區`;
  }

  if (classification.kind === 'local-mayor') {
    return regionName ?? `縣市代碼${countyKey}`;
  }

  if (classification.kind.startsWith('local-councilor')) {
    const suffix = classification.districtLabel ? `${classification.districtLabel}議員` : '議員';
    return regionName ? `${regionName}第${districtCode}選舉區${suffix}` : `縣市代碼${countyKey}第${districtCode}選舉區${suffix}`;
  }

  return null;
}

function toHistoricalCecPosition(row, classification, regionByCountyKey) {
  const elected = cleanCecCell(row[14]) === '*';

  if (classification.kind === 'president') {
    const role = cleanCecCell(row[15]) === 'Y' ? '副總統' : '總統';
    return elected ? `${classification.year}年${role}當選人` : `${classification.year}年${role}候選人`;
  }

  if (classification.kind === 'local-mayor') {
    const countyKey = toCecCountyKey(cleanCecCell(row[0]), cleanCecCell(row[1]));
    const region = regionByCountyKey.get(countyKey);
    const regionName = region?.name ?? historicalCecCountyNameByKey[countyKey] ?? null;
    const officeTitle = region ? toLocalMayorOfficeTitle(region) : regionName ? `${regionName}首長` : '縣市首長';
    return elected ? officeTitle : `${officeTitle}候選人`;
  }

  if (classification.kind.startsWith('local-councilor')) {
    const countyKey = toCecCountyKey(cleanCecCell(row[0]), cleanCecCell(row[1]));
    const region = regionByCountyKey.get(countyKey);
    const regionName = region?.name ?? historicalCecCountyNameByKey[countyKey] ?? null;
    const kindLabel = classification.districtLabel ?? '';
    const officeTitle = region ? toLocalCouncilorOfficeTitle(region, kindLabel) : `${regionName ?? ''}${kindLabel}議員`;
    return elected ? officeTitle : `${officeTitle}候選人`;
  }

  return elected ? `${classification.year}年立法委員當選人` : `${classification.year}年立法委員候選人`;
}

function toHistoricalCecSourcePeople({ zipBuffer, source, seed }) {
  const regionByCountyKey = buildCecRegionByCountyKey(seed);
  const entries = listZipEntries(zipBuffer);
  const sourcePeople = [];
  const skippedEntries = [];

  for (const entry of entries) {
    const classification = classifyHistoricalCecCandidateEntry(entry.name);

    if (!classification) {
      continue;
    }

    const partyEntryName = `${zipDirname(entry.name)}/elpaty.csv`;
    const partyEntry = entries.find((item) => item.name === partyEntryName);

    if (!partyEntry) {
      skippedEntries.push({ entry: entry.name, reason: 'missing elpaty.csv' });
      continue;
    }

    const partyRows = parseDelimitedRows(readZipTextByEntry(zipBuffer, partyEntry.name), ',');
    const candidateRows = parseDelimitedRows(readZipTextByEntry(zipBuffer, entry.name), ',');
    const partyByCode = new Map(partyRows.map((row) => [cleanCecCell(row[0]), normalizePartyName(cleanCecCell(row[1]))]));

    for (const row of candidateRows) {
      const candidateNo = cleanCecCell(row[5]);
      const name = cleanCecCell(row[6]);

      if (!candidateNo || !name || name === '姓名') {
        continue;
      }

      const countyCode = cleanCecCell(row[0]);
      const countySubCode = cleanCecCell(row[1]);
      const districtCode = cleanCecCell(row[2]);
      const partyCode = cleanCecCell(row[7]);
      const vicePresident = cleanCecCell(row[15]) === 'Y';
      const elected = cleanCecCell(row[14]) === '*';
      const party = normalizePartyName(partyByCode.get(partyCode) ?? '');
      const countyKey = toCecCountyKey(countyCode, countySubCode);
      const sourcePersonKey = `cec-historical:${hashId([entry.name, candidateNo, name, row[0], row[1], row[2], row[15]].join('|'))}`;

      sourcePeople.push({
        sourcePersonKey,
        sourceType: 'official_election',
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        rawName: name,
        alias: null,
        gender: normalizeGender(cleanCecCell(row[8])),
        party,
        position: toHistoricalCecPosition(row, classification, regionByCountyKey),
        normalizedRole: normalizedRoleForPosition(toHistoricalCecPosition(row, classification, regionByCountyKey)),
        district: toHistoricalCecDistrictName(row, classification, regionByCountyKey),
        electionYear: classification.year,
        externalRecordId: sourcePersonKey,
        sourcePayload: {
          zipEntry: entry.name,
          candidateNo,
          countyCode,
          countySubCode,
          countyKey,
          districtCode,
          partyCode,
          elected,
          vicePresident,
          kind: classification.kind,
        },
        confidenceSuggestion: 'A',
        isPublic: false,
      });
    }
  }

  return { sourcePeople, skippedEntries };
}

function toLocalCandidateRows({ rows, partyByCode, source, roleLabel, raceExternalIdForRow, districtNameForRow, officeTitleForRow }) {
  return rows
    .map((row) => {
      const candidateNo = row[5];
      const name = row[6];
      const party = normalizePartyName(partyByCode.get(row[7]) ?? '');
      const gender = normalizeGender(row[8]);
      const elected = row[14]?.trim() === '*';
      const raceExternalId = raceExternalIdForRow(row);
      const officeTitle = officeTitleForRow(row);
      const personExternalId = `cec-2022-${roleLabel}-person-${hashId([raceExternalId, candidateNo, name].join('|'))}`;
      const candidateExternalId = `cec-2022-${roleLabel}-candidate-${hashId([raceExternalId, candidateNo, name].join('|'))}`;

      if (!name || !raceExternalId || !officeTitle) {
        return null;
      }

      return {
        person: {
          externalId: personExternalId,
          name,
          alias: null,
          party,
          position: elected ? officeTitle : `${officeTitle}候選人`,
          electionYear: 2022,
          district: districtNameForRow(row),
          sourceUrl: source.url,
          isPublic: true,
          sourceId: source.id,
          gender,
        },
        candidate: {
          externalId: candidateExternalId,
          personExternalId,
          raceExternalId,
          party,
          candidateNo,
          registrationStatus: elected ? 'elected' : 'not_elected',
          sourceUrl: source.url,
          isPublic: true,
          sourceId: source.id,
        },
      };
    })
    .filter((item) => item !== null);
}

async function enrichSeedWithLiveCecCandidates(seed, args) {
  const source = seed.sources.find((item) => item.id === 'cec-2024-votedata');

  if (args.skipLiveFetch || !source?.downloadUrl) {
    return {
      seed,
      liveCecCandidates: {
        status: 'skipped',
        count: seed.candidates?.length ?? 0,
        url: source?.downloadUrl ?? null,
      },
    };
  }

  try {
    const zipBuffer = await fetchBytes(source.downloadUrl);
    const partyRows = parseDelimitedRows(readZipTextBySuffix(zipBuffer, '2024總統立委/總統/elpaty.csv'), ',');
    const candidateRows = parseDelimitedRows(readZipTextBySuffix(zipBuffer, '2024總統立委/總統/elcand.csv'), ',');
    const partyByCode = new Map(partyRows.map((row) => [row[0], normalizePartyName(row[1] ?? '')]));
    const electedCandidateNos = new Set(candidateRows.filter((row) => row[14]?.trim() === '*').map((row) => row[5]));
    const regionByCountyKey = buildCecRegionByCountyKey(seed);
    const elections = [
      {
        externalId: 'cec-2022-local-public-officials',
        name: '111年地方公職人員選舉',
        year: 2022,
        electionType: 'local',
        votingDate: '2022-11-26',
        status: 'completed',
        sourceId: source.id,
      },
    ];
    const people = [];
    const candidates = [];
    const races = [];

    for (const row of candidateRows) {
      const candidateNo = row[5];
      const name = row[6];
      const party = normalizePartyName(partyByCode.get(row[7]) ?? '');
      const gender = normalizeGender(row[8]);
      const role = row[15]?.trim() === 'Y' ? '副總統候選人' : '總統候選人';
      const elected = electedCandidateNos.has(candidateNo);
      const publicPosition = elected ? role.replace('候選人', '') : role;
      const personExternalId = `cec-2024-president-person-${hashId([candidateNo, name, role].join('|'))}`;
      const candidateExternalId = `cec-2024-president-candidate-${candidateNo}-${hashId([name, role].join('|'))}`;

      if (!name) {
        continue;
      }

      people.push({
        externalId: personExternalId,
        name,
        alias: null,
        party,
        position: `第16任${publicPosition}`,
        electionYear: 2024,
        district: '全國',
        sourceUrl: source.url,
        isPublic: true,
        sourceId: 'cec-2024-votedata',
        gender,
      });

      candidates.push({
        externalId: candidateExternalId,
        personExternalId,
        raceExternalId: 'cec-2024-president-national',
        party,
        candidateNo,
        registrationStatus: electedCandidateNos.has(candidateNo) ? 'elected' : 'not_elected',
        sourceUrl: source.url,
        isPublic: true,
        sourceId: 'cec-2024-votedata',
      });
    }

    const regionalCandidateRows = parseDelimitedRows(readZipTextBySuffix(zipBuffer, '2024總統立委/區域立委/elcand.csv'), ',');
    const regionalRaceKeys = new Set();

    for (const row of regionalCandidateRows) {
      const countyKey = toCecCountyKey(row[0], row[1]);
      const region = regionByCountyKey.get(countyKey);
      const districtCode = row[2];

      if (!region || regionalRaceKeys.has(`${countyKey}-${districtCode}`)) {
        continue;
      }

      regionalRaceKeys.add(`${countyKey}-${districtCode}`);
      races.push({
        externalId: `cec-2024-legislative-district-${countyKey}-${districtCode}`,
        electionExternalId: 'cec-2024-legislative-yuan',
        regionExternalId: region.externalId,
        raceType: 'legislator',
        title: toCecRaceTitle(region.name, districtCode),
        votingDate: '2024-01-13',
        status: 'completed',
        sourceId: 'cec-2024-votedata',
      });
    }

    const regionalCandidates = toLegislativeCandidateRows({
      rows: regionalCandidateRows,
      partyByCode,
      source,
      roleLabel: 'legislative-district',
      raceExternalIdForRow: (row) => `cec-2024-legislative-district-${toCecCountyKey(row[0], row[1])}-${row[2]}`,
      districtNameForRow: (row) => {
        const countyKey = toCecCountyKey(row[0], row[1]);
        const region = regionByCountyKey.get(countyKey);
        return region ? `${region.name}第${Number(row[2])}選舉區` : `第${Number(row[2])}選舉區`;
      },
    });

    const indigenousRaces = [
      {
        kind: 'plain-indigenous',
        suffix: '2024總統立委/平地立委/elcand.csv',
        title: '平地原住民立法委員選舉',
        districtName: '平地原住民',
      },
      {
        kind: 'mountain-indigenous',
        suffix: '2024總統立委/山地立委/elcand.csv',
        title: '山地原住民立法委員選舉',
        districtName: '山地原住民',
      },
    ];

    for (const race of indigenousRaces) {
      const raceExternalId = `cec-2024-legislative-${race.kind}`;
      races.push({
        externalId: raceExternalId,
        electionExternalId: 'cec-2024-legislative-yuan',
        regionExternalId: 'tw',
        raceType: 'legislator',
        title: race.title,
        votingDate: '2024-01-13',
        status: 'completed',
        sourceId: 'cec-2024-votedata',
      });

      const indigenousCandidateRows = parseDelimitedRows(readZipTextBySuffix(zipBuffer, race.suffix), ',');
      const indigenousCandidates = toLegislativeCandidateRows({
        rows: indigenousCandidateRows,
        partyByCode,
        source,
        roleLabel: `legislative-${race.kind}`,
        raceExternalIdForRow: () => raceExternalId,
        districtNameForRow: () => race.districtName,
      });

      people.push(...indigenousCandidates.map((item) => item.person));
      candidates.push(...indigenousCandidates.map((item) => item.candidate));
    }

    people.push(...regionalCandidates.map((item) => item.person));
    candidates.push(...regionalCandidates.map((item) => item.candidate));

    const mayorCandidateRows = [
      ...parseDelimitedRows(readZipTextBySuffix(zipBuffer, '2022-111年地方公職人員選舉/C1/prv/elcand.csv'), ','),
      ...parseDelimitedRows(readZipTextBySuffix(zipBuffer, '2022-111年地方公職人員選舉/C1/city/elcand.csv'), ','),
    ];
    const mayorRaceKeys = new Set();

    for (const row of mayorCandidateRows) {
      const countyKey = toCecCountyKey(row[0], row[1]);
      const region = regionByCountyKey.get(countyKey);

      if (!region || mayorRaceKeys.has(countyKey)) {
        continue;
      }

      mayorRaceKeys.add(countyKey);
      races.push({
        externalId: `cec-2022-local-mayor-${countyKey}`,
        electionExternalId: 'cec-2022-local-public-officials',
        regionExternalId: region.externalId,
        raceType: region.regionType === 'municipality' ? 'municipality_mayor' : 'county_mayor',
        title: `${toLocalMayorOfficeTitle(region)}選舉`,
        votingDate: '2022-11-26',
        status: 'completed',
        sourceId: source.id,
      });
    }

    const mayorCandidates = toLocalCandidateRows({
      rows: mayorCandidateRows,
      partyByCode,
      source,
      roleLabel: 'local-mayor',
      raceExternalIdForRow: (row) => `cec-2022-local-mayor-${toCecCountyKey(row[0], row[1])}`,
      districtNameForRow: (row) => regionByCountyKey.get(toCecCountyKey(row[0], row[1]))?.name ?? '地方首長',
      officeTitleForRow: (row) => {
        const region = regionByCountyKey.get(toCecCountyKey(row[0], row[1]));
        return region ? toLocalMayorOfficeTitle(region) : '';
      },
    });

    people.push(...mayorCandidates.map((item) => item.person));
    candidates.push(...mayorCandidates.map((item) => item.candidate));

    const councilorSources = [
      {
        kind: 'regional',
        label: '',
        suffixes: [
          '2022-111年地方公職人員選舉/T1/prv/elcand.csv',
          '2022-111年地方公職人員選舉/T1/city/elcand.csv',
        ],
      },
      {
        kind: 'plain-indigenous',
        label: '平地原住民',
        suffixes: [
          '2022-111年地方公職人員選舉/T2/prv/elcand.csv',
          '2022-111年地方公職人員選舉/T2/city/elcand.csv',
        ],
      },
      {
        kind: 'mountain-indigenous',
        label: '山地原住民',
        suffixes: [
          '2022-111年地方公職人員選舉/T3/prv/elcand.csv',
          '2022-111年地方公職人員選舉/T3/city/elcand.csv',
        ],
      },
    ];

    for (const sourceConfig of councilorSources) {
      const councilorRows = sourceConfig.suffixes.flatMap((suffix) => parseDelimitedRows(readZipTextBySuffix(zipBuffer, suffix), ','));
      const councilorRaceKeys = new Set();

      for (const row of councilorRows) {
        const countyKey = toCecCountyKey(row[0], row[1]);
        const region = regionByCountyKey.get(countyKey);
        const districtCode = row[2];
        const raceKey = `${sourceConfig.kind}-${countyKey}-${districtCode}`;

        if (!region || councilorRaceKeys.has(raceKey)) {
          continue;
        }

        councilorRaceKeys.add(raceKey);
        races.push({
          externalId: `cec-2022-local-councilor-${raceKey}`,
          electionExternalId: 'cec-2022-local-public-officials',
          regionExternalId: region.externalId,
          raceType: toLocalCouncilorRaceType(region),
          title: `${region.name}第${Number(districtCode)}選舉區${sourceConfig.label}議員選舉`,
          votingDate: '2022-11-26',
          status: 'completed',
          sourceId: source.id,
        });
      }

      const councilorCandidates = toLocalCandidateRows({
        rows: councilorRows,
        partyByCode,
        source,
        roleLabel: `local-councilor-${sourceConfig.kind}`,
        raceExternalIdForRow: (row) =>
          `cec-2022-local-councilor-${sourceConfig.kind}-${toCecCountyKey(row[0], row[1])}-${row[2]}`,
        districtNameForRow: (row) => {
          const region = regionByCountyKey.get(toCecCountyKey(row[0], row[1]));
          return region ? `${region.name}第${Number(row[2])}選舉區` : `第${Number(row[2])}選舉區`;
        },
        officeTitleForRow: (row) => {
          const region = regionByCountyKey.get(toCecCountyKey(row[0], row[1]));
          return region ? toLocalCouncilorOfficeTitle(region, sourceConfig.label) : '';
        },
      });

      people.push(...councilorCandidates.map((item) => item.person));
      candidates.push(...councilorCandidates.map((item) => item.candidate));
    }

    if (candidates.length === 0) {
      throw new Error('CEC ZIP parsed successfully but no candidate rows were found.');
    }

    return {
      seed: {
        ...seed,
        elections: mergeByExternalId([seed.elections, elections]),
        races: mergeByExternalId([seed.races, races]),
        people: mergeByExternalId([seed.people, people]),
        candidates: mergeByExternalId([seed.candidates, candidates]),
      },
      liveCecCandidates: {
        status: 'ok',
        count: candidates.length,
        url: source.downloadUrl,
        raceCount: races.length,
        localElectionCandidateCount: mayorCandidateRows.length + councilorSources.reduce((count, sourceConfig) => {
          return count + sourceConfig.suffixes.reduce((innerCount, suffix) => {
            return innerCount + parseDelimitedRows(readZipTextBySuffix(zipBuffer, suffix), ',').length;
          }, 0);
        }, 0),
        skippedPartyListBallotChoices: parseDelimitedRows(
          readZipTextBySuffix(zipBuffer, '2024總統立委/不分區政黨/elcand.csv'),
          ',',
        ).length,
        scope: '2024 national candidates plus 2022 local mayors and councilors',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      seed,
      liveCecCandidates: {
        status: 'fallback',
        count: seed.candidates?.length ?? 0,
        url: source.downloadUrl,
        error: message,
      },
    };
  }
}

async function enrichSeedWithHistoricalCecSourcePeople(seed, args) {
  const source = seed.sources.find((item) => item.id === 'cec-2024-votedata');

  if (!args.includeHistoricalCec || args.skipLiveFetch || !source?.downloadUrl) {
    return {
      seed,
      historicalCecSourcePeople: {
        status: args.includeHistoricalCec ? 'skipped' : 'disabled',
        count: seed.sourcePeople?.length ?? 0,
        url: source?.downloadUrl ?? null,
      },
    };
  }

  try {
    const zipBuffer = await fetchBytes(source.downloadUrl);
    const { sourcePeople, skippedEntries } = toHistoricalCecSourcePeople({ zipBuffer, source, seed });

    return {
      seed: {
        ...seed,
        sourcePeople: mergeBySourcePersonKey([seed.sourcePeople, sourcePeople]),
      },
      historicalCecSourcePeople: {
        status: 'ok',
        count: sourcePeople.length,
        url: source.downloadUrl,
        skippedEntryCount: skippedEntries.length,
        scope: 'historical CEC candidate source people since 1989, excluding current baseline 2024 national and 2022 local imports',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      seed,
      historicalCecSourcePeople: {
        status: 'fallback',
        count: seed.sourcePeople?.length ?? 0,
        url: source.downloadUrl,
        error: message,
      },
    };
  }
}

async function enrichSeedWithLivePartyRegistry(seed, args) {
  const registrySource = seed.sources.find((source) => source.id === 'moi-party-registry');

  if (args.skipLiveFetch || !registrySource?.downloadUrl) {
    return {
      seed,
      livePartyRegistry: {
        status: 'skipped',
        count: seed.parties.length,
        url: registrySource?.downloadUrl ?? null,
      },
    };
  }

  try {
    const csv = await fetchText(registrySource.downloadUrl);
    const rows = parseDelimited(csv);
    const seenNames = new Set();
    const parties = rows
      .map((row) => ({
        row,
        name: pickField(row, ['政黨名稱', '名稱', '黨名', 'political_party_name']),
      }))
      .filter(({ name }) => {
        if (!name || seenNames.has(name) || !relevantPartyNames.has(name)) {
          return false;
        }

        seenNames.add(name);
        return true;
      })
      .map(({ row, name }) => {
        const known = knownPartyProfiles[name] ?? {};
        return {
          externalId: `moi-party-${hashId(name)}`,
          name,
          shortName: known.shortName ?? null,
          slug: slugifyPartyName(name),
          themeKey: known.themeKey ?? 'unknown',
          officialSiteUrl: known.officialSiteUrl ?? null,
          registryNo: pickField(row, ['政黨編號', '編號', 'registry_no', 'party_no']),
          foundedDateText: pickField(row, ['成立日期', 'founded_date']),
          filedDateText: pickField(row, ['備案日期', 'filed_date', 'registration_date']),
          headquartersAddress: pickField(row, ['主事務所地址', '地址', 'headquarters_address']),
          contactPhone: pickField(row, ['通訊電話', '電話', 'contact_phone']),
          chairpersonName: pickField(row, ['負責人', '主任委員', '黨主席', 'chairperson', 'leader']),
          status: 'active',
          sourceId: 'moi-party-registry',
        };
      });

    if (parties.length === 0) {
      throw new Error('CSV parsed successfully but no party names were found.');
    }

    return {
      seed: {
        ...seed,
        parties,
      },
      livePartyRegistry: {
        status: 'ok',
        count: parties.length,
        url: registrySource.downloadUrl,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      seed,
      livePartyRegistry: {
        status: 'fallback',
        count: seed.parties.length,
        url: registrySource.downloadUrl,
        error: message,
      },
    };
  }
}

function parseJsonPayload(content) {
  const startIndex = content.indexOf('{');
  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('No JSON object was found in response payload.');
  }

  return JSON.parse(content.slice(startIndex, endIndex + 1));
}

function getLegislatorCodeFromPhotoUrl(picUrl) {
  const match = picUrl.match(/\/(\d+)\.[a-z]+$/i);
  return match?.[1] ?? '';
}

async function enrichSeedWithLiveCurrentOfficeholders(seed, args) {
  const source = seed.sources.find((item) => item.id === 'ly-current-legislators');

  if (args.skipLiveFetch || !source?.downloadUrl) {
    return {
      seed,
      liveCurrentOfficeholders: {
        status: 'skipped',
        count: seed.people?.length ?? 0,
        url: source?.downloadUrl ?? null,
      },
    };
  }

  try {
    const payload = parseJsonPayload(await fetchText(source.downloadUrl));
    const rows = Array.isArray(payload.dataList) ? payload.dataList : [];
    const officeholders = rows
      .filter((row) => pickField(row, ['leaveFlag']) === '否')
      .map((row) => {
        const term = pickField(row, ['term']) || '11';
        const name = pickField(row, ['name']);
        const party = pickField(row, ['partyGroup', 'party']);
        const areaName = pickField(row, ['areaName']);
        const onboardDate = pickField(row, ['onboardDate']);
        const legislatorCode = getLegislatorCodeFromPhotoUrl(pickField(row, ['picUrl']));
        const degree = pickField(row, ['degree']);
        const experience = pickField(row, ['experience']);
        const birthDateText = pickField(row, ['birthday', 'birthDate', 'birth_date', '出生日期']);
        return {
          externalId: `ly-legislator-${term}-${legislatorCode || hashId([name, party, areaName, onboardDate].join('|'))}`,
          name,
          alias: pickField(row, ['ename']) || null,
          gender: normalizeGender(pickField(row, ['sex'])),
          party,
          position: `第${term}屆立法委員`,
          electionYear: 2024,
          district: areaName,
          birthDate: normalizeDateText(birthDateText),
          birthDateText: birthDateText || null,
          education: degree || null,
          experience: experience || null,
          sourceUrl: source.url,
          isPublic: true,
          sourceId: 'ly-current-legislators',
        };
      })
      .filter((person) => person.name);

    if (officeholders.length === 0) {
      throw new Error('JSON parsed successfully but no current legislators were found.');
    }

    return {
      seed: {
        ...seed,
        people: mergeByExternalId([seed.people, officeholders]),
      },
      liveCurrentOfficeholders: {
        status: 'ok',
        count: officeholders.length,
        url: source.downloadUrl,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      seed,
      liveCurrentOfficeholders: {
        status: 'fallback',
        count: seed.people?.length ?? 0,
        url: source?.downloadUrl ?? null,
        error: message,
      },
    };
  }
}

async function enrichSeedWithLivePartyFinanceSummaries(seed, args) {
  const source = seed.sources.find((item) => item.id === 'data-gov-tw-party-contribution-6562003');

  if (args.skipLiveFetch || !source?.downloadUrl) {
    return {
      seed,
      livePartyFinanceSummaries: {
        status: 'skipped',
        count: seed.partyFinanceSummaries?.length ?? 0,
        url: source?.downloadUrl ?? null,
      },
    };
  }

  try {
    const zipBuffer = await fetchBytes(source.downloadUrl);
    const financeRows = parseDelimited(readZipTextBySuffix(zipBuffer, 'political party_incomes and expenditures.csv'));
    const incomeRows = parseDelimited(readZipTextBySuffix(zipBuffer, 'incomes.csv'));
    const partyByName = new Map(seed.parties.map((party) => [normalizePartyName(party.name), party]));
    const summaries = financeRows
      .map((row) => {
        const partyName = normalizePartyName(pickField(row, ['政黨名稱']));
        const party = partyByName.get(partyName);
        const reportYear = toGregorianYear(pickField(row, ['申報年度']));

        if (!party || !reportYear) {
          return null;
        }

        return {
          partyExternalId: party.externalId,
          reportYear,
          incomeTotal: parseAmount(row['收入合計']),
          expenseTotal: parseAmount(row['支出合計']),
          balanceAmount: parseAmount(row['本期結餘']),
          individualDonationTotal: parseAmount(row['個人捐贈收入']),
          businessDonationTotal: parseAmount(row['營利事業捐贈收入']),
          civilGroupDonationTotal: parseAmount(row['人民團體捐贈收入']),
          anonymousDonationTotal: parseAmount(row['匿名捐贈收入']),
          otherIncomeTotal: parseAmount(row['其他收入']),
          sourceId: source.id,
        };
      })
      .filter((summary) => summary !== null);
    const companyByUnifiedBusinessNo = new Map(seed.companies?.map((company) => [company.unifiedBusinessNo, company]) ?? []);
    const companyContributionByKey = new Map();

    for (const row of incomeRows) {
      const account = pickField(row, ['收支科目']);
      const unifiedBusinessNo = normalizeUnifiedBusinessNo(pickField(row, ['身分證／統一編號']));
      const partyName = normalizePartyName(pickField(row, ['擬參選人／政黨']));
      const party = partyByName.get(partyName);
      const donorName = pickField(row, ['捐贈者／支出對象']);
      const reportYear = toGregorianYear(pickField(row, ['申報序號／年度']));
      const amount = parseAmount(row['收入金額']);

      if (account !== '營利事業捐贈收入' || !party || !unifiedBusinessNo || !donorName || !reportYear || amount <= 0) {
        continue;
      }

      companyByUnifiedBusinessNo.set(unifiedBusinessNo, {
        unifiedBusinessNo,
        name: donorName,
        status: null,
        addressRegion: pickField(row, ['地址']).replace(/\*+/g, '').slice(0, 3) || null,
        sourceUrl: source.url,
        isPublic: true,
      });

      const contributionKey = `${party.externalId}:${unifiedBusinessNo}:${reportYear}`;
      const existing = companyContributionByKey.get(contributionKey) ?? {
        partyExternalId: party.externalId,
        companyUnifiedBusinessNo: unifiedBusinessNo,
        reportYear,
        amountTotal: 0,
        donationCount: 0,
        confidenceLevel: 'A',
        sourceId: source.id,
        sourceUrl: source.url,
      };

      existing.amountTotal += amount;
      existing.donationCount += 1;
      companyContributionByKey.set(contributionKey, existing);
    }

    if (summaries.length === 0) {
      throw new Error('Political contribution ZIP parsed successfully but no party summaries matched current parties.');
    }

    return {
      seed: {
        ...seed,
        partyFinanceSummaries: summaries,
        companies: Array.from(companyByUnifiedBusinessNo.values()),
        partyCompanyContributionSummaries: Array.from(companyContributionByKey.values()).sort((left, right) => {
          return right.amountTotal - left.amountTotal || left.companyUnifiedBusinessNo.localeCompare(right.companyUnifiedBusinessNo);
        }),
      },
      livePartyFinanceSummaries: {
        status: 'ok',
        count: summaries.length,
        sourceRowCount: Math.max(0, financeRows.length),
        businessContributionSummaryCount: companyContributionByKey.size,
        businessContributorCount: companyByUnifiedBusinessNo.size,
        url: source.downloadUrl,
        privacyBoundary: 'party-level annual summaries and company-level aggregate contribution summaries only; personal donation details and raw transaction rows are not written',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      seed,
      livePartyFinanceSummaries: {
        status: 'fallback',
        count: seed.partyFinanceSummaries?.length ?? 0,
        url: source.downloadUrl,
        error: message,
      },
    };
  }
}

function readSeed(seedPath) {
  const content = fs.readFileSync(seedPath, 'utf8');
  return {
    seed: JSON.parse(content),
    hash: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

function readOptionalJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getSource(seed, sourceId) {
  const source = seed.sources.find((item) => item.id === sourceId);

  if (!source) {
    throw new Error(`Missing source metadata: ${sourceId}`);
  }

  return source;
}

function normalizeLegalLeadDate(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  const compactRoc = text.match(/^(\d{2,3})(\d{2})(\d{2})$/);
  if (compactRoc) {
    return `${Number(compactRoc[1]) + 1911}-${compactRoc[2]}-${compactRoc[3]}`;
  }

  const separated = text.match(/^(\d{2,4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (separated) {
    const year = Number(separated[1]);
    const gregorianYear = year < 1911 ? year + 1911 : year;
    return `${gregorianYear}-${separated[2].padStart(2, '0')}-${separated[3].padStart(2, '0')}`;
  }

  return null;
}

function normalizeDateText(value) {
  return normalizeLegalLeadDate(value);
}

function normalizeLegalRecordLead(rawLead, seed) {
  const sourceId = rawLead.sourceId ?? rawLead.source_id ?? 'judicial-yuan-court-open-data-api';
  const source = getSource(seed, sourceId);
  const rawName = toClaimValue(rawLead.rawName ?? rawLead.raw_name ?? rawLead.personName ?? rawLead.person_name);
  const sourceUrl = rawLead.sourceUrl ?? rawLead.source_url ?? source.url;
  const courtName = toClaimValue(rawLead.courtName ?? rawLead.court_name);
  const caseYear = toClaimValue(rawLead.caseYear ?? rawLead.case_year);
  const caseCode = toClaimValue(rawLead.caseCode ?? rawLead.case_code);
  const caseNumber = toClaimValue(rawLead.caseNumber ?? rawLead.case_number);
  const judgmentDate = normalizeLegalLeadDate(rawLead.judgmentDate ?? rawLead.judgment_date);
  const title = toClaimValue(rawLead.title);
  const leadKey =
    rawLead.leadKey ??
    rawLead.lead_key ??
    `legal:${hashId([sourceId, sourceUrl, courtName, caseYear, caseCode, caseNumber, judgmentDate, title, rawName].join('|'))}`;

  return {
    leadKey,
    sourceId,
    sourceType: rawLead.sourceType ?? rawLead.source_type ?? 'court_document',
    sourceName: rawLead.sourceName ?? rawLead.source_name ?? source.name,
    sourceUrl,
    courtName: courtName || null,
    caseYear: caseYear || null,
    caseCode: caseCode || null,
    caseNumber: caseNumber || null,
    judgmentDate,
    caseType: toClaimValue(rawLead.caseType ?? rawLead.case_type) || null,
    reason: toClaimValue(rawLead.reason) || null,
    title: title || null,
    summary: toClaimValue(rawLead.summary) || null,
    rawName: rawName || null,
    normalizedName: rawName ? normalizeSourcePersonName(rawName) : null,
    confidenceLevel: rawLead.confidenceLevel ?? rawLead.confidence_level ?? 'D',
    sourcePayload: rawLead.sourcePayload ?? rawLead.source_payload ?? rawLead,
  };
}

function enrichSeedWithLegalRecordLeads(seed, args) {
  if (!args.includeLegalRecordLeads) {
    return {
      seed,
      legalRecordLeads: {
        status: 'disabled',
        count: seed.legalRecordLeads?.length ?? 0,
        path: args.legalRecordLeadsPath,
      },
    };
  }

  const legalSeed = readOptionalJson(args.legalRecordLeadsPath, { legalRecordLeads: [] });
  const legalRecordLeads = (legalSeed.legalRecordLeads ?? []).map((lead) => normalizeLegalRecordLead(lead, seed));

  return {
    seed: {
      ...seed,
      legalRecordLeads,
    },
    legalRecordLeads: {
      status: 'ok',
      count: legalRecordLeads.length,
      path: args.legalRecordLeadsPath,
      publicationBoundary: 'private review-only leads; no public legal_case claim is created by this step',
    },
  };
}

function normalizePersonEnrichmentClaim(rawClaim, seed) {
  const sourceId = rawClaim.sourceId ?? rawClaim.source_id ?? 'wikidata-person-enrichment';
  const source = getSource(seed, sourceId);
  const claimType = rawClaim.claimType ?? rawClaim.claim_type ?? 'other';
  const claimValue = rawClaim.claimValue ?? rawClaim.claim_value ?? null;
  const personName = rawClaim.personName ?? rawClaim.person_name ?? null;

  return {
    claimKey: rawClaim.claimKey ?? rawClaim.claim_key ?? null,
    personId: rawClaim.personId ?? rawClaim.person_id ?? null,
    personExternalId: rawClaim.personExternalId ?? rawClaim.person_external_id ?? null,
    personName,
    normalizedName: personName ? normalizeSourcePersonName(personName) : null,
    claimType,
    claimValue,
    claimJson: rawClaim.claimJson ?? rawClaim.claim_json ?? {},
    confidenceLevel: rawClaim.confidenceLevel ?? rawClaim.confidence_level ?? confidenceForSourceId(sourceId),
    reviewStatus: rawClaim.reviewStatus ?? rawClaim.review_status ?? 'pending',
    visibility: rawClaim.visibility ?? 'review_only',
    sourceId,
    sourceName: rawClaim.sourceName ?? rawClaim.source_name ?? source.name,
    sourceUrl: rawClaim.sourceUrl ?? rawClaim.source_url ?? source.url,
    observedAt: rawClaim.observedAt ?? rawClaim.observed_at ?? null,
  };
}

function enrichSeedWithPersonEnrichmentClaims(seed, args) {
  if (!args.includePersonEnrichmentClaims) {
    return {
      seed,
      personEnrichmentClaims: {
        status: 'disabled',
        count: seed.personEnrichmentClaims?.length ?? 0,
        path: args.personEnrichmentClaimsPath,
      },
    };
  }

  const enrichmentSeed = readOptionalJson(args.personEnrichmentClaimsPath, { personClaims: [] });
  const personEnrichmentClaims = (enrichmentSeed.personClaims ?? []).map((claim) => normalizePersonEnrichmentClaim(claim, seed));

  return {
    seed: {
      ...seed,
      personEnrichmentClaims,
    },
    personEnrichmentClaims: {
      status: 'ok',
      count: personEnrichmentClaims.length,
      path: args.personEnrichmentClaimsPath,
      publicationBoundary: 'review-only by default; low-trust enrichment sources are not auto-published',
    },
  };
}

function validateSeed(seed) {
  const sourceIds = new Set(seed.sources.map((source) => source.id));
  const regionIds = new Set(seed.regions.map((region) => region.externalId));
  const electionIds = new Set(seed.elections.map((election) => election.externalId));
  const raceIds = new Set(seed.races.map((race) => race.externalId));
  const personIds = new Set((seed.people ?? []).map((person) => person.externalId));
  const partyIds = new Set(seed.parties.map((party) => party.externalId));
  const companyUnifiedBusinessNos = new Set((seed.companies ?? []).map((company) => company.unifiedBusinessNo).filter(Boolean));

  for (const collection of ['regions', 'elections', 'races', 'parties', 'people', 'candidates']) {
    if (!Array.isArray(seed[collection])) {
      throw new Error(`Seed collection must be an array: ${collection}`);
    }
  }

  for (const region of seed.regions) {
    if (!sourceIds.has(region.sourceId)) throw new Error(`Region ${region.externalId} has unknown sourceId.`);
    if (region.parentExternalId && !regionIds.has(region.parentExternalId)) {
      throw new Error(`Region ${region.externalId} has unknown parentExternalId.`);
    }
  }

  for (const election of seed.elections) {
    if (!sourceIds.has(election.sourceId)) throw new Error(`Election ${election.externalId} has unknown sourceId.`);
  }

  for (const race of seed.races) {
    if (!sourceIds.has(race.sourceId)) throw new Error(`Race ${race.externalId} has unknown sourceId.`);
    if (!electionIds.has(race.electionExternalId)) throw new Error(`Race ${race.externalId} has unknown electionExternalId.`);
    if (race.regionExternalId && !regionIds.has(race.regionExternalId)) {
      throw new Error(`Race ${race.externalId} has unknown regionExternalId.`);
    }
  }

  for (const party of seed.parties) {
    if (!sourceIds.has(party.sourceId)) throw new Error(`Party ${party.externalId} has unknown sourceId.`);
  }

  for (const person of seed.people ?? []) {
    if (!sourceIds.has(person.sourceId)) throw new Error(`Person ${person.externalId} has unknown sourceId.`);
  }

  for (const sourcePerson of seed.sourcePeople ?? []) {
    if (!sourceIds.has(sourcePerson.sourceId)) {
      throw new Error(`Source person ${sourcePerson.sourcePersonKey} has unknown sourceId.`);
    }
  }

  for (const candidate of seed.candidates ?? []) {
    if (!sourceIds.has(candidate.sourceId)) throw new Error(`Candidate ${candidate.externalId} has unknown sourceId.`);
    if (!personIds.has(candidate.personExternalId)) {
      throw new Error(`Candidate ${candidate.externalId} has unknown personExternalId.`);
    }
    if (!raceIds.has(candidate.raceExternalId)) {
      throw new Error(`Candidate ${candidate.externalId} has unknown raceExternalId.`);
    }
  }

  for (const summary of seed.partyFinanceSummaries ?? []) {
    if (!partyIds.has(summary.partyExternalId)) {
      throw new Error(`Party finance summary has unknown partyExternalId: ${summary.partyExternalId}`);
    }
  }

  for (const summary of seed.partyCompanyContributionSummaries ?? []) {
    if (!partyIds.has(summary.partyExternalId)) {
      throw new Error(`Party company contribution summary has unknown partyExternalId: ${summary.partyExternalId}`);
    }

    if (!companyUnifiedBusinessNos.has(summary.companyUnifiedBusinessNo)) {
      throw new Error(`Party company contribution summary has unknown companyUnifiedBusinessNo: ${summary.companyUnifiedBusinessNo}`);
    }
  }

  for (const lead of seed.legalRecordLeads ?? []) {
    if (!sourceIds.has(lead.sourceId)) {
      throw new Error(`Legal record lead ${lead.leadKey} has unknown sourceId.`);
    }
  }

  for (const claim of seed.personEnrichmentClaims ?? []) {
    if (!sourceIds.has(claim.sourceId)) {
      throw new Error(`Person enrichment claim has unknown sourceId: ${claim.sourceId}`);
    }
  }
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error('Writing requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url: url.replace(/\/$/, ''), serviceKey };
}

async function supabaseRequest(env, table, { method = 'GET', rows, onConflict, select, range, filters } = {}) {
  const url = new URL(`${env.url}/rest/v1/${table}`);

  if (onConflict) {
    url.searchParams.set('on_conflict', onConflict);
  }

  if (select) {
    url.searchParams.set('select', select);
  }

  for (const [key, value] of Object.entries(filters ?? {})) {
    url.searchParams.set(key, value);
  }

  const headers = {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
  };

  if (range) {
    headers.range = `${range.from}-${range.to}`;
  }

  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    headers.prefer = onConflict ? 'resolution=merge-duplicates,return=representation' : 'return=representation';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(rows),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${table} ${method} failed: ${body?.message ?? response.statusText}`);
  }

  return Array.isArray(body) ? body : [];
}

async function supabasePatch(env, table, filters, row) {
  const url = new URL(`${env.url}/rest/v1/${table}`);

  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, `eq.${value}`);
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: env.serviceKey,
      authorization: `Bearer ${env.serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    throw new Error(`${table} PATCH failed: ${body?.message ?? response.statusText}`);
  }
}

async function upsertOrThrow(env, table, rows, options = {}) {
  if (rows.length === 0) {
    return [];
  }

  return supabaseRequest(env, table, {
    method: 'POST',
    rows,
    onConflict: options.onConflict,
  });
}

async function selectOrThrow(env, table, select) {
  return supabaseRequest(env, table, { method: 'GET', select });
}

async function selectAllOrThrow(env, table, select, pageSize = 1000) {
  const rows = [];
  let offset = 0;

  while (true) {
    const page = await supabaseRequest(env, table, {
      method: 'GET',
      select,
      filters: { order: 'id.asc' },
      range: { from: offset, to: offset + pageSize - 1 },
    });

    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

const terminalPersonClaimReviewStatuses = new Set(['verified', 'rejected', 'archived']);

function wikidataQidFromClaimJson(claimJson) {
  const qid = claimJson?.wikidataQid;
  return typeof qid === 'string' && /^Q\d+$/i.test(qid) ? qid.toUpperCase() : null;
}

function wikidataSemanticClaimKey(row) {
  const qid = wikidataQidFromClaimJson(row.claim_json);
  if (!qid || !row.person_id || !row.claim_type) {
    return null;
  }

  return [
    row.person_id,
    qid,
    row.claim_type,
    toClaimValue(row.claim_value) ?? '',
  ].join(':');
}

function wikidataRejectedPersonQidKey(row) {
  const qid = wikidataQidFromClaimJson(row.claim_json);
  if (!qid || !row.person_id) {
    return null;
  }

  return `${row.person_id}:${qid}`;
}

async function fetchExistingPersonClaimReviewStates(env) {
  const rows = await selectAllOrThrow(
    env,
    'person_claims',
    'claim_key,person_id,claim_type,claim_value,review_status,visibility,is_public,auto_reviewed_at,scoring_version,scoring_reasons,claim_json',
  );

  const terminalRows = rows.filter((row) => terminalPersonClaimReviewStatuses.has(row.review_status));
  const byClaimKey = new Map(terminalRows.map((row) => [row.claim_key, row]));
  const byWikidataSemanticKey = new Map();
  const rejectedWikidataPersonQids = new Map();

  for (const row of terminalRows) {
    const semanticKey = wikidataSemanticClaimKey(row);
    if (semanticKey) {
      byWikidataSemanticKey.set(semanticKey, row);
    }

    const rejectedKey = row.review_status === 'rejected' ? wikidataRejectedPersonQidKey(row) : null;
    if (rejectedKey) {
      rejectedWikidataPersonQids.set(rejectedKey, row);
    }
  }

  return { byClaimKey, byWikidataSemanticKey, rejectedWikidataPersonQids };
}

function preserveReviewedPersonClaimRows(rows, existingReviewStates) {
  return rows.map((row) => {
    const existing =
      existingReviewStates.byClaimKey.get(row.claim_key) ??
      existingReviewStates.rejectedWikidataPersonQids.get(wikidataRejectedPersonQidKey(row)) ??
      existingReviewStates.byWikidataSemanticKey.get(wikidataSemanticClaimKey(row));

    if (!existing) {
      return row;
    }

    if (
      row.claim_type === 'external_id' &&
      row.confidence_level === 'A' &&
      row.review_status === 'verified' &&
      row.visibility === 'public' &&
      row.is_public === true &&
      existing.review_status === 'archived'
    ) {
      return row;
    }

    return {
      ...row,
      review_status: existing.review_status,
      visibility: existing.visibility,
      is_public: existing.is_public,
      auto_reviewed_at: existing.auto_reviewed_at,
      scoring_version: existing.scoring_version ?? row.scoring_version,
      scoring_reasons: existing.scoring_reasons ?? row.scoring_reasons,
      claim_json: {
        ...(row.claim_json ?? {}),
        ...(existing.claim_json?.reviewDecision ? { reviewDecision: existing.claim_json.reviewDecision } : {}),
      },
    };
  });
}

async function applySkippedWikidataRejections(env, args, reviewedAt) {
  const rejectedByPerson = args.rejectedWikidataQidsByPerson ?? new Map();
  if (rejectedByPerson.size === 0) {
    return 0;
  }

  const targets = [];

  for (const [key, rejectedQids] of rejectedByPerson.entries()) {
    if (!key.startsWith('id:')) {
      continue;
    }

    const personId = key.slice(3);
    const rows = await supabaseRequest(env, 'person_claims', {
      method: 'GET',
      select: 'id,person_id,review_status,claim_json,scoring_reasons',
      filters: {
        person_id: `eq.${personId}`,
        review_status: 'in.(pending,needs_more_evidence)',
      },
    });

    targets.push(...rows.filter((row) => {
      const qid = wikidataQidFromClaimJson(row.claim_json);
      return Boolean(qid && rejectedQids.has(qid));
    }));
  }

  for (const target of targets) {
    const scoringReasons = Array.isArray(target.scoring_reasons) ? target.scoring_reasons : [];
    await supabasePatch(env, 'person_claims', { id: target.id }, {
      review_status: 'rejected',
      visibility: 'private',
      is_public: false,
      scoring_version: 'person-enrichment-skipped-rejection-v1',
      scoring_reasons: [
        ...scoringReasons,
        {
          version: 'person-enrichment-skipped-rejection-v1',
          reason: 'Wikidata QID was previously rejected for this person',
          reviewedAt,
        },
      ],
      claim_json: {
        ...(target.claim_json ?? {}),
        reviewDecision: {
          version: 'person-enrichment-skipped-rejection-v1',
          decision: 'reject',
          reason: 'Wikidata QID was previously rejected for this person',
          reviewedAt,
        },
      },
      updated_at: reviewedAt,
    });
  }

  return targets.length;
}

async function applyExistingWikidataTerminalReviewStates(env, reviewedAt) {
  const rows = await selectAllOrThrow(
    env,
    'person_claims',
    'id,person_id,claim_type,claim_value,review_status,visibility,is_public,auto_reviewed_at,scoring_version,scoring_reasons,claim_json',
  );
  const terminalBySemanticKey = new Map();

  for (const row of rows) {
    if (!terminalPersonClaimReviewStatuses.has(row.review_status)) {
      continue;
    }

    const key = wikidataSemanticClaimKey(row);
    if (key && !terminalBySemanticKey.has(key)) {
      terminalBySemanticKey.set(key, row);
    }
  }

  const targets = rows
    .filter((row) => ['pending', 'needs_more_evidence'].includes(row.review_status))
    .map((row) => ({ row, terminal: terminalBySemanticKey.get(wikidataSemanticClaimKey(row)) }))
    .filter((item) => item.terminal);

  for (const { row, terminal } of targets) {
    const scoringReasons = Array.isArray(row.scoring_reasons) ? row.scoring_reasons : [];
    await supabasePatch(env, 'person_claims', { id: row.id }, {
      review_status: terminal.review_status,
      visibility: terminal.visibility,
      is_public: terminal.is_public,
      auto_reviewed_at: terminal.auto_reviewed_at,
      scoring_version: terminal.scoring_version ?? row.scoring_version,
      scoring_reasons: [
        ...scoringReasons,
        {
          version: 'existing-wikidata-terminal-state-sync-v1',
          reason: 'same person, Wikidata QID, claim type, and value already has terminal review status',
          reviewedAt,
        },
      ],
      claim_json: {
        ...(row.claim_json ?? {}),
        ...(terminal.claim_json?.reviewDecision ? { reviewDecision: terminal.claim_json.reviewDecision } : {}),
      },
      updated_at: reviewedAt,
    });
  }

  return targets.length;
}

function buildSourcePersonRows(seed, startedAt, ingestBatchKey) {
  const canonicalRows = (seed.people ?? []).map((person) => {
    const source = getSource(seed, person.sourceId);
    const sourceType = sourceTypeForSourceId(person.sourceId);
    return {
      source_person_key: sourcePersonKeyFor(person),
      source_type: sourceType,
      source_id: person.sourceId,
      source_name: source.name,
      source_url: person.sourceUrl ?? source.url,
      raw_name: person.name,
      normalized_name: normalizeSourcePersonName(person.name),
      alias: person.alias ?? null,
      gender: person.gender ?? 'unknown',
      party: person.party ?? null,
      normalized_party: person.party ? normalizeIdentityText(normalizePartyName(person.party)) : null,
      position: person.position ?? null,
      normalized_role: normalizedRoleForPosition(person.position),
      district: person.district ?? null,
      normalized_region: person.district ? normalizeIdentityText(person.district) : null,
      election_year: person.electionYear ?? null,
      birth_date: person.birthDate ?? null,
      birth_date_text: person.birthDateText ?? null,
      external_person_id: person.externalId,
      external_record_id: person.externalId,
      source_payload: {
        externalId: person.externalId,
        sourceId: person.sourceId,
        sourceType,
      },
      confidence_suggestion: confidenceForSourceId(person.sourceId),
      ingest_batch_key: ingestBatchKey,
      is_public: person.isPublic ?? true,
      updated_at: startedAt,
    };
  });

  const sourceOnlyRows = (seed.sourcePeople ?? []).map((person) => {
    const source = getSource(seed, person.sourceId);
    const sourceType = person.sourceType ?? sourceTypeForSourceId(person.sourceId);
    return {
      source_person_key: person.sourcePersonKey,
      source_type: sourceType,
      source_id: person.sourceId,
      source_name: person.sourceName ?? source.name,
      source_url: person.sourceUrl ?? source.url,
      raw_name: person.rawName,
      normalized_name: normalizeSourcePersonName(person.rawName),
      alias: person.alias ?? null,
      gender: person.gender ?? 'unknown',
      party: person.party ?? null,
      normalized_party: person.party ? normalizeIdentityText(normalizePartyName(person.party)) : null,
      position: person.position ?? null,
      normalized_role: person.normalizedRole ?? normalizedRoleForPosition(person.position),
      district: person.district ?? null,
      normalized_region: person.district ? normalizeIdentityText(person.district) : null,
      election_year: person.electionYear ?? null,
      birth_date: person.birthDate ?? null,
      birth_date_text: person.birthDateText ?? null,
      external_person_id: person.externalPersonId ?? null,
      external_record_id: person.externalRecordId ?? person.sourcePersonKey,
      source_payload: person.sourcePayload ?? {},
      confidence_suggestion: person.confidenceSuggestion ?? confidenceForSourceId(person.sourceId),
      ingest_batch_key: ingestBatchKey,
      is_public: person.isPublic ?? false,
      updated_at: startedAt,
    };
  });

  return [...canonicalRows, ...sourceOnlyRows];
}

function buildIdentityMatchRows(seed, sourcePersonByKey, personByExternalId, startedAt) {
  return (seed.people ?? [])
    .map((person) => {
      const sourcePerson = sourcePersonByKey.get(sourcePersonKeyFor(person));
      const canonicalPerson = personByExternalId.get(person.externalId);

      if (!sourcePerson || !canonicalPerson) {
        return null;
      }

      return {
        source_person_id: sourcePerson.id,
        person_id: canonicalPerson.id,
        match_status: 'auto_matched',
        score: 100,
        match_method: 'external_id',
        match_reason: 'The source person was imported from the same external_id that upserts the canonical public person.',
        evidence_json: {
          externalId: person.externalId,
          normalizedName: normalizeSourcePersonName(person.name),
          sourceId: person.sourceId,
        },
        updated_at: startedAt,
      };
    })
    .filter((row) => row !== null);
}

function buildProbableIdentityMatchRows(seed, sourcePersonByKey, canonicalPeople, startedAt, args) {
  const peopleByNormalizedName = new Map();

  for (const person of canonicalPeople) {
    const normalizedName = normalizeSourcePersonName(person.name);
    const group = peopleByNormalizedName.get(normalizedName) ?? [];
    group.push(person);
    peopleByNormalizedName.set(normalizedName, group);
  }

  const rows = [];

  for (const sourcePerson of seed.sourcePeople ?? []) {
    const sourceRow = sourcePersonByKey.get(sourcePerson.sourcePersonKey);
    const candidates = peopleByNormalizedName.get(normalizeSourcePersonName(sourcePerson.rawName)) ?? [];

    if (!sourceRow || candidates.length === 0) {
      continue;
    }

    const sourceRole = sourcePerson.normalizedRole ?? normalizedRoleForPosition(sourcePerson.position);
    const sourceParty = normalizeIdentityText(sourcePerson.party);
    const sourceDistrict = normalizeIdentityText(sourcePerson.district);
    const sourceGender = sourcePerson.gender ?? 'unknown';

    const scoredCandidates = candidates
      .map((person) => {
        let score = 45;
        const reasons = ['normalized name matched'];
        let corroboratingSignalCount = 0;

        if (sourceGender !== 'unknown' && person.gender === sourceGender) {
          score += 25;
          reasons.push('gender matched');
        } else {
          reasons.push(sourceGender === 'unknown' ? 'source gender missing' : 'gender mismatch');
          return { person, score: 0, reasons };
        }

        if (sourceParty && sourceParty === normalizeIdentityText(person.party)) {
          score += 10;
          reasons.push('party matched');
          corroboratingSignalCount += 1;
        }

        if (sourceRole !== 'other' && sourceRole === normalizedRoleForPosition(person.position)) {
          score += 10;
          reasons.push('role matched');
          corroboratingSignalCount += 1;
        }

        if (sourceDistrict && normalizeIdentityText(person.district).includes(sourceDistrict.slice(0, 3))) {
          score += 5;
          reasons.push('region hint matched');
          corroboratingSignalCount += 1;
        }

        if (corroboratingSignalCount === 0) {
          return { person, score: 0, reasons: [...reasons, 'missing corroborating identity signal'] };
        }

        return { person, score, reasons };
      })
      .filter((item) => item.score >= 75)
      .sort((left, right) => right.score - left.score);

    const best = scoredCandidates[0];

    if (!best) {
      continue;
    }

    const autoApproved = args.autoApproveReview && best.score >= args.identityAutoApproveThreshold;

    rows.push({
      source_person_id: sourceRow.id,
      person_id: best.person.id,
      match_status: autoApproved ? 'auto_matched' : 'probable_match',
      score: best.score,
      match_method: autoApproved ? 'auto_approved_name_party_role_scoring' : 'name_party_role_scoring',
      match_reason: `${best.reasons.join('; ')}${autoApproved ? '; auto-approved by threshold' : ''}`,
      evidence_json: {
        sourcePersonKey: sourcePerson.sourcePersonKey,
        sourceElectionYear: sourcePerson.electionYear ?? null,
        sourceParty: sourcePerson.party ?? null,
        sourcePosition: sourcePerson.position ?? null,
        canonicalExternalId: best.person.external_id ?? null,
        canonicalParty: best.person.party ?? null,
        canonicalPosition: best.person.position ?? null,
      },
      reviewed_by: autoApproved ? 'system:auto-review' : null,
      reviewed_at: autoApproved ? startedAt : null,
      updated_at: startedAt,
    });
  }

  return rows;
}

function toClaimValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizePersonName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '');
}

function loadRejectedWikidataQidsByPerson(skippedPath) {
  if (!fs.existsSync(skippedPath)) {
    return new Map();
  }

  const payload = JSON.parse(fs.readFileSync(skippedPath, 'utf8'));
  const byPerson = new Map();

  for (const record of payload.skippedTargets ?? []) {
    const target = record.target ?? record;
    const personId = target.personId ?? target.person_id ?? null;
    const name = target.name ?? record.name ?? null;
    const rejectedWikidataQids = target.rejectedWikidataQids ?? target.rejected_wikidata_qids ?? [];

    if (!Array.isArray(rejectedWikidataQids) || rejectedWikidataQids.length === 0) {
      continue;
    }

    const key = personId ? `id:${personId}` : `name:${normalizePersonName(name)}`;
    const existing = byPerson.get(key) ?? new Set();
    for (const qid of rejectedWikidataQids) {
      existing.add(String(qid).toUpperCase());
    }
    byPerson.set(key, existing);
  }

  return byPerson;
}

function buildPersonClaimRows(seed, sourcePersonByKey, personByExternalId, startedAt, autoApprovedPersonBySourceKey = new Map(), args = {}) {
  const rows = [];

  for (const person of seed.people ?? []) {
    const source = getSource(seed, person.sourceId);
    const sourcePerson = sourcePersonByKey.get(sourcePersonKeyFor(person));
    const canonicalPerson = personByExternalId.get(person.externalId);

    if (!sourcePerson || !canonicalPerson) {
      continue;
    }

    const confidence = confidenceForSourceId(person.sourceId);
    const sourceType = sourceTypeForSourceId(person.sourceId);
    const base = {
      person_id: canonicalPerson.id,
      source_person_id: sourcePerson.id,
      confidence_level: confidence,
      source_name: source.name,
      source_url: person.sourceUrl ?? source.url,
      observed_at: startedAt,
      is_public: confidence === 'A',
      updated_at: startedAt,
    };

    const claims = [
      ['name', person.name],
      ['alias', person.alias],
      ['gender', person.gender],
      ['party', person.party],
      ['position', person.position],
      ['district', person.district],
      ['birth_date', person.birthDate ?? person.birthDateText],
      ['education', person.education],
      ['experience', person.experience],
      ['external_id', person.externalId],
    ];

    for (const [claimType, rawValue] of claims) {
      const value = toClaimValue(rawValue);

      if (!value || value === 'unknown') {
        continue;
      }

      const scoring = scoreClaim({
        claimType,
        sourceType,
        confidenceLevel: confidence,
        hasMatchedPerson: true,
      });
      const autoApproved = scoring.score >= (args.claimAutoApproveThreshold ?? 90);

      rows.push({
        ...base,
        claim_key: `${sourcePersonKeyFor(person)}:${claimType}`,
        claim_type: claimType,
        claim_value: value,
        review_status: autoApproved ? 'verified' : 'pending',
        visibility: autoApproved ? 'public' : 'review_only',
        is_public: autoApproved,
        review_score: scoring.score,
        scoring_version: reviewScoringVersion,
        scoring_reasons: scoring.reasons,
        auto_reviewed_at: autoApproved ? startedAt : null,
        claim_json: {
          value,
          personExternalId: person.externalId,
          sourcePersonKey: sourcePersonKeyFor(person),
        },
      });
    }
  }

  for (const person of seed.sourcePeople ?? []) {
    const source = getSource(seed, person.sourceId);
    const sourcePerson = sourcePersonByKey.get(person.sourcePersonKey);
    const approvedPerson = autoApprovedPersonBySourceKey.get(person.sourcePersonKey) ?? null;

    if (!sourcePerson) {
      continue;
    }

    const confidence = person.confidenceSuggestion ?? confidenceForSourceId(person.sourceId);
    const sourceType = person.sourceType ?? sourceTypeForSourceId(person.sourceId);
    const base = {
      person_id: approvedPerson?.id ?? null,
      source_person_id: sourcePerson.id,
      confidence_level: confidence,
      source_name: person.sourceName ?? source.name,
      source_url: person.sourceUrl ?? source.url,
      observed_at: startedAt,
      is_public: false,
      updated_at: startedAt,
    };

    const claims = [
      ['name', person.rawName],
      ['alias', person.alias],
      ['gender', person.gender],
      ['party', person.party],
      ['position', person.position],
      ['district', person.district],
      ['birth_date', person.birthDate ?? person.birthDateText],
      ['external_id', person.externalRecordId],
    ];

    for (const [claimType, rawValue] of claims) {
      const value = toClaimValue(rawValue);

      if (!value || value === 'unknown') {
        continue;
      }

      const scoring = scoreClaim({
        claimType,
        sourceType,
        confidenceLevel: confidence,
        hasMatchedPerson: Boolean(approvedPerson),
      });
      const autoApproved = Boolean(approvedPerson) && scoring.score >= (args.claimAutoApproveThreshold ?? 90);

      rows.push({
        ...base,
        claim_key: `${person.sourcePersonKey}:${claimType}`,
        claim_type: claimType,
        claim_value: value,
        review_status: autoApproved ? 'verified' : 'pending',
        visibility: autoApproved ? 'public' : 'review_only',
        is_public: autoApproved,
        review_score: scoring.score,
        scoring_version: reviewScoringVersion,
        scoring_reasons: scoring.reasons,
        auto_reviewed_at: autoApproved ? startedAt : null,
        claim_json: {
          value,
          sourcePersonKey: person.sourcePersonKey,
          sourcePayload: person.sourcePayload ?? {},
        },
      });
    }
  }

  return rows;
}

function scoreLegalLeadMatch(lead, person) {
  if (!lead.normalizedName) {
    return { score: 0, reasons: ['missing name in legal lead'] };
  }

  const personName = normalizeSourcePersonName(person.name);
  const leadName = lead.normalizedName;

  if (personName !== leadName) {
    return { score: 0, reasons: ['name did not match'] };
  }

  let score = 45;
  const reasons = ['normalized name matched'];

  if (lead.sourceType === 'court_document' || lead.sourceType === 'judicial_api' || lead.sourceType === 'government_open_data') {
    score += 15;
    reasons.push('official legal source');
  }

  const matchedHints = lead.sourcePayload?.matchedHints ?? {};
  const targetPersonId = lead.sourcePayload?.targetPerson?.personId ?? null;
  const evidenceText = normalizeIdentityText([lead.title, lead.summary, lead.reason].filter(Boolean).join(' '));
  const personDistrict = normalizeIdentityText(person.district);
  const personParty = normalizeIdentityText(person.party);
  const personPosition = normalizeIdentityText(person.position);

  if (targetPersonId && targetPersonId === person.id) {
    score += 5;
    reasons.push('fetch target person matched canonical person');
  }

  if (matchedHints.district || (personDistrict && evidenceText.includes(personDistrict.slice(0, 3)))) {
    score += 10;
    reasons.push('district hint matched');
  }

  if (matchedHints.party || (personParty && evidenceText.includes(personParty))) {
    score += 5;
    reasons.push('party hint matched');
  }

  if (matchedHints.position || (personPosition && evidenceText.includes(personPosition.slice(0, 4)))) {
    score += 5;
    reasons.push('position hint matched');
  }

  score -= 20;
  reasons.push('legal record requires manual identity confirmation');

  return { score: Math.max(0, Math.min(89, score)), reasons };
}

function buildLegalRecordLeadRows(seed, canonicalPeople, startedAt) {
  const peopleByNormalizedName = new Map();

  for (const person of canonicalPeople) {
    const normalizedName = normalizeSourcePersonName(person.name);
    const group = peopleByNormalizedName.get(normalizedName) ?? [];
    group.push(person);
    peopleByNormalizedName.set(normalizedName, group);
  }

  return (seed.legalRecordLeads ?? []).map((lead) => {
    const candidates = lead.normalizedName ? peopleByNormalizedName.get(lead.normalizedName) ?? [] : [];
    const best = candidates
      .map((person) => ({ person, ...scoreLegalLeadMatch(lead, person) }))
      .sort((left, right) => right.score - left.score)[0];
    const matchStatus = best?.score >= 75 ? 'probable_match' : best?.score >= 50 ? 'possible_match' : 'unmatched';

    return {
      lead_key: lead.leadKey,
      source_id: lead.sourceId,
      source_type: lead.sourceType,
      source_name: lead.sourceName,
      source_url: lead.sourceUrl,
      court_name: lead.courtName,
      case_year: lead.caseYear,
      case_code: lead.caseCode,
      case_number: lead.caseNumber,
      judgment_date: lead.judgmentDate,
      case_type: lead.caseType,
      reason: lead.reason,
      title: lead.title,
      summary: lead.summary,
      raw_name: lead.rawName,
      normalized_name: lead.normalizedName,
      matched_person_id: best?.score > 0 ? best.person.id : null,
      match_score: best?.score ?? 0,
      match_status: matchStatus,
      confidence_level: lead.confidenceLevel,
      review_status: 'pending',
      review_note: best?.reasons?.join('; ') ?? null,
      source_payload: lead.sourcePayload ?? {},
      is_public: false,
      updated_at: startedAt,
    };
  });
}

function buildPersonEnrichmentClaimRows(seed, canonicalPeople, startedAt, args = {}) {
  const peopleById = new Map(canonicalPeople.map((person) => [person.id, person]));
  const peopleByExternalId = new Map(
    canonicalPeople
      .filter((person) => person.external_id)
      .map((person) => [person.external_id, person]),
  );
  const peopleByNormalizedName = new Map();

  for (const person of canonicalPeople) {
    const normalizedName = normalizeSourcePersonName(person.name);
    const group = peopleByNormalizedName.get(normalizedName) ?? [];
    group.push(person);
    peopleByNormalizedName.set(normalizedName, group);
  }

  return (seed.personEnrichmentClaims ?? [])
    .map((claim) => {
      if (
        claim.sourceId === 'wikidata-person-enrichment' &&
        claim.claimJson?.identityMatch?.status !== 'matched'
      ) {
        return null;
      }

      const candidates = [
        claim.personId ? peopleById.get(claim.personId) : null,
        claim.personExternalId ? peopleByExternalId.get(claim.personExternalId) : null,
        claim.normalizedName && claim.claimJson?.identityMatch?.status === 'matched'
          ? (peopleByNormalizedName.get(claim.normalizedName) ?? [])[0]
          : null,
      ].filter(Boolean);
      const person = candidates[0] ?? null;

      if (!person) {
        return null;
      }

      const sourceType = sourceTypeForSourceId(claim.sourceId);
      const scoring = scoreClaim({
        claimType: claim.claimType,
        sourceType,
        confidenceLevel: claim.confidenceLevel,
        hasMatchedPerson: true,
      });
      const allowAutoPublic =
        claim.visibility === 'public' &&
        claim.reviewStatus === 'verified' &&
        scoring.score >= (args.claimAutoApproveThreshold ?? 90) &&
        !['legal_case', 'family_relation'].includes(claim.claimType);
      const claimValue = toClaimValue(claim.claimValue);
      const claimJson = claim.claimJson ?? {};
      const claimHash = hashId(JSON.stringify({ claimValue, claimJson }));
      const rejectedQids =
        args.rejectedWikidataQidsByPerson?.get(`id:${person.id}`) ??
        args.rejectedWikidataQidsByPerson?.get(`name:${normalizePersonName(person.name)}`) ??
        new Set();
      const wikidataQid = wikidataQidFromClaimJson(claimJson);
      const rejectedWikidataQid = Boolean(wikidataQid && rejectedQids.has(wikidataQid));

      return {
        person_id: person.id,
        source_person_id: null,
        claim_key: claim.claimKey ?? `enrichment:${claim.sourceId}:${person.id}:${claim.claimType}:${claimHash}`,
        claim_type: claim.claimType,
        claim_value: claimValue || null,
        claim_json: {
          ...claimJson,
          personName: claim.personName ?? person.name,
          sourceId: claim.sourceId,
        },
        confidence_level: claim.confidenceLevel,
        review_status: rejectedWikidataQid ? 'rejected' : allowAutoPublic ? 'verified' : 'pending',
        visibility: rejectedWikidataQid ? 'private' : allowAutoPublic ? 'public' : 'review_only',
        source_name: claim.sourceName,
        source_url: claim.sourceUrl,
        observed_at: claim.observedAt ?? startedAt,
        is_public: rejectedWikidataQid ? false : allowAutoPublic,
        review_score: scoring.score,
        scoring_version: rejectedWikidataQid ? 'person-enrichment-skipped-rejection-v1' : reviewScoringVersion,
        scoring_reasons: rejectedWikidataQid
          ? [
              ...scoring.reasons,
              {
                version: 'person-enrichment-skipped-rejection-v1',
                reason: 'Wikidata QID was previously rejected for this person',
              },
            ]
          : scoring.reasons,
        auto_reviewed_at: allowAutoPublic ? startedAt : null,
        updated_at: startedAt,
      };
    })
    .filter((row) => row !== null);
}

function estimatePersonClaimCount(seed) {
  const canonicalCount = (seed.people ?? []).reduce((count, person) => {
    return (
      count +
      ['name', 'alias', 'gender', 'party', 'position', 'district', 'birthDate', 'birthDateText', 'education', 'experience', 'externalId'].filter((field) => {
        const value = field === 'externalId' ? person.externalId : person[field];
        return value && String(value).trim() && String(value).trim() !== 'unknown';
      }).length
    );
  }, 0);

  const sourceOnlyCount = (seed.sourcePeople ?? []).reduce((count, person) => {
    return (
      count +
      ['rawName', 'alias', 'gender', 'party', 'position', 'district', 'birthDate', 'birthDateText', 'externalRecordId'].filter((field) => {
        const value = person[field];
        return value && String(value).trim() && String(value).trim() !== 'unknown';
      }).length
    );
  }, 0);

  return canonicalCount + sourceOnlyCount;
}

async function hideKnownSamplePublicRows(env) {
  const sampleRaceSourceUrls = [
    'https://example.invalid/races/taipei-mayor',
    'https://example.invalid/races/taipei-councilor',
    'https://example.invalid/races/daan-village-chief',
    'https://example.invalid/races/new-taipei-mayor',
  ];

  const sampleCandidateSourceUrls = [
    'https://example.invalid/candidates/test-a',
    'https://example.invalid/candidates/test-b',
  ];

  for (const sourceUrl of sampleCandidateSourceUrls) {
    await supabasePatch(env, 'candidates', { source_url: sourceUrl }, { is_public: false });
  }

  for (const sourceUrl of sampleRaceSourceUrls) {
    await supabasePatch(env, 'races', { source_url: sourceUrl }, { is_public: false });
  }

  await supabasePatch(env, 'elections', { source_url: 'https://example.invalid/ccec/2026-local-election' }, { is_public: false });
  await supabasePatch(env, 'people', { name: '測試人物A' }, { is_public: false });
  await supabasePatch(env, 'people', { name: '測試人物B' }, { is_public: false });
  await supabasePatch(env, 'person_media', { source_url: 'https://example.com/placeholder' }, { is_public: false });
}

async function writeSeed(seed, hash, args) {
  const env = getSupabaseEnv();
  const startedAt = new Date().toISOString();

  await hideKnownSamplePublicRows(env);

  const regionRows = seed.regions.map((region) => {
    return {
      external_id: region.externalId,
      name: region.name,
      slug: region.slug,
      region_type: region.regionType,
      official_code: region.officialCode ?? null,
      map_code: region.mapCode ?? null,
      display_order: region.displayOrder ?? null,
      is_public: true,
      updated_at: startedAt,
      parent_region_id: null,
    };
  });

  for (const region of seed.regions) {
    await supabasePatch(env, 'regions', { slug: region.slug }, { external_id: region.externalId });
  }

  const regions = await upsertOrThrow(env, 'regions', regionRows, { onConflict: 'external_id' });
  const regionByExternalId = new Map(regions.map((region) => [region.external_id, region]));

  const regionsWithParents = seed.regions
    .filter((region) => region.parentExternalId)
    .map((region) => ({
      external_id: region.externalId,
      name: region.name,
      slug: region.slug,
      region_type: region.regionType,
      official_code: region.officialCode ?? null,
      map_code: region.mapCode ?? null,
      display_order: region.displayOrder ?? null,
      is_public: true,
      updated_at: startedAt,
      parent_region_id: regionByExternalId.get(region.parentExternalId)?.id ?? null,
    }));

  await upsertOrThrow(env, 'regions', regionsWithParents, { onConflict: 'external_id' });

  const electionRows = seed.elections.map((election) => {
    const source = getSource(seed, election.sourceId);
    return {
      external_id: election.externalId,
      name: election.name,
      year: election.year,
      election_type: election.electionType,
      voting_date: election.votingDate,
      status: election.status,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  const elections = await upsertOrThrow(env, 'elections', electionRows, { onConflict: 'external_id' });
  const electionByExternalId = new Map(elections.map((election) => [election.external_id, election]));

  const regionRefresh = await selectOrThrow(env, 'regions', 'id,external_id');
  for (const region of regionRefresh) {
    regionByExternalId.set(region.external_id, region);
  }

  const raceRows = seed.races.map((race) => {
    const source = getSource(seed, race.sourceId);
    return {
      external_id: race.externalId,
      election_id: electionByExternalId.get(race.electionExternalId)?.id,
      region_id: race.regionExternalId ? regionByExternalId.get(race.regionExternalId)?.id ?? null : null,
      race_type: race.raceType,
      title: race.title,
      voting_date: race.votingDate,
      status: race.status,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  await upsertOrThrow(env, 'races', raceRows, { onConflict: 'external_id' });

  const raceRefresh = await selectOrThrow(env, 'races', 'id,external_id');
  const raceByExternalId = new Map(raceRefresh.map((race) => [race.external_id, race]));

  const personRows = (seed.people ?? []).map((person) => {
    const source = getSource(seed, person.sourceId);
    return {
      external_id: person.externalId,
      name: person.name,
      alias: person.alias ?? null,
      party: person.party ?? null,
      position: person.position ?? null,
      election_year: person.electionYear ?? null,
      district: person.district ?? null,
      gender: person.gender ?? 'unknown',
      education: person.education ?? null,
      experience: person.experience ?? null,
      source_url: person.sourceUrl ?? source.url,
      is_public: person.isPublic ?? true,
      updated_at: startedAt,
    };
  });

  const people = await upsertOrThrow(env, 'people', personRows, { onConflict: 'external_id' });
  const personByExternalId = new Map(people.map((person) => [person.external_id, person]));
  const peopleRefresh = await selectOrThrow(env, 'people', 'id,external_id,name,party,position,district,gender');

  const companyRows = (seed.companies ?? [])
    .filter((company) => company.unifiedBusinessNo)
    .map((company) => {
      return {
        unified_business_no: company.unifiedBusinessNo,
        name: company.name,
        representative_name: company.representativeName ?? null,
        status: company.status ?? null,
        capital: company.capital ?? null,
        address_region: company.addressRegion ?? null,
        source_url: company.sourceUrl ?? null,
        last_checked_at: startedAt,
        is_public: company.isPublic ?? true,
        updated_at: startedAt,
      };
    });

  const companies = await upsertOrThrow(env, 'companies', companyRows, { onConflict: 'unified_business_no' });
  const companyByUnifiedBusinessNo = new Map(companies.map((company) => [company.unified_business_no, company]));

  const sourcePersonRows = buildSourcePersonRows(seed, startedAt, hash);
  const sourcePeople = await upsertOrThrow(env, 'source_people', sourcePersonRows, { onConflict: 'source_person_key' });
  const sourcePersonByKey = new Map(sourcePeople.map((sourcePerson) => [sourcePerson.source_person_key, sourcePerson]));

  const candidateRows = (seed.candidates ?? []).map((candidate) => {
    const source = getSource(seed, candidate.sourceId);
    return {
      external_id: candidate.externalId,
      person_id: personByExternalId.get(candidate.personExternalId)?.id,
      race_id: raceByExternalId.get(candidate.raceExternalId)?.id,
      party: candidate.party ?? null,
      candidate_no: candidate.candidateNo ?? null,
      registration_status: candidate.registrationStatus ?? 'unknown',
      source_name: source.name,
      source_url: candidate.sourceUrl ?? source.url,
      is_public: candidate.isPublic ?? true,
      updated_at: startedAt,
    };
  });

  await upsertOrThrow(env, 'candidates', candidateRows, { onConflict: 'external_id' });

  const identityMatchRows = buildIdentityMatchRows(seed, sourcePersonByKey, personByExternalId, startedAt);
  await upsertOrThrow(env, 'person_identity_matches', identityMatchRows, { onConflict: 'source_person_id,person_id' });

  const probableIdentityMatchRows = buildProbableIdentityMatchRows(seed, sourcePersonByKey, people, startedAt, args);
  await upsertOrThrow(env, 'person_identity_matches', probableIdentityMatchRows, { onConflict: 'source_person_id,person_id' });

  const autoApprovedPersonBySourceKey = new Map(
    probableIdentityMatchRows
      .filter((match) => match.match_status === 'auto_matched')
      .map((match) => {
        const person = people.find((item) => item.id === match.person_id);
        const sourcePerson = sourcePeople.find((item) => item.id === match.source_person_id);
        return sourcePerson && person ? [sourcePerson.source_person_key, person] : null;
      })
      .filter((item) => item !== null),
  );

  const existingPersonClaimReviewStates = await fetchExistingPersonClaimReviewStates(env);
  const personClaimRows = preserveReviewedPersonClaimRows(
    buildPersonClaimRows(seed, sourcePersonByKey, personByExternalId, startedAt, autoApprovedPersonBySourceKey, args),
    existingPersonClaimReviewStates,
  );
  await upsertOrThrow(env, 'person_claims', personClaimRows, { onConflict: 'claim_key' });

  const personEnrichmentClaimRows = preserveReviewedPersonClaimRows(
    buildPersonEnrichmentClaimRows(seed, peopleRefresh, startedAt, args),
    existingPersonClaimReviewStates,
  );
  await upsertOrThrow(env, 'person_claims', personEnrichmentClaimRows, { onConflict: 'claim_key' });
  args.appliedSkippedWikidataRejections = await applySkippedWikidataRejections(env, args, startedAt);
  args.appliedExistingWikidataTerminalReviewStates = await applyExistingWikidataTerminalReviewStates(env, startedAt);

  const legalRecordLeadRows = buildLegalRecordLeadRows(seed, peopleRefresh, startedAt);
  await upsertOrThrow(env, 'legal_record_leads', legalRecordLeadRows, { onConflict: 'lead_key' });

  const partyRows = seed.parties.map((party) => {
    const source = getSource(seed, party.sourceId);
    return {
      external_id: party.externalId,
      name: party.name,
      short_name: party.shortName ?? null,
      slug: party.slug,
      theme_key: party.themeKey,
      official_site_url: party.officialSiteUrl ?? null,
      chairperson_name: party.chairpersonName ?? null,
      registry_no: party.registryNo ?? null,
      founded_date_text: party.foundedDateText ?? null,
      filed_date_text: party.filedDateText ?? null,
      headquarters_address: party.headquartersAddress ?? null,
      contact_phone: party.contactPhone ?? null,
      status: party.status,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  const parties = await upsertOrThrow(env, 'parties', partyRows, { onConflict: 'external_id' });
  const partyByExternalId = new Map(parties.map((party) => [party.external_id, party]));

  const financeRows = (seed.partyFinanceSummaries ?? []).map((summary) => {
    const party = partyByExternalId.get(summary.partyExternalId);
    const source = getSource(seed, summary.sourceId);
    return {
      party_id: party?.id,
      report_year: summary.reportYear,
      income_total: summary.incomeTotal ?? 0,
      expense_total: summary.expenseTotal ?? 0,
      balance_amount: summary.balanceAmount ?? 0,
      individual_donation_total: summary.individualDonationTotal ?? 0,
      business_donation_total: summary.businessDonationTotal ?? 0,
      civil_group_donation_total: summary.civilGroupDonationTotal ?? 0,
      anonymous_donation_total: summary.anonymousDonationTotal ?? 0,
      other_income_total: summary.otherIncomeTotal ?? 0,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  await upsertOrThrow(env, 'party_finance_summaries', financeRows, { onConflict: 'party_id,report_year' });

  const companyContributionRows = (seed.partyCompanyContributionSummaries ?? [])
    .map((summary) => {
      const party = partyByExternalId.get(summary.partyExternalId);
      const company = companyByUnifiedBusinessNo.get(summary.companyUnifiedBusinessNo);
      const source = getSource(seed, summary.sourceId);

      if (!party || !company) {
        return null;
      }

      return {
        party_id: party.id,
        company_id: company.id,
        report_year: summary.reportYear,
        amount_total: summary.amountTotal ?? 0,
        donation_count: summary.donationCount ?? 0,
        confidence_level: summary.confidenceLevel ?? 'A',
        source_name: source.name,
        source_url: summary.sourceUrl ?? source.url,
        reviewed_at: startedAt,
        is_public: true,
        updated_at: startedAt,
      };
    })
    .filter((row) => row !== null);

  await upsertOrThrow(env, 'party_company_contribution_summaries', companyContributionRows, {
    onConflict: 'party_id,company_id,report_year',
  });

  if (args.recordRun) {
    await upsertOrThrow(
      env,
      'data_sync_runs',
      [
        {
          sync_name: 'real-public-data-foundation',
          mode: args.write ? 'write' : 'dry-run',
          status: 'ok',
          source_hash: hash,
          source_count:
            seed.regions.length +
            seed.elections.length +
            seed.races.length +
            (seed.people?.length ?? 0) +
            sourcePersonRows.length +
            identityMatchRows.length +
            probableIdentityMatchRows.length +
            personClaimRows.length +
            personEnrichmentClaimRows.length +
            legalRecordLeadRows.length +
            (seed.candidates?.length ?? 0) +
            seed.parties.length +
            financeRows.length +
            companyRows.length +
            companyContributionRows.length,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          report_json: buildReport(
            seed,
            hash,
            args,
            args.livePartyRegistry,
            args.liveCurrentOfficeholders,
            args.liveCecCandidates,
            args.historicalCecSourcePeople,
            args.plannedLocalElections,
            args.livePartyFinanceSummaries,
            args.legalRecordLeads,
            args.personEnrichmentClaims,
          ),
        },
      ],
    );
  }
}

function buildReport(
  seed,
  hash,
  args,
  livePartyRegistry,
  liveCurrentOfficeholders,
  liveCecCandidates,
  historicalCecSourcePeople,
  plannedLocalElections,
  livePartyFinanceSummaries,
  legalRecordLeads,
  personEnrichmentClaims,
) {
  return {
    syncName: 'real-public-data-foundation',
    mode: args.write ? 'write' : 'dry-run',
    cadence: args.mode,
    sourceHash: hash,
    counts: {
      sources: seed.sources.length,
      regions: seed.regions.length,
      elections: seed.elections.length,
      races: seed.races.length,
      people: seed.people?.length ?? 0,
      historicalSourcePeople: seed.sourcePeople?.length ?? 0,
      sourcePeople: (seed.people?.length ?? 0) + (seed.sourcePeople?.length ?? 0),
      autoIdentityMatches: seed.people?.length ?? 0,
      probableIdentityMatches: 'computed-on-write',
      personClaimsEstimate: estimatePersonClaimCount(seed),
      personEnrichmentClaims: seed.personEnrichmentClaims?.length ?? 0,
      legalRecordLeads: seed.legalRecordLeads?.length ?? 0,
      candidates: seed.candidates?.length ?? 0,
      parties: seed.parties.length,
      partyFinanceSummaries: seed.partyFinanceSummaries?.length ?? 0,
      partyCompanyContributionSummaries: seed.partyCompanyContributionSummaries?.length ?? 0,
      companies: seed.companies?.length ?? 0,
    },
    livePartyRegistry,
    liveCurrentOfficeholders,
    liveCecCandidates,
    historicalCecSourcePeople,
    plannedLocalElections,
    livePartyFinanceSummaries,
    legalRecordLeads,
    personEnrichmentClaims,
    skipped: {
      personalDonationDetails: true,
      rawContributionRows: true,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const { seed: baseSeed } = readSeed(args.seedPath);
  const partyEnriched = await enrichSeedWithLivePartyRegistry(baseSeed, args);
  const officeholderEnriched = await enrichSeedWithLiveCurrentOfficeholders(partyEnriched.seed, args);
  const candidateEnriched = await enrichSeedWithLiveCecCandidates(officeholderEnriched.seed, args);
  const historicalCecEnriched = await enrichSeedWithHistoricalCecSourcePeople(candidateEnriched.seed, args);
  const plannedElectionEnriched = enrichSeedWithPlannedLocalElections(historicalCecEnriched.seed);
  const financeEnriched = await enrichSeedWithLivePartyFinanceSummaries(plannedElectionEnriched.seed, args);
  const personEnrichmentEnriched = enrichSeedWithPersonEnrichmentClaims(financeEnriched.seed, args);
  const legalEnriched = enrichSeedWithLegalRecordLeads(personEnrichmentEnriched.seed, args);
  const seed = legalEnriched.seed;
  const hash = crypto.createHash('sha256').update(JSON.stringify(seed)).digest('hex');
  validateSeed(seed);

  const report = buildReport(
    seed,
    hash,
    args,
    partyEnriched.livePartyRegistry,
    officeholderEnriched.liveCurrentOfficeholders,
    candidateEnriched.liveCecCandidates,
    historicalCecEnriched.historicalCecSourcePeople,
    plannedElectionEnriched.plannedLocalElections,
    financeEnriched.livePartyFinanceSummaries,
    legalEnriched.legalRecordLeads,
    personEnrichmentEnriched.personEnrichmentClaims,
  );
  args.livePartyRegistry = partyEnriched.livePartyRegistry;
  args.liveCurrentOfficeholders = officeholderEnriched.liveCurrentOfficeholders;
  args.liveCecCandidates = candidateEnriched.liveCecCandidates;
  args.historicalCecSourcePeople = historicalCecEnriched.historicalCecSourcePeople;
  args.plannedLocalElections = plannedElectionEnriched.plannedLocalElections;
  args.livePartyFinanceSummaries = financeEnriched.livePartyFinanceSummaries;
  args.legalRecordLeads = legalEnriched.legalRecordLeads;
  args.personEnrichmentClaims = personEnrichmentEnriched.personEnrichmentClaims;
  args.rejectedWikidataQidsByPerson = loadRejectedWikidataQidsByPerson(args.personEnrichmentSkippedPath);

  if (args.write) {
    await writeSeed(seed, hash, args);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`real public data sync failed: ${message}`);
  process.exit(1);
});
