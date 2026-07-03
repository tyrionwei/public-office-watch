import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'election-race-duplicate-report.json');

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
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '') : '';
        return [key, value];
      }),
  );
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const options = {
    outputPath: defaultOutputPath,
    limit: 100000,
    sampleLimit: 25,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      options.limit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--sample-limit') {
      options.sampleLimit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive integer');
  }

  if (!Number.isInteger(options.sampleLimit) || options.sampleLimit < 0) {
    throw new Error('--sample-limit must be a non-negative integer');
  }

  return options;
}

function restUrl(pathname) {
  return new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${pathname}`);
}

async function fetchRows(tableName, select, options) {
  const pageSize = 1000;
  const rows = [];

  while (rows.length < options.limit) {
    const pageStart = rows.length;
    const pageEnd = Math.min(pageStart + pageSize - 1, options.limit - 1);
    const url = restUrl(tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('order', 'id.asc');

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        range: `${pageStart}-${pageEnd}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    }

    if (!Array.isArray(body) || body.length === 0) {
      break;
    }

    rows.push(...body);

    if (body.length < pageSize) {
      break;
    }
  }

  return rows;
}

function sourceKind(row) {
  const externalId = String(row?.external_id ?? '');
  const sourceName = String(row?.source_name ?? '');

  if (externalId.startsWith('votetw-') || sourceName.toLowerCase().includes('votetw')) return 'votetw';
  if (externalId.startsWith('cec-') || sourceName.includes('中央選舉委員會')) return 'cec';
  return 'other';
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s　,，.。()（）\[\]【】第屆任年]/g, '')
    .replace(/臺/g, '台')
    .toLowerCase();
}

function normalizeName(value) {
  return normalizeText(value).replace(/[^\p{Script=Han}a-z0-9]/gu, '');
}

function semanticElectionType(value) {
  if (['presidential', 'president'].includes(value)) return 'president';
  if (['legislative', 'legislator'].includes(value)) return 'legislator';
  if (['local', 'local_chief', 'councilor', 'township_representative', 'village_chief'].includes(value)) return 'local';
  return value ?? 'unknown';
}

function semanticRaceType(value) {
  if (['president', 'vice_president'].includes(value)) return 'president';
  if (['legislator', 'legislative_district', 'party_list_legislator', 'indigenous'].includes(value)) return 'legislator';
  if (['municipality_mayor', 'county_mayor', 'township_mayor', 'local_chief'].includes(value)) return 'local_chief';
  if (['city_councilor', 'county_councilor', 'councilor_district'].includes(value)) return 'councilor';
  if (['township_representative', 'township_representative_district'].includes(value)) return 'township_representative';
  if (value === 'village_chief') return 'village_chief';
  return value ?? 'unknown';
}

function candidateIdentityKey(candidate, peopleById) {
  const person = peopleById.get(candidate.person_id);
  const name = normalizeName(person?.name);
  const party = normalizeText(candidate.party);
  if (!name) return null;
  return `${name}|${party}`;
}

function overlap(leftSet, rightSet) {
  if (leftSet.size === 0 || rightSet.size === 0) {
    return { count: 0, leftRate: 0, rightRate: 0, smallerRate: 0 };
  }

  let count = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) count += 1;
  }

  return {
    count,
    leftRate: count / leftSet.size,
    rightRate: count / rightSet.size,
    smallerRate: count / Math.min(leftSet.size, rightSet.size),
  };
}

function confidenceForElectionPair(pair) {
  if (pair.year === 2024 && pair.semanticType === 'president' && pair.candidateOverlap.smallerRate >= 1) return 'auto';
  if (pair.year === 2024 && pair.semanticType === 'legislator' && pair.candidateOverlap.smallerRate >= 0.75) return 'auto';
  if (pair.year === 2022 && pair.semanticType === 'local' && pair.raceTypeOverlap.length > 0 && pair.candidateOverlap.count > 0) return 'review';
  if (pair.candidateOverlap.smallerRate >= 0.5) return 'review';
  return 'manual';
}

function confidenceForRacePair(pair) {
  if (pair.candidateOverlap.smallerRate >= 1 && pair.candidateOverlap.count > 0) return 'auto';
  if (pair.candidateOverlap.smallerRate >= 0.75 && pair.candidateOverlap.count >= 2) return 'review';
  if (pair.nameSimilarity || pair.candidateOverlap.count > 0) return 'manual';
  return 'unlikely';
}

function summarizeElection(election, races, candidates) {
  const raceIds = new Set(races.map((race) => race.id));
  const electionCandidates = candidates.filter((candidate) => raceIds.has(candidate.race_id));
  return {
    id: election.id,
    externalId: election.external_id,
    name: election.name,
    year: election.year,
    electionType: election.election_type,
    semanticType: semanticElectionType(election.election_type),
    sourceKind: sourceKind(election),
    sourceName: election.source_name,
    raceCount: races.length,
    candidateCount: electionCandidates.length,
    raceTypes: Array.from(new Set(races.map((race) => race.race_type))).sort(),
  };
}

function buildCandidateKeySet(races, candidates, peopleById) {
  const raceIds = new Set(races.map((race) => race.id));
  return new Set(
    candidates
      .filter((candidate) => raceIds.has(candidate.race_id))
      .map((candidate) => candidateIdentityKey(candidate, peopleById))
      .filter(Boolean),
  );
}

function compactElection(election) {
  return {
    externalId: election.externalId,
    name: election.name,
    year: election.year,
    electionType: election.electionType,
    sourceKind: election.sourceKind,
    sourceName: election.sourceName,
    raceCount: election.raceCount,
    candidateCount: election.candidateCount,
    raceTypes: election.raceTypes,
  };
}

function compactRace(race) {
  return {
    externalId: race.external_id,
    title: race.title,
    raceType: race.race_type,
    semanticRaceType: semanticRaceType(race.race_type),
    sourceKind: sourceKind(race),
    sourceName: race.source_name,
  };
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for election/race duplicate report.');
  }

  const options = parseArgs(process.argv.slice(2));
  const [elections, races, candidates, people] = await Promise.all([
    fetchRows('elections', 'id,external_id,name,year,election_type,voting_date,status,source_name,is_public', options),
    fetchRows('races', 'id,external_id,election_id,region_id,race_type,title,voting_date,status,source_name,is_public', options),
    fetchRows('candidates', 'id,external_id,person_id,race_id,party,candidate_no,registration_status,is_elected,source_name,is_public', options),
    fetchRows('people', 'id,external_id,name,is_public', options),
  ]);

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const racesByElectionId = new Map();
  for (const race of races) {
    const group = racesByElectionId.get(race.election_id) ?? [];
    group.push(race);
    racesByElectionId.set(race.election_id, group);
  }

  const candidatesByRaceId = new Map();
  for (const candidate of candidates) {
    const group = candidatesByRaceId.get(candidate.race_id) ?? [];
    group.push(candidate);
    candidatesByRaceId.set(candidate.race_id, group);
  }

  const electionSummaries = elections.map((election) => summarizeElection(
    election,
    racesByElectionId.get(election.id) ?? [],
    candidates,
  ));

  const electionPairs = [];
  for (let leftIndex = 0; leftIndex < electionSummaries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < electionSummaries.length; rightIndex += 1) {
      const left = electionSummaries[leftIndex];
      const right = electionSummaries[rightIndex];
      if (left.year !== right.year) continue;
      if (left.semanticType !== right.semanticType) continue;
      if (left.sourceKind === right.sourceKind) continue;
      if (!['cec', 'votetw'].includes(left.sourceKind) && !['cec', 'votetw'].includes(right.sourceKind)) continue;

      const leftRaces = racesByElectionId.get(left.id) ?? [];
      const rightRaces = racesByElectionId.get(right.id) ?? [];
      const leftKeys = buildCandidateKeySet(leftRaces, candidates, peopleById);
      const rightKeys = buildCandidateKeySet(rightRaces, candidates, peopleById);
      const candidateOverlap = overlap(leftKeys, rightKeys);
      const raceTypeOverlap = left.raceTypes.filter((raceType) => right.raceTypes.includes(raceType));
      if (candidateOverlap.count === 0 && raceTypeOverlap.length === 0) continue;
      const pair = {
        year: left.year,
        semanticType: left.semanticType,
        left: compactElection(left),
        right: compactElection(right),
        candidateOverlap,
        raceTypeOverlap,
      };
      electionPairs.push({
        ...pair,
        confidence: confidenceForElectionPair(pair),
      });
    }
  }

  const racePairs = [];
  const racesByYearSemanticType = new Map();
  for (const race of races) {
    const election = elections.find((item) => item.id === race.election_id);
    if (!election) continue;
    const key = `${election.year}|${semanticRaceType(race.race_type)}`;
    const group = racesByYearSemanticType.get(key) ?? [];
    group.push({ ...race, election });
    racesByYearSemanticType.set(key, group);
  }

  for (const group of racesByYearSemanticType.values()) {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        if (sourceKind(left) === sourceKind(right)) continue;
        if (!['cec', 'votetw'].includes(sourceKind(left)) && !['cec', 'votetw'].includes(sourceKind(right))) continue;
        const leftName = normalizeText(left.title);
        const rightName = normalizeText(right.title);
        const nameSimilarity = Boolean(leftName && rightName && (leftName.includes(rightName) || rightName.includes(leftName)));
        const leftCandidateKeys = new Set((candidatesByRaceId.get(left.id) ?? []).map((candidate) => candidateIdentityKey(candidate, peopleById)).filter(Boolean));
        const rightCandidateKeys = new Set((candidatesByRaceId.get(right.id) ?? []).map((candidate) => candidateIdentityKey(candidate, peopleById)).filter(Boolean));
        const candidateOverlap = overlap(leftCandidateKeys, rightCandidateKeys);
        if (candidateOverlap.count === 0) continue;
        const pair = {
          year: left.election.year,
          semanticRaceType: semanticRaceType(left.race_type),
          leftElection: left.election.name,
          rightElection: right.election.name,
          left: compactRace(left),
          right: compactRace(right),
          nameSimilarity,
          candidateOverlap,
        };
        racePairs.push({
          ...pair,
          confidence: confidenceForRacePair(pair),
        });
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    totals: {
      elections: elections.length,
      races: races.length,
      candidates: candidates.length,
      people: people.length,
      electionPairs: electionPairs.length,
      racePairs: racePairs.length,
    },
    electionPairConfidenceCounts: countBy(electionPairs, 'confidence'),
    racePairConfidenceCounts: countBy(racePairs, 'confidence'),
  };

  const report = {
    summary,
    electionPairs: electionPairs.sort(comparePairs).slice(0, options.limit),
    racePairs: racePairs.sort(compareRacePairs).slice(0, options.limit),
  };

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    ...summary,
    outputPath: options.outputPath,
    sampleElectionPairs: report.electionPairs.slice(0, options.sampleLimit),
    sampleRacePairs: report.racePairs.slice(0, options.sampleLimit),
  }, null, 2));
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  }
  return counts;
}

function confidenceRank(confidence) {
  return { auto: 0, review: 1, manual: 2, unlikely: 3 }[confidence] ?? 9;
}

function comparePairs(left, right) {
  return confidenceRank(left.confidence) - confidenceRank(right.confidence) ||
    left.year - right.year ||
    left.semanticType.localeCompare(right.semanticType) ||
    right.candidateOverlap.count - left.candidateOverlap.count;
}

function compareRacePairs(left, right) {
  return confidenceRank(left.confidence) - confidenceRank(right.confidence) ||
    left.year - right.year ||
    left.semanticRaceType.localeCompare(right.semanticRaceType) ||
    right.candidateOverlap.count - left.candidateOverlap.count;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`election/race duplicate report failed: ${message}`);
  process.exit(1);
});
