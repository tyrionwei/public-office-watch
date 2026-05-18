import { dataPrinciples, nextEvent, regions, upcomingRaces } from '../data/mockHomeData';
import { taiwanStageRegionNodes, taiwanStageRegionSummaries } from '../data/taiwanRegions';
import { mockPollComparisons } from '../data/mockPolling';
import { mockPublicCandidates, mockPublicElections, mockPublicRaces } from '../data/mockPublicViews';
import { assertPublicViewName, allowedPublicViews } from './publicViewRegistry';
import type { PublicDataProvider } from './publicDataProvider';

const providerViews = [
  'public_home_election_ticker',
  'public_region_election_summary',
  'public_regions',
  'public_elections',
  'public_races',
  'public_candidates',
] as const;

export function validatePublicDataBoundary() {
  for (const viewName of providerViews) {
    assertPublicViewName(viewName);
  }

  return providerViews.every((viewName) => allowedPublicViews.includes(viewName));
}

function getBaseRegionId(regionId: string) {
  const stageRegion = taiwanStageRegionNodes.find((region) => region.id === regionId);
  return stageRegion?.publicRegionId?.replace('region-', '') ?? regionId;
}

export const mockPublicDataProvider: PublicDataProvider = {
  getHomeTicker() {
    return nextEvent;
  },

  getHomePageData() {
    return {
      ticker: nextEvent,
      regions,
      stageRegions: taiwanStageRegionNodes,
      stageRegionSummaries: taiwanStageRegionSummaries,
      upcomingRaces,
      dataPrinciples,
    };
  },

  getRegionElectionSummaries() {
    return regions;
  },

  getRegionSummary(regionId: string) {
    return taiwanStageRegionSummaries.find((summary) => summary.regionId === regionId) ?? null;
  },

  getRegionCardByStageRegionId(regionId: string) {
    const baseRegionId = getBaseRegionId(regionId);
    return regions.find((region) => region.id === baseRegionId) ?? null;
  },

  getStageRegions() {
    return taiwanStageRegionNodes;
  },

  getStageRegion(regionId: string) {
    return taiwanStageRegionNodes.find((region) => region.id === regionId) ?? null;
  },

  getChildStageRegions(parentId: string) {
    return taiwanStageRegionNodes.filter((region) => region.parentId === parentId);
  },

  getUpcomingRaces() {
    return upcomingRaces;
  },

  getRelatedRacesByRegionId(regionId: string) {
    const baseRegionId = getBaseRegionId(regionId);
    return upcomingRaces.filter((race) => race.regionId === baseRegionId);
  },

  getElectionById(electionId: string) {
    return mockPublicElections.find((item) => item.election_id === electionId) ?? null;
  },

  getRacesByElectionId(electionId: string) {
    return mockPublicRaces.filter((race) => race.election_id === electionId);
  },

  getCandidatesByElectionId(electionId: string) {
    return mockPublicCandidates.filter((candidate) => candidate.election_id === electionId);
  },

  getPollComparisonByElectionId(electionId: string) {
    return mockPollComparisons.find((comparison) => comparison.electionId === electionId) ?? null;
  },
};
