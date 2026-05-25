import { dataPrinciples, nextEvent, regions, upcomingRaces } from '../data/mockHomeData';
import { taiwanStageRegionNodes, taiwanStageRegionSummaries } from '../data/taiwanRegions';
import { mockPollComparisons } from '../data/mockPolling';
import {
  mockPublicCandidates,
  mockPublicCompanies,
  mockPublicElections,
  mockPublicParties,
  mockPublicPartyCompanyContributionSummaries,
  mockPublicPartyFinanceSummaries,
  mockPublicPersonClaims,
  mockPublicPeople,
  mockPublicRaces,
} from '../data/mockPublicViews';
import { electionPath, partyPath, personPath, regionPath } from '../routes/routePaths';
import { buildLocalOfficeSummary, buildPersonListItems, buildPersonProfile, filterPersonListItems } from './personData';
import { assertPublicViewName, allowedPublicViews } from './publicViewRegistry';
import type { PublicDataProvider, PublicSearchResult } from './publicDataProvider';

const providerViews = [
  'public_home_election_ticker',
  'public_region_election_summary',
  'public_people',
  'public_companies',
  'public_regions',
  'public_elections',
  'public_races',
  'public_candidates',
  'public_person_claims',
  'public_parties',
  'public_party_finance_summaries',
  'public_party_company_contribution_summaries',
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

function isNationalUpcomingRace(race: (typeof upcomingRaces)[number]) {
  return (
    race.raceType === 'president' ||
    race.raceType === 'vice_president' ||
    race.raceType === 'party_list_legislator' ||
    race.raceType === 'referendum' ||
    ['taiwan', 'region-taiwan', '全國', '臺灣', '台灣'].includes(race.regionId) ||
    ['全國', '臺灣', '台灣'].includes(race.region)
  );
}

function includesQuery(value: string | null | undefined, normalizedQuery: string) {
  return value?.toLowerCase().includes(normalizedQuery) ?? false;
}

function takeResults(results: PublicSearchResult[]) {
  return results.slice(0, 12);
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
    return upcomingRaces.filter((race) => race.regionId === baseRegionId || isNationalUpcomingRace(race));
  },

  getElectionById(electionId: string) {
    return mockPublicElections.find((item) => item.election_id === electionId) ?? null;
  },

  getRacesByElectionId(electionId: string) {
    return mockPublicRaces.filter((race) => race.election_id === electionId);
  },

  getCandidates() {
    return mockPublicCandidates;
  },

  getCandidatesByElectionId(electionId: string) {
    return mockPublicCandidates.filter((candidate) => candidate.election_id === electionId);
  },

  getPollComparisonByElectionId(electionId: string) {
    return mockPollComparisons.find((comparison) => comparison.electionId === electionId) ?? null;
  },

  getPeople() {
    return mockPublicPeople;
  },

  getPeopleByFilters(filters = {}) {
    return filterPersonListItems(buildPersonListItems(mockPublicPeople, mockPublicCandidates, taiwanStageRegionNodes, mockPublicPersonClaims), filters);
  },

  getPersonById(personId: string) {
    return mockPublicPeople.find((person) => person.person_id === personId) ?? null;
  },

  getPersonProfile(personId: string) {
    return buildPersonProfile(personId, mockPublicPeople, mockPublicCandidates, taiwanStageRegionNodes, mockPublicPersonClaims);
  },

  getLocalOfficeSummaryByRegionId(regionId: string) {
    return buildLocalOfficeSummary(regionId, mockPublicPeople, mockPublicCandidates, taiwanStageRegionNodes, mockPublicPersonClaims);
  },

  getCompanies() {
    return mockPublicCompanies;
  },

  getParties() {
    return mockPublicParties;
  },

  getPartyBySlug(partySlug: string) {
    return mockPublicParties.find((party) => party.slug === partySlug) ?? null;
  },

  getPartyFinanceSummaries(partyId: string) {
    return mockPublicPartyFinanceSummaries.filter((summary) => summary.party_id === partyId);
  },

  getPartyCompanyContributionSummaries(partyId: string) {
    return mockPublicPartyCompanyContributionSummaries.filter((summary) => summary.party_id === partyId);
  },

  searchPublicRecords(query: string) {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length < 2) {
      return [];
    }

    const peopleResults: PublicSearchResult[] = mockPublicPeople
      .filter((person) =>
        [person.name, person.alias, person.party, person.position, person.district].some((value) =>
          includesQuery(value, normalizedQuery),
        ),
      )
      .map((person) => ({
        id: person.person_id,
        type: 'person',
        label: '人物',
        title: person.name,
        subtitle: [person.party, person.position, person.district].filter(Boolean).join(' · ') || '公開人物資料',
        href: personPath(person.person_id),
      }));

    const companyResults: PublicSearchResult[] = mockPublicCompanies
      .filter((company) =>
        [company.name, company.unified_business_no, company.representative_name, company.address_region].some((value) =>
          includesQuery(value, normalizedQuery),
        ),
      )
      .map((company) => ({
        id: company.company_id,
        type: 'company',
        label: '公司',
        title: company.name,
        subtitle: [company.representative_name, company.address_region].filter(Boolean).join(' · ') || '公開公司資料',
        href: null,
      }));

    const partyResults: PublicSearchResult[] = mockPublicParties
      .filter((party) => [party.name, party.short_name].some((value) => includesQuery(value, normalizedQuery)))
      .map((party) => ({
        id: party.party_id,
        type: 'party',
        label: '政黨',
        title: party.name,
        subtitle: party.short_name ? `簡稱 ${party.short_name}` : '政黨與政治獻金摘要',
        href: partyPath(party.slug),
      }));

    const electionResults: PublicSearchResult[] = mockPublicElections
      .filter((election) => [election.name, election.election_type, election.status].some((value) => includesQuery(value, normalizedQuery)))
      .map((election) => ({
        id: election.election_id,
        type: 'election',
        label: '選舉',
        title: election.name,
        subtitle: [election.year?.toString(), election.voting_date, election.status].filter(Boolean).join(' · '),
        href: electionPath(election.election_id),
      }));

    const regionResults: PublicSearchResult[] = taiwanStageRegionNodes
      .filter((region) => [region.label, region.stageLabel, region.note].some((value) => includesQuery(value, normalizedQuery)))
      .map((region) => ({
        id: region.id,
        type: 'region',
        label: '地區',
        title: region.label,
        subtitle: region.level === 'county_city' ? '縣市地圖區域' : '公開區域導覽',
        href: regionPath(region.id),
      }));

    return takeResults([...partyResults, ...electionResults, ...regionResults, ...peopleResults, ...companyResults]);
  },
};
