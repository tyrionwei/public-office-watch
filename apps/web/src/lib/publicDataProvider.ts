import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import type { PollComparison } from '../types/polling';
import type { PublicCandidate, PublicElection, PublicRace } from '../types/publicViews';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';

export type HomeTicker = {
  title: string;
  subtitle: string;
  date: string;
};

export type HomePageData = {
  ticker: HomeTicker;
  regions: RegionCard[];
  stageRegions: StageRegionNode[];
  stageRegionSummaries: StageRegionSummary[];
  upcomingRaces: UpcomingRace[];
  dataPrinciples: string[];
};

export interface PublicDataProvider {
  getHomeTicker(): HomeTicker;
  getHomePageData(): HomePageData;
  getRegionElectionSummaries(): RegionCard[];
  getRegionSummary(regionId: string): StageRegionSummary | null;
  getRegionCardByStageRegionId(regionId: string): RegionCard | null;
  getStageRegions(): StageRegionNode[];
  getStageRegion(regionId: string): StageRegionNode | null;
  getChildStageRegions(parentId: string): StageRegionNode[];
  getUpcomingRaces(): UpcomingRace[];
  getRelatedRacesByRegionId(regionId: string): UpcomingRace[];
  getElectionById(electionId: string): PublicElection | null;
  getRacesByElectionId(electionId: string): PublicRace[];
  getCandidatesByElectionId(electionId: string): PublicCandidate[];
  getPollComparisonByElectionId(electionId: string): PollComparison | null;
}
