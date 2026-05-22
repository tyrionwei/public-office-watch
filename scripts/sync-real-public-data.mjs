import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'real-public-data.seed.json');

function parseArgs(argv) {
  const args = {
    seedPath: defaultSeedPath,
    write: false,
    recordRun: false,
    mode: 'weekly',
    skipLiveFetch: false,
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

    if (arg === '--daily' || arg === '--weekly') {
      args.mode = arg.slice(2);
      continue;
    }

    if (arg === '--seed') {
      args.seedPath = path.resolve(argv[index + 1] ?? '');
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

function parseAmount(value) {
  const normalized = String(value ?? '').replaceAll(',', '').trim();
  const amount = Number.parseFloat(normalized);

  return Number.isFinite(amount) ? amount : 0;
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
  if (sourceId.includes('moi')) return 'government_open_data';
  return 'other';
}

function confidenceForSourceId(sourceId) {
  return sourceTypeForSourceId(sourceId).startsWith('official') || sourceTypeForSourceId(sourceId) === 'government_open_data'
    ? 'A'
    : 'D';
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
        return {
          externalId: `ly-legislator-${term}-${legislatorCode || hashId([name, party, areaName, onboardDate].join('|'))}`,
          name,
          alias: pickField(row, ['ename']) || null,
          gender: normalizeGender(pickField(row, ['sex'])),
          party,
          position: `第${term}屆立法委員`,
          electionYear: 2024,
          district: areaName,
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

    if (summaries.length === 0) {
      throw new Error('Political contribution ZIP parsed successfully but no party summaries matched current parties.');
    }

    return {
      seed: {
        ...seed,
        partyFinanceSummaries: summaries,
      },
      livePartyFinanceSummaries: {
        status: 'ok',
        count: summaries.length,
        sourceRowCount: Math.max(0, financeRows.length),
        url: source.downloadUrl,
        privacyBoundary: 'party-level annual summaries only; detail income/expenditure rows are not written',
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

function getSource(seed, sourceId) {
  const source = seed.sources.find((item) => item.id === sourceId);

  if (!source) {
    throw new Error(`Missing source metadata: ${sourceId}`);
  }

  return source;
}

function validateSeed(seed) {
  const sourceIds = new Set(seed.sources.map((source) => source.id));
  const regionIds = new Set(seed.regions.map((region) => region.externalId));
  const electionIds = new Set(seed.elections.map((election) => election.externalId));
  const raceIds = new Set(seed.races.map((race) => race.externalId));
  const personIds = new Set((seed.people ?? []).map((person) => person.externalId));
  const partyIds = new Set(seed.parties.map((party) => party.externalId));

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
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error('Writing requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url: url.replace(/\/$/, ''), serviceKey };
}

async function supabaseRequest(env, table, { method = 'GET', rows, onConflict, select } = {}) {
  const url = new URL(`${env.url}/rest/v1/${table}`);

  if (onConflict) {
    url.searchParams.set('on_conflict', onConflict);
  }

  if (select) {
    url.searchParams.set('select', select);
  }

  const headers = {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
  };

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

function buildSourcePersonRows(seed, startedAt, ingestBatchKey) {
  return (seed.people ?? []).map((person) => {
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

function toClaimValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildPersonClaimRows(seed, sourcePersonByKey, personByExternalId, startedAt) {
  const rows = [];

  for (const person of seed.people ?? []) {
    const source = getSource(seed, person.sourceId);
    const sourcePerson = sourcePersonByKey.get(sourcePersonKeyFor(person));
    const canonicalPerson = personByExternalId.get(person.externalId);

    if (!sourcePerson || !canonicalPerson) {
      continue;
    }

    const confidence = confidenceForSourceId(person.sourceId);
    const base = {
      person_id: canonicalPerson.id,
      source_person_id: sourcePerson.id,
      confidence_level: confidence,
      review_status: confidence === 'A' ? 'verified' : 'pending',
      visibility: confidence === 'A' ? 'public' : 'review_only',
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
      ['education', person.education],
      ['experience', person.experience],
      ['external_id', person.externalId],
    ];

    for (const [claimType, rawValue] of claims) {
      const value = toClaimValue(rawValue);

      if (!value || value === 'unknown') {
        continue;
      }

      rows.push({
        ...base,
        claim_key: `${sourcePersonKeyFor(person)}:${claimType}:${hashId(value)}`,
        claim_type: claimType,
        claim_value: value,
        claim_json: {
          value,
          personExternalId: person.externalId,
          sourcePersonKey: sourcePersonKeyFor(person),
        },
      });
    }
  }

  return rows;
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

  const personClaimRows = buildPersonClaimRows(seed, sourcePersonByKey, personByExternalId, startedAt);
  await upsertOrThrow(env, 'person_claims', personClaimRows, { onConflict: 'claim_key' });

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
            personClaimRows.length +
            (seed.candidates?.length ?? 0) +
            seed.parties.length +
            financeRows.length,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          report_json: buildReport(
            seed,
            hash,
            args,
            args.livePartyRegistry,
            args.liveCurrentOfficeholders,
            args.liveCecCandidates,
            args.plannedLocalElections,
            args.livePartyFinanceSummaries,
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
  plannedLocalElections,
  livePartyFinanceSummaries,
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
      sourcePeople: seed.people?.length ?? 0,
      autoIdentityMatches: seed.people?.length ?? 0,
      personClaimsEstimate: (seed.people ?? []).reduce((count, person) => {
        return (
          count +
          ['name', 'alias', 'gender', 'party', 'position', 'district', 'education', 'experience', 'externalId'].filter((field) => {
            const value = field === 'externalId' ? person.externalId : person[field];
            return value && String(value).trim() && String(value).trim() !== 'unknown';
          }).length
        );
      }, 0),
      candidates: seed.candidates?.length ?? 0,
      parties: seed.parties.length,
      partyFinanceSummaries: seed.partyFinanceSummaries?.length ?? 0,
      partyCompanyContributionSummaries: seed.partyCompanyContributionSummaries?.length ?? 0,
    },
    livePartyRegistry,
    liveCurrentOfficeholders,
    liveCecCandidates,
    plannedLocalElections,
    livePartyFinanceSummaries,
    skipped: {
      personalDonationDetails: true,
      companyContributionSummaries: 'requires later review flow before publication',
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const { seed: baseSeed } = readSeed(args.seedPath);
  const partyEnriched = await enrichSeedWithLivePartyRegistry(baseSeed, args);
  const officeholderEnriched = await enrichSeedWithLiveCurrentOfficeholders(partyEnriched.seed, args);
  const candidateEnriched = await enrichSeedWithLiveCecCandidates(officeholderEnriched.seed, args);
  const plannedElectionEnriched = enrichSeedWithPlannedLocalElections(candidateEnriched.seed);
  const financeEnriched = await enrichSeedWithLivePartyFinanceSummaries(plannedElectionEnriched.seed, args);
  const seed = financeEnriched.seed;
  const hash = crypto.createHash('sha256').update(JSON.stringify(seed)).digest('hex');
  validateSeed(seed);

  const report = buildReport(
    seed,
    hash,
    args,
    partyEnriched.livePartyRegistry,
    officeholderEnriched.liveCurrentOfficeholders,
    candidateEnriched.liveCecCandidates,
    plannedElectionEnriched.plannedLocalElections,
    financeEnriched.livePartyFinanceSummaries,
  );
  args.livePartyRegistry = partyEnriched.livePartyRegistry;
  args.liveCurrentOfficeholders = officeholderEnriched.liveCurrentOfficeholders;
  args.liveCecCandidates = candidateEnriched.liveCecCandidates;
  args.plannedLocalElections = plannedElectionEnriched.plannedLocalElections;
  args.livePartyFinanceSummaries = financeEnriched.livePartyFinanceSummaries;

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
