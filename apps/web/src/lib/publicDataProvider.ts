import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import type { PollComparison } from '../types/polling';
import type {
  PublicCandidate,
  PublicCompany,
  PublicElection,
  PublicElectionEducationDistribution,
  PublicElectionRaceFacet,
  PublicElectionRaceSummary,
  PublicLocalOfficeSummary,
  PublicLegislatorPartySummary,
  PublicNationalOfficeHolder,
  PublicParty,
  PublicPartyAnnualFinanceFiling,
  PublicPartyCompanyContributionSummary,
  PublicPartyFinanceSummary,
  PublicPartyLegalStatistics,
  PublicPartyPeopleStatisticRow,
  PublicPartyOfficer,
  PublicPartyElectionPerformance,
  PublicPerson,
  PublicPersonFilters,
  PublicPersonListItem,
  PublicPersonPartyAffiliation,
  PublicPersonProfile,
  PublicRace,
  PublicReferendumOption,
  PublicReferendumQuestion,
  PublicReferendumRegionResult,
  PublicUpdate,
} from '../types/publicViews';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';

export type { UpcomingRace };

export type HomeTicker = {
  title: string;
  date: string;
  electionId: string | null;
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
  party?: string | null;
  href: string | null;
};

export type PublicPersonListPage = {
  items: PublicPersonListItem[];
  total: number;
};

export type PublicCandidateListPage = {
  items: PublicCandidate[];
  total: number;
};

export type PublicPartyCompanyContributionPage = {
  items: PublicPartyCompanyContributionSummary[];
  total: number;
};

export type PublicRaceListPage = {
  items: PublicRace[];
  total: number;
};

export type PublicElectionIndexData = {
  elections: PublicElection[];
  raceSummaries: PublicElectionRaceSummary[];
};

export type PublicRaceDetailData = {
  race: PublicRace | null;
  election: PublicElection | null;
  candidates: PublicCandidate[];
  partyAffiliations: PublicPersonPartyAffiliation[];
  referendumQuestion: PublicReferendumQuestion | null;
  referendumOptions: PublicReferendumOption[];
  referendumRegionResults: PublicReferendumRegionResult[];
};

export type PublicRaceQueryFilters = {
  raceTypes?: PublicRace['race_type'][];
  regionKey?: string;
  query?: string;
};

export interface PublicDataProvider {
  loadHomePageData(): Promise<HomePageData>;
  loadRegionDirectory(): Promise<StageRegionNode[]>;
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
  loadRelatedRacesByRegionId(regionId: string): Promise<UpcomingRace[]>;
  getElections(): PublicElection[];
  getElectionById(electionId: string): PublicElection | null;
  getRacesByElectionId(electionId: string): PublicRace[];
  getRaces(): PublicRace[];
  getRaceById(raceId: string): PublicRace | null;
  getCandidates(): PublicCandidate[];
  getCandidatesByElectionId(electionId: string): PublicCandidate[];
  getCandidatesByRaceId(raceId: string): PublicCandidate[];
  loadElectionIndex(): Promise<PublicElectionIndexData>;
  loadElectionRaceFacets(electionIds: string[]): Promise<PublicElectionRaceFacet[]>;
  loadElectionPartyPerformance(eventKey: string, electionIds: string[], filters?: PublicRaceQueryFilters): Promise<PublicPartyElectionPerformance[]>;
  loadElectionEducationDistribution(eventKey: string, electionIds: string[], filters?: PublicRaceQueryFilters): Promise<PublicElectionEducationDistribution[]>;
  loadRacesByElectionIds(electionIds: string[], filters?: PublicRaceQueryFilters): Promise<PublicRace[]>;
  loadElectionRacePage(eventKey: string, electionIds: string[], filters: PublicRaceQueryFilters, page: number, pageSize: number): Promise<PublicRaceListPage>;
  loadRaceDetail(raceId: string): Promise<PublicRaceDetailData>;
  getPollComparisonByElectionId(electionId: string): PollComparison | null;
  getPeople(): PublicPerson[];
  getPeopleByFilters(filters?: PublicPersonFilters): PublicPersonListItem[];
  loadPeoplePage(filters: PublicPersonFilters, page: number, pageSize: number): Promise<PublicPersonListPage>;
  loadPartyCandidatePage(partyName: string, page: number, pageSize: number): Promise<PublicCandidateListPage>;
  getPersonById(personId: string): PublicPerson | null;
  getPersonProfile(personId: string): PublicPersonProfile | null;
  loadPersonProfiles(personIds: string[]): Promise<PublicPersonProfile[]>;
  getLocalOfficeSummaryByRegionId(regionId: string): PublicLocalOfficeSummary;
  loadLocalOfficeSummaryByRegionId(regionId: string): Promise<PublicLocalOfficeSummary>;
  loadNationalOfficeHolders(): Promise<PublicNationalOfficeHolder[]>;
  loadCurrentLegislatorPartySummary(): Promise<PublicLegislatorPartySummary[]>;
  loadPublicUpdates(limit?: number): Promise<PublicUpdate[]>;
  getCompanies(): PublicCompany[];
  getParties(): PublicParty[];
  loadPartyDirectory(): Promise<PublicParty[]>;
  loadPartyFinanceData(): Promise<void>;
  getPartyBySlug(partySlug: string): PublicParty | null;
  loadPartyOfficers(partyId: string): Promise<PublicPartyOfficer[]>;
  loadPartyPeopleStatistics(partyName: string): Promise<PublicPartyPeopleStatisticRow[]>;
  loadPartyLegalStatistics(partyName: string): Promise<PublicPartyLegalStatistics>;
  getPartyAnnualFinanceFilings(partyId: string): PublicPartyAnnualFinanceFiling[];
  getPartyFinanceSummaries(partyId: string): PublicPartyFinanceSummary[];
  getPartyCompanyContributionSummaries(partyId: string): PublicPartyCompanyContributionSummary[];
  loadPartyCompanyContributionPage(partyId: string, page: number, pageSize: number): Promise<PublicPartyCompanyContributionPage>;
  searchPublicRecords(query: string): Promise<PublicSearchResult[]>;
}
