import type { PublicDataProvider } from './publicDataProvider';
import { assertPublicViewName } from './publicViewRegistry';
import { getSupabasePublicClient } from './supabasePublicClient';

function fromPublicView(viewName: string) {
  assertPublicViewName(viewName);
  const client = getSupabasePublicClient();

  if (!client) {
    return null;
  }

  return client.from(viewName);
}

function notEnabled(): never {
  throw new Error('Supabase public data provider is not enabled yet.');
}

export const supabasePublicDataProvider: PublicDataProvider = {
  getHomeTicker() {
    return notEnabled();
  },
  getHomePageData() {
    return notEnabled();
  },
  getRegionElectionSummaries() {
    return notEnabled();
  },
  getRegionSummary() {
    return null;
  },
  getRegionCardByStageRegionId() {
    return null;
  },
  getStageRegions() {
    return [];
  },
  getStageRegion() {
    return null;
  },
  getChildStageRegions() {
    return [];
  },
  getUpcomingRaces() {
    return [];
  },
  getRelatedRacesByRegionId() {
    return [];
  },
  getElectionById() {
    const query = fromPublicView('public_elections');
    void query;
    // TODO: Map Supabase public view rows after public view contracts are finalized.
    return null;
  },
  getRacesByElectionId() {
    const query = fromPublicView('public_races');
    void query;
    // TODO: Map Supabase public view rows after public view contracts are finalized.
    return [];
  },
  getCandidatesByElectionId() {
    const query = fromPublicView('public_candidates');
    void query;
    // TODO: Map Supabase public view rows after public view contracts are finalized.
    return [];
  },
  getPollComparisonByElectionId() {
    return null;
  },
};
