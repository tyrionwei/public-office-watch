import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildCoreComparisonPlan,
  buildHistoricalSourceContext,
  classifySeatType,
  normalizeHistoricalGeography,
} from './preview-historical-cec-core-build.mjs';
import { normalizeElectionDistrict } from './normalize-election-district.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'local-data', 'historical-cec-existing-candidate-coverage.json');
const sourceType = 'official_election';
const sourceId = 'cec-2024-votedata';
const newPersonMatchMethod = 'official_historical_source_scoped_new_person_v1';
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);

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
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = { outputPath: defaultOutputPath, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function groupBy(rows, keyFor) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function countBy(rows, keyFor) {
  const counts = {};
  for (const row of rows) {
    const key = keyFor(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeParty(value) {
  if (value === '無') return '無黨籍';
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function nullableNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sameValue(left, right) {
  if (left == null && right == null) return true;
  if (typeof left === 'number' || typeof right === 'number') return Number(left) === Number(right);
  return left === right;
}

function expectedCandidate(source) {
  const elected = source.source_payload?.elected === true;
  return {
    party: normalizeParty(source.party),
    candidate_no: String(source.source_payload?.candidateNo ?? '').trim() || null,
    vote_count: nullableNumber(source.source_payload?.voteCount ?? source.source_payload?.votes),
    vote_rate: nullableNumber(source.source_payload?.voteRate),
    is_elected: elected,
    candidacy_status: 'qualified',
    election_result: elected ? 'elected' : 'not_elected',
    registration_status: elected ? 'elected' : 'not_elected',
  };
}

function candidateMismatches(candidate, expected) {
  return Object.entries(expected)
    .filter(([field, value]) => !sameValue(candidate[field], value))
    .map(([field]) => field);
}

function buildContexts(sources) {
  const events = new Map();
  const races = new Map();
  for (const source of sources) {
    const context = buildHistoricalSourceContext(source);
    if (!events.has(context.eventContextKey)) {
      events.set(context.eventContextKey, {
        key: context.eventContextKey,
        electionYear: source.election_year,
        role: context.role,
        unmatchedSourceRowCount: 1,
      });
    }
    if (!races.has(context.raceContextKey)) {
      races.set(context.raceContextKey, {
        ...context,
        key: context.raceContextKey,
        electionYear: source.election_year,
        unmatchedSourceRowCount: 1,
      });
    }
  }
  return { eventContexts: [...events.values()], raceContexts: [...races.values()] };
}

function existingDistrictNumber(race) {
  const label = normalizeElectionDistrict(race?.title);
  const match = String(label ?? '').match(/第(\d+)(?:選舉區|選區)/u);
  return match ? Number.parseInt(match[1], 10) : null;
}

function semanticRaceRole(race) {
  const type = String(race?.race_type ?? '');
  const title = String(race?.title ?? '');
  if (type === 'president' || title.includes('總統')) return 'president';
  if (['legislative_district', 'party_list_legislator', 'indigenous'].includes(type) || title.includes('立法委員')) {
    return 'legislator';
  }
  if (['city_councilor', 'county_councilor'].includes(type) || (title.includes('議員') && !title.includes('代表'))) {
    return 'councilor';
  }
  if (['county_mayor', 'municipality_mayor'].includes(type)) return 'county_city_mayor';
  return 'other';
}

function directRaceCandidates(context, dataset, canonicalRaceId) {
  const electionsById = new Map((dataset.elections ?? []).map((election) => [election.id, election]));
  const racesById = new Map((dataset.races ?? []).map((race) => [race.id, race]));
  const regionsById = new Map((dataset.regions ?? []).map((region) => [region.id, region.name]));
  const seen = new Set();
  const matches = [];

  for (const race of dataset.races ?? []) {
    const election = electionsById.get(race.election_id);
    if (!election || election.year !== context.electionYear || semanticRaceRole(race) !== context.role) continue;

    let seatType = classifySeatType(race.title, regionsById.get(race.region_id));
    if (race.race_type === 'party_list_legislator') seatType = 'party_list';
    if (seatType !== context.seatType) continue;
    if (context.regionScope === 'local') {
      const geography = normalizeHistoricalGeography(race.title, regionsById.get(race.region_id));
      if (geography !== context.historicalGeography) continue;
    }
    const districtNumber = existingDistrictNumber(race);
    if (districtNumber !== context.districtNumber && !(context.districtNumber === 1 && districtNumber == null)) continue;

    const canonicalId = canonicalRaceId(race.id);
    if (seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    const canonicalRace = racesById.get(canonicalId) ?? race;
    matches.push({
      id: canonicalRace.id,
      externalId: canonicalRace.external_id,
      title: canonicalRace.title,
      raceType: canonicalRace.race_type,
      canonicalId,
    });
  }
  return matches;
}

function compactSource(source, context) {
  return {
    sourcePersonId: source.id,
    sourcePersonKey: source.source_person_key,
    name: source.raw_name,
    electionYear: source.election_year,
    role: context.role,
    raceContextKey: context.raceContextKey,
  };
}

export function auditHistoricalCecCandidateCoverage(dataset) {
  const sources = dataset.sources ?? [];
  const matchesBySource = groupBy(
    (dataset.matches ?? []).filter((match) => match.match_status === 'auto_matched'),
    (match) => match.source_person_id,
  );
  const candidatesByPerson = groupBy(dataset.candidates ?? [], (candidate) => candidate.person_id);
  const racesById = new Map((dataset.races ?? []).map((race) => [race.id, race]));
  const raceCanonicalIds = new Map(
    (dataset.raceCanonicalMap ?? []).map((row) => [row.race_id, row.canonical_race_id]),
  );
  const electionCanonicalIds = new Map(
    (dataset.electionCanonicalMap ?? []).map((row) => [row.election_id, row.canonical_election_id]),
  );
  const canonicalRaceId = (raceId) => raceCanonicalIds.get(raceId) ?? raceId;
  const canonicalElectionId = (electionId) => electionCanonicalIds.get(electionId) ?? electionId;
  const contexts = buildContexts(sources);
  const comparison = buildCoreComparisonPlan(
    contexts.eventContexts,
    contexts.raceContexts,
    dataset,
  );
  const racePlansByKey = new Map(comparison.racePlans.map((plan) => [plan.key, plan]));
  const directRaceCandidatesByKey = new Map();

  const prepared = sources.map((source) => {
    const context = buildHistoricalSourceContext(source);
    const sourceSummary = compactSource(source, context);
    const matches = matchesBySource.get(source.id) ?? [];
    const distinctPersonIds = [...new Set(matches.map((match) => match.person_id))];

    if (distinctPersonIds.length === 0) {
      return { ...sourceSummary, category: 'unmatched_identity' };
    }
    if (distinctPersonIds.length > 1) {
      return {
        ...sourceSummary,
        category: 'identity_conflict',
        personIds: distinctPersonIds,
        matchMethods: [...new Set(matches.map((match) => match.match_method))],
      };
    }
    if (matches.some((match) => match.match_method === newPersonMatchMethod)) {
      return { ...sourceSummary, category: 'new_private_candidate_scope', personId: distinctPersonIds[0] };
    }

    if (!['president', 'legislator', 'councilor', 'county_city_mayor'].includes(context.role)) {
      return { ...sourceSummary, category: 'unsupported_role', personId: distinctPersonIds[0] };
    }

    const racePlan = racePlansByKey.get(context.raceContextKey);
    if (racePlan?.action !== 'reuse_existing' && !directRaceCandidatesByKey.has(context.raceContextKey)) {
      directRaceCandidatesByKey.set(
        context.raceContextKey,
        directRaceCandidates({ ...context, electionYear: source.election_year }, dataset, canonicalRaceId),
      );
    }
    const raceCandidates = racePlan?.action === 'reuse_existing'
      ? racePlan.existingCandidates
      : directRaceCandidatesByKey.get(context.raceContextKey);
    const raceResolution = racePlan?.action === 'reuse_existing' ? 'core_plan' : 'direct_race_context';
    if (raceCandidates.length !== 1) {
      return {
        ...sourceSummary,
        category: raceCandidates.length === 0 ? 'missing_race_context' : 'race_mapping_conflict',
        personId: distinctPersonIds[0],
        racePlanAction: racePlan?.action ?? null,
        raceResolution,
        raceCandidates,
      };
    }

    const expectedRaceId = raceCandidates[0].canonicalId;
    return {
      ...sourceSummary,
      personId: distinctPersonIds[0],
      expectedRaceId,
      raceResolution,
      assignmentKey: `${distinctPersonIds[0]}|${expectedRaceId}`,
      expected: expectedCandidate(source),
    };
  });

  const assignmentCounts = countBy(
    prepared.filter((row) => row.assignmentKey),
    (row) => row.assignmentKey,
  );

  const results = prepared.map((row) => {
    if (row.category) return row;
    if (assignmentCounts[row.assignmentKey] > 1) {
      return { ...row, category: 'duplicate_source_assignment' };
    }

    const personCandidates = candidatesByPerson.get(row.personId) ?? [];
    const matchingCandidates = personCandidates.filter(
      (candidate) => canonicalRaceId(candidate.race_id) === row.expectedRaceId,
    );
    if (matchingCandidates.length > 1) {
      return {
        ...row,
        category: 'multiple_candidates',
        candidateIds: matchingCandidates.map((candidate) => candidate.id),
      };
    }
    if (matchingCandidates.length === 1) {
      const candidate = matchingCandidates[0];
      const mismatchFields = candidateMismatches(candidate, row.expected);
      return {
        ...row,
        category: mismatchFields.length === 0 ? 'exact_candidate' : 'safe_update_candidate',
        candidateId: candidate.id,
        candidateExternalId: candidate.external_id,
        mismatchFields,
      };
    }

    const expectedRace = racesById.get(row.expectedRaceId);
    const expectedElectionId = expectedRace ? canonicalElectionId(expectedRace.election_id) : null;
    const otherSameEventCandidates = expectedElectionId == null ? [] : personCandidates.filter((candidate) => {
      const candidateRace = racesById.get(canonicalRaceId(candidate.race_id));
      return candidateRace
        && canonicalElectionId(candidateRace.election_id) === expectedElectionId
        && canonicalRaceId(candidate.race_id) !== row.expectedRaceId;
    });
    if (otherSameEventCandidates.length > 0) {
      return {
        ...row,
        category: 'candidate_on_other_race_same_event',
        candidateIds: otherSameEventCandidates.map((candidate) => candidate.id),
      };
    }
    return { ...row, category: 'safe_create_candidate' };
  });

  const actionableCategories = new Set(['safe_create_candidate', 'safe_update_candidate']);
  const excludedCategories = new Set(['new_private_candidate_scope', 'unmatched_identity']);
  const manualCategories = new Set([
    'identity_conflict',
    'unsupported_role',
    'missing_race_context',
    'race_mapping_conflict',
    'duplicate_source_assignment',
    'multiple_candidates',
    'candidate_on_other_race_same_event',
  ]);
  return {
    source: { sourceType, sourceId },
    policy: {
      databaseWrites: false,
      existingIdentityScope: 'Only one distinct active auto-matched person is eligible for automatic candidate coverage checks.',
      safeCreate: 'No candidate exists for the matched person and canonical race, and no candidate exists on another race in the same election.',
      safeUpdate: 'Exactly one candidate exists for the matched person and canonical race; only official ballot/result fields differ.',
    },
    summary: {
      sourceRows: results.length,
      preexistingMatchedSourceRows: results.filter((row) => !excludedCategories.has(row.category)).length,
      uniquePreexistingIdentityRows: results.filter((row) => !excludedCategories.has(row.category) && row.category !== 'identity_conflict').length,
      actionableRows: results.filter((row) => actionableCategories.has(row.category)).length,
      manualReviewRows: results.filter((row) => manualCategories.has(row.category)).length,
      exactCandidateRows: results.filter((row) => row.category === 'exact_candidate').length,
      newPrivateCandidateScopeRows: results.filter((row) => row.category === 'new_private_candidate_scope').length,
      unmatchedIdentityRows: results.filter((row) => row.category === 'unmatched_identity').length,
    },
    categoryCounts: countBy(results, (row) => row.category),
    actionableByYear: countBy(
      results.filter((row) => actionableCategories.has(row.category)),
      (row) => String(row.electionYear),
    ),
    actionableByRole: countBy(
      results.filter((row) => actionableCategories.has(row.category)),
      (row) => row.role,
    ),
    safeCreates: results.filter((row) => row.category === 'safe_create_candidate'),
    safeUpdates: results.filter((row) => row.category === 'safe_update_candidate'),
    manualReview: results.filter((row) => manualCategories.has(row.category)),
  };
}

function restUrl(config, tableName) {
  return new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`);
}

async function fetchRows(config, tableName, select, filters = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = restUrl(config, tableName);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', String(offset));
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch ${tableName}: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < 1000) return rows;
  }
}

async function loadDataset(config) {
  const [sources, matches, candidates, elections, races, regions, electionCanonicalMap, raceCanonicalMap] = await Promise.all([
    fetchRows(config, 'source_people', 'id,source_person_key,raw_name,normalized_name,gender,party,position,district,election_year,source_payload', {
      source_type: `eq.${sourceType}`,
      source_id: `eq.${sourceId}`,
      order: 'id.asc',
    }),
    fetchRows(config, 'person_identity_matches', 'source_person_id,person_id,match_status,match_method', {
      match_status: 'eq.auto_matched',
      order: 'source_person_id.asc',
    }),
    fetchRows(config, 'candidates', 'id,external_id,person_id,race_id,party,candidate_no,registration_status,vote_count,vote_rate,is_elected,candidacy_status,election_result,is_public', {
      order: 'id.asc',
    }),
    fetchRows(config, 'elections', 'id,external_id,name,year,election_type', { order: 'id.asc' }),
    fetchRows(config, 'races', 'id,external_id,election_id,region_id,race_type,title', { order: 'id.asc' }),
    fetchRows(config, 'regions', 'id,name,region_type', { order: 'id.asc' }),
    fetchRows(config, 'election_canonical_map', 'election_id,canonical_election_id', { order: 'election_id.asc' }),
    fetchRows(config, 'race_canonical_map', 'race_id,canonical_race_id', { order: 'race_id.asc' }),
  ]);
  return { sources, matches, candidates, elections, races, regions, electionCanonicalMap, raceCanonicalMap };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('Historical CEC candidate coverage audit only reads Local Supabase.');
  }

  const report = auditHistoricalCecCandidateCoverage(await loadDataset(config));
  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    output: options.write ? path.relative(repoRoot, options.outputPath) : null,
    ...report.summary,
    categoryCounts: report.categoryCounts,
    actionableByYear: report.actionableByYear,
    actionableByRole: report.actionableByRole,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`historical CEC candidate coverage audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
