import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import type {
  PublicCandidate,
  PublicCompany,
  PublicElection,
  PublicHomeElectionTicker,
  PublicParty,
  PublicPartyCompanyContributionSummary,
  PublicPartyFinanceSummary,
  PublicPerson,
  PublicRace,
  PublicRegion,
  PublicRegionElectionSummary,
} from '../types/publicViews';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import type { PollComparison } from '../types/polling';
import { electionPath, partyPath, regionPath } from '../routes/routePaths';
import type { HomePageData, HomeTicker, PublicDataProvider, PublicSearchResult } from './publicDataProvider';
import { type AllowedPublicViewName, assertPublicViewName } from './publicViewRegistry';
import { getSupabasePublicClient } from './supabasePublicClient';
import {
  mapPublicCandidateRow,
  mapPublicCompanyRow,
  mapPublicElectionRow,
  mapPublicHomeElectionTickerRow,
  mapPublicPartyCompanyContributionSummaryRow,
  mapPublicPartyFinanceSummaryRow,
  mapPublicPartyRow,
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

const emptyHomeTicker: HomeTicker = {
  title: '公開選舉資料待載入',
  subtitle: '尚未接入 Supabase public views。',
  date: '待公告',
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
  parties: PublicParty[];
  partyFinanceSummaries: PublicPartyFinanceSummary[];
  partyCompanyContributionSummaries: PublicPartyCompanyContributionSummary[];
};

let snapshotCache: SupabasePublicSnapshot | null = null;

function fromPublicView(viewName: AllowedPublicViewName) {
  assertPublicViewName(viewName);
  const client = getSupabasePublicClient();

  if (!client) {
    return null;
  }

  return client.from(viewName);
}

async function fetchRows<T>(viewName: AllowedPublicViewName): Promise<T[]> {
  const query = fromPublicView(viewName);

  if (!query) {
    return [];
  }

  const { data, error } = await query.select('*');

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data as T[];
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

function buildSnapshot(params: {
  tickerRows: unknown[];
  regionSummaryRows: unknown[];
  regionRows: unknown[];
  personRows: unknown[];
  companyRows: unknown[];
  electionRows: unknown[];
  raceRows: unknown[];
  candidateRows: unknown[];
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
  const upcomingRaces = races.map((race) => mapRaceToUpcomingRace(race));
  const parties = params.partyRows.map((row) => mapPublicPartyRow(row as PublicParty));
  const partyFinanceSummaries = params.partyFinanceRows.map((row) =>
    mapPublicPartyFinanceSummaryRow(row as PublicPartyFinanceSummary),
  );
  const partyCompanyContributionSummaries = params.partyCompanyContributionRows.map((row) =>
    mapPublicPartyCompanyContributionSummaryRow(row as PublicPartyCompanyContributionSummary),
  );

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
    parties,
    partyFinanceSummaries,
    partyCompanyContributionSummaries,
  };
}

export async function refreshSupabasePublicDataSnapshot(): Promise<SupabasePublicSnapshot | null> {
  if (!getSupabasePublicClient()) {
    snapshotCache = null;
    return null;
  }

  const [
    tickerRows,
    regionSummaryRows,
    regionRows,
    personRows,
    companyRows,
    electionRows,
    raceRows,
    candidateRows,
    partyRows,
    partyFinanceRows,
    partyCompanyContributionRows,
  ] = await Promise.all([
    fetchRows('public_home_election_ticker'),
    fetchRows('public_region_election_summary'),
    fetchRows('public_regions'),
    fetchRows('public_people'),
    fetchRows('public_companies'),
    fetchRows('public_elections'),
    fetchRows('public_races'),
    fetchRows('public_candidates'),
    fetchRows('public_parties'),
    fetchRows('public_party_finance_summaries'),
    fetchRows('public_party_company_contribution_summaries'),
  ]);

  snapshotCache = buildSnapshot({
    tickerRows,
    regionSummaryRows,
    regionRows,
    personRows,
    companyRows,
    electionRows,
    raceRows,
    candidateRows,
    partyRows,
    partyFinanceRows,
    partyCompanyContributionRows,
  });
  return snapshotCache;
}

function getSnapshot() {
  return snapshotCache;
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

function includesQuery(value: string | null | undefined, normalizedQuery: string) {
  return value?.toLowerCase().includes(normalizedQuery) ?? false;
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

    const keys = toRegionLookupKeys(regionId, snapshot.stageRegions);
    return snapshot.stageRegionSummaries.find((summary) => keys.has(summary.regionId)) ?? null;
  },

  getRegionCardByStageRegionId(regionId: string) {
    const snapshot = getSnapshot();

    if (!snapshot) {
      return null;
    }

    const keys = toRegionLookupKeys(regionId, snapshot.stageRegions);
    return snapshot.regionCards.find((region) => keys.has(region.id)) ?? null;
  },

  getStageRegions() {
    return getSnapshot()?.stageRegions ?? [];
  },

  getStageRegion(regionId: string) {
    return getSnapshot()?.stageRegions.find((region) => region.id === regionId) ?? null;
  },

  getChildStageRegions(parentId: string) {
    return getSnapshot()?.stageRegions.filter((region) => region.parentId === parentId) ?? [];
  },

  getUpcomingRaces() {
    return getSnapshot()?.upcomingRaces ?? [];
  },

  getRelatedRacesByRegionId(regionId: string) {
    const snapshot = getSnapshot();

    if (!snapshot) {
      return [];
    }

    const keys = toRegionLookupKeys(regionId, snapshot.stageRegions);
    return snapshot.upcomingRaces.filter((race) => keys.has(race.regionId));
  },

  getElectionById(electionId: string) {
    return getSnapshot()?.elections.find((item) => item.election_id === electionId) ?? null;
  },

  getRacesByElectionId(electionId: string) {
    return getSnapshot()?.races.filter((race) => race.election_id === electionId) ?? [];
  },

  getCandidatesByElectionId(electionId: string) {
    return getSnapshot()?.candidates.filter((candidate) => candidate.election_id === electionId) ?? [];
  },

  getPollComparisonByElectionId(): PollComparison | null {
    // TODO: Add a mapped poll comparison source after an approved public poll view exists.
    return null;
  },

  getPeople() {
    return getSnapshot()?.people ?? [];
  },

  getCompanies() {
    return getSnapshot()?.companies ?? [];
  },

  getParties() {
    return getSnapshot()?.parties ?? [];
  },

  getPartyBySlug(partySlug: string) {
    return getSnapshot()?.parties.find((party) => party.slug === partySlug) ?? null;
  },

  getPartyFinanceSummaries(partyId: string) {
    return getSnapshot()?.partyFinanceSummaries.filter((summary) => summary.party_id === partyId) ?? [];
  },

  getPartyCompanyContributionSummaries(partyId: string) {
    return getSnapshot()?.partyCompanyContributionSummaries.filter((summary) => summary.party_id === partyId) ?? [];
  },

  searchPublicRecords(query: string) {
    const snapshot = getSnapshot();
    const normalizedQuery = query.trim().toLowerCase();

    if (!snapshot || normalizedQuery.length < 2) {
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
          href: null,
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

    return results.slice(0, 12);
  },
};
