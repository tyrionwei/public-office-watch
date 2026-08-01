import type { UpcomingRace } from '../data/mockHomeData';
import type { PollComparison } from '../types/polling';
import type {
  PublicCandidate,
  PublicCompany,
  PublicElection,
  PublicElectionRaceFacet,
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
import { buildLocalOfficeSummaryFromItems, filterPersonListItems } from './personData.ts';
import type {
  HomePageData,
  HomeTicker,
  PublicDataProvider,
  PublicElectionIndexData,
  PublicPersonListPage,
  PublicRaceDetailData,
  PublicRaceListPage,
  PublicRaceQueryFilters,
} from './publicDataProvider';
import type { PublishedPartyData, PublishedPublicDataBridge } from './publishedPublicDataBridge.ts';

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
    '前端只讀經審核且有界的 published 發布資料。',
    '尚未載入公開發布資料。',
  ],
};

export type PublishedProviderAssembly = {
  provider: PublicDataProvider;
  refresh(): Promise<void>;
};

function mergeByKey<T>(items: T[], incoming: T[], getKey: (item: T) => string) {
  const byKey = new Map(items.map((item) => [getKey(item), item]));
  for (const item of incoming) byKey.set(getKey(item), item);
  return Array.from(byKey.values());
}

function isNationalRace(race: UpcomingRace) {
  return (
    race.raceType === 'president'
    || race.raceType === 'vice_president'
    || race.raceType === 'party_list_legislator'
    || race.raceType === 'referendum'
    || ['taiwan', 'region-taiwan', '全國', '臺灣', '台灣'].includes(race.regionId)
  );
}

export function createPublishedPublicDataProvider(
  bridge: PublishedPublicDataBridge,
): PublishedProviderAssembly {
  let homeData = emptyHomePageData;
  let partyData: PublishedPartyData = {
    parties: [],
    financeSummaries: [],
    companyContributionSummaries: [],
  };
  let elections: PublicElection[] = [];
  let races: PublicRace[] = [];
  let candidates: PublicCandidate[] = [];
  let people: PublicPersonListItem[] = [];
  const profilesById = new Map<string, PublicPersonProfile>();
  const localOfficeSummaries = new Map<string, PublicLocalOfficeSummary>();
  let refreshPromise: Promise<void> | null = null;

  function getStageRegion(regionId: string) {
    return homeData.stageRegions.find((region) => (
      region.id === regionId || region.publicRegionId === regionId
    )) ?? null;
  }

  function getRegionSummary(regionId: string) {
    const region = getStageRegion(regionId);
    const keys = new Set([regionId, region?.id, region?.publicRegionId].filter(Boolean));
    return homeData.stageRegionSummaries.find((summary) => keys.has(summary.regionId)) ?? null;
  }

  function getRegionCard(regionId: string) {
    const region = getStageRegion(regionId);
    const keys = new Set([regionId, region?.id, region?.publicRegionId].filter(Boolean));
    return homeData.regions.find((card) => keys.has(card.id)) ?? null;
  }

  function getRelatedRaces(regionId: string) {
    const region = getStageRegion(regionId);
    const keys = new Set([regionId, region?.id, region?.publicRegionId].filter(Boolean));
    return homeData.upcomingRaces.filter((race) => keys.has(race.regionId) || isNationalRace(race));
  }

  function getEmptyLocalOfficeSummary(regionId: string) {
    const region = getStageRegion(regionId);
    const summary = buildLocalOfficeSummaryFromItems(regionId, [], []);
    return region ? { ...summary, region_name: region.label } : summary;
  }

  const provider: PublicDataProvider = {
    getHomeTicker() {
      return homeData.ticker;
    },

    getHomePageData() {
      return homeData;
    },

    getRegionElectionSummaries() {
      return homeData.regions;
    },

    getRegionSummary,

    getRegionCardByStageRegionId: getRegionCard,

    getStageRegions() {
      return homeData.stageRegions;
    },

    getStageRegion,

    getChildStageRegions(parentId: string) {
      return homeData.stageRegions.filter((region) => region.parentId === parentId);
    },

    getUpcomingRaces() {
      return homeData.upcomingRaces;
    },

    getRelatedRacesByRegionId: getRelatedRaces,

    getElections() {
      return elections;
    },

    getElectionById(electionId: string) {
      return elections.find((election) => election.election_id === electionId) ?? null;
    },

    getRacesByElectionId(electionId: string) {
      return races.filter((race) => race.election_id === electionId);
    },

    getRaces() {
      return races;
    },

    getRaceById(raceId: string) {
      return races.find((race) => race.race_id === raceId) ?? null;
    },

    getCandidates() {
      return candidates;
    },

    getCandidatesByElectionId(electionId: string) {
      return candidates.filter((candidate) => candidate.election_id === electionId);
    },

    getCandidatesByRaceId(raceId: string) {
      return candidates.filter((candidate) => candidate.race_id === raceId);
    },

    async loadElectionIndex(): Promise<PublicElectionIndexData> {
      const result = await bridge.loadElectionIndex();
      elections = result.elections;
      return result;
    },

    loadElectionRaceFacets(electionIds: string[]): Promise<PublicElectionRaceFacet[]> {
      return bridge.loadElectionRaceFacets(electionIds);
    },

    async loadRacesByElectionIds(electionIds: string[], filters: PublicRaceQueryFilters = {}) {
      const electionIdSet = new Set(electionIds);
      return races.filter((race) => (
        electionIdSet.has(race.election_id)
        && (!filters.raceTypes?.length || filters.raceTypes.includes(race.race_type))
      ));
    },

    async loadElectionRacePage(
      eventKey: string,
      electionIds: string[],
      filters: PublicRaceQueryFilters,
      page: number,
      pageSize: number,
    ): Promise<PublicRaceListPage> {
      const result = await bridge.loadElectionRacePage(
        eventKey,
        electionIds,
        filters,
        page,
        pageSize,
      );
      races = mergeByKey(races, result.items, (race) => race.race_id);
      return result;
    },

    async loadRaceDetail(raceId: string): Promise<PublicRaceDetailData> {
      const result = await bridge.loadRaceDetail(raceId);
      if (result.race) races = mergeByKey(races, [result.race], (race) => race.race_id);
      if (result.election) {
        elections = mergeByKey(elections, [result.election], (election) => election.election_id);
      }
      candidates = mergeByKey(candidates, result.candidates, (candidate) => candidate.candidate_id);
      return result;
    },

    getPollComparisonByElectionId(): PollComparison | null {
      return null;
    },

    getPeople(): PublicPerson[] {
      return people;
    },

    getPeopleByFilters(filters: PublicPersonFilters = {}) {
      return filterPersonListItems(people, filters);
    },

    async loadPeoplePage(
      filters: PublicPersonFilters,
      page: number,
      pageSize: number,
    ): Promise<PublicPersonListPage> {
      const result = await bridge.loadPeoplePage(filters, page, pageSize);
      people = mergeByKey(people, result.items, (person) => person.person_id);
      return result;
    },

    async loadPartyCandidatePage(partyName: string, page: number, pageSize: number) {
      const result = await bridge.loadPartyCandidatePage(partyName, page, pageSize);
      candidates = mergeByKey(candidates, result.items, (candidate) => candidate.candidate_id);
      return result;
    },

    getPersonById(personId: string) {
      return people.find((person) => person.person_id === personId) ?? null;
    },

    getPersonProfile(personId: string) {
      return profilesById.get(personId) ?? null;
    },

    async loadPersonProfiles(personIds: string[]) {
      const profiles = await bridge.loadPersonProfiles(personIds);
      for (const profile of profiles) profilesById.set(profile.person.person_id, profile);
      people = mergeByKey(people, profiles.map((profile) => profile.person), (person) => person.person_id);
      return profiles;
    },

    getLocalOfficeSummaryByRegionId(regionId: string) {
      return localOfficeSummaries.get(regionId) ?? getEmptyLocalOfficeSummary(regionId);
    },

    async loadLocalOfficeSummaryByRegionId(regionId: string) {
      const summary = await bridge.loadLocalOfficeSummaryByRegionId(regionId);
      localOfficeSummaries.set(regionId, summary);
      return summary;
    },

    getCompanies(): PublicCompany[] {
      return [];
    },

    getParties(): PublicParty[] {
      return partyData.parties;
    },

    getPartyBySlug(partySlug: string) {
      return partyData.parties.find((party) => party.slug === partySlug) ?? null;
    },

    loadPartyOfficers(partyId: string) {
      return bridge.loadPartyOfficers(partyId);
    },

    getPartyFinanceSummaries(partyId: string): PublicPartyFinanceSummary[] {
      return partyData.financeSummaries.filter((summary) => summary.party_id === partyId);
    },

    getPartyCompanyContributionSummaries(
      partyId: string,
    ): PublicPartyCompanyContributionSummary[] {
      return partyData.companyContributionSummaries.filter((summary) => summary.party_id === partyId);
    },

    searchPublicRecords(query: string) {
      return bridge.searchPublicRecords(query);
    },
  };

  return {
    provider,
    refresh() {
      refreshPromise ??= Promise.all([
        bridge.loadHomePageData(),
        bridge.loadPartyData(),
      ])
        .then(([nextHomeData, nextPartyData]) => {
          homeData = nextHomeData;
          partyData = nextPartyData;
        })
        .finally(() => {
          refreshPromise = null;
        });
      return refreshPromise;
    },
  };
}
