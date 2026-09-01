import type { UpcomingRace } from '../data/mockHomeData';
import type { PollComparison } from '../types/polling';
import type {
  PublicCandidate,
  PublicCompany,
  PublicElection,
  PublicElectionRaceFacet,
  PublicLocalOfficeSummary,
  PublicParty,
  PublicPartyAnnualFinanceFiling,
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
  PublicPartyCompanyContributionPage,
} from './publicDataProvider';
import type { PublishedPartyData, PublishedPublicDataBridge } from './publishedPublicDataBridge.ts';

const publicDataReadyEvent = 'public-data-ready';

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
  candidateSummaries: [],
  seatDistribution: [],
  releaseId: null,
  publishedAt: null,
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

const referenceDataStaleTimeMs = 30 * 60 * 1000;
const pageDataStaleTimeMs = 5 * 60 * 1000;

type CachedRequest = {
  expiresAt: number;
  promise: Promise<unknown>;
};

function createRequestCache() {
  const requests = new Map<string, CachedRequest>();
  return function cached<T>(key: string, staleTime: number, load: () => Promise<T>) {
    const current = requests.get(key);
    if (current && current.expiresAt > Date.now()) return current.promise as Promise<T>;
    const promise = load().catch((error: unknown) => {
      if (requests.get(key)?.promise === promise) requests.delete(key);
      throw error;
    });
    requests.set(key, { expiresAt: Date.now() + staleTime, promise });
    return promise;
  };
}

function notifyPublicDataReady() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(publicDataReadyEvent));
}

export function createPublishedPublicDataProvider(
  bridge: PublishedPublicDataBridge,
): PublishedProviderAssembly {
  let homeData = emptyHomePageData;
  let partyData: PublishedPartyData = {
    parties: [],
    annualFinanceFilings: [],
    financeSummaries: [],
    companyContributionSummaries: [],
  };
  let elections: PublicElection[] = [];
  let races: PublicRace[] = [];
  let candidates: PublicCandidate[] = [];
  let people: PublicPersonListItem[] = [];
  const profilesById = new Map<string, PublicPersonProfile>();
  const localOfficeSummaries = new Map<string, PublicLocalOfficeSummary>();
  const regionRacesByRegionId = new Map<string, UpcomingRace[]>();
  const raceRegionPromises = new Map<string, Promise<UpcomingRace[]>>();
  const cached = createRequestCache();
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

  async function loadRelatedRaces(regionId: string) {
    const region = getStageRegion(regionId);
    const regionKey = region?.id ?? regionId;

    if (regionRacesByRegionId.has(regionKey)) {
      return getRelatedRaces(regionId);
    }

    let inFlightRequest = raceRegionPromises.get(regionKey);
    if (!inFlightRequest) {
      inFlightRequest = bridge.loadRegionPageData(regionKey)
        .then((result) => {
          const loadedRegionKey = result.region?.id ?? regionKey;
          regionRacesByRegionId.set(loadedRegionKey, result.relatedRaces);
          homeData = {
            ...homeData,
            stageRegions: mergeByKey(
              homeData.stageRegions,
              [result.region, ...result.childRegions].filter(
                (item): item is NonNullable<typeof result.region> => item !== null,
              ),
              (item) => item.id,
            ),
            stageRegionSummaries: result.summary
              ? mergeByKey(homeData.stageRegionSummaries, [result.summary], (item) => item.regionId)
              : homeData.stageRegionSummaries,
            regions: result.card
              ? mergeByKey(homeData.regions, [result.card], (item) => item.id)
              : homeData.regions,
            upcomingRaces: mergeByKey(homeData.upcomingRaces, result.relatedRaces, (race) => race.id),
          };
          notifyPublicDataReady();
          return getRelatedRaces(regionId);
        })
        .finally(() => {
          raceRegionPromises.delete(regionKey);
        });
      raceRegionPromises.set(regionKey, inFlightRequest);
    }

    return inFlightRequest;
  }

  function getEmptyLocalOfficeSummary(regionId: string) {
    const region = getStageRegion(regionId);
    const summary = buildLocalOfficeSummaryFromItems(regionId, [], []);
    return region ? { ...summary, region_name: region.label } : summary;
  }

  const provider: PublicDataProvider = {
    async loadRegionDirectory() {
      const regions = await cached('region-directory', referenceDataStaleTimeMs, () =>
        bridge.loadRegionDirectory());
      homeData = { ...homeData, stageRegions: regions };
      notifyPublicDataReady();
      return regions;
    },

    async loadHomePageData(regionId = null) {
      const normalizedRegionId = regionId?.trim() || null;
      const nextHomeData = await cached(
        `home-page:${normalizedRegionId ?? 'national'}`,
        pageDataStaleTimeMs,
        () => bridge.loadHomePageData(normalizedRegionId),
      );
      const loadedRegionRaces = Array.from(regionRacesByRegionId.values()).flat();
      homeData = {
        ...nextHomeData,
        upcomingRaces: mergeByKey(nextHomeData.upcomingRaces, loadedRegionRaces, (race) => race.id),
      };
      candidates = mergeByKey(
        candidates,
        (nextHomeData.candidateSummaries ?? []).map((summary) => summary.candidate),
        (candidate) => candidate.candidate_id,
      );
      return homeData;
    },

    async loadPartyDirectory() {
      const parties = await cached('party-directory', referenceDataStaleTimeMs, () => bridge.loadPartyDirectory());
      partyData = { ...partyData, parties };
      notifyPublicDataReady();
      return parties;
    },

    async loadPartyFinanceData() {
      const nextPartyData = await cached('party-finance', pageDataStaleTimeMs, () => bridge.loadPartyData());
      partyData = {
        ...nextPartyData,
        parties: partyData.parties,
        companyContributionSummaries: partyData.companyContributionSummaries,
      };
    },

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

    loadRelatedRacesByRegionId: loadRelatedRaces,

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
      const result = await cached('election-index', referenceDataStaleTimeMs, () => bridge.loadElectionIndex());
      elections = result.elections;
      notifyPublicDataReady();
      return result;
    },

    loadElectionRaceFacets(electionIds: string[]): Promise<PublicElectionRaceFacet[]> {
      return cached(`election-facets:${electionIds.join(',')}`, pageDataStaleTimeMs, () => bridge.loadElectionRaceFacets(electionIds));
    },

    loadElectionEducationDistribution(eventKey, electionIds, filters = {}) {
      return bridge.loadElectionEducationDistribution(eventKey, electionIds, filters);
    },

    loadElectionPartyPerformance(eventKey, electionIds, filters = {}) {
      return bridge.loadElectionPartyPerformance(eventKey, electionIds, filters);
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
      const key = `election-races:${eventKey}:${electionIds.join(',')}:${JSON.stringify(filters)}:${page}:${pageSize}`;
      const result = await cached(key, pageDataStaleTimeMs, () =>
        bridge.loadElectionRacePage(eventKey, electionIds, filters, page, pageSize));
      races = mergeByKey(races, result.items, (race) => race.race_id);
      notifyPublicDataReady();
      return result;
    },

    async loadRaceDetail(raceId: string): Promise<PublicRaceDetailData> {
      const result = await cached(`race-detail:${raceId}`, pageDataStaleTimeMs, () => bridge.loadRaceDetail(raceId));
      if (result.race) races = mergeByKey(races, [result.race], (race) => race.race_id);
      if (result.election) {
        elections = mergeByKey(elections, [result.election], (election) => election.election_id);
      }
      candidates = mergeByKey(candidates, result.candidates, (candidate) => candidate.candidate_id);
      notifyPublicDataReady();
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
      const key = `people:${JSON.stringify(filters)}:${page}:${pageSize}`;
      const result = await cached(key, pageDataStaleTimeMs, () => bridge.loadPeoplePage(filters, page, pageSize));
      people = mergeByKey(people, result.items, (person) => person.person_id);
      notifyPublicDataReady();
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
      const normalizedIds = Array.from(new Set(personIds)).sort();
      const profiles = await cached(`profiles:${normalizedIds.join(',')}`, pageDataStaleTimeMs, () =>
        bridge.loadPersonProfiles(normalizedIds));
      for (const profile of profiles) profilesById.set(profile.person.person_id, profile);
      people = mergeByKey(people, profiles.map((profile) => profile.person), (person) => person.person_id);
      notifyPublicDataReady();
      return profiles;
    },

    getLocalOfficeSummaryByRegionId(regionId: string) {
      return localOfficeSummaries.get(regionId) ?? getEmptyLocalOfficeSummary(regionId);
    },

    async loadLocalOfficeSummaryByRegionId(regionId: string) {
      const summary = await cached(`local-office:${regionId}`, pageDataStaleTimeMs, () =>
        bridge.loadLocalOfficeSummaryByRegionId(regionId));
      localOfficeSummaries.set(regionId, summary);
      return summary;
    },

    loadNationalOfficeHolders() {
      return cached('national-office-holders', pageDataStaleTimeMs, () => bridge.loadNationalOfficeHolders());
    },

    loadCurrentLegislatorPartySummary() {
      return cached('legislator-party-summary', pageDataStaleTimeMs, () => bridge.loadCurrentLegislatorPartySummary());
    },

    loadPublicUpdates(limit) {
      return bridge.loadPublicUpdates(limit);
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
      return cached(`party-officers:${partyId}`, pageDataStaleTimeMs, () => bridge.loadPartyOfficers(partyId));
    },

    loadPartyPlatformHistory(partyId: string) {
      return cached(`party-platform-history:${partyId}`, pageDataStaleTimeMs, () => bridge.loadPartyPlatformHistory(partyId));
    },

    loadPartyPeopleStatistics(partyName: string) {
      return cached(`party-people:${partyName}`, pageDataStaleTimeMs, () => bridge.loadPartyPeopleStatistics(partyName));
    },

    loadPartyLegalStatistics(partyName: string) {
      return cached(`party-legal:${partyName}`, pageDataStaleTimeMs, () => bridge.loadPartyLegalStatistics(partyName));
    },

    getPartyAnnualFinanceFilings(partyId: string): PublicPartyAnnualFinanceFiling[] {
      return partyData.annualFinanceFilings.filter((filing) => filing.party_id === partyId);
    },

    getPartyFinanceSummaries(partyId: string): PublicPartyFinanceSummary[] {
      return partyData.financeSummaries.filter((summary) => summary.party_id === partyId);
    },

    getPartyCompanyContributionSummaries(
      partyId: string,
    ): PublicPartyCompanyContributionSummary[] {
      return partyData.companyContributionSummaries.filter((summary) => summary.party_id === partyId);
    },

    loadPartyCompanyContributionCounts() {
      return cached('party-company-counts', pageDataStaleTimeMs, () =>
        bridge.loadPartyCompanyContributionCounts());
    },

    async loadPartyCompanyContributionPage(
      partyId: string,
      page: number,
      pageSize: number,
    ): Promise<PublicPartyCompanyContributionPage> {
      return cached(`party-company:${partyId}:${page}:${pageSize}`, pageDataStaleTimeMs, () => bridge.loadPartyCompanyContributionPage(partyId, page, pageSize));
    },

    searchPublicRecords(query: string) {
      return bridge.searchPublicRecords(query);
    },
  };

  return {
    provider,
    refresh() {
      refreshPromise ??= Promise.all([
        provider.loadHomePageData(),
        provider.loadPartyDirectory(),
        provider.loadPartyFinanceData(),
      ])
        .then(() => undefined)
        .finally(() => {
          refreshPromise = null;
        });
      return refreshPromise;
    },
  };
}
