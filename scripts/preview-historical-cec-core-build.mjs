import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { normalizeElectionDistrict } from './normalize-election-district.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'local-data', 'historical-cec-core-preview.json');
const sourceId = 'cec-2024-votedata';
const sourceType = 'official_election';
const localHostnames = new Set(['127.0.0.1', 'localhost', '::1']);
const modernRegionNames = new Map([
  ['臺北縣', '新北市'],
  ['桃園縣', '桃園市'],
  ['臺中縣', '臺中市'],
  ['臺南縣', '臺南市'],
  ['高雄縣', '高雄市'],
]);

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
    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

function normalizeTaiwanText(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/台/g, '臺');
}

export function normalizeHistoricalGeography(district, position) {
  const context = `${normalizeTaiwanText(district)} ${normalizeTaiwanText(position)}`
    .replace(/\d{4}年?/gu, ' ');
  return context.match(/(?:^|[^\p{Script=Han}])([\p{Script=Han}]{1,4}[縣市])/u)?.[1] ?? null;
}

export function modernizeIdentityGeography(historicalGeography) {
  return modernRegionNames.get(historicalGeography) ?? historicalGeography;
}

export function classifyHistoricalRole(position) {
  const value = normalizeTaiwanText(position);
  if (value.includes('總統')) return 'president';
  if (value.includes('立法委員')) return 'legislator';
  if (value.includes('議員')) return 'councilor';
  return 'other';
}

export function classifySeatType(district, position) {
  const value = `${normalizeTaiwanText(district)} ${normalizeTaiwanText(position)}`;
  if (value.includes('山地原住民')) return 'mountain_indigenous';
  if (value.includes('平地原住民')) return 'plain_indigenous';
  if (value.includes('原住民')) return 'indigenous';
  if (value.includes('不分區')) return 'party_list';
  return 'regional';
}

export function canonicalElectionType(role) {
  if (role === 'president') return 'presidential';
  if (role === 'legislator') return 'legislative';
  if (role === 'councilor') return 'councilor';
  return 'other';
}

export function canonicalElectionName(year, role) {
  if (role === 'president') return `${year}年總統副總統選舉`;
  if (role === 'legislator') return `${year}年立法委員選舉`;
  if (role === 'councilor') return `${year}年直轄市及縣市議員選舉`;
  return `${year}年其他選舉`;
}

export function canonicalRaceType(role, seatType, historicalGeography = null) {
  if (role === 'president') return 'president';
  if (role === 'legislator') {
    if (seatType === 'party_list') return 'party_list_legislator';
    if (['plain_indigenous', 'mountain_indigenous', 'indigenous'].includes(seatType)) return 'indigenous';
    return 'legislative_district';
  }
  if (role === 'councilor') return historicalGeography?.endsWith('縣') ? 'county_councilor' : 'city_councilor';
  return 'other';
}

function seatLabel(seatType) {
  if (seatType === 'plain_indigenous') return '平地原住民';
  if (seatType === 'mountain_indigenous') return '山地原住民';
  if (seatType === 'indigenous') return '原住民';
  if (seatType === 'party_list') return '不分區';
  return null;
}

export function canonicalRaceTitle({ role, seatType, historicalGeography, districtNumber }) {
  if (role === 'president') return '全國總統副總統選舉';
  if (role === 'legislator' && seatType === 'party_list') return '全國不分區立法委員選舉';
  if (role === 'legislator' && seatLabel(seatType)) return `全國${seatLabel(seatType)}立法委員選舉`;

  const geography = historicalGeography ?? '';
  const district = districtNumber == null ? '' : `第${districtNumber}選舉區`;
  const seat = seatLabel(seatType) ?? '';
  if (role === 'legislator') return `${geography}${district}立法委員選舉`;
  if (role === 'councilor') return `${geography}${district}${seat}議員選舉`;
  return `${geography}${district}${seat}其他選舉`;
}

function normalizedDistrictNumber(source) {
  const payloadValue = String(source.source_payload?.districtCode ?? '').trim();
  if (/^\d+$/.test(payloadValue) && Number.parseInt(payloadValue, 10) > 0) {
    return Number.parseInt(payloadValue, 10);
  }

  const label = normalizeElectionDistrict(source.district);
  const match = String(label ?? '').match(/第(\d+)(?:選舉區|選區)/u);
  return match ? Number.parseInt(match[1], 10) : null;
}

function sourceContext(source) {
  const historicalGeography = normalizeHistoricalGeography(source.district, source.position);
  const identityGeography = modernizeIdentityGeography(historicalGeography);
  const role = classifyHistoricalRole(source.position);
  const seatType = classifySeatType(source.district, source.position);
  const districtNumber = normalizedDistrictNumber(source);
  const districtKey = districtNumber == null ? seatType : `district-${districtNumber}`;
  const electionType = canonicalElectionType(role);
  const electionName = canonicalElectionName(source.election_year, role);
  const raceType = canonicalRaceType(role, seatType, historicalGeography);
  const raceTitle = canonicalRaceTitle({ role, seatType, historicalGeography, districtNumber });

  return {
    historicalGeography,
    identityGeography,
    role,
    seatType,
    districtLabel: raceTitle,
    districtNumber,
    electionType,
    electionName,
    raceType,
    raceTitle,
    regionScope: role === 'president' || (role === 'legislator' && seatType !== 'regional') ? 'national' : 'local',
    eventContextKey: [source.election_year, role, 'national'].join('|'),
    raceContextKey: [source.election_year, role, historicalGeography ?? 'national', districtKey, seatType].join('|'),
  };
}

function countBy(rows, keyFor) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    Array.from(counts.entries()).sort(([left], [right]) => String(left).localeCompare(String(right), 'zh-Hant-TW')),
  );
}

function groupBy(rows, keyFor) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function proposedPersonExternalId(sourcePersonKey) {
  return `cec-historical-person-${crypto.createHash('sha256').update(sourcePersonKey).digest('hex').slice(0, 16)}`;
}

function compactSource(source, context) {
  return {
    sourcePersonId: source.id,
    sourcePersonKey: source.source_person_key,
    name: source.raw_name,
    normalizedName: source.normalized_name,
    gender: source.gender,
    party: source.party,
    electionYear: source.election_year,
    position: source.position,
    district: source.district,
    candidateNo: source.source_payload?.candidateNo ?? null,
    voteCount: source.source_payload?.voteCount ?? source.source_payload?.votes ?? null,
    voteRate: source.source_payload?.voteRate ?? null,
    elected: source.source_payload?.elected === true,
    ...context,
  };
}

function buildContextRows(sources, unmatchedSourceIds) {
  const compactRows = sources.map((source) => ({
    ...compactSource(source, sourceContext(source)),
    isUnmatched: unmatchedSourceIds.has(source.id),
  }));
  const eventGroups = groupBy(compactRows, (row) => row.eventContextKey);
  const raceGroups = groupBy(compactRows, (row) => row.raceContextKey);

  const eventContexts = Array.from(eventGroups.entries()).map(([key, rows]) => ({
    key,
    electionYear: rows[0].electionYear,
    role: rows[0].role,
    historicalGeography: null,
    electionType: rows[0].electionType,
    electionName: rows[0].electionName,
    sourceRowCount: rows.length,
    raceContextCount: new Set(rows.map((row) => row.raceContextKey)).size,
    unmatchedSourceRowCount: rows.filter((row) => row.isUnmatched).length,
  })).sort((left, right) => left.electionYear - right.electionYear || left.key.localeCompare(right.key, 'zh-Hant-TW'));

  const raceContexts = Array.from(raceGroups.entries()).map(([key, rows]) => ({
    key,
    eventContextKey: rows[0].eventContextKey,
    electionYear: rows[0].electionYear,
    role: rows[0].role,
    historicalGeography: rows[0].historicalGeography,
    identityGeography: rows[0].identityGeography,
    districtLabel: rows[0].districtLabel,
    districtNumber: rows[0].districtNumber,
    seatType: rows[0].seatType,
    raceType: rows[0].raceType,
    raceTitle: rows[0].raceTitle,
    regionScope: rows[0].regionScope,
    sourceRowCount: rows.length,
    unmatchedSourceRowCount: rows.filter((row) => row.isUnmatched).length,
    sourcePersonKeys: rows.map((row) => row.sourcePersonKey).sort(),
  })).sort((left, right) => left.key.localeCompare(right.key, 'zh-Hant-TW'));

  return { compactRows, eventContexts, raceContexts };
}

function semanticElectionRole(election) {
  const type = String(election?.election_type ?? '');
  const name = normalizeTaiwanText(election?.name);
  if (['presidential', 'president'].includes(type) || name.includes('總統')) return 'president';
  if (['legislative', 'legislator'].includes(type) || name.includes('立法委員')) return 'legislator';
  if (type === 'councilor' || (name.includes('議員') && !name.includes('代表'))) return 'councilor';
  return 'other';
}

function existingDistrictNumber(race) {
  const label = normalizeElectionDistrict(race?.title);
  const match = String(label ?? '').match(/第(\d+)(?:選舉區|選區)/u);
  return match ? Number.parseInt(match[1], 10) : null;
}

function existingSeatType(race, regionName) {
  if (race?.race_type === 'party_list_legislator') return 'party_list';
  return classifySeatType(race?.title, regionName);
}

function canonicalIdMap(rows, sourceKey, canonicalKey) {
  return new Map((rows ?? []).map((row) => [row[sourceKey], row[canonicalKey]]));
}

function compactExistingElection(election) {
  return {
    id: election.id,
    externalId: election.external_id,
    name: election.name,
    electionType: election.election_type,
  };
}

function compactExistingRace(race, regionName) {
  return {
    id: race.id,
    externalId: race.external_id,
    title: race.title,
    raceType: race.race_type,
    regionName: regionName ?? null,
  };
}

function dedupeByCanonicalId(rows, idFor) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = idFor(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function buildCoreComparisonPlan(eventContexts, raceContexts, dataset) {
  const supportedRoles = new Set(['president', 'legislator', 'councilor']);
  const supportedEventContexts = eventContexts.filter(
    (context) => supportedRoles.has(context.role) && context.unmatchedSourceRowCount !== 0,
  );
  const supportedRaceContexts = raceContexts.filter(
    (context) => supportedRoles.has(context.role) && context.unmatchedSourceRowCount !== 0,
  );
  const elections = dataset.elections ?? [];
  const races = dataset.races ?? [];
  const regionsById = new Map((dataset.regions ?? []).map((region) => [region.id, region.name]));
  const electionsById = new Map(elections.map((election) => [election.id, election]));
  const racesById = new Map(races.map((race) => [race.id, race]));
  const electionCanonicalIds = canonicalIdMap(
    dataset.electionCanonicalMap,
    'election_id',
    'canonical_election_id',
  );
  const raceCanonicalIds = canonicalIdMap(dataset.raceCanonicalMap, 'race_id', 'canonical_race_id');

  const eventPlans = supportedEventContexts.map((context) => {
    const candidates = dedupeByCanonicalId(
      elections.filter((election) => {
        return election.year === context.electionYear && semanticElectionRole(election) === context.role;
      }),
      (election) => electionCanonicalIds.get(election.id) ?? election.id,
    );
    const action = candidates.length === 0 ? 'create_new' : candidates.length === 1 ? 'reuse_existing' : 'manual_review';
    const existingCandidates = candidates.map((election) => {
      const canonicalId = electionCanonicalIds.get(election.id) ?? election.id;
      const canonicalElection = electionsById.get(canonicalId) ?? election;
      return {
        ...compactExistingElection(canonicalElection),
        canonicalId,
        scope: semanticElectionRole(canonicalElection) === context.role ? 'same_scope' : 'aggregate',
      };
    });
    return {
      ...context,
      action,
      existingScope: action === 'reuse_existing' ? existingCandidates[0].scope : null,
      existingCandidates,
    };
  });
  const eventPlansByKey = new Map(eventPlans.map((plan) => [plan.key, plan]));

  const racePlans = supportedRaceContexts.map((context) => {
    const eventPlan = eventPlansByKey.get(context.eventContextKey);
    if (eventPlan?.action === 'create_new') {
      return { ...context, action: 'create_new', existingCandidates: [] };
    }

    const allowedElectionIds = new Set(eventPlan?.existingCandidates.map((candidate) => candidate.canonicalId) ?? []);
    const candidates = dedupeByCanonicalId(
      races.filter((race) => {
        const election = electionsById.get(race.election_id);
        if (!election || election.year !== context.electionYear || semanticElectionRole(election) !== context.role) return false;
        const canonicalElectionId = electionCanonicalIds.get(election.id) ?? election.id;
        if (allowedElectionIds.size > 0 && !allowedElectionIds.has(canonicalElectionId)) return false;

        const regionName = regionsById.get(race.region_id) ?? '';
        const seatType = existingSeatType(race, regionName);
        if (seatType !== context.seatType) return false;
        if (context.regionScope === 'local') {
          const geography = normalizeHistoricalGeography(race.title, regionName);
          if (geography !== context.historicalGeography) return false;
        }

        const districtNumber = existingDistrictNumber(race);
        return districtNumber === context.districtNumber
          || (context.districtNumber === 1 && districtNumber == null);
      }),
      (race) => raceCanonicalIds.get(race.id) ?? race.id,
    );
    let action = candidates.length === 0 ? 'create_new' : candidates.length === 1 ? 'reuse_existing' : 'manual_review';
    if (eventPlan?.action === 'manual_review') action = 'manual_review';
    return {
      ...context,
      action,
      existingCandidates: candidates.map((race) => {
        const canonicalId = raceCanonicalIds.get(race.id) ?? race.id;
        const canonicalRace = racesById.get(canonicalId) ?? race;
        return {
          ...compactExistingRace(canonicalRace, regionsById.get(canonicalRace.region_id)),
          canonicalId,
        };
      }),
    };
  });

  return {
    eventPlans,
    racePlans,
    eventActionCounts: countBy(eventPlans, (plan) => plan.action),
    raceActionCounts: countBy(racePlans, (plan) => plan.action),
  };
}

function buildNewPersonPreview(unmatchedSources, reviewsBySourceId) {
  const sourcesNeedingNewPerson = unmatchedSources.filter(
    (source) => reviewsBySourceId.get(source.id)?.review_status === 'needs_new_person_review',
  );
  const grouped = groupBy(sourcesNeedingNewPerson, (source) => {
    const context = sourceContext(source);
    return [source.normalized_name, source.gender, context.identityGeography, context.role].join('|');
  });
  const safeNewPeople = [];
  const heldForReview = [];

  for (const [identityContextKey, sources] of grouped.entries()) {
    const contexts = sources.map((source) => sourceContext(source));
    const first = sources[0];
    const firstContext = contexts[0];
    const years = sources.map((source) => source.election_year);
    const missingSignals = [];
    if (!['male', 'female'].includes(first.gender)) missingSignals.push('gender');
    if (!firstContext.identityGeography) missingSignals.push('geography');
    if (firstContext.role === 'other') missingSignals.push('role');

    let holdReason = null;
    if (missingSignals.length > 0) holdReason = `missing_${missingSignals.join('_')}`;
    else if (new Set(years).size !== years.length) holdReason = 'same_year_collision';
    else if (sources.length > 1) holdReason = 'cross_year_context_only';

    if (holdReason) {
      heldForReview.push({
        identityContextKey,
        reason: holdReason,
        sourceRowCount: sources.length,
        sources: sources.map((source, index) => compactSource(source, contexts[index])),
      });
      continue;
    }

    safeNewPeople.push({
      identityContextKey,
      proposedPerson: {
        externalId: proposedPersonExternalId(first.source_person_key),
        name: first.raw_name,
        gender: first.gender,
        party: first.party,
        position: first.position,
        district: first.district,
        electionYear: first.election_year,
        isPublic: false,
      },
      source: compactSource(first, firstContext),
      creationPolicy: 'single official CEC source with no existing same-name public person',
    });
  }

  safeNewPeople.sort((left, right) => left.identityContextKey.localeCompare(right.identityContextKey, 'zh-Hant-TW'));
  heldForReview.sort((left, right) => left.identityContextKey.localeCompare(right.identityContextKey, 'zh-Hant-TW'));
  return { sourcesNeedingNewPerson, safeNewPeople, heldForReview };
}

export function buildHistoricalCecCorePreview(dataset, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const activeMatchedSourceIds = new Set(
    dataset.matches.filter((match) => match.match_status === 'auto_matched').map((match) => match.source_person_id),
  );
  const reviewsBySourceId = new Map(dataset.reviews.map((review) => [review.source_person_id, review]));
  const unmatchedSources = dataset.sources.filter((source) => !activeMatchedSourceIds.has(source.id));
  const unmatchedSourceIds = new Set(unmatchedSources.map((source) => source.id));
  const { compactRows, eventContexts, raceContexts } = buildContextRows(dataset.sources, unmatchedSourceIds);
  const comparisonPlan = buildCoreComparisonPlan(eventContexts, raceContexts, dataset);
  const { sourcesNeedingNewPerson, safeNewPeople, heldForReview } = buildNewPersonPreview(unmatchedSources, reviewsBySourceId);
  const reviewStatusCounts = countBy(
    unmatchedSources,
    (source) => reviewsBySourceId.get(source.id)?.review_status ?? 'linked_claim_or_excluded_from_queue',
  );

  return {
    generatedAt,
    source: { sourceId, sourceType },
    policy: {
      databaseWrites: false,
      historicalGeography: 'Preserve the jurisdiction name used at the time of the election.',
      identityGeography: 'Keep a separate modernized geography only for identity comparison.',
      safeNewPerson: 'Create a private source-scoped preview only when one official source row has no existing same-name public person and has gender, geography and role.',
      crossYearIdentity: 'Never merge cross-year records using context-only evidence.',
      electionNaming: 'Use one canonical name per year, office family and historical jurisdiction.',
      raceNaming: 'Remove leading zeroes and use explicit national, district and indigenous labels.',
      seatClassification: 'Keep plain, mountain and generic indigenous seat types distinct from the database race_type.',
      comparisonScope: 'Only plan event and race contexts that contain at least one unmatched source person.',
    },
    summary: {
      totalSourceRows: dataset.sources.length,
      alreadyMatchedSourceRows: dataset.sources.length - unmatchedSources.length,
      unmatchedSourceRows: unmatchedSources.length,
      eventContextCount: eventContexts.length,
      affectedEventContextCount: eventContexts.filter((context) => context.unmatchedSourceRowCount > 0).length,
      raceContextCount: raceContexts.length,
      affectedRaceContextCount: raceContexts.filter((context) => context.unmatchedSourceRowCount > 0).length,
      reuseExistingEventCount: comparisonPlan.eventActionCounts.reuse_existing ?? 0,
      createNewEventCount: comparisonPlan.eventActionCounts.create_new ?? 0,
      manualReviewEventCount: comparisonPlan.eventActionCounts.manual_review ?? 0,
      reuseExistingRaceCount: comparisonPlan.raceActionCounts.reuse_existing ?? 0,
      createNewRaceCount: comparisonPlan.raceActionCounts.create_new ?? 0,
      manualReviewRaceCount: comparisonPlan.raceActionCounts.manual_review ?? 0,
      outOfScopeEventContextCount: eventContexts.length - comparisonPlan.eventPlans.length,
      outOfScopeRaceContextCount: raceContexts.length - comparisonPlan.racePlans.length,
      reviewQueueRows: unmatchedSources.length - (reviewStatusCounts.linked_claim_or_excluded_from_queue ?? 0),
      linkedClaimOrExcludedRows: reviewStatusCounts.linked_claim_or_excluded_from_queue ?? 0,
      needsNewPersonSourceRows: sourcesNeedingNewPerson.length,
      safeNewPersonCount: safeNewPeople.length,
      heldNewPersonSourceRows: heldForReview.reduce((sum, group) => sum + group.sourceRowCount, 0),
      heldNewPersonGroupCount: heldForReview.length,
    },
    reviewStatusCounts,
    unmatchedByElectionYear: countBy(compactRows.filter((row) => row.isUnmatched), (row) => row.electionYear),
    unmatchedByRole: countBy(compactRows.filter((row) => row.isUnmatched), (row) => row.role),
    eventContexts,
    raceContexts,
    comparisonPlan,
    safeNewPeople,
    heldNewPeople: heldForReview,
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
  const [
    sources,
    matches,
    reviews,
    elections,
    races,
    regions,
    electionCanonicalMap,
    raceCanonicalMap,
  ] = await Promise.all([
    fetchRows(
      config,
      'source_people',
      'id,source_person_key,raw_name,normalized_name,gender,party,position,district,election_year,source_payload',
      { source_type: `eq.${sourceType}`, source_id: `eq.${sourceId}`, order: 'id.asc' },
    ),
    fetchRows(config, 'person_identity_matches', 'source_person_id,match_status', {
      match_status: 'eq.auto_matched',
      order: 'source_person_id.asc',
    }),
    fetchRows(
      config,
      'person_identity_review_queue',
      'source_person_id,review_status,candidate_count,best_match_score',
      { order: 'source_person_id.asc' },
    ),
    fetchRows(config, 'elections', 'id,external_id,name,year,election_type', { order: 'id.asc' }),
    fetchRows(config, 'races', 'id,external_id,election_id,region_id,race_type,title', { order: 'id.asc' }),
    fetchRows(config, 'regions', 'id,name,region_type', { order: 'id.asc' }),
    fetchRows(config, 'election_canonical_map', 'election_id,canonical_election_id', {
      order: 'election_id.asc',
    }),
    fetchRows(config, 'race_canonical_map', 'race_id,canonical_race_id', {
      order: 'race_id.asc',
    }),
  ]);
  return {
    sources,
    matches,
    reviews,
    elections,
    races,
    regions,
    electionCanonicalMap,
    raceCanonicalMap,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localEnv = readLocalEnv();
  const config = {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || 'http://127.0.0.1:54321',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!config.serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for the historical CEC preview.');
  if (!localHostnames.has(new URL(config.supabaseUrl).hostname)) {
    throw new Error('Historical CEC preview only reads the local Supabase instance.');
  }

  const report = buildHistoricalCecCorePreview(await loadDataset(config));
  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    output: options.write ? path.relative(repoRoot, options.outputPath) : null,
    ...report.summary,
    reviewStatusCounts: report.reviewStatusCounts,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`historical CEC core preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
