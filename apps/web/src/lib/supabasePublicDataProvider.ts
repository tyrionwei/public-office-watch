import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import type {
  PublicCandidate,
  PublicElection,
  PublicHomeElectionTicker,
  PublicRace,
  PublicRegion,
  PublicRegionElectionSummary,
} from '../types/publicViews';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import type { PollComparison } from '../types/polling';
import type { HomePageData, HomeTicker, PublicDataProvider } from './publicDataProvider';
import { type AllowedPublicViewName, assertPublicViewName } from './publicViewRegistry';
import { getSupabasePublicClient } from './supabasePublicClient';
import {
  mapPublicCandidateRow,
  mapPublicElectionRow,
  mapPublicHomeElectionTickerRow,
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
  elections: PublicElection[];
  races: PublicRace[];
  candidates: PublicCandidate[];
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
  electionRows: unknown[];
  raceRows: unknown[];
  candidateRows: unknown[];
}): SupabasePublicSnapshot {
  const homeTickerRow = params.tickerRows[0];
  const regionSummaries = params.regionSummaryRows.map((row) => mapPublicRegionElectionSummaryRow(row as PublicRegionElectionSummary));
  const regionCards = regionSummaries.map((row) => mapRegionSummaryToRegionCard(row));
  const stageRegionSummaries = regionSummaries.map((row) => mapRegionSummaryToStageRegionSummary(row));
  const regions = params.regionRows.map((row) => mapPublicRegionRow(row as PublicRegion));
  const stageRegions = buildStageRegions(regions);
  const elections = params.electionRows.map((row) => mapPublicElectionRow(row as PublicElection));
  const races = params.raceRows.map((row) => mapPublicRaceRow(row as PublicRace));
  const candidates = params.candidateRows.map((row) => mapPublicCandidateRow(row as PublicCandidate));
  const upcomingRaces = races.map((race) => mapRaceToUpcomingRace(race));

  return {
    homeTicker: homeTickerRow ? mapTickerToHomeTicker(mapPublicHomeElectionTickerRow(homeTickerRow as PublicHomeElectionTicker)) : emptyHomeTicker,
    regionCards,
    stageRegions,
    stageRegionSummaries,
    upcomingRaces,
    elections,
    races,
    candidates,
  };
}

export async function refreshSupabasePublicDataSnapshot(): Promise<SupabasePublicSnapshot | null> {
  if (!getSupabasePublicClient()) {
    snapshotCache = null;
    return null;
  }

  const [tickerRows, regionSummaryRows, regionRows, electionRows, raceRows, candidateRows] = await Promise.all([
    fetchRows('public_home_election_ticker'),
    fetchRows('public_region_election_summary'),
    fetchRows('public_regions'),
    fetchRows('public_elections'),
    fetchRows('public_races'),
    fetchRows('public_candidates'),
  ]);

  snapshotCache = buildSnapshot({ tickerRows, regionSummaryRows, regionRows, electionRows, raceRows, candidateRows });
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
};
