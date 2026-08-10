import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(repoRoot, 'data-sources', 'cec-elected-executives-1994-2014.json');
const coveragePath = path.join(repoRoot, 'data-sources', 'cec-elected-executive-identity-coverage.json');
const foundationPath = path.join(repoRoot, 'data-sources', 'real-public-data.seed.json');
const outputPath = path.join(
  repoRoot,
  'data-sources',
  'cec-elected-executive-election-history-1994-2014.seed.json',
);

const SOURCE_ID = 'cec-election-database';
const PRESIDENTIAL_TERM = new Map([
  [1996, 9],
  [2000, 10],
  [2004, 11],
  [2008, 12],
  [2012, 13],
]);

// These are the same public person appearing in several election-year imports.
// Selecting a canonical record here does not merge or delete the other records.
const AMBIGUOUS_SELECTIONS = new Map([
  ['吳俊立', 'cec-2012-person-a52c5a01cc19'],
  ['李進勇', 'votetw-person-b6955d5dabdcb14d'],
  ['林右昌', 'votetw-person-3bb6ce301b13939c'],
  ['林佳龍', 'cec-2022-local-mayor-person-c718c9883a0e'],
  ['林明溱', 'votetw-person-a887575123097ff2'],
  ['林智堅', 'votetw-person-195864e56632ff21'],
  ['徐耀昌', 'votetw-person-f2a3bc775081685c'],
  ['陳福海', 'cec-2022-local-mayor-person-1a37920d575e'],
  ['黃敏惠', 'votetw-person-050c1cb8f8324450'],
  ['潘孟安', 'votetw-person-94b5386e3d1ba0ae'],
  ['鄭文燦', 'votetw-person-4c6063d5aedf97b7'],
  ['賴清德', 'votetw-person-dfa78bb8c53fc15c'],
  ['魏明谷', 'votetw-person-e6d7cb8755d91e02'],
  ['蘇煥智', 'cec-2022-local-mayor-person-078a934fe9ed'],
]);

const EXISTING_CANDIDATE_IDS = new Map([
  ['2012:president:馬英九', 'cec-historical-candidate-fbeb0a876fdaa402'],
  ['2012:vice_president:吳敦義', 'cec-historical-candidate-f5c641156009efc0'],
]);

function stableId(prefix, value, length = 16) {
  return `${prefix}-${crypto.createHash('sha256').update(value).digest('hex').slice(0, length)}`;
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('台', '臺').replace(/\s+/g, '').trim();
}

function latestRecord(records) {
  return [...records].sort((left, right) =>
    right.electionYear - left.electionYear || right.votingDate.localeCompare(left.votingDate))[0];
}

function historicalExperience(records) {
  return [...records]
    .sort((left, right) => left.electionYear - right.electionYear || left.officeName.localeCompare(right.officeName))
    .map((record) => `${record.electionYear}年${record.officeName}當選`)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join('、');
}

function electionGroupKey(record) {
  return `${record.electionType}:${record.votingDate}`;
}

function electionExternalId(records) {
  const first = records[0];
  if (first.electionType === 'president' && first.electionYear === 2012) {
    return 'cec-2012-president-vice-president';
  }
  return stableId('cec-elected-executive-election', electionGroupKey(first));
}

function electionName(records) {
  const first = records[0];
  if (first.electionType === 'president') {
    return `${first.electionYear}年第${PRESIDENTIAL_TERM.get(first.electionYear)}任總統副總統選舉`;
  }
  const regions = new Set(records.map((record) => record.historicalRegionName));
  const directCitiesOnly = [...regions].every((region) => ['臺北市', '高雄市'].includes(region));
  if (first.electionYear === 2010) return '2010年直轄市長選舉';
  if (first.electionYear === 2014) return '2014年直轄市及縣市長選舉';
  return `${first.electionYear}年${directCitiesOnly ? '直轄市長' : '縣市長'}選舉`;
}

function raceExternalId(record) {
  if (record.electionType === 'president' && record.electionYear === 2012) {
    return 'cec-2012-president-national';
  }
  if (record.electionType === 'president') {
    return stableId('cec-elected-executive-race', `${record.electionYear}:president:national`);
  }
  return stableId(
    'cec-elected-executive-race',
    `${record.votingDate}:${record.historicalRegionName}:${record.officeName}`,
  );
}

function localRaceType(record) {
  const directCityYears = new Set([1994, 1998, 2002, 2006]);
  if (directCityYears.has(record.electionYear) && ['臺北市', '高雄市'].includes(record.historicalRegionName)) {
    return 'municipality_mayor';
  }
  if (record.electionYear === 2010) return 'municipality_mayor';
  if (
    record.electionYear === 2014 &&
    ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市'].includes(record.canonicalRegionName)
  ) {
    return 'municipality_mayor';
  }
  return 'county_mayor';
}

function candidateExternalId(record) {
  const existing = EXISTING_CANDIDATE_IDS.get(`${record.electionYear}:${record.officeRole}:${record.name}`);
  if (existing) return existing;
  return stableId(
    'cec-elected-executive-candidate',
    `${record.votingDate}:${record.officeRole}:${record.historicalRegionName}:${record.name}:${record.candidateNo}`,
  );
}

function toCanonicalPerson(entry) {
  const records = entry.sourceRecords;
  const latest = latestRecord(records);
  let match = null;
  if (entry.resolution === 'unique_match') {
    match = entry.matches[0];
  } else if (entry.resolution === 'ambiguous_match') {
    const selectedExternalId = AMBIGUOUS_SELECTIONS.get(entry.name);
    match = entry.matches.find((candidate) => candidate.external_id === selectedExternalId) ?? null;
    if (!match) throw new Error(`Missing reviewed ambiguous selection for ${entry.name}.`);
  }

  const externalId = match?.external_id ?? stableId(
    'cec-elected-executive-person',
    `${entry.normalizedName}:${records.find((record) => record.birthDate)?.birthDate ?? ''}`,
  );
  const birth = records.find((record) => record.birthDate);
  const education = [...records].reverse().find((record) => record.educationLevel)?.educationLevel ?? null;
  const isNew = !match || externalId.startsWith('cec-elected-executive-person-');

  return {
    externalId,
    sourceId: SOURCE_ID,
    name: entry.name,
    alias: match?.alias ?? null,
    party: match?.party ?? null,
    position: match?.position ?? `曾任${latest.officeName}`,
    electionYear: match?.election_year ?? latest.electionYear,
    district: match?.district ?? (latest.canonicalRegionName || latest.historicalRegionName),
    gender: match?.gender && match.gender !== 'unknown' ? match.gender : entry.sourceGender,
    birthDate: birth?.birthDatePrecision === 'day' ? birth.birthDate : null,
    birthDateText: birth?.birthDate ?? null,
    education: match?.education ?? education,
    experience: match?.experience ?? historicalExperience(records),
    sourceUrl: match?.source_url ?? latest.sourceUrl,
    isPublic: true,
    confidenceSuggestion: 'A',
    sourcePayload: {
      identityResolution: isNew ? 'created_from_official_elected_record' : entry.resolution,
      identitySelection: isNew ? 'new_person_from_official_elected_record' : match.external_id,
      currentStatusPolicy: isNew
        ? 'Historical elected office is stored as 曾任; this source does not assert current incumbency.'
        : 'Existing canonical current-status fields are preserved.',
      officeHistory: [...records]
        .sort((left, right) => left.electionYear - right.electionYear)
        .map((record) => ({
          electionYear: record.electionYear,
          votingDate: record.votingDate,
          officeRole: record.officeRole,
          officeName: record.officeName,
          historicalRegionName: record.historicalRegionName,
          partyAtElection: record.party,
          wasIncumbentAtElection: record.wasIncumbentAtElection,
          voteCount: record.voteCount,
          voteRate: record.voteRate,
        })),
    },
  };
}

function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const foundation = JSON.parse(fs.readFileSync(foundationPath, 'utf8'));
  const regionByName = new Map(foundation.regions.map((region) => [normalize(region.name), region]));

  const people = coverage.entries.map(toCanonicalPerson);
  const personExternalIdByName = new Map(people.map((person) => [normalize(person.name), person.externalId]));

  const groups = new Map();
  for (const record of source.records) {
    const key = electionGroupKey(record);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const elections = [...groups.values()].map((records) => ({
    externalId: electionExternalId(records),
    sourceId: SOURCE_ID,
    name: electionName(records),
    year: records[0].electionYear,
    electionType: records[0].electionType === 'president' ? 'presidential' : 'local',
    votingDate: records[0].votingDate,
    status: 'completed',
  }));
  const electionExternalIdByGroup = new Map(
    [...groups.entries()].map(([key, records]) => [key, electionExternalId(records)]),
  );

  const raceByExternalId = new Map();
  for (const record of source.records) {
    const externalId = raceExternalId(record);
    if (raceByExternalId.has(externalId)) continue;
    const region = record.electionType === 'president'
      ? regionByName.get(normalize('臺灣'))
      : regionByName.get(normalize(record.canonicalRegionName));
    if (!region) throw new Error(`Missing canonical region for ${record.officeName}.`);
    raceByExternalId.set(externalId, {
      externalId,
      sourceId: SOURCE_ID,
      electionExternalId: electionExternalIdByGroup.get(electionGroupKey(record)),
      regionExternalId: region.externalId,
      raceType: record.electionType === 'president' ? 'president' : localRaceType(record),
      title: record.electionType === 'president'
        ? '總統副總統全國選舉'
        : `${record.historicalRegionName}${record.officeName.endsWith('縣長') ? '縣長' : '市長'}選舉`,
      votingDate: record.votingDate,
      status: 'completed',
    });
  }

  const candidates = source.records.map((record) => ({
    externalId: candidateExternalId(record),
    sourceId: SOURCE_ID,
    personExternalId: personExternalIdByName.get(normalize(record.name)),
    raceExternalId: raceExternalId(record),
    party: record.party,
    candidateNo: Number(record.candidateNo),
    registrationStatus: 'elected',
    voteCount: record.voteCount,
    voteRate: record.voteRate,
    isElected: true,
    isIncumbent: record.wasIncumbentAtElection,
    sourceUrl: record.sourceUrl,
    sourcePayload: {
      ticketRole: record.officeRole,
      officeName: record.officeName,
      historicalRegionName: record.historicalRegionName,
      canonicalRegionName: record.canonicalRegionName,
      partyAtElection: record.party,
      wasIncumbentAtElection: record.wasIncumbentAtElection,
      sourceArchivePath: record.sourceArchivePath,
    },
  }));

  const sourcePeople = source.records.map((record) => {
    const personExternalId = personExternalIdByName.get(normalize(record.name));
    const recordId = `${record.votingDate}:${record.officeRole}:${record.historicalRegionName}:${record.name}`;
    return {
      sourcePersonKey: `${SOURCE_ID}:${stableId('elected-executive-record', recordId)}`,
      sourceId: SOURCE_ID,
      sourceName: record.sourceName,
      sourceUrl: record.sourceUrl,
      rawName: record.name,
      gender: record.gender,
      party: record.party,
      position: record.officeName,
      district: record.canonicalRegionName || record.historicalRegionName,
      electionYear: record.electionYear,
      birthDate: record.birthDatePrecision === 'day' ? record.birthDate : null,
      birthDateText: record.birthDate,
      externalPersonId: personExternalId,
      externalRecordId: recordId,
      confidenceSuggestion: 'A',
      isPublic: true,
      sourcePayload: {
        ticketRole: record.officeRole,
        raceExternalId: raceExternalId(record),
        candidateNo: Number(record.candidateNo),
        voteCount: record.voteCount,
        voteRate: record.voteRate,
        elected: true,
        incumbentAtElection: record.wasIncumbentAtElection,
        historicalRegionName: record.historicalRegionName,
        canonicalRegionName: record.canonicalRegionName,
        sourceArchivePath: record.sourceArchivePath,
      },
    };
  });

  const requiredRegionNames = new Set([
    '臺灣',
    ...source.records.filter((record) => record.canonicalRegionName).map((record) => record.canonicalRegionName),
  ].map(normalize));
  const regions = foundation.regions.filter((region) => requiredRegionNames.has(normalize(region.name)));

  const output = {
    schemaVersion: 1,
    name: 'cec-elected-executive-election-history-1994-2014',
    generatedAt: new Date().toISOString(),
    notes: [
      '只收錄中選會公開資料中的當選正副總統與直轄市／縣市長。',
      '候選人黨籍與 isIncumbent 僅代表該次選舉當時狀態，不代表目前黨籍或現任職務。',
      '新建歷史人物一律使用「曾任」職稱；既有人物完整保留現行 canonical 欄位。',
    ],
    sources: [
      ...foundation.sources,
      {
        id: SOURCE_ID,
        type: 'official-election-result',
        name: source.source.name,
        url: source.source.url,
        downloadUrl: source.source.rawSourceUrl,
        license: '政府資料開放授權條款第1版',
        refreshCadence: 'manual',
        notes: '官方當選名單、候選人基本欄位與得票資料。',
      },
    ],
    summary: {
      sourceRecordCount: source.records.length,
      personCount: people.length,
      existingUniquePersonCount: people.filter((person) =>
        person.sourcePayload.identityResolution === 'unique_match').length,
      reviewedAmbiguousPersonCount: people.filter((person) =>
        person.sourcePayload.identityResolution === 'ambiguous_match').length,
      newHistoricalPersonCount: people.filter((person) =>
        person.sourcePayload.identityResolution === 'created_from_official_elected_record').length,
      electionCount: elections.length,
      raceCount: raceByExternalId.size,
      candidateCount: candidates.length,
    },
    regions,
    elections,
    races: [...raceByExternalId.values()],
    parties: [],
    people,
    sourcePeople,
    candidates,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...output.summary }, null, 2));
}

main();
