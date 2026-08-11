import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import { getRaceRegionGroup } from '../data/electionEvents';
import type {
  PublicCandidate,
  PublicCompany,
  PublicElection,
  PublicElectionEducationDistribution,
  PublicElectionRaceFacet,
  PublicElectionRaceSummary,
  PublicHomeElectionTicker,
  PublicPartyElectionPerformance,
  PublicLocalOfficeSummary,
  PublicParty,
  PublicPartyCompanyContributionSummary,
  PublicPartyFinanceSummary,
  PublicPartyLegalStatistics,
  PublicPartyPeopleStatisticRow,
  PublicPartyOfficer,
  PublicPerson,
  PublicPersonClaim,
  PublicPersonFilters,
  PublicPersonListItem,
  PublicPersonPartyAffiliation,
  PublicPersonProfile,
  PublicPersonRole,
  PublicPersonStatus,
  PublicRace,
  PublicRegion,
  PublicRegionElectionSummary,
} from '../types/publicViews';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import type { PollComparison } from '../types/polling';
import { electionPath, partyPath, personPath, regionPath } from '../routes/routePaths';
import type { HomePageData, HomeTicker, PublicCandidateListPage, PublicDataProvider, PublicElectionIndexData, PublicPersonListPage, PublicRaceDetailData, PublicRaceListPage, PublicRaceQueryFilters, PublicSearchResult } from './publicDataProvider';
import { buildPartyLegalStatistics } from './legalStatistics.ts';
import { buildPartyPeopleStatistics } from './partyPeopleStatistics.ts';
import {
  buildLocalOfficeSummary,
  buildPersonListItems,
  buildPersonProfileFromItems,
  filterPersonListItems,
} from './personData';
import { type AllowedPublicViewName, assertPublicViewName } from './publicViewRegistry';
import { getSupabasePublicClient } from './supabasePublicClient';
import {
  mapPublicCandidateRow,
  mapPublicCompanyRow,
  mapPublicElectionRow,
  mapPublicHomeElectionTickerRow,
  mapPublicPartyCompanyContributionSummaryRow,
  mapPublicPartyFinanceSummaryRow,
  mapPublicPartyOfficerRow,
  mapPublicPartyRow,
  mapPublicPersonClaimRow,
  mapPublicPersonPartyAffiliationRow,
  mapPublicPersonRow,
  mapPublicRaceRow,
  mapPublicRegionElectionSummaryRow,
  mapPublicRegionRow,
  mapRaceToUpcomingRace,
  mapRegionSummaryToRegionCard,
  mapRegionSummaryToStageRegionSummary,
  mapRegionToStageRegionNode,
  mapTickerToHomeTicker,
} from './supabasePublicViewMappers';
import { PUBLIC_SEARCH_RESULT_LIMIT, toPublicPageRange } from './publicReadContracts';

const emptyHomeTicker: HomeTicker = {
  title: '公開選舉資料待載入',
  date: '待公告',
  electionId: null,
};

const emptyHomePageData: HomePageData = {
  ticker: emptyHomeTicker,
  regions: [],
  stageRegions: [],
  stageRegionSummaries: [],
  upcomingRaces: [],
  dataPrinciples: [
    '前端僅可讀取 approved public views。',
    '尚未啟用 Supabase provider，畫面需保留 safe fallback。',
    '不顯示未審核資料。',
  ],
};

const peopleRoleLabels: Record<PublicPersonRole, string> = {
  president: '總統',
  vice_president: '副總統',
  legislator: '立法委員',
  local_chief: '縣市首長',
  local_deputy: '副縣市首長',
  agency_head: '主要單位首長',
  councilor: '議員',
  party_officer: '政黨職務',
  candidate: '候選人',
  other: '其他公眾人物',
};

const peopleStatusLabels: Record<PublicPersonStatus, string> = {
  current: '現任',
  candidate: '參選中',
  former: '曾任／卸任',
  other: '其他',
};

type PublicPeopleListCachedRow = PublicPerson & {
  list_role: PublicPersonRole;
  list_status: PublicPersonStatus;
};

type SupabasePublicSnapshotIndexes = {
  regionLookupKeysByRegionId: Map<string, Set<string>>;
  regionSummaryByLookupKey: Map<string, StageRegionSummary>;
  regionCardByLookupKey: Map<string, RegionCard>;
  stageRegionById: Map<string, StageRegionNode>;
  childStageRegionsByParentId: Map<string, StageRegionNode[]>;
  relatedRacesByRegionId: Map<string, UpcomingRace[]>;
  electionById: Map<string, PublicElection>;
  raceById: Map<string, PublicRace>;
  racesByElectionId: Map<string, PublicRace[]>;
  candidatesByElectionId: Map<string, PublicCandidate[]>;
  candidatesByRaceId: Map<string, PublicCandidate[]>;
  personById: Map<string, PublicPerson>;
  personListItems: PublicPersonListItem[] | null;
  personProfilesById: Map<string, PublicPersonProfile | null>;
  partyBySlug: Map<string, PublicParty>;
  partyFinanceSummariesByPartyId: Map<string, PublicPartyFinanceSummary[]>;
  partyCompanyContributionSummariesByPartyId: Map<string, PublicPartyCompanyContributionSummary[]>;
};

type SupabasePublicSnapshot = {
  homeTicker: HomeTicker;
  regionCards: RegionCard[];
  stageRegions: StageRegionNode[];
  stageRegionSummaries: StageRegionSummary[];
  upcomingRaces: UpcomingRace[];
  people: PublicPerson[];
  companies: PublicCompany[];
  elections: PublicElection[];
  races: PublicRace[];
  candidates: PublicCandidate[];
  personClaims: PublicPersonClaim[];
  personPartyAffiliations: PublicPersonPartyAffiliation[];
  parties: PublicParty[];
  partyFinanceSummaries: PublicPartyFinanceSummary[];
  partyCompanyContributionSummaries: PublicPartyCompanyContributionSummary[];
  indexes: SupabasePublicSnapshotIndexes;
};

let snapshotCache: SupabasePublicSnapshot | null = null;
let homeSnapshotPromise: Promise<SupabasePublicSnapshot | null> | null = null;
let peopleSnapshotPromise: Promise<SupabasePublicSnapshot | null> | null = null;
let defaultPeopleDatasetLoaded = false;
let partySnapshotPromise: Promise<SupabasePublicSnapshot | null> | null = null;
const partyOfficerCache = new Map<string, PublicPartyOfficer[]>();
const partyOfficerPromises = new Map<string, Promise<PublicPartyOfficer[]>>();
let electionIndexSnapshotPromise: Promise<SupabasePublicSnapshot | null> | null = null;
let electionIndexDatasetLoaded = false;
const electionSnapshotPromises = new Map<string, Promise<SupabasePublicSnapshot | null>>();
const loadedElectionDatasets = new Set<string>();
const personSnapshotPromises = new Map<string, Promise<SupabasePublicSnapshot | null>>();
const loadedPersonProfileDatasets = new Set<string>();
const peopleSearchSnapshotPromises = new Map<string, Promise<SupabasePublicSnapshot | null>>();
const loadedPeopleSearchQueries = new Set<string>();
const localOfficeSummaryCache = new Map<string, PublicLocalOfficeSummary>();
const localOfficeSummaryPromises = new Map<string, Promise<PublicLocalOfficeSummary>>();
const peoplePageCache = new Map<string, PublicPersonListPage>();
const peoplePagePromises = new Map<string, Promise<PublicPersonListPage>>();
const peoplePageBlockSize = 1;
const electionRacePageCache = new Map<string, PublicRaceListPage>();
const electionRacePagePromises = new Map<string, Promise<PublicRaceListPage>>();
const electionRacePageBlockSize = 1;

function addLookupValue<T>(index: Map<string, T>, key: string | null | undefined, value: T) {
  if (!key) return;
  if (!index.has(key)) {
    index.set(key, value);
  }

  const normalizedKey = key.replace(/^region-/, '');
  if (!index.has(normalizedKey)) {
    index.set(normalizedKey, value);
  }
}

function addArrayIndexValue<T>(index: Map<string, T[]>, key: string | null | undefined, value: T) {
  if (!key) return;
  const values = index.get(key) ?? [];
  values.push(value);
  index.set(key, values);
}

function buildSnapshotIndexes(params: {
  stageRegions: StageRegionNode[];
  stageRegionSummaries: StageRegionSummary[];
  regionCards: RegionCard[];
  upcomingRaces: UpcomingRace[];
  elections: PublicElection[];
  races: PublicRace[];
  candidates: PublicCandidate[];
  people: PublicPerson[];
  parties: PublicParty[];
  partyFinanceSummaries: PublicPartyFinanceSummary[];
  partyCompanyContributionSummaries: PublicPartyCompanyContributionSummary[];
}): SupabasePublicSnapshotIndexes {
  const regionLookupKeysByRegionId = new Map<string, Set<string>>();
  const regionSummaryByLookupKey = new Map<string, StageRegionSummary>();
  const regionCardByLookupKey = new Map<string, RegionCard>();
  const stageRegionById = new Map(params.stageRegions.map((region) => [region.id, region]));
  const childStageRegionsByParentId = new Map<string, StageRegionNode[]>();
  const relatedRacesByRegionId = new Map<string, UpcomingRace[]>();
  const electionById = new Map(params.elections.map((election) => [election.election_id, election]));
  const raceById = new Map(params.races.map((race) => [race.race_id, race]));
  const racesByElectionId = new Map<string, PublicRace[]>();
  const candidatesByElectionId = new Map<string, PublicCandidate[]>();
  const candidatesByRaceId = new Map<string, PublicCandidate[]>();
  const personById = new Map(params.people.map((person) => [person.person_id, person]));
  const partyBySlug = new Map(params.parties.map((party) => [party.slug, party]));
  const partyFinanceSummariesByPartyId = new Map<string, PublicPartyFinanceSummary[]>();
  const partyCompanyContributionSummariesByPartyId = new Map<string, PublicPartyCompanyContributionSummary[]>();
  const nationalRaceIds = new Set(params.upcomingRaces.filter(isNationalUpcomingRace).map((race) => race.id));

  for (const region of params.stageRegions) {
    addArrayIndexValue(childStageRegionsByParentId, region.parentId, region);
    const keys = toRegionLookupKeys(region.id, params.stageRegions);
    for (const key of keys) {
      regionLookupKeysByRegionId.set(key, keys);
    }
  }

  for (const summary of params.stageRegionSummaries) {
    addLookupValue(regionSummaryByLookupKey, summary.regionId, summary);
  }

  for (const card of params.regionCards) {
    addLookupValue(regionCardByLookupKey, card.id, card);
  }

  for (const region of params.stageRegions) {
    const keys = toRegionAndDescendantLookupKeys(region.id, params.stageRegions);
    const relatedRaces = params.upcomingRaces.filter((race) => keys.has(race.regionId) || nationalRaceIds.has(race.id));
    for (const key of toRegionLookupKeys(region.id, params.stageRegions)) {
      relatedRacesByRegionId.set(key, relatedRaces);
    }
  }

  for (const race of params.races) {
    addArrayIndexValue(racesByElectionId, race.election_id, race);
  }

  for (const candidate of params.candidates) {
    addArrayIndexValue(candidatesByElectionId, candidate.election_id, candidate);
    addArrayIndexValue(candidatesByRaceId, candidate.race_id, candidate);
  }

  for (const summary of params.partyFinanceSummaries) {
    addArrayIndexValue(partyFinanceSummariesByPartyId, summary.party_id, summary);
  }

  for (const summary of params.partyCompanyContributionSummaries) {
    addArrayIndexValue(partyCompanyContributionSummariesByPartyId, summary.party_id, summary);
  }

  return {
    regionLookupKeysByRegionId,
    regionSummaryByLookupKey,
    regionCardByLookupKey,
    stageRegionById,
    childStageRegionsByParentId,
    relatedRacesByRegionId,
    electionById,
    raceById,
    racesByElectionId,
    candidatesByElectionId,
    candidatesByRaceId,
    personById,
    personListItems: null,
    personProfilesById: new Map<string, PublicPersonProfile | null>(),
    partyBySlug,
    partyFinanceSummariesByPartyId,
    partyCompanyContributionSummariesByPartyId,
  };
}

function fromPublicView(viewName: AllowedPublicViewName) {
  assertPublicViewName(viewName);
  const client = getSupabasePublicClient();

  if (!client) {
    return null;
  }

  return client.from(viewName);
}

async function fetchRows<T>(
  viewName: AllowedPublicViewName,
  configure?: (query: ReturnType<NonNullable<ReturnType<typeof fromPublicView>>['select']>) => ReturnType<NonNullable<ReturnType<typeof fromPublicView>>['select']>,
  maxRows = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const requestSize = Math.min(pageSize, maxRows - rows.length);
    if (requestSize <= 0) return rows;

    const view = fromPublicView(viewName);

    if (!view) {
      return [];
    }

    const baseQuery = view.select('*');
    const query = configure ? configure(baseQuery) : baseQuery;
    const { data, error } = await query.range(offset, offset + requestSize - 1);

    if (error || !Array.isArray(data)) {
      if (error && import.meta.env.DEV) {
        console.warn(`Failed to fetch ${viewName}: ${error.message}`);
      }
      return [];
    }

    rows.push(...(data as T[]));

    if (data.length < requestSize) {
      return rows;
    }

    offset += pageSize;
  }
}

function buildStageRegions(regions: PublicRegion[]) {
  const byRegionId = new Map(regions.map((region) => [region.region_id, region]));

  return regions
    .slice()
    .sort((left, right) => (left.display_order ?? Number.MAX_SAFE_INTEGER) - (right.display_order ?? Number.MAX_SAFE_INTEGER))
    .map((region, index) => {
      const parentRegion = region.parent_region_id ? byRegionId.get(region.parent_region_id) ?? null : null;
      return mapRegionToStageRegionNode(region, index, parentRegion?.slug ?? null);
    });
}

function rebuildSnapshot(params: Omit<SupabasePublicSnapshot, 'indexes'>): SupabasePublicSnapshot {
  return {
    ...params,
    indexes: buildSnapshotIndexes({
      stageRegions: params.stageRegions,
      stageRegionSummaries: params.stageRegionSummaries,
      regionCards: params.regionCards,
      upcomingRaces: params.upcomingRaces,
      elections: params.elections,
      races: params.races,
      candidates: params.candidates,
      people: params.people,
      parties: params.parties,
      partyFinanceSummaries: params.partyFinanceSummaries,
      partyCompanyContributionSummaries: params.partyCompanyContributionSummaries,
    }),
  };
}

function notifyPublicDataReady() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('public-data-ready'));
  }
}

function mergeUniqueBy<T>(currentItems: T[], incomingItems: T[], getKey: (item: T) => string) {
  const byKey = new Map(currentItems.map((item) => [getKey(item), item]));
  for (const item of incomingItems) {
    byKey.set(getKey(item), item);
  }
  return Array.from(byKey.values());
}

function hasPersonSearchQuery(filters: { query?: string | null }) {
  return Boolean(filters.query?.trim());
}

function normalizePeopleSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

function regionLabelVariants(label: string) {
  return Array.from(new Set([label, label.replace(/臺/g, '台'), label.replace(/台/g, '臺')]));
}

function isGrassrootsPosition(value: string | null | undefined) {
  return Boolean(value?.includes("村里") || value?.includes("代表"));
}

function isGrassrootsPersonListItem(person: PublicPersonListItem) {
  return [person.position, person.role_label, person.district, person.region_name].some(isGrassrootsPosition);
}

function mergeSnapshot(values: Partial<Omit<SupabasePublicSnapshot, 'indexes'>>) {
  const base = snapshotCache;
  snapshotCache = rebuildSnapshot({
    homeTicker: values.homeTicker ?? base?.homeTicker ?? emptyHomeTicker,
    regionCards: values.regionCards ?? base?.regionCards ?? [],
    stageRegions: values.stageRegions ?? base?.stageRegions ?? [],
    stageRegionSummaries: values.stageRegionSummaries ?? base?.stageRegionSummaries ?? [],
    upcomingRaces: values.upcomingRaces ?? base?.upcomingRaces ?? [],
    people: values.people ?? base?.people ?? [],
    companies: values.companies ?? base?.companies ?? [],
    elections: values.elections ?? base?.elections ?? [],
    races: values.races ?? base?.races ?? [],
    candidates: values.candidates ?? base?.candidates ?? [],
    personClaims: values.personClaims ?? base?.personClaims ?? [],
    personPartyAffiliations: values.personPartyAffiliations ?? base?.personPartyAffiliations ?? [],
    parties: values.parties ?? base?.parties ?? [],
    partyFinanceSummaries: values.partyFinanceSummaries ?? base?.partyFinanceSummaries ?? [],
    partyCompanyContributionSummaries: values.partyCompanyContributionSummaries ?? base?.partyCompanyContributionSummaries ?? [],
  });
  return snapshotCache;
}

function buildSnapshot(params: {
  tickerRows: unknown[];
  regionSummaryRows: unknown[];
  regionRows: unknown[];
  personRows: unknown[];
  companyRows: unknown[];
  electionRows: unknown[];
  raceRows: unknown[];
  candidateRows: unknown[];
  personClaimRows: unknown[];
  personPartyAffiliationRows: unknown[];
  partyRows: unknown[];
  partyFinanceRows: unknown[];
  partyCompanyContributionRows: unknown[];
}): SupabasePublicSnapshot {
  const homeTickerRow = params.tickerRows[0];
  const regionSummaries = params.regionSummaryRows.map((row) => mapPublicRegionElectionSummaryRow(row as PublicRegionElectionSummary));
  const regionCards = regionSummaries.map((row) => mapRegionSummaryToRegionCard(row));
  const stageRegionSummaries = regionSummaries.map((row) => mapRegionSummaryToStageRegionSummary(row));
  const regions = params.regionRows.map((row) => mapPublicRegionRow(row as PublicRegion));
  const stageRegions = buildStageRegions(regions);
  const people = params.personRows.map((row) => mapPublicPersonRow(row as PublicPerson));
  const companies = params.companyRows.map((row) => mapPublicCompanyRow(row as PublicCompany));
  const elections = params.electionRows.map((row) => mapPublicElectionRow(row as PublicElection));
  const races = params.raceRows.map((row) => mapPublicRaceRow(row as PublicRace));
  const candidates = params.candidateRows.map((row) => mapPublicCandidateRow(row as PublicCandidate));
  const personClaims = params.personClaimRows.map((row) => mapPublicPersonClaimRow(row as PublicPersonClaim));
  const personPartyAffiliations = params.personPartyAffiliationRows.map((row) =>
    mapPublicPersonPartyAffiliationRow(row as PublicPersonPartyAffiliation),
  );
  const upcomingRaces = races.map((race) => mapRaceToUpcomingRace(race));
  const parties = params.partyRows.map((row) => mapPublicPartyRow(row as PublicParty));
  const partyFinanceSummaries = params.partyFinanceRows.map((row) =>
    mapPublicPartyFinanceSummaryRow(row as PublicPartyFinanceSummary),
  );
  const partyCompanyContributionSummaries = params.partyCompanyContributionRows.map((row) =>
    mapPublicPartyCompanyContributionSummaryRow(row as PublicPartyCompanyContributionSummary),
  );
  const indexes = buildSnapshotIndexes({
    stageRegions,
    stageRegionSummaries,
    regionCards,
    upcomingRaces,
    elections,
    races,
    candidates,
    people,
    parties,
    partyFinanceSummaries,
    partyCompanyContributionSummaries,
  });

  return {
    homeTicker: homeTickerRow ? mapTickerToHomeTicker(mapPublicHomeElectionTickerRow(homeTickerRow as PublicHomeElectionTicker)) : emptyHomeTicker,
    regionCards,
    stageRegions,
    stageRegionSummaries,
    upcomingRaces,
    people,
    companies,
    elections,
    races,
    candidates,
    personClaims,
    personPartyAffiliations,
    parties,
    partyFinanceSummaries,
    partyCompanyContributionSummaries,
    indexes,
  };
}

async function loadHomeSnapshot(): Promise<SupabasePublicSnapshot | null> {
  if (!getSupabasePublicClient()) {
    snapshotCache = null;
    return null;
  }

  const homeRegionTypes = ['country', 'municipality', 'county', 'city'];
  const [tickerRows, regionSummaryRows, regionRows, raceRows, partyRows, partyFinanceRows, partyCompanyContributionRows] = await Promise.all([
    fetchRows('public_home_election_ticker'),
    fetchRows('public_region_election_summary', (query) => query.in('region_type', homeRegionTypes)),
    fetchRows('public_regions', (query) => query.in('region_type', homeRegionTypes)),
    fetchRows('public_races', (query) => query.neq('status', 'completed')),
    fetchRows('public_parties'),
    fetchRows('public_party_finance_summaries'),
    fetchRows('public_party_company_contribution_summaries'),
  ]);

  snapshotCache = buildSnapshot({
    tickerRows,
    regionSummaryRows,
    regionRows,
    personRows: [],
    companyRows: [],
    electionRows: [],
    raceRows,
    candidateRows: [],
    personClaimRows: [],
    personPartyAffiliationRows: [],
    partyRows,
    partyFinanceRows,
    partyCompanyContributionRows,
  });
  return snapshotCache;
}

export async function refreshSupabasePublicDataSnapshot(): Promise<SupabasePublicSnapshot | null> {
  if (snapshotCache && snapshotCache.stageRegions.length > 0) {
    return snapshotCache;
  }

  homeSnapshotPromise ??= loadHomeSnapshot().finally(() => {
    homeSnapshotPromise = null;
  });
  return homeSnapshotPromise;
}

function peoplePageCacheKey(filters: PublicPersonFilters, page: number, pageSize: number) {
  return JSON.stringify([
    filters.query?.trim().toLowerCase() ?? '',
    filters.regionId ?? '',
    filters.party ?? '',
    filters.role ?? '',
    filters.status ?? '',
    page,
    pageSize,
  ]);
}

function loadCachedPeoplePage(filters: PublicPersonFilters, page: number, pageSize: number) {
  const cacheKey = peoplePageCacheKey(filters, page, pageSize);
  const cachedPage = peoplePageCache.get(cacheKey);
  if (cachedPage) return Promise.resolve(cachedPage);

  const blockStartPage = Math.floor((page - 1) / peoplePageBlockSize) * peoplePageBlockSize + 1;
  const blockCacheKey = peoplePageCacheKey(filters, blockStartPage, pageSize);
  let blockPromise = peoplePagePromises.get(blockCacheKey);

  if (!blockPromise) {
    blockPromise = fetchPeoplePage(filters, blockStartPage, pageSize)
      .then((result) => {
        for (let index = 0; index < peoplePageBlockSize; index += 1) {
          const blockPage = blockStartPage + index;
          const itemStart = index * pageSize;
          peoplePageCache.set(
            peoplePageCacheKey(filters, blockPage, pageSize),
            { items: result.items.slice(itemStart, itemStart + pageSize), total: result.total },
          );
        }

        return result;
      })
      .finally(() => {
        peoplePagePromises.delete(blockCacheKey);
      });
    peoplePagePromises.set(blockCacheKey, blockPromise);
  }

  return blockPromise.then((result) => peoplePageCache.get(cacheKey) ?? { items: [], total: result.total });
}

async function fetchPeoplePage(
  filters: PublicPersonFilters,
  page: number,
  pageSize: number,
): Promise<PublicPersonListPage> {
  await refreshSupabasePublicDataSnapshot();

  const snapshot = getSnapshot();
  const view = fromPublicView('public_people_list_cached');
  if (!snapshot || !view) {
    return { items: [], total: 0 };
  }

  let query = view.select('*', { count: 'exact' });
  const normalizedQuery = filters.query?.trim();

  if (normalizedQuery) {
    query = query.ilike('name', '%' + normalizedQuery + '%');
  } else {
    query = query.eq('list_is_grassroots', false);
  }

  if (filters.party) {
    const partyNames = filters.party === '台灣民眾黨' || filters.party === '臺灣民眾黨'
      ? ['台灣民眾黨', '臺灣民眾黨']
      : [filters.party];
    query = query.in('party', partyNames);
  }

  if (filters.regionId) {
    const region = snapshot.indexes.stageRegionById.get(filters.regionId);
    const labels = regionLabelVariants(region?.label ?? filters.regionId);
    query = query.or(labels.map((label) => 'district.ilike.' + label + '%').join(','));
  }

  if (filters.role) query = query.eq('list_role', filters.role);
  if (filters.status) query = query.eq('list_status', filters.status);

  const pageRange = toPublicPageRange(page, pageSize);
  const { data, error, count } = await query
    .order('list_status_order', { ascending: true })
    .order('list_role_order', { ascending: true })
    .order('name', { ascending: true })
    .range(pageRange.from, pageRange.to);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to fetch public people page: ' + error.message);
    }
    throw new Error('Failed to fetch public people page.');
  }

  if (!Array.isArray(data)) {
    throw new Error('Public people page returned an invalid response.');
  }

  const listRows = data as PublicPeopleListCachedRow[];
  const people = listRows.map((row) => mapPublicPersonRow(row));
  const items = buildPersonListItems(people, [], snapshot.stageRegions).map((item, index) => {
    const row = listRows[index];
    const role = row.list_role ?? item.role;
    const status = row.list_status ?? item.status;
    const roleLabel = peopleRoleLabels[role];
    const regionName = item.region_name ?? row.district;
    const displayPositionLabel = status === 'current'
      ? row.current_office_label?.trim()
        || row.position?.trim()
        || (role === 'other' ? null : `${regionName ?? ''}${roleLabel}`)
      : status === 'candidate'
        ? row.upcoming_candidate_label?.trim() || row.position?.trim() || null
        : null;

    return {
      ...item,
      role,
      role_label: roleLabel,
      status,
      status_label: peopleStatusLabels[status],
      display_position_label: displayPositionLabel,
      candidate_count: 0,
      merged_role_labels: [roleLabel],
      merged_candidate_count: 0,
    };
  });

  return { items, total: count ?? items.length };
}

async function fetchPartyCandidatePage(
  partyName: string,
  page: number,
  pageSize: number,
): Promise<PublicCandidateListPage> {
  await refreshSupabasePublicDataSnapshot();

  const view = fromPublicView('public_candidates');
  const normalizedPartyName = partyName.trim();
  if (!view || !normalizedPartyName) {
    return { items: [], total: 0 };
  }

  const partyNames = normalizedPartyName === '台灣民眾黨' || normalizedPartyName === '臺灣民眾黨'
    ? ['台灣民眾黨', '臺灣民眾黨']
    : [normalizedPartyName];
  const pageRange = toPublicPageRange(page, pageSize);
  const { data, error, count } = await view
    .select('*', { count: 'exact' })
    .in('party', partyNames)
    .in('candidacy_status', ['potential', 'party_nominee', 'officially_announced', 'registered', 'qualified'])
    .eq('election_result', 'pending')
    .order('election_year', { ascending: false, nullsFirst: false })
    .order('region_name', { ascending: true, nullsFirst: false })
    .order('race_title', { ascending: true })
    .order('person_name', { ascending: true })
    .order('candidate_id', { ascending: true })
    .range(pageRange.from, pageRange.to);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to fetch public party candidate page: ' + error.message);
    }
    throw new Error('Failed to fetch public party candidate page.');
  }

  if (!Array.isArray(data)) {
    throw new Error('Public party candidate page returned an invalid response.');
  }

  const items = data.map((row) => mapPublicCandidateRow(row as PublicCandidate));
  return { items, total: count ?? items.length };
}

function electionRacePageCacheKey(
  eventKey: string,
  filters: PublicRaceQueryFilters,
  page: number,
  pageSize: number,
) {
  return JSON.stringify([
    eventKey,
    [...(filters.raceTypes ?? [])].sort(),
    filters.regionKey ?? '',
    page,
    pageSize,
  ]);
}

function loadCachedElectionRacePage(
  eventKey: string,
  filters: PublicRaceQueryFilters,
  page: number,
  pageSize: number,
) {
  const cacheKey = electionRacePageCacheKey(eventKey, filters, page, pageSize);
  const cachedPage = electionRacePageCache.get(cacheKey);
  if (cachedPage) return Promise.resolve(cachedPage);

  const blockStartPage = Math.floor((page - 1) / electionRacePageBlockSize) * electionRacePageBlockSize + 1;
  const blockCacheKey = electionRacePageCacheKey(eventKey, filters, blockStartPage, pageSize);
  let blockPromise = electionRacePagePromises.get(blockCacheKey);

  if (!blockPromise) {
    blockPromise = fetchElectionRacePage(eventKey, filters, blockStartPage, pageSize)
      .then((result) => {
        for (let index = 0; index < electionRacePageBlockSize; index += 1) {
          const blockPage = blockStartPage + index;
          const itemStart = index * pageSize;
          electionRacePageCache.set(
            electionRacePageCacheKey(eventKey, filters, blockPage, pageSize),
            { items: result.items.slice(itemStart, itemStart + pageSize), total: result.total },
          );
        }

        return result;
      })
      .finally(() => {
        electionRacePagePromises.delete(blockCacheKey);
      });
    electionRacePagePromises.set(blockCacheKey, blockPromise);
  }

  return blockPromise.then((result) => electionRacePageCache.get(cacheKey) ?? { items: [], total: result.total });
}

async function fetchElectionRacePage(
  eventKey: string,
  filters: PublicRaceQueryFilters,
  page: number,
  pageSize: number,
): Promise<PublicRaceListPage> {
  await refreshSupabasePublicDataSnapshot();

  const view = fromPublicView('public_election_race_list');
  if (!view) return { items: [], total: 0 };

  let query = view.select('*', { count: 'exact' }).eq('event_key', eventKey);
  if (filters.raceTypes?.length) query = query.in('race_type', filters.raceTypes);
  if (filters.regionKey) query = query.eq('region_key', filters.regionKey);

  const pageRange = toPublicPageRange(page, pageSize);
  const { data, error, count } = await query
    .order('sort_category_order', { ascending: true })
    .order('sort_region_order', { ascending: true })
    .order('sort_district_order', { ascending: true, nullsFirst: true })
    .order('region_name', { ascending: true, nullsFirst: true })
    .order('title', { ascending: true })
    .order('race_id', { ascending: true })
    .range(pageRange.from, pageRange.to);

  if (error || !Array.isArray(data)) {
    if (error && import.meta.env.DEV) {
      console.warn('Failed to fetch public election race page: ' + error.message);
    }
    return { items: [], total: 0 };
  }

  return {
    items: data.map((row) => mapPublicRaceRow(row as PublicRace)),
    total: count ?? data.length,
  };
}

async function loadLocalOfficeSummary(regionId: string): Promise<PublicLocalOfficeSummary> {
  const cachedSummary = localOfficeSummaryCache.get(regionId);
  if (cachedSummary) {
    return cachedSummary;
  }

  if (!localOfficeSummaryPromises.has(regionId)) {
    localOfficeSummaryPromises.set(regionId, (async () => {
      await refreshSupabasePublicDataSnapshot();
      const snapshot = getSnapshot();
      const region = snapshot?.indexes.stageRegionById.get(regionId);

      if (!snapshot || !region) {
        return buildLocalOfficeSummary(regionId, [], [], []);
      }

      const labels = regionLabelVariants(region.label);
      const personRows = await fetchRows('public_people_list_cached', (query) =>
        query.or(labels.map((label) => 'district.ilike.' + label + '%').join(',')),
      );
      const people = personRows
        .map((row) => mapPublicPersonRow(row as PublicPerson))
        .filter((person) => {
          const position = person.position ?? '';
          const isAppointedLocalOffice = /副市長|副縣長|副縣市長|局長|處長|主任委員/.test(position);
          return isAppointedLocalOffice || Boolean(person.current_office_label);
        });
      const summary = buildLocalOfficeSummary(regionId, people, [], snapshot.stageRegions);
      localOfficeSummaryCache.set(regionId, summary);
      return summary;
    })().finally(() => {
      localOfficeSummaryPromises.delete(regionId);
    }));
  }

  return localOfficeSummaryPromises.get(regionId) ?? buildLocalOfficeSummary(regionId, [], [], []);
}

async function ensurePeopleDataset(filters: { query?: string | null } = {}) {
  if (hasPersonSearchQuery(filters)) {
    return ensurePeopleSearchDataset(filters.query ?? '');
  }

  if (defaultPeopleDatasetLoaded) {
    return snapshotCache;
  }

  peopleSnapshotPromise ??= (async () => {
    await refreshSupabasePublicDataSnapshot();
    const personRows = await fetchRows(
      'public_people_list_cached',
      (query) => query.not('position', 'ilike', '%村里%').not('position', 'ilike', '%代表%'),
    );
    const base = snapshotCache;
    const people = mergeUniqueBy(
      base?.people ?? [],
      personRows.map((row) => mapPublicPersonRow(row as PublicPerson)),
      (item) => item.person_id,
    );
    defaultPeopleDatasetLoaded = true;
    const snapshot = mergeSnapshot({ people });
    notifyPublicDataReady();
    return snapshot;
  })().finally(() => {
    peopleSnapshotPromise = null;
  });

  return peopleSnapshotPromise;
}

async function ensurePeopleSearchDataset(query: string) {
  const normalizedQuery = normalizePeopleSearchQuery(query);

  if (normalizedQuery.length === 0 || loadedPeopleSearchQueries.has(normalizedQuery)) {
    return snapshotCache;
  }

  if (peopleSearchSnapshotPromises.has(normalizedQuery) === false) {
    peopleSearchSnapshotPromises.set(normalizedQuery, (async () => {
      await refreshSupabasePublicDataSnapshot();
      const pattern = '%' + query.trim() + '%';
      const personRows = await fetchRows(
        'public_people_list_cached',
        (request) =>
          request.or([
            'name.ilike.' + pattern,
            'alias.ilike.' + pattern,
            'party.ilike.' + pattern,
            'position.ilike.' + pattern,
            'district.ilike.' + pattern,
          ].join(',')),
        12,
      );
      const people = personRows.map((row) => mapPublicPersonRow(row as PublicPerson));
      const base = snapshotCache;
      const snapshot = mergeSnapshot({
        people: mergeUniqueBy(base?.people ?? [], people, (item) => item.person_id),
      });
      loadedPeopleSearchQueries.add(normalizedQuery);
      notifyPublicDataReady();
      return snapshot;
    })().finally(() => {
      peopleSearchSnapshotPromises.delete(normalizedQuery);
    }));
  }

  return peopleSearchSnapshotPromises.get(normalizedQuery) ?? null;
}

async function ensureElectionIndexDataset() {
  if (electionIndexDatasetLoaded) return snapshotCache;

  if (!electionIndexSnapshotPromise) {
    electionIndexSnapshotPromise = (async () => {
      await refreshSupabasePublicDataSnapshot();
      const [electionRows, raceRows] = await Promise.all([
        fetchRows('public_elections'),
        fetchRows('public_races'),
      ]);
      const base = snapshotCache;
      const elections = mergeUniqueBy(
        base?.elections ?? [],
        electionRows.map((row) => mapPublicElectionRow(row as PublicElection)),
        (item) => item.election_id,
      );
      const races = mergeUniqueBy(
        base?.races ?? [],
        raceRows.map((row) => mapPublicRaceRow(row as PublicRace)),
        (item) => item.race_id,
      );
      const snapshot = mergeSnapshot({ elections, races });

      if (electionRows.length > 0 || raceRows.length > 0) {
        electionIndexDatasetLoaded = true;
      }

      notifyPublicDataReady();
      return snapshot;
    })().finally(() => {
      electionIndexSnapshotPromise = null;
    });
  }

  return electionIndexSnapshotPromise;
}

async function ensureElectionDataset(electionId: string) {
  if (!electionId) return snapshotCache;
  if (loadedElectionDatasets.has(electionId)) {
    return snapshotCache;
  }

  if (!electionSnapshotPromises.has(electionId)) {
    electionSnapshotPromises.set(electionId, (async () => {
      await refreshSupabasePublicDataSnapshot();
      const [electionRows, raceRows, candidateRows] = await Promise.all([
        fetchRows('public_elections', (query) => query.eq('election_id', electionId)),
        fetchRows('public_races', (query) => query.eq('election_id', electionId)),
        fetchRows('public_candidates', (query) => query.eq('election_id', electionId)),
      ]);
      const base = snapshotCache;
      const elections = mergeUniqueBy(
        base?.elections ?? [],
        electionRows.map((row) => mapPublicElectionRow(row as PublicElection)),
        (item) => item.election_id,
      );
      const races = mergeUniqueBy(
        base?.races ?? [],
        raceRows.map((row) => mapPublicRaceRow(row as PublicRace)),
        (item) => item.race_id,
      );
      const candidates = mergeUniqueBy(
        base?.candidates ?? [],
        candidateRows.map((row) => mapPublicCandidateRow(row as PublicCandidate)),
        (item) => item.candidate_id,
      );
      const snapshot = mergeSnapshot({ elections, races, candidates });
      loadedElectionDatasets.add(electionId);
      notifyPublicDataReady();
      return snapshot;
    })().finally(() => {
      electionSnapshotPromises.delete(electionId);
    }));
  }

  return electionSnapshotPromises.get(electionId) ?? null;
}

async function ensurePersonProfileDatasets(personIds: string[]) {
  const missingPersonIds = Array.from(new Set(personIds.filter(Boolean)))
    .filter((personId) => !loadedPersonProfileDatasets.has(personId));
  if (missingPersonIds.length === 0) return snapshotCache;

  const batchKey = missingPersonIds.slice().sort().join(',');
  if (!personSnapshotPromises.has(batchKey)) {
    personSnapshotPromises.set(batchKey, (async () => {
      await refreshSupabasePublicDataSnapshot();
      const [personRows, candidateRows, claimRows, partyAffiliationRows] = await Promise.all([
        fetchRows('public_people_list_cached', (query) => query.in('person_id', missingPersonIds)),
        fetchRows('public_candidates', (query) => query.in('person_id', missingPersonIds)),
        fetchRows('public_person_claims', (query) => query.in('person_id', missingPersonIds)),
        fetchRows('public_person_party_affiliations', (query) => query.in('person_id', missingPersonIds)),
      ]);
      const base = snapshotCache;
      const people = mergeUniqueBy(
        base?.people ?? [],
        personRows.map((row) => mapPublicPersonRow(row as PublicPerson)),
        (item) => item.person_id,
      );
      const candidates = mergeUniqueBy(
        base?.candidates ?? [],
        candidateRows.map((row) => mapPublicCandidateRow(row as PublicCandidate)),
        (item) => item.candidate_id,
      );
      const personClaims = mergeUniqueBy(
        base?.personClaims ?? [],
        claimRows.map((row) => mapPublicPersonClaimRow(row as PublicPersonClaim)),
        (item) => item.claim_id,
      );
      const personPartyAffiliations = mergeUniqueBy(
        base?.personPartyAffiliations ?? [],
        partyAffiliationRows.map((row) => mapPublicPersonPartyAffiliationRow(row as PublicPersonPartyAffiliation)),
        (item) => item.affiliation_id,
      );
      const snapshot = mergeSnapshot({ people, candidates, personClaims, personPartyAffiliations });
      missingPersonIds.forEach((personId) => loadedPersonProfileDatasets.add(personId));
      notifyPublicDataReady();
      return snapshot;
    })().finally(() => {
      personSnapshotPromises.delete(batchKey);
    }));
  }

  return personSnapshotPromises.get(batchKey) ?? null;
}

async function ensurePersonProfileDataset(personId: string) {
  return ensurePersonProfileDatasets([personId]);
}

async function ensurePartyDataset() {
  if (snapshotCache?.parties.length) {
    return snapshotCache;
  }

  partySnapshotPromise ??= (async () => {
    await refreshSupabasePublicDataSnapshot();
    const [partyRows, partyFinanceRows, partyCompanyContributionRows] = await Promise.all([
      fetchRows('public_parties'),
      fetchRows('public_party_finance_summaries'),
      fetchRows('public_party_company_contribution_summaries'),
    ]);
    const parties = partyRows.map((row) => mapPublicPartyRow(row as PublicParty));
    const partyFinanceSummaries = partyFinanceRows.map((row) =>
      mapPublicPartyFinanceSummaryRow(row as PublicPartyFinanceSummary),
    );
    const partyCompanyContributionSummaries = partyCompanyContributionRows.map((row) =>
      mapPublicPartyCompanyContributionSummaryRow(row as PublicPartyCompanyContributionSummary),
    );
    const snapshot = mergeSnapshot({ parties, partyFinanceSummaries, partyCompanyContributionSummaries });
    notifyPublicDataReady();
    return snapshot;
  })().finally(() => {
    partySnapshotPromise = null;
  });

  return partySnapshotPromise;
}

async function loadPartyOfficersByPartyId(partyId: string) {
  const cached = partyOfficerCache.get(partyId);
  if (cached) return cached;

  if (!partyOfficerPromises.has(partyId)) {
    partyOfficerPromises.set(partyId, (async () => {
      await refreshSupabasePublicDataSnapshot();
      const rows = await fetchRows(
        'public_party_officers',
        (query) => query.eq('party_id', partyId).order('display_order', { ascending: true, nullsFirst: false }).order('person_name'),
      );
      const officers = rows.map((row) => mapPublicPartyOfficerRow(row as PublicPartyOfficer));
      partyOfficerCache.set(partyId, officers);
      return officers;
    })().finally(() => {
      partyOfficerPromises.delete(partyId);
    }));
  }

  return partyOfficerPromises.get(partyId) ?? [];
}

function getSnapshot() {
  return snapshotCache;
}

function getPersonProfileFromSnapshot(snapshot: SupabasePublicSnapshot, personId: string) {
  if (!snapshot.indexes.personProfilesById.has(personId)) {
    snapshot.indexes.personProfilesById.set(
      personId,
      buildPersonProfileFromItems(
        personId,
        getPersonListItems(snapshot),
        snapshot.candidates,
        snapshot.personClaims,
        snapshot.personPartyAffiliations,
      ),
    );
  }

  return snapshot.indexes.personProfilesById.get(personId) ?? null;
}

function getPersonListItems(snapshot: SupabasePublicSnapshot) {
  if (!snapshot.indexes.personListItems) {
    snapshot.indexes.personListItems = buildPersonListItems(
      snapshot.people,
      snapshot.candidates,
      snapshot.stageRegions,
      snapshot.personClaims,
    );
  }

  return snapshot.indexes.personListItems;
}

function getRegionLookupKeys(snapshot: SupabasePublicSnapshot, regionId: string) {
  return snapshot.indexes.regionLookupKeysByRegionId.get(regionId) ?? new Set([regionId, regionId.replace(/^region-/, '')]);
}

function lookupByRegionKeys<T>(keys: Set<string>, index: Map<string, T>) {
  for (const key of keys) {
    const value = index.get(key);
    if (value) {
      return value;
    }
  }

  return null;
}

function toRegionLookupKeys(regionId: string, stageRegions: StageRegionNode[]) {
  const keys = new Set<string>([regionId, regionId.replace(/^region-/, '')]);
  const stageRegion = stageRegions.find((item) => item.id === regionId);

  if (stageRegion?.publicRegionId) {
    keys.add(stageRegion.publicRegionId);
    keys.add(stageRegion.publicRegionId.replace(/^region-/, ''));
  }

  return keys;
}

function toRegionAndDescendantLookupKeys(regionId: string, stageRegions: StageRegionNode[]) {
  const keys = toRegionLookupKeys(regionId, stageRegions);
  const nationalRegions = stageRegions.filter((region) => region.level === 'country' || region.id === 'taiwan' || region.label === '臺灣');
  const queuedRegionIds = [regionId];

  for (const nationalRegion of nationalRegions) {
    for (const key of toRegionLookupKeys(nationalRegion.id, stageRegions)) {
      keys.add(key);
    }
  }

  while (queuedRegionIds.length > 0) {
    const parentId = queuedRegionIds.shift();
    const children = stageRegions.filter((region) => region.parentId === parentId);

    for (const child of children) {
      for (const key of toRegionLookupKeys(child.id, stageRegions)) {
        keys.add(key);
      }
      queuedRegionIds.push(child.id);
    }
  }

  return keys;
}

function includesQuery(value: string | null | undefined, normalizedQuery: string) {
  return value?.toLowerCase().includes(normalizedQuery) ?? false;
}

function isNationalUpcomingRace(race: UpcomingRace) {
  return (
    race.raceType === 'president' ||
    race.raceType === 'vice_president' ||
    race.raceType === 'party_list_legislator' ||
    race.raceType === 'referendum' ||
    ['taiwan', 'region-taiwan', '全國', '臺灣', '台灣'].includes(race.regionId) ||
    ['全國', '臺灣', '台灣'].includes(race.region)
  );
}

export const supabasePublicDataProvider: PublicDataProvider = {
  getHomeTicker() {
    return getSnapshot()?.homeTicker ?? emptyHomeTicker;
  },

  getHomePageData() {
    const snapshot = getSnapshot();

    if (!snapshot) {
      return emptyHomePageData;
    }

    return {
      ticker: snapshot.homeTicker,
      regions: snapshot.regionCards,
      stageRegions: snapshot.stageRegions,
      stageRegionSummaries: snapshot.stageRegionSummaries,
      upcomingRaces: snapshot.upcomingRaces,
      dataPrinciples: emptyHomePageData.dataPrinciples,
    };
  },

  getRegionElectionSummaries() {
    return getSnapshot()?.regionCards ?? [];
  },

  getRegionSummary(regionId: string) {
    const snapshot = getSnapshot();

    if (!snapshot) {
      return null;
    }

    return lookupByRegionKeys(getRegionLookupKeys(snapshot, regionId), snapshot.indexes.regionSummaryByLookupKey);
  },

  getRegionCardByStageRegionId(regionId: string) {
    const snapshot = getSnapshot();

    if (!snapshot) {
      return null;
    }

    return lookupByRegionKeys(getRegionLookupKeys(snapshot, regionId), snapshot.indexes.regionCardByLookupKey);
  },

  getStageRegions() {
    return getSnapshot()?.stageRegions ?? [];
  },

  getStageRegion(regionId: string) {
    return getSnapshot()?.indexes.stageRegionById.get(regionId) ?? null;
  },

  getChildStageRegions(parentId: string) {
    return getSnapshot()?.indexes.childStageRegionsByParentId.get(parentId) ?? [];
  },

  getUpcomingRaces() {
    return getSnapshot()?.upcomingRaces ?? [];
  },

  getRelatedRacesByRegionId(regionId: string) {
    const snapshot = getSnapshot();

    if (!snapshot) {
      return [];
    }

    return snapshot.indexes.relatedRacesByRegionId.get(regionId) ?? [];
  },

  async loadRelatedRacesByRegionId(regionId: string) {
    await refreshSupabasePublicDataSnapshot();
    return this.getRelatedRacesByRegionId(regionId);
  },

  getElections() {
    void ensureElectionIndexDataset();
    return getSnapshot()?.elections ?? [];
  },

  getElectionById(electionId: string) {
    void ensureElectionDataset(electionId);
    return getSnapshot()?.indexes.electionById.get(electionId) ?? null;
  },

  getRacesByElectionId(electionId: string) {
    void ensureElectionIndexDataset();
    return getSnapshot()?.indexes.racesByElectionId.get(electionId) ?? [];
  },

  getRaces() {
    void ensureElectionIndexDataset();
    return getSnapshot()?.races ?? [];
  },

  getRaceById(raceId: string) {
    void ensureElectionIndexDataset();
    return getSnapshot()?.indexes.raceById.get(raceId) ?? null;
  },

  getCandidates() {
    return getSnapshot()?.candidates ?? [];
  },

  getCandidatesByElectionId(electionId: string) {
    void ensureElectionDataset(electionId);
    return getSnapshot()?.indexes.candidatesByElectionId.get(electionId) ?? [];
  },

  getCandidatesByRaceId(raceId: string) {
    const race = getSnapshot()?.indexes.raceById.get(raceId) ?? null;

    if (race) {
      void ensureElectionDataset(race.election_id);
    } else {
      void ensureElectionIndexDataset();
    }

    return getSnapshot()?.indexes.candidatesByRaceId.get(raceId) ?? [];
  },

  async loadElectionIndex(): Promise<PublicElectionIndexData> {
    await refreshSupabasePublicDataSnapshot();
    const [electionRows, summaryRows] = await Promise.all([
      fetchRows('public_elections'),
      fetchRows('public_election_race_summaries'),
    ]);

    return {
      elections: electionRows.map((row) => mapPublicElectionRow(row as PublicElection)),
      raceSummaries: summaryRows as PublicElectionRaceSummary[],
    };
  },

  async loadElectionRaceFacets(electionIds: string[]) {
    await refreshSupabasePublicDataSnapshot();
    const uniqueElectionIds = Array.from(new Set(electionIds.filter(Boolean)));
    const facetRows: PublicElectionRaceFacet[] = [];

    for (let index = 0; index < uniqueElectionIds.length; index += 200) {
      const chunk = uniqueElectionIds.slice(index, index + 200);
      facetRows.push(...await fetchRows('public_election_race_facets', (query) => query.in('election_id', chunk)) as PublicElectionRaceFacet[]);
    }

    return facetRows;
  },

  async loadElectionEducationDistribution(eventKey, electionIds, filters = {}) {
    const client = getSupabasePublicClient();
    if (!client) return [];
    const normalizedEventKey = eventKey.trim();
    const normalizedElectionIds = Array.from(new Set(electionIds.filter(Boolean))).slice(0, 500);
    if (!normalizedEventKey || normalizedElectionIds.length === 0) return [];

    const raceTypes = Array.from(new Set(filters.raceTypes ?? []));
    const { data, error } = await client.schema('published').rpc('election_education_distribution', {
      p_event_key: normalizedEventKey,
      p_election_ids: normalizedElectionIds,
      p_race_types: raceTypes.length > 0 ? raceTypes : null,
      p_region_key: filters.regionKey?.trim() || null,
    });

    if (error || !Array.isArray(data)) {
      if (error && import.meta.env.DEV) {
        console.warn(`Failed to fetch election education distribution: ${error.message}`);
      }
      return [];
    }

    return data as PublicElectionEducationDistribution[];
  },

  async loadElectionPartyPerformance(eventKey, electionIds, filters = {}) {
    const client = getSupabasePublicClient();
    if (!client) return [];
    const normalizedEventKey = eventKey.trim();
    const normalizedElectionIds = Array.from(new Set(electionIds.filter(Boolean))).slice(0, 500);
    if (!normalizedEventKey || normalizedElectionIds.length === 0) return [];

    const raceTypes = Array.from(new Set(filters.raceTypes ?? []));
    const { data, error } = await client.schema('published').rpc('election_party_performance', {
      p_event_key: normalizedEventKey,
      p_election_ids: normalizedElectionIds,
      p_race_types: raceTypes.length > 0 ? raceTypes : null,
      p_region_key: filters.regionKey?.trim() || null,
    });

    if (error || !Array.isArray(data)) {
      if (error && import.meta.env.DEV) {
        console.warn(`Failed to fetch election party performance: ${error.message}`);
      }
      return [];
    }

    return data as PublicPartyElectionPerformance[];
  },

  async loadRacesByElectionIds(electionIds, filters = {}) {
    await refreshSupabasePublicDataSnapshot();
    const uniqueElectionIds = Array.from(new Set(electionIds.filter(Boolean)));
    const raceRows: unknown[] = [];

    for (let index = 0; index < uniqueElectionIds.length; index += 200) {
      const chunk = uniqueElectionIds.slice(index, index + 200);
      raceRows.push(...await fetchRows('public_races', (query) => {
        let filteredQuery = query.in('election_id', chunk);
        if (filters.raceTypes?.length) filteredQuery = filteredQuery.in('race_type', filters.raceTypes);
        if (filters.regionKey && filters.regionKey !== 'national') filteredQuery = filteredQuery.like('region_name', `${filters.regionKey}%`);
        return filteredQuery;
      }));
    }

    return raceRows
      .map((row) => mapPublicRaceRow(row as PublicRace))
      .filter((race) => !filters.regionKey || getRaceRegionGroup(race).key === filters.regionKey);
  },

  loadElectionRacePage(eventKey, _electionIds, filters, page, pageSize) {
    return loadCachedElectionRacePage(eventKey, filters, page, pageSize);
  },

  async loadRaceDetail(raceId: string): Promise<PublicRaceDetailData> {
    await refreshSupabasePublicDataSnapshot();
    const raceRows = await fetchRows('public_races', (query) => query.eq('race_id', raceId));
    const race = raceRows[0] ? mapPublicRaceRow(raceRows[0] as PublicRace) : null;

    if (!race) {
      return { race: null, election: null, candidates: [], partyAffiliations: [] };
    }

    const [electionRows, candidateRows] = await Promise.all([
      fetchRows('public_elections', (query) => query.eq('election_id', race.election_id)),
      fetchRows('public_candidates', (query) => query.eq('race_id', raceId)),
    ]);

    const candidates = candidateRows.map((row) => mapPublicCandidateRow(row as PublicCandidate));
    const personIds = Array.from(new Set(candidates.map((candidate) => candidate.person_id).filter(Boolean)));
    const partyAffiliationRows = personIds.length > 0
      ? await fetchRows('public_person_party_affiliations', (query) => query.in('person_id', personIds))
      : [];

    return {
      race,
      election: electionRows[0] ? mapPublicElectionRow(electionRows[0] as PublicElection) : null,
      candidates,
      partyAffiliations: partyAffiliationRows.map((row) => (
        mapPublicPersonPartyAffiliationRow(row as PublicPersonPartyAffiliation)
      )),
    };
  },

  getPollComparisonByElectionId(): PollComparison | null {
    // TODO: Add a mapped poll comparison source after an approved public poll view exists.
    return null;
  },

  getPeople() {
    return getSnapshot()?.people ?? [];
  },

  getPeopleByFilters(filters = {}) {
    void ensurePeopleDataset(filters);
    const snapshot = getSnapshot();

    if (snapshot === null) {
      return [];
    }

    const items = getPersonListItems(snapshot);
    const visibleItems = hasPersonSearchQuery(filters)
      ? items
      : items.filter((person) => isGrassrootsPersonListItem(person) === false);

    return filterPersonListItems(visibleItems, filters);
  },

  loadPeoplePage(filters, page, pageSize) {
    return loadCachedPeoplePage(filters, page, pageSize);
  },

  loadPartyCandidatePage(partyName, page, pageSize) {
    return fetchPartyCandidatePage(partyName, page, pageSize);
  },

  async loadPartyPeopleStatistics(partyName) {
    const normalizedPartyName = partyName.trim();
    const client = getSupabasePublicClient();
    if (!normalizedPartyName || !client) {
      return buildPartyPeopleStatistics(normalizedPartyName, [], []);
    }

    const { data, error } = await client.schema('published').rpc(
      'party_people_statistics',
      { p_party_name: normalizedPartyName },
    );
    if (error || !Array.isArray(data) || data.length !== 19) {
      if (error && import.meta.env.DEV) {
        console.warn(`Failed to fetch party people statistics: ${error.message}`);
      }
      return buildPartyPeopleStatistics(normalizedPartyName, [], []);
    }

    return data as PublicPartyPeopleStatisticRow[];
  },

  async loadPartyLegalStatistics(partyName) {
    const normalizedPartyName = partyName.trim();
    const client = getSupabasePublicClient();
    if (!normalizedPartyName || !client) {
      return buildPartyLegalStatistics(normalizedPartyName, [], []);
    }

    const { data, error } = await client.schema('published').rpc(
      'party_legal_statistics',
      { p_party_name: normalizedPartyName },
    );
    if (error || !Array.isArray(data) || data.length !== 1) {
      if (error && import.meta.env.DEV) {
        console.warn(`Failed to fetch party legal statistics: ${error.message}`);
      }
      return buildPartyLegalStatistics(normalizedPartyName, [], []);
    }

    return data[0] as PublicPartyLegalStatistics;
  },

  getPersonById(personId: string) {
    return getSnapshot()?.indexes.personById.get(personId) ?? null;
  },

  getPersonProfile(personId: string) {
    void ensurePersonProfileDataset(personId);
    const snapshot = getSnapshot();
    return snapshot ? getPersonProfileFromSnapshot(snapshot, personId) : null;
  },

  async loadPersonProfiles(personIds: string[]) {
    const snapshot = await ensurePersonProfileDatasets(personIds);
    if (!snapshot) return [];
    return personIds
      .map((personId) => getPersonProfileFromSnapshot(snapshot, personId))
      .filter((profile): profile is PublicPersonProfile => profile !== null);
  },

  getLocalOfficeSummaryByRegionId(regionId: string) {
    const snapshot = getSnapshot();
    return localOfficeSummaryCache.get(regionId)
      ?? buildLocalOfficeSummary(regionId, [], [], snapshot?.stageRegions ?? []);
  },

  loadLocalOfficeSummaryByRegionId(regionId: string) {
    return loadLocalOfficeSummary(regionId);
  },

  getCompanies() {
    return getSnapshot()?.companies ?? [];
  },

  getParties() {
    void ensurePartyDataset();
    return getSnapshot()?.parties ?? [];
  },

  getPartyBySlug(partySlug: string) {
    void ensurePartyDataset();
    return getSnapshot()?.indexes.partyBySlug.get(partySlug) ?? null;
  },

  loadPartyOfficers(partyId: string) {
    return loadPartyOfficersByPartyId(partyId);
  },

  getPartyFinanceSummaries(partyId: string) {
    void ensurePartyDataset();
    return getSnapshot()?.indexes.partyFinanceSummariesByPartyId.get(partyId) ?? [];
  },

  getPartyCompanyContributionSummaries(partyId: string) {
    void ensurePartyDataset();
    return getSnapshot()?.indexes.partyCompanyContributionSummariesByPartyId.get(partyId) ?? [];
  },

  async searchPublicRecords(query: string) {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length < 2) {
      return [];
    }

    await Promise.all([
      ensurePeopleDataset({ query }),
      ensurePartyDataset(),
    ]);

    const pattern = '%' + query.trim() + '%';
    const [electionRows, companyRows] = await Promise.all([
      fetchRows('public_elections', (request) => request.ilike('name', pattern), PUBLIC_SEARCH_RESULT_LIMIT),
      fetchRows(
        'public_companies',
        (request) =>
          request.or([
            'name.ilike.' + pattern,
            'unified_business_no.ilike.' + pattern,
            'representative_name.ilike.' + pattern,
            'address_region.ilike.' + pattern,
          ].join(',')),
        PUBLIC_SEARCH_RESULT_LIMIT,
      ),
    ]);

    const base = getSnapshot();
    if (base) {
      mergeSnapshot({
        elections: mergeUniqueBy(
          base.elections,
          electionRows.map((row) => mapPublicElectionRow(row as PublicElection)),
          (item) => item.election_id,
        ),
        companies: mergeUniqueBy(
          base.companies,
          companyRows.map((row) => mapPublicCompanyRow(row as PublicCompany)),
          (item) => item.company_id,
        ),
      });
    }

    const snapshot = getSnapshot();

    if (!snapshot) {
      return [];
    }

    const results: PublicSearchResult[] = [
      ...snapshot.parties
        .filter((party) => [party.name, party.short_name].some((value) => includesQuery(value, normalizedQuery)))
        .map((party) => ({
          id: party.party_id,
          type: 'party' as const,
          label: '政黨',
          title: party.name,
          subtitle: party.short_name ? `簡稱 ${party.short_name}` : '政黨與政治獻金摘要',
          href: partyPath(party.slug),
        })),
      ...snapshot.elections
        .filter((election) => [election.name, election.election_type, election.status].some((value) => includesQuery(value, normalizedQuery)))
        .map((election) => ({
          id: election.election_id,
          type: 'election' as const,
          label: '選舉',
          title: election.name,
          subtitle: [election.year?.toString(), election.voting_date, election.status].filter(Boolean).join(' · '),
          href: electionPath(election.election_id),
        })),
      ...snapshot.stageRegions
        .filter((region) => [region.label, region.stageLabel, region.note].some((value) => includesQuery(value, normalizedQuery)))
        .map((region) => ({
          id: region.id,
          type: 'region' as const,
          label: '地區',
          title: region.label,
          subtitle: region.level === 'county_city' ? '縣市地圖區域' : '公開區域導覽',
          href: regionPath(region.id),
        })),
      ...snapshot.people
        .filter((person) =>
          [person.name, person.alias, person.party, person.position, person.district].some((value) =>
            includesQuery(value, normalizedQuery),
          ),
        )
        .map((person) => ({
          id: person.person_id,
          type: 'person' as const,
          label: '人物',
          title: person.name,
          subtitle: [person.party, person.position, person.district].filter(Boolean).join(' · ') || '公開人物資料',
          href: personPath(person.person_id),
        })),
      ...snapshot.companies
        .filter((company) =>
          [company.name, company.unified_business_no, company.representative_name, company.address_region].some((value) =>
            includesQuery(value, normalizedQuery),
          ),
        )
        .map((company) => ({
          id: company.company_id,
          type: 'company' as const,
          label: '公司',
          title: company.name,
          subtitle: [company.representative_name, company.address_region].filter(Boolean).join(' · ') || '公開公司資料',
          href: null,
        })),
    ];

    return results.slice(0, PUBLIC_SEARCH_RESULT_LIMIT);
  },
};
