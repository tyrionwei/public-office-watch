import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import type { PollComparison } from '../types/polling';
import type {
  PublicCandidate,
  PublicCompany,
  PublicElection,
  PublicLocalOfficeSummary,
  PublicParty,
  PublicPartyCompanyContributionSummary,
  PublicPartyFinanceSummary,
  PublicPerson,
  PublicPersonFilters,
  PublicPersonListItem,
  PublicPersonProfile,
  PublicRace,
} from '../types/publicViews';
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

export type PublicSearchResultType = 'person' | 'company' | 'party' | 'election' | 'region';

export type PublicSearchResult = {
  id: string;
  type: PublicSearchResultType;
  label: string;
  title: string;
  subtitle: string;
  href: string | null;
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
  getCandidates(): PublicCandidate[];
  getCandidatesByElectionId(electionId: string): PublicCandidate[];
  getPollComparisonByElectionId(electionId: string): PollComparison | null;
  getPeople(): PublicPerson[];
  getPeopleByFilters(filters?: PublicPersonFilters): PublicPersonListItem[];
  getPersonById(personId: string): PublicPerson | null;
  getPersonProfile(personId: string): PublicPersonProfile | null;
  getLocalOfficeSummaryByRegionId(regionId: string): PublicLocalOfficeSummary;
  getCompanies(): PublicCompany[];
  getParties(): PublicParty[];
  getPartyBySlug(partySlug: string): PublicParty | null;
  getPartyFinanceSummaries(partyId: string): PublicPartyFinanceSummary[];
  getPartyCompanyContributionSummaries(partyId: string): PublicPartyCompanyContributionSummary[];
  searchPublicRecords(query: string): PublicSearchResult[];
}
