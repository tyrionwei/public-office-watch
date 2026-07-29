import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'data-sources', 'tnl-dark-guide');
const defaultOutputPath = path.join(dataDir, 'coverage-report.json');

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = separator >= 0 ? line.slice(0, separator).trim() : line;
        const value = separator >= 0
          ? line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
          : '';
        return [key, value];
      }),
  );
}

function parseArgs(argv) {
  const options = { outputPath: defaultOutputPath };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${argv[index]}`);
  }

  return options;
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim()
  || localEnv.SUPABASE_URL
  || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function restUrl(tableName) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(tableName, select) {
  const rows = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const url = restUrl(tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    }

    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/[\s　·．・‧,，.。()（）\[\]【】]/g, '')
    .toLowerCase();
}

function normalizeName(value) {
  return normalizeText(value).replace(/[^\p{Script=Han}a-z0-9]/gu, '');
}

function normalizeHanName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/臺/g, '台')
    .replace(/羣/g, '群')
    .replace(/黄/g, '黃')
    .match(/\p{Script=Han}+/gu)
    ?.join('') ?? '';
}

function normalizeParty(value) {
  const party = normalizeText(value)
    .replace(/台灣民眾黨/g, '民眾黨')
    .replace(/台灣基進/g, '基進黨')
    .replace(/無黨籍及未經政黨推薦/g, '無黨籍')
    .replace(/無歐巴桑聯盟/g, '小民參政歐巴桑聯盟');
  return party || '未知';
}

function cityCodeForText(value) {
  const text = normalizeText(value);
  if (text.includes('台北')) return 'tpe';
  if (text.includes('新北')) return 'nwt';
  if (text.includes('桃園')) return 'tao';
  if (text.includes('台中')) return 'txg';
  if (text.includes('台南')) return 'tnn';
  if (text.includes('高雄')) return 'khh';
  return null;
}

function chineseNumber(value) {
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === '十') return 10;
  if (value.includes('十')) {
    const [left, right] = value.split('十');
    return (left ? digits[left] : 1) * 10 + (right ? digits[right] : 0);
  }
  return digits[value] ?? null;
}

function districtNumber(value) {
  const text = String(value ?? '').normalize('NFKC');
  const match = text.match(/第\s*([一二三四五六七八九十\d]+)\s*(?:選舉)?區/);
  return match ? chineseNumber(match[1]) : null;
}

function semanticRaceType(value) {
  if (['city_councilor', 'county_councilor', 'councilor_district'].includes(value)) return 'councilor';
  if (['municipality_mayor', 'county_mayor', 'local_chief'].includes(value)) return 'local_chief';
  return value ?? 'unknown';
}

function compactCandidate(row) {
  return {
    candidateId: row.candidateId,
    personId: row.personId,
    canonicalPersonId: row.canonicalPersonId,
    name: row.name,
    year: row.year,
    cityCode: row.cityCode,
    area: row.area,
    raceType: row.raceType,
    party: row.party,
    candidateNumber: row.candidateNumber,
    raceTitle: row.raceTitle,
    sourceName: row.sourceName,
  };
}

function compactGuide(row) {
  return {
    id: row.id,
    year: row.year,
    city: row.city,
    cityCode: row.cityCode,
    area: row.area,
    districtLabel: row.districtLabel,
    name: row.name,
    party: row.party,
    candidateNumber: row.number ?? null,
    pageUrl: row.pageUrl,
  };
}

function uniqueBy(rows, keyFor) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFor(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function historicalContextKey(row) {
  const identity = row.candidateNumber
    ? `number:${row.candidateNumber}`
    : `name:${normalizeHanName(row.name) || normalizeName(row.name)}`;
  return [row.year, row.cityCode, row.area, identity].join('|');
}

function matchGuideCandidate(guide, historicalRows) {
  const name = normalizeName(guide.name);
  const hanName = normalizeHanName(guide.name);
  const sameContext = historicalRows.filter((row) => (
    row.year === guide.year
    && row.cityCode === guide.cityCode
    && row.area === guide.area
  ));
  let candidates = guide.number
    ? sameContext.filter((row) => row.candidateNumber === String(guide.number))
    : sameContext.filter((row) => (
      normalizeName(row.name) === name
      || (hanName && normalizeHanName(row.name) === hanName)
    ));
  let matchLevel = guide.number ? 'year_city_area_number' : 'year_city_area_name';

  if (candidates.length === 0) {
    candidates = historicalRows.filter((row) => (
      row.year === guide.year
      && row.cityCode === guide.cityCode
      && (
        normalizeName(row.name) === name
        || (hanName && normalizeHanName(row.name) === hanName)
      )
    ));
    matchLevel = 'year_city_name';
  }

  if (candidates.length > 1) {
    const sameParty = candidates.filter((row) => normalizeParty(row.party) === normalizeParty(guide.party));
    if (sameParty.length > 0) {
      candidates = sameParty;
      matchLevel += '_party';
    }
  }

  const canonicalIds = new Set(candidates.map((row) => row.canonicalPersonId));
  if (candidates.length > 0) {
    return {
      status: 'matched',
      matchLevel,
      candidates,
      identityConflict: canonicalIds.size > 1,
    };
  }
  return { status: 'missing', matchLevel: null, candidates: [] };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment or .env.local');
  }

  const options = parseArgs(process.argv.slice(2));
  const guide2018 = JSON.parse(fs.readFileSync(path.join(dataDir, 'tnl-dark-guide-2018.json'), 'utf8'));
  const guide2022 = JSON.parse(fs.readFileSync(path.join(dataDir, 'tnl-dark-guide-2022.json'), 'utf8'));
  const guideRows = [...guide2018.candidates, ...guide2022.candidates];

  const [elections, races, candidates, people, regions, canonicalMap] = await Promise.all([
    fetchRows('elections', 'id,external_id,name,year,election_type,source_name'),
    fetchRows('races', 'id,external_id,election_id,region_id,race_type,title,source_name'),
    fetchRows('candidates', 'id,external_id,person_id,race_id,party,candidate_no,registration_status,source_name,is_public'),
    fetchRows('people', 'id,external_id,name,party,is_public'),
    fetchRows('regions', 'id,external_id,name,region_type,parent_region_id'),
    fetchRows('person_canonical_map', 'person_id,canonical_person_id'),
  ]);

  const electionById = new Map(elections.map((row) => [row.id, row]));
  const raceById = new Map(races.map((row) => [row.id, row]));
  const personById = new Map(people.map((row) => [row.id, row]));
  const regionById = new Map(regions.map((row) => [row.id, row]));
  const canonicalByPersonId = new Map(canonicalMap.map((row) => [row.person_id, row.canonical_person_id]));

  const regionLineage = (regionId) => {
    const rows = [];
    const visited = new Set();
    let current = regionById.get(regionId);
    while (current && !visited.has(current.id)) {
      rows.push(current);
      visited.add(current.id);
      current = regionById.get(current.parent_region_id);
    }
    return rows;
  };

  const databaseRows = candidates.map((candidate) => {
    const race = raceById.get(candidate.race_id);
    const election = electionById.get(race?.election_id);
    const person = personById.get(candidate.person_id);
    const canonicalPersonId = canonicalByPersonId.get(candidate.person_id) ?? candidate.person_id;
    const canonicalPerson = personById.get(canonicalPersonId) ?? person;
    const lineage = regionLineage(race?.region_id);
    const cityCode = [
      ...lineage.flatMap((row) => [row.name, row.external_id]),
      race?.title,
      race?.external_id,
      election?.name,
      election?.external_id,
    ].map(cityCodeForText).find(Boolean) ?? null;
    const area = [race?.title, ...lineage.flatMap((row) => [row.name, row.external_id])]
      .map(districtNumber)
      .find((value) => value !== null) ?? null;

    return {
      candidateId: candidate.id,
      personId: candidate.person_id,
      canonicalPersonId,
      name: canonicalPerson?.name ?? person?.name ?? '',
      year: election?.year ?? null,
      cityCode,
      area,
      raceType: semanticRaceType(race?.race_type),
      rawRaceType: race?.race_type ?? null,
      party: candidate.party ?? canonicalPerson?.party ?? person?.party ?? '',
      candidateNumber: candidate.candidate_no ? String(Number(candidate.candidate_no)) : null,
      raceTitle: race?.title ?? null,
      sourceName: candidate.source_name ?? null,
      registrationStatus: candidate.registration_status,
      isPublic: candidate.is_public,
    };
  }).filter((row) => row.year !== null && row.name);

  const historicalRows = databaseRows.filter((row) => (
    [2018, 2022].includes(row.year)
    && row.raceType === 'councilor'
    && row.cityCode
  ));
  const historicalUnique = uniqueBy(
    historicalRows,
    historicalContextKey,
  );

  const guideMatches = guideRows.map((guide) => ({ guide, result: matchGuideCandidate(guide, historicalRows) }));
  const matched = guideMatches.filter((row) => row.result.status === 'matched');
  const identityConflicts = guideMatches.filter((row) => row.result.identityConflict);
  const missing = guideMatches.filter((row) => row.result.status === 'missing');
  const matchedHistoricalKeys = new Set(matched.flatMap(({ result }) => (
    result.candidates.map(historicalContextKey)
  )));
  const databaseMissingInGuide = historicalUnique.filter((row) => (
    !matchedHistoricalKeys.has(historicalContextKey(row))
  ));

  const guideCanonicalIds = new Set(matched.flatMap(({ result }) => result.candidates.map((row) => row.canonicalPersonId)));
  const guideNames = new Map();
  for (const guide of guideRows) {
    const key = normalizeName(guide.name);
    const rows = guideNames.get(key) ?? [];
    rows.push(guide);
    guideNames.set(key, rows);
  }

  const current2026 = uniqueBy(
    databaseRows.filter((row) => row.year === 2026),
    (row) => [row.raceType, row.cityCode, row.area, row.canonicalPersonId].join('|'),
  );
  const currentMatched = current2026.filter((row) => guideCanonicalIds.has(row.canonicalPersonId));
  const currentNameOnly = current2026.filter((row) => (
    !guideCanonicalIds.has(row.canonicalPersonId)
    && guideNames.has(normalizeName(row.name))
  ));
  const currentNotInGuide = current2026.filter((row) => (
    !guideCanonicalIds.has(row.canonicalPersonId)
    && !guideNames.has(normalizeName(row.name))
  ));
  const currentCouncilorSixCities = current2026.filter((row) => row.raceType === 'councilor' && row.cityCode);
  const isSixCityCouncilor = (row) => row.raceType === 'councilor' && row.cityCode;

  const byYear = (rows) => Object.fromEntries([2018, 2022].map((year) => [
    year,
    rows.filter((row) => (row.guide?.year ?? row.year) === year).length,
  ]));

  const report = {
    generatedAt: new Date().toISOString(),
    databaseUrl: supabaseUrl,
    scope: {
      historical: '2018 and 2022 six-municipality city councilor candidates',
      current: 'all unique 2026 candidate contexts; overlap is based on canonical person identity linked through historical races',
      caution: 'Dark Guide entries are internal research leads and are not approved for publication.',
    },
    summary: {
      darkGuide: {
        total: guideRows.length,
        byYear: byYear(guideRows),
      },
      historicalDatabase: {
        rawCandidateRows: historicalRows.length,
        uniqueCandidateContexts: historicalUnique.length,
        matchedGuideEntries: matched.length,
        matchedByYear: byYear(matched),
        identityConflictGuideEntries: identityConflicts.length,
        missingGuideEntriesInDatabase: missing.length,
        databaseCandidateContextsMissingInGuide: databaseMissingInGuide.length,
        databaseMissingByYear: byYear(databaseMissingInGuide),
      },
      current2026: {
        uniqueCandidateContexts: current2026.length,
        sixCityCouncilorContexts: currentCouncilorSixCities.length,
        sixCityCouncilorsLinkedToDarkGuide: currentMatched.filter(isSixCityCouncilor).length,
        sixCityCouncilorsSameNameButNotLinked: currentNameOnly.filter(isSixCityCouncilor).length,
        sixCityCouncilorsWithNoDarkGuideHistory: currentNotInGuide.filter(isSixCityCouncilor).length,
        linkedToDarkGuideByCanonicalPerson: currentMatched.length,
        sameNameButNotLinked: currentNameOnly.length,
        noDarkGuideHistory: currentNotInGuide.length,
      },
    },
    historical: {
      identityConflictGuideEntries: identityConflicts.map(({ guide, result }) => ({
        guide: compactGuide(guide),
        databaseCandidates: uniqueBy(result.candidates, (row) => row.canonicalPersonId).map(compactCandidate),
      })),
      guideEntriesMissingInDatabase: missing.map(({ guide }) => compactGuide(guide)),
      databaseCandidatesMissingInGuide: databaseMissingInGuide.map(compactCandidate),
    },
    current2026: {
      linkedToDarkGuide: currentMatched.map(compactCandidate),
      sameNameButNotLinked: currentNameOnly.map((row) => ({
        candidate: compactCandidate(row),
        darkGuideEntries: guideNames.get(normalizeName(row.name)).map(compactGuide),
      })),
      noDarkGuideHistory: currentNotInGuide.map(compactCandidate),
    },
  };

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
}

await main();
