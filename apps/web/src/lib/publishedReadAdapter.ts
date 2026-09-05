import type { PollingPlace } from '../types/pollingPlace';
import type { CandidateLifecycleEvent } from '../types/candidateLifecycle';
import type {
  PublicElection,
  PublicElectionEducationDistribution,
  PublicElectionRaceFacet,
  PublicElectionRaceSummary,
  PublicCandidate,
  PublicParty,
  PublicPartyAnnualFinanceFiling,
  PublicPartyCompanyContributionCount,
  PublicPartyCompanyContributionSummary,
  PublicPartyFinanceSummary,
  PublicPartyLegalStatistics,
  PublicPartyListRaceResult,
  PublicPartyPlatformHistory,
  PublicPartyPeopleStatisticRow,
  PublicPartyOfficer,
  PublicPartyElectionPerformance,
  PublicLegislatorPartySummary,
  PublicNationalOfficeHolder,
  PublicPersonClaim,
  PublicPersonPartyAffiliation,
  PublicPersonRole,
  PublicPersonStatus,
  PublicRace,
  PublicReferendumOption,
  PublicReferendumQuestion,
  PublicReferendumRegionResult,
  PublicRegion,
  PublicUpdate,
} from '../types/publicViews';
import {
  PUBLIC_ELECTION_RACE_PAGE_SIZE,
  PUBLIC_PEOPLE_PAGE_SIZE,
  PUBLIC_SEARCH_RESULT_LIMIT,
  normalizePublishedSearchQuery,
  toPublicPageRange,
} from './publicReadContracts.ts';

export const HOME_REGION_LIMIT = 32;
export const HOME_RACE_LIMIT = 25;
export const HOME_CANDIDATE_SUMMARY_LIMIT = 400;
export const REGION_CHILD_LIMIT = 64;
export const REGION_RACE_LIMIT = 24;
export const ELECTION_INDEX_LIMIT = 500;
export const ELECTION_ID_BATCH_SIZE = 200;
export const ELECTION_FACET_BATCH_LIMIT = 1000;
export const ELECTION_RACE_PAGE_ELECTION_LIMIT = 500;
export const ELECTION_RACE_PAGE_SIZE = PUBLIC_ELECTION_RACE_PAGE_SIZE;
export const ELECTION_EDUCATION_DISTRIBUTION_LIMIT = 9;
export const ELECTION_PARTY_PERFORMANCE_LIMIT = 50;
export const PERSON_PROFILE_BATCH_LIMIT = 4;
export const PERSON_CANDIDATE_LIMIT = 100;
export const PERSON_CLAIM_LIMIT = 400;
export const LOCAL_OFFICE_PERSON_LIMIT = 200;
export const NATIONAL_OFFICE_HOLDER_LIMIT = 12;
export const LEGISLATOR_PARTY_SUMMARY_LIMIT = 20;
export const RACE_DETAIL_CANDIDATE_LIMIT = 100;
export const RACE_DETAIL_PARTY_LIST_CANDIDATE_LIMIT = 256;
export const RACE_DETAIL_PARTY_LIST_RESULT_LIMIT = 32;
export const RACE_DETAIL_PARTY_AFFILIATION_LIMIT = 1000;
export const RACE_DETAIL_REFERENDUM_OPTION_LIMIT = 2;
export const RACE_DETAIL_REFERENDUM_REGION_LIMIT = 64;
export const PARTY_LIMIT = 200;
export const PARTY_ANNUAL_FINANCE_LIMIT = 200;
export const PARTY_FINANCE_LIMIT = 100;
export const PARTY_COMPANY_CONTRIBUTION_PAGE_SIZE = 50;
export const PARTY_OFFICER_LIMIT = 200;
export const PARTY_PLATFORM_HISTORY_LIMIT = 16;
export const PARTY_PEOPLE_STATISTICS_LIMIT = 19;
export const PERSON_PARTY_AFFILIATION_LIMIT = 100;
export const PUBLIC_UPDATE_LIMIT = 50;

const LOCAL_OFFICE_ROLES: PublicPersonRole[] = [
  'local_chief',
  'local_deputy',
  'agency_head',
  'councilor',
];

export const ELECTION_COLUMNS = [
  'election_id',
  'name',
  'year',
  'election_type',
  'voting_date',
  'status',
  'source_name',
  'source_url',
].join(',');

export const ELECTION_RACE_SUMMARY_COLUMNS = [
  'election_id',
  'race_count',
  'race_types',
].join(',');

export const ELECTION_RACE_FACET_COLUMNS = [
  'election_id',
  'race_type',
  'region_key',
  'region_label',
  'race_count',
].join(',');

export const HOME_TICKER_COLUMNS = [
  'election_id',
  'election_name',
  'voting_date',
].join(',');

export const HOME_REGION_SUMMARY_COLUMNS = [
  'region_id',
  'region_name',
  'region_slug',
  'region_type',
  'next_election_id',
  'next_election_name',
  'next_voting_date',
  'upcoming_race_count',
].join(',');

export const REGION_COLUMNS = [
  'region_id',
  'name',
  'slug',
  'region_type',
  'parent_region_id',
  'official_code',
  'map_code',
  'display_order',
].join(',');

export const RACE_COLUMNS = [
  'race_id',
  'election_id',
  'election_name',
  'region_id',
  'region_name',
  'region_slug',
  'race_type',
  'title',
  'voting_date',
  'status',
].join(',');

export const RACE_DETAIL_COLUMNS = [
  'race_id',
  'election_id',
  'election_name',
  'region_id',
  'region_name',
  'region_slug',
  'race_type',
  'title',
  'voting_date',
  'status',
  'source_name',
  'source_url',
].join(',');

export const REFERENDUM_QUESTION_COLUMNS = [
  'question_id',
  'race_id',
  'election_id',
  'referendum_type',
  'case_number',
  'jurisdiction_name',
  'proposal_text',
  'result_status',
  'eligible_voters',
  'total_votes',
  'valid_votes',
  'invalid_votes',
  'turnout_rate',
  'approval_rule',
  'source_name',
  'source_url',
  'source_document_url',
  'updated_at',
].join(',');

export const REFERENDUM_OPTION_COLUMNS = [
  'option_id',
  'question_id',
  'race_id',
  'option_code',
  'label',
  'vote_count',
  'vote_rate',
  'display_order',
  'updated_at',
].join(',');

export const REFERENDUM_REGION_RESULT_COLUMNS = [
  'result_id',
  'question_id',
  'race_id',
  'region_id',
  'region_name',
  'region_slug',
  'eligible_voters',
  'yes_votes',
  'no_votes',
  'invalid_votes',
  'turnout_rate',
  'source_name',
  'source_url',
  'updated_at',
].join(',');

export const PEOPLE_DIRECTORY_COLUMNS = [
  'person_id',
  'name',
  'alias',
  'gender',
  'party',
  'position',
  'current_office_label',
  'upcoming_candidate_label',
  'election_year',
  'district',
  'updated_at',
  'primary_photo_thumbnail_url',
  'list_role',
  'list_status',
  'list_is_grassroots',
  'list_is_party_only',
  'list_status_order',
  'list_role_order',
].join(',');

export const NATIONAL_OFFICE_HOLDER_COLUMNS = [
  'institution_key',
  'role_key',
  'holder_name',
  'holder_person_id',
  'party_name',
  'tenure_status',
  'source_name',
  'source_url',
  'observed_at',
  'display_order',
  'updated_at',
].join(',');

export const PUBLIC_UPDATE_COLUMNS = [
  'update_id',
  'update_type',
  'title',
  'summary',
  'entity_type',
  'entity_id',
  'entity_href',
  'source_name',
  'source_url',
  'occurred_at',
  'published_at',
].join(',');

export const LEGISLATOR_PARTY_SUMMARY_COLUMNS = [
  'party_name',
  'legislator_count',
].join(',');

export const PERSON_PROFILE_COLUMNS = [
  'person_id',
  'name',
  'alias',
  'gender',
  'party',
  'position',
  'current_office_label',
  'upcoming_candidate_label',
  'election_year',
  'district',
  'education',
  'experience',
  'updated_at',
  'primary_photo_url',
  'primary_photo_thumbnail_url',
  'photo_source_name',
  'photo_source_url',
  'photo_license_type',
  'photo_license_url',
  'photo_attribution',
  'list_role',
  'list_status',
  'list_is_grassroots',
  'list_is_party_only',
  'list_status_order',
  'list_role_order',
  'candidate_count',
  'primary_region_id',
  'primary_region_name',
].join(',');

export const HOME_CANDIDATE_SUMMARY_COLUMNS = [
  'gender',
  'birth_date',
].join(',');

export const PERSON_CANDIDATE_COLUMNS = [
  'candidate_id',
  'person_id',
  'person_name',
  'person_party',
  'person_position',
  'race_id',
  'race_title',
  'election_id',
  'election_name',
  'region_id',
  'region_name',
  'party',
  'candidate_no',
  'registration_status',
  'vote_count',
  'vote_rate',
  'is_elected',
  'is_incumbent',
  'election_year',
  'candidacy_status',
  'election_result',
  'status_updated_at',
  'candidate_updated_at',
  'source_name',
  'source_url',
  'primary_photo_url',
  'primary_photo_thumbnail_url',
  'photo_attribution',
  'photo_license_type',
].join(',');

export const PARTY_COLUMNS = [
  'party_id',
  'name',
  'short_name',
  'slug',
  'theme_key',
  'official_site_url',
  'chairperson_name',
  'registry_no',
  'founded_date_text',
  'filed_date_text',
  'headquarters_address',
  'contact_phone',
  'status',
  'source_name',
  'source_url',
  'updated_at',
].join(',');

export const PARTY_ANNUAL_FINANCE_COLUMNS = [
  'party_id',
  'party_name',
  'report_year',
  'filing_status',
  'ratification_status',
  'assembly_approval_status',
  'detail_url',
  'report_pdf_url',
  'source_name',
  'source_url',
  'updated_at',
].join(',');

export const PARTY_FINANCE_COLUMNS = [
  'party_id',
  'party_name',
  'report_year',
  'income_total',
  'expense_total',
  'balance_amount',
  'individual_donation_total',
  'business_donation_total',
  'civil_group_donation_total',
  'anonymous_donation_total',
  'other_income_total',
  'source_name',
  'source_url',
  'updated_at',
].join(',');

export const PARTY_COMPANY_CONTRIBUTION_COLUMNS = [
  'party_id',
  'company_id',
  'company_name',
  'report_year',
  'amount_total',
  'donation_count',
  'confidence_level',
  'source_name',
  'source_url',
  'reviewed_at',
  'representative_name',
  'director_names',
  'registry_source_name',
  'registry_source_url',
  'registry_checked_at',
].join(',');

export const PARTY_OFFICER_COLUMNS = [
  'affiliation_id',
  'person_id',
  'person_name',
  'party_id',
  'party_name',
  'role_title',
  'organization_unit',
  'display_order',
  'start_date',
  'observed_date',
  'current_office_label',
  'primary_photo_thumbnail_url',
  'source_name',
  'source_url',
  'updated_at',
  'role_tier',
].join(',');

export const PERSON_PARTY_AFFILIATION_COLUMNS = [
  'affiliation_id',
  'affiliation_key',
  'person_id',
  'person_name',
  'source_claim_key',
  'party_name',
  'role_context',
  'role_title',
  'organization_unit',
  'display_order',
  'role_tier',
  'observed_year',
  'observed_date',
  'start_date',
  'end_date',
  'is_current',
  'confidence_level',
  'source_name',
  'source_url',
  'updated_at',
].join(',');

export const SEARCH_RESULT_COLUMNS = [
  'document_key',
  'entity_type',
  'entity_id',
  'title',
  'normalized_search_text',
  'href',
].join(',');

export type PublishedHomeTickerRow = {
  election_id: string;
  election_name: string;
  voting_date: string;
};

export type PublishedRegionSummaryRow = {
  region_id: string;
  region_name: string;
  region_slug: string;
  region_type: PublicRegion['region_type'];
  next_election_id: string | null;
  next_election_name: string | null;
  next_voting_date: string | null;
  upcoming_race_count: number;
};

export type PublishedRegionRow = PublicRegion;

export type PublishedElectionRow = PublicElection;

export type PublishedElectionRaceSummaryRow = PublicElectionRaceSummary;

export type PublishedElectionRaceFacetRow = PublicElectionRaceFacet;
export type PublishedElectionEducationDistributionRow = PublicElectionEducationDistribution;
export type PublishedPartyElectionPerformanceRow = PublicPartyElectionPerformance;

export type PublishedRaceRow = Pick<
  PublicRace,
  | 'race_id'
  | 'election_id'
  | 'election_name'
  | 'region_id'
  | 'region_name'
  | 'region_slug'
  | 'race_type'
  | 'title'
  | 'voting_date'
  | 'status'
>;

export type PublishedPeopleDirectoryRow = {
  person_id: string;
  name: string;
  alias: string | null;
  gender: 'male' | 'female' | 'unknown' | null;
  party: string | null;
  position: string | null;
  current_office_label: string | null;
  upcoming_candidate_label: string | null;
  election_year: number | null;
  district: string | null;
  updated_at: string;
  primary_photo_thumbnail_url: string | null;
  list_role: PublicPersonRole;
  list_status: PublicPersonStatus;
  list_is_grassroots: boolean;
  list_is_party_only: boolean;
  list_status_order: number;
  list_role_order: number;
};

export type PublishedHomePageCandidateRow = PublicCandidate & {
  gender: PublishedPeopleDirectoryRow['gender'];
  age_group: 'under-40' | '40-49' | '50-59' | '60-plus' | null;
};

export type PublishedHomeSeatRow = {
  party_name: string | null;
  seat_count: number;
};

export type PublishedNationalOfficeHolderRow = PublicNationalOfficeHolder;
export type PublishedLegislatorPartySummaryRow = PublicLegislatorPartySummary;

export type PublishedPersonProfileRow = PublishedPeopleDirectoryRow & {
  education: string | null;
  experience: string | null;
  primary_photo_url: string | null;
  photo_source_name: string | null;
  photo_source_url: string | null;
  photo_license_type: string | null;
  photo_license_url: string | null;
  photo_attribution: string | null;
  candidate_count: number;
  primary_region_id: string | null;
  primary_region_name: string | null;
};

export type PublishedSearchResultRow = {
  document_key: string;
  entity_type: 'person' | 'company' | 'party' | 'election' | 'region';
  entity_id: string;
  title: string;
  normalized_search_text: string;
  party_name: string | null;
  href: string | null;
};

export type PublishedPeoplePageRequest = {
  page: number;
  pageSize?: number;
  query?: string;
  districtPrefixes?: string[];
  party?: string;
  role?: PublicPersonRole;
  status?: PublicPersonStatus;
};

export type PublishedPeoplePage = {
  rows: PublishedPeopleDirectoryRow[];
  total: number;
};

export type PublishedPartyCandidatePage = {
  rows: PublicCandidate[];
  total: number;
};

export type PublishedHomePageRows = {
  apiVersion: number;
  releaseId: string | null;
  publishedAt: string | null;
  tickerRows: PublishedHomeTickerRow[];
  regionSummaryRows: PublishedRegionSummaryRow[];
  regionRows: PublishedRegionRow[];
  raceRows: PublishedRaceRow[];
  candidateRows: PublishedHomePageCandidateRow[];
  seatRows: PublishedHomeSeatRow[];
};

type PublishedPayloadMetadata = {
  api_version: number;
  release_id: string | null;
  published_at: string | null;
};

type PublishedHomePagePayloadRow = {
  payload: PublishedPayloadMetadata & {
    release_id: string | null;
    published_at: string | null;
    ticker_rows: PublishedHomeTickerRow[];
    region_summary_rows: PublishedRegionSummaryRow[];
    region_rows: PublishedRegionRow[];
    race_rows: PublishedRaceRow[];
    candidate_rows: PublishedHomePageCandidateRow[];
    seat_rows: PublishedHomeSeatRow[];
  };
};

type PublishedRegionPagePayloadRow = {
  payload: PublishedPayloadMetadata & {
    region_row: PublishedRegionRow | null;
    summary_row: PublishedRegionSummaryRow | null;
    child_region_rows: PublishedRegionRow[];
    race_rows: PublishedRaceRow[];
  };
};

type PublishedElectionIndexPayloadRow = {
  payload: PublishedPayloadMetadata & {
    election_rows: PublishedElectionRow[];
    race_summary_rows: PublishedElectionRaceSummaryRow[];
  };
};

type PublishedRacePagePayloadRow = {
  payload: PublishedPayloadMetadata & {
    race_row: PublicRace | null;
    election_row: PublicElection | null;
    candidate_rows: PublicCandidate[];
    party_affiliation_rows: PublicPersonPartyAffiliation[];
    party_list_result_rows?: PublicPartyListRaceResult[];
    referendum_question_row: PublicReferendumQuestion | null;
    referendum_option_rows: PublicReferendumOption[];
    referendum_region_result_rows: PublicReferendumRegionResult[];
  };
};

type PublishedPersonProfilesPayloadRow = {
  payload: PublishedPayloadMetadata & {
    person_rows: PublishedPersonProfileRow[];
    candidate_rows: PublicCandidate[];
    claim_rows: PublicPersonClaim[];
    party_affiliation_rows: PublicPersonPartyAffiliation[];
  };
};

export type PublishedPartyCompanyContributionPage = {
  rows: PublicPartyCompanyContributionSummary[];
  total: number;
};

export type PublishedRegionPageRows = {
  regionRow: PublishedRegionRow | null;
  summaryRow: PublishedRegionSummaryRow | null;
  childRegionRows: PublishedRegionRow[];
  raceRows: PublishedRaceRow[];
};

export type PublishedElectionIndexRows = {
  electionRows: PublishedElectionRow[];
  raceSummaryRows: PublishedElectionRaceSummaryRow[];
};

export type PublishedElectionRacePage = {
  items: PublicRace[];
  total: number;
};

export type PublishedRaceDetailRows = {
  raceRow: PublicRace | null;
  electionRow: PublicElection | null;
  candidateRows: PublicCandidate[];
  partyAffiliationRows: PublicPersonPartyAffiliation[];
  partyListResultRows: PublicPartyListRaceResult[];
  referendumQuestionRow: PublicReferendumQuestion | null;
  referendumOptionRows: PublicReferendumOption[];
  referendumRegionResultRows: PublicReferendumRegionResult[];
};

export type PublishedPartyDataRows = {
  partyRows: PublicParty[];
  annualFinanceFilingRows: PublicPartyAnnualFinanceFiling[];
  financeRows: PublicPartyFinanceSummary[];
  companyContributionRows?: PublicPartyCompanyContributionSummary[];
};

export type PublishedPersonProfileRows = {
  personRows: PublishedPersonProfileRow[];
  candidateRows: PublicCandidate[];
  claimRows: PublicPersonClaim[];
  partyAffiliationRows: PublicPersonPartyAffiliation[];
};

type PublishedQueryError = {
  message: string;
};

type PublishedQueryResponse<Row> = {
  data: Row[] | null;
  error: PublishedQueryError | null;
  count: number | null;
};

export interface PublishedQueryBuilder<Row> extends PromiseLike<PublishedQueryResponse<Row>> {
  select(columns: string, options?: { count: 'exact' }): PublishedQueryBuilder<Row>;
  eq(column: string, value: unknown): PublishedQueryBuilder<Row>;
  ilike(column: string, pattern: string): PublishedQueryBuilder<Row>;
  like(column: string, pattern: string): PublishedQueryBuilder<Row>;
  in(column: string, values: readonly unknown[]): PublishedQueryBuilder<Row>;
  or(filters: string): PublishedQueryBuilder<Row>;
  not(column: string, operator: string, value: unknown): PublishedQueryBuilder<Row>;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): PublishedQueryBuilder<Row>;
  range(from: number, to: number): PublishedQueryBuilder<Row>;
  limit(count: number): PublishedQueryBuilder<Row>;
}

export interface PublishedSchemaClient {
  schema(schemaName: string): {
    from<Row>(relationName: string): PublishedQueryBuilder<Row>;
    rpc<Row>(
      functionName: string,
      args: Record<string, unknown>,
    ): PromiseLike<PublishedQueryResponse<Row>>;
  };
}

export type PublishedReadAdapter = {
  loadHomePage(regionSlug?: string | null): Promise<PublishedHomePageRows>;
  loadRegionDirectory(): Promise<PublishedRegionRow[]>;
  loadRegionPage(regionSlug: string): Promise<PublishedRegionPageRows>;
  loadElectionIndex(): Promise<PublishedElectionIndexRows>;
  loadElectionRaceFacets(electionIds: string[]): Promise<PublishedElectionRaceFacetRow[]>;
  loadElectionEducationDistribution(
    eventKey: string,
    electionIds: string[],
    filters: { raceTypes?: PublicRace['race_type'][]; regionKey?: string },
  ): Promise<PublishedElectionEducationDistributionRow[]>;
  loadElectionPartyPerformance(
    eventKey: string,
    electionIds: string[],
    filters: { raceTypes?: PublicRace['race_type'][]; regionKey?: string },
  ): Promise<PublishedPartyElectionPerformanceRow[]>;
  loadElectionRacePage(
    eventKey: string,
    electionIds: string[],
    filters: { raceTypes?: PublicRace['race_type'][]; regionKey?: string; query?: string },
    page: number,
    pageSize: number,
  ): Promise<PublishedElectionRacePage>;
  loadRaceDetail(raceId: string): Promise<PublishedRaceDetailRows>;
  loadLocalOfficePeople(districtPrefixes: string[]): Promise<PublishedPeopleDirectoryRow[]>;
  loadNationalOfficeHolders(): Promise<PublishedNationalOfficeHolderRow[]>;
  loadCurrentLegislatorPartySummary(): Promise<PublishedLegislatorPartySummaryRow[]>;
  loadPublicUpdates(limit?: number): Promise<PublicUpdate[]>;
  loadPeoplePage(request: PublishedPeoplePageRequest): Promise<PublishedPeoplePage>;
  loadPartyCandidatePage(partyName: string, page: number, pageSize: number): Promise<PublishedPartyCandidatePage>;
  loadPartyData(): Promise<PublishedPartyDataRows>;
  loadPartyDirectory(): Promise<PublicParty[]>;
  loadPartyCompanyContributionCounts(): Promise<PublicPartyCompanyContributionCount[]>;
  loadPartyCompanyContributionPage(partyId: string, page: number, pageSize: number): Promise<PublishedPartyCompanyContributionPage>;
  loadPartyOfficers(partyId: string): Promise<PublicPartyOfficer[]>;
  loadPollingPlaces(eventKey: string, villageCode: string): Promise<PollingPlace[]>;
  loadCandidateLifecycle(candidateId: string): Promise<CandidateLifecycleEvent[]>;
  loadPartyPlatformHistory(partyId: string): Promise<PublicPartyPlatformHistory[]>;
  loadPartyPeopleStatistics(partyName: string): Promise<PublicPartyPeopleStatisticRow[]>;
  loadPartyLegalStatistics(partyName: string): Promise<PublicPartyLegalStatistics>;
  loadPersonProfiles(personIds: string[]): Promise<PublishedPersonProfileRows>;
  search(query: string): Promise<PublishedSearchResultRow[]>;
};

function getPartyNames(party: string) {
  return party === '台灣民眾黨' || party === '臺灣民眾黨'
    ? ['台灣民眾黨', '臺灣民眾黨']
    : [party];
}

function getRowsOrThrow<Row>(response: PublishedQueryResponse<Row>, label: string) {
  if (response.error) {
    throw new Error(`${label} query failed: ${response.error.message}`);
  }

  return response.data ?? [];
}

function getBoundedRowsOrThrow<Row>(
  response: PublishedQueryResponse<Row>,
  label: string,
  limit: number,
) {
  const rows = getRowsOrThrow(response, label);
  if (rows.length > limit) {
    throw new Error(`${label} exceeded the ${limit}-row batch limit.`);
  }
  return rows;
}

function getBoundedPayloadRows<Row>(value: unknown, label: string, limit: number) {
  if (!Array.isArray(value)) {
    throw new Error(label + ' returned an invalid payload.');
  }
  if (value.length > limit) {
    throw new Error(label + ' exceeded the ' + limit + '-row batch limit.');
  }
  return value as Row[];
}

function assertPayloadMetadata(payload: PublishedPayloadMetadata, label: string) {
  if (payload.api_version !== 1) {
    throw new Error(label + ' returned an unsupported API version.');
  }
  if (payload.release_id !== null && typeof payload.release_id !== 'string') {
    throw new Error(label + ' returned an invalid release id.');
  }
  if (payload.published_at !== null && typeof payload.published_at !== 'string') {
    throw new Error(label + ' returned an invalid publication timestamp.');
  }
}

function normalizePersonIds(personIds: string[]) {
  const normalized = Array.from(new Set(
    personIds.map((personId) => personId.trim()).filter(Boolean),
  ));
  if (normalized.length > PERSON_PROFILE_BATCH_LIMIT) {
    throw new Error(`Published person profiles accept at most ${PERSON_PROFILE_BATCH_LIMIT} person ids.`);
  }
  return normalized;
}

function normalizeElectionIds(electionIds: string[]) {
  return Array.from(new Set(
    electionIds.map((electionId) => electionId.trim()).filter(Boolean),
  )).slice(0, ELECTION_INDEX_LIMIT);
}

function normalizeElectionRacePageIds(electionIds: string[]) {
  const normalized = Array.from(new Set(
    electionIds.map((electionId) => electionId.trim()).filter(Boolean),
  ));
  if (normalized.length > ELECTION_RACE_PAGE_ELECTION_LIMIT) {
    throw new Error(
      `Published election race pages accept at most ${ELECTION_RACE_PAGE_ELECTION_LIMIT} election ids.`,
    );
  }
  return normalized;
}

export function createPublishedReadAdapter(client: PublishedSchemaClient): PublishedReadAdapter {
  async function loadRegistrationNames(raceIds: string[]) {
    if (raceIds.length === 0) return [];
    const response = await client.schema('published').rpc<PublishedHomePageCandidateRow>(
      'registration_names_for',
      { p_race_ids: Array.from(new Set(raceIds)) },
    );
    return getBoundedRowsOrThrow(response, 'Published registration names', 2000);
  }

  return {
    async loadHomePage(rawRegionSlug = null) {
      const regionSlug = rawRegionSlug?.trim() || null;
      const response = await client.schema('published').rpc<PublishedHomePagePayloadRow>(
        'home_page_for',
        { p_region_slug: regionSlug },
      );
      const rows = getBoundedRowsOrThrow(response, 'Published home page', 1);
      const payload = rows[0]?.payload;
      if (!payload || typeof payload !== 'object') {
        throw new Error('Published home page returned an invalid payload.');
      }
      assertPayloadMetadata(payload, 'Published home page');

      const raceRows = getBoundedPayloadRows<PublishedRaceRow>(
        payload.race_rows, 'Published home races', HOME_RACE_LIMIT,
      );
      const registrationNames = await loadRegistrationNames(raceRows.filter((race) => race.voting_date?.startsWith('2026-')).map((race) => race.race_id));

      return {
        apiVersion: payload.api_version,
        releaseId: payload.release_id ?? null,
        publishedAt: payload.published_at ?? null,
        tickerRows: getBoundedPayloadRows<PublishedHomeTickerRow>(
          payload.ticker_rows,
          'Published home ticker',
          1,
        ),
        regionSummaryRows: getBoundedPayloadRows<PublishedRegionSummaryRow>(
          payload.region_summary_rows,
          'Published home region summaries',
          HOME_REGION_LIMIT,
        ),
        regionRows: getBoundedPayloadRows<PublishedRegionRow>(
          payload.region_rows,
          'Published home regions',
          HOME_REGION_LIMIT,
        ),
        raceRows,
        candidateRows: [
          ...getBoundedPayloadRows<PublishedHomePageCandidateRow>(
            payload.candidate_rows,
            'Published home candidates',
            HOME_CANDIDATE_SUMMARY_LIMIT,
          ),
          ...registrationNames,
        ],
        seatRows: getBoundedPayloadRows<PublishedHomeSeatRow>(
          payload.seat_rows,
          'Published home seat distribution',
          LEGISLATOR_PARTY_SUMMARY_LIMIT,
        ),
      };
    },

    async loadRegionDirectory() {
      const response = await client
        .schema('published')
        .from<PublishedRegionRow>('regions')
        .select(REGION_COLUMNS)
        .in('region_type', ['country', 'municipality', 'county', 'city'])
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })
        .order('region_id', { ascending: true })
        .limit(HOME_REGION_LIMIT);

      return getRowsOrThrow(response, 'Published region directory');
    },

    async loadRegionPage(rawRegionSlug) {
      const regionSlug = rawRegionSlug.trim();
      if (!regionSlug) {
        return {
          regionRow: null,
          summaryRow: null,
          childRegionRows: [],
          raceRows: [],
        };
      }

      const response = await client.schema('published').rpc<PublishedRegionPagePayloadRow>(
        'region_page_for',
        { p_region_slug: regionSlug },
      );
      const rows = getBoundedRowsOrThrow(response, 'Published region page', 1);
      const payload = rows[0]?.payload;
      if (!payload || typeof payload !== 'object') {
        throw new Error('Published region page returned an invalid payload.');
      }
      assertPayloadMetadata(payload, 'Published region page');

      return {
        regionRow: payload.region_row ?? null,
        summaryRow: payload.summary_row ?? null,
        childRegionRows: getBoundedPayloadRows<PublishedRegionRow>(
          payload.child_region_rows,
          'Published child regions',
          REGION_CHILD_LIMIT,
        ),
        raceRows: getBoundedPayloadRows<PublishedRaceRow>(
          payload.race_rows,
          'Published region races',
          REGION_RACE_LIMIT,
        ),
      };
    },

    async loadElectionIndex() {
      const response = await client.schema('published').rpc<PublishedElectionIndexPayloadRow>(
        'election_index_page',
        {},
      );
      const rows = getBoundedRowsOrThrow(response, 'Published election index', 1);
      const payload = rows[0]?.payload;
      if (!payload || typeof payload !== 'object') {
        throw new Error('Published election index returned an invalid payload.');
      }
      assertPayloadMetadata(payload, 'Published election index');

      return {
        electionRows: getBoundedPayloadRows<PublishedElectionRow>(
          payload.election_rows,
          'Published elections',
          ELECTION_INDEX_LIMIT,
        ),
        raceSummaryRows: getBoundedPayloadRows<PublishedElectionRaceSummaryRow>(
          payload.race_summary_rows,
          'Published election race summaries',
          ELECTION_INDEX_LIMIT,
        ),
      };
    },

    async loadElectionRaceFacets(rawElectionIds) {
      const electionIds = normalizeElectionIds(rawElectionIds);
      const facetBatches: string[][] = [];
      const published = client.schema('published');

      for (let index = 0; index < electionIds.length; index += ELECTION_ID_BATCH_SIZE) {
        facetBatches.push(electionIds.slice(index, index + ELECTION_ID_BATCH_SIZE));
      }

      return (await Promise.all(facetBatches.map(async (chunk) => {
        const response = await published
          .from<PublishedElectionRaceFacetRow>('election_race_facets')
          .select(ELECTION_RACE_FACET_COLUMNS, { count: 'exact' })
          .in('election_id', chunk)
          .order('election_id', { ascending: true })
          .order('race_type', { ascending: true })
          .order('region_key', { ascending: true })
          .limit(ELECTION_FACET_BATCH_LIMIT);
        const rows = getRowsOrThrow(response, 'Published election race facets');

        if ((response.count ?? rows.length) > rows.length) {
          throw new Error(`Published election race facets exceeded the ${ELECTION_FACET_BATCH_LIMIT}-row batch limit.`);
        }
        return rows;
      }))).flat();
    },

    async loadElectionEducationDistribution(eventKey, rawElectionIds, filters) {
      const electionIds = normalizeElectionRacePageIds(rawElectionIds);
      if (electionIds.length === 0) return [];

      const normalizedEventKey = eventKey.trim();
      if (!normalizedEventKey) {
        throw new Error('Published election education distribution requires an event key.');
      }

      const raceTypes = Array.from(new Set(filters.raceTypes ?? []));
      const response = await client.schema('published').rpc<PublishedElectionEducationDistributionRow>('election_education_distribution',
        {
          p_event_key: normalizedEventKey,
          p_election_ids: electionIds,
          p_race_types: raceTypes.length > 0 ? raceTypes : null,
          p_region_key: filters.regionKey?.trim() || null,
        },
      );

      return getBoundedRowsOrThrow(
        response,
        'Published election education distribution',
        ELECTION_EDUCATION_DISTRIBUTION_LIMIT,
      );
    },

    async loadElectionPartyPerformance(eventKey, rawElectionIds, filters) {
      const electionIds = normalizeElectionRacePageIds(rawElectionIds);
      if (electionIds.length === 0) return [];

      const normalizedEventKey = eventKey.trim();
      if (!normalizedEventKey) {
        throw new Error('Published election party performance requires an event key.');
      }

      const raceTypes = Array.from(new Set(filters.raceTypes ?? []));
      const response = await client.schema('published').rpc<PublishedPartyElectionPerformanceRow>('election_party_performance',
        {
          p_event_key: normalizedEventKey,
          p_election_ids: electionIds,
          p_race_types: raceTypes.length > 0 ? raceTypes : null,
          p_region_key: filters.regionKey?.trim() || null,
        },
      );

      return getBoundedRowsOrThrow(
        response,
        'Published election party performance',
        ELECTION_PARTY_PERFORMANCE_LIMIT,
      );
    },

    async loadElectionRacePage(eventKey, rawElectionIds, filters, page, pageSize) {
      const electionIds = normalizeElectionRacePageIds(rawElectionIds);
      if (electionIds.length === 0) return { items: [], total: 0 };

      const normalizedEventKey = eventKey.trim();
      if (!normalizedEventKey) {
        throw new Error('Published election race pages require an event key.');
      }

      const range = toPublicPageRange(page, pageSize);
      const normalizedPageSize = range.to - range.from + 1;
      const normalizedPage = Math.floor(range.from / normalizedPageSize) + 1;
      const raceTypes = Array.from(new Set(filters.raceTypes ?? []));
      const regionKey = filters.regionKey?.trim() || null;
      const query = normalizePublishedSearchQuery(filters.query ?? '').slice(0, 100) || null;
      const response = await client
        .schema('published')
        .rpc<PublishedElectionRacePage>('election_race_page', {
          p_event_key: normalizedEventKey,
          p_election_ids: electionIds,
          p_race_types: raceTypes.length > 0 ? raceTypes : null,
          p_region_key: regionKey,
          p_query: query,
          p_page: normalizedPage,
          p_page_size: normalizedPageSize,
        });
      const rows = getRowsOrThrow(response, 'Published election race page');
      const result = rows[0];
      if (!result || !Array.isArray(result.items) || !Number.isFinite(Number(result.total))) {
        throw new Error('Published election race page returned an invalid response.');
      }
      if (result.items.length > ELECTION_RACE_PAGE_SIZE) {
        throw new Error(`Published election race page exceeded the ${ELECTION_RACE_PAGE_SIZE}-row limit.`);
      }

      return { items: result.items, total: Number(result.total) };
    },

    async loadRaceDetail(rawRaceId) {
      const raceId = rawRaceId.trim();
      if (!raceId) {
        return {
          raceRow: null,
          electionRow: null,
          candidateRows: [],
          partyAffiliationRows: [],
          partyListResultRows: [],
          referendumQuestionRow: null,
          referendumOptionRows: [],
          referendumRegionResultRows: [],
        };
      }

      const response = await client.schema('published').rpc<PublishedRacePagePayloadRow>(
        'race_page_for',
        { p_race_id: raceId },
      );
      const rows = getBoundedRowsOrThrow(response, 'Published race page', 1);
      let payload = rows[0]?.payload;
      if (!payload || typeof payload !== 'object') {
        throw new Error('Published race page returned an invalid payload.');
      }
      assertPayloadMetadata(payload, 'Published race page');

      if (payload.race_row?.race_type === 'party_list_legislator') {
        const partyListResponse = await client.schema('published').rpc<PublishedRacePagePayloadRow>(
          'party_list_race_page_for',
          { p_race_id: raceId },
        );
        const partyListRows = getBoundedRowsOrThrow(partyListResponse, 'Published party-list race page', 1);
        const partyListPayload = partyListRows[0]?.payload;
        if (!partyListPayload || typeof partyListPayload !== 'object') {
          throw new Error('Published party-list race page returned an invalid payload.');
        }
        assertPayloadMetadata(partyListPayload, 'Published party-list race page');
        payload = partyListPayload;
      }

      const candidateLimit = payload.race_row?.race_type === 'party_list_legislator'
        ? RACE_DETAIL_PARTY_LIST_CANDIDATE_LIMIT
        : RACE_DETAIL_CANDIDATE_LIMIT;

      return {
        raceRow: payload.race_row ?? null,
        electionRow: payload.election_row ?? null,
        candidateRows: [
          ...getBoundedPayloadRows<PublicCandidate>(
            payload.candidate_rows,
            'Published race candidates',
            candidateLimit,
          ),
          ...await loadRegistrationNames(payload.race_row && payload.election_row?.year === 2026 ? [payload.race_row.race_id] : []),
        ],
        partyAffiliationRows: getBoundedPayloadRows<PublicPersonPartyAffiliation>(
          payload.party_affiliation_rows,
          'Published race party affiliations',
          RACE_DETAIL_PARTY_AFFILIATION_LIMIT,
        ),
        partyListResultRows: getBoundedPayloadRows<PublicPartyListRaceResult>(
          payload.party_list_result_rows ?? [],
          'Published party-list race results',
          RACE_DETAIL_PARTY_LIST_RESULT_LIMIT,
        ),
        referendumQuestionRow: payload.referendum_question_row ?? null,
        referendumOptionRows: getBoundedPayloadRows<PublicReferendumOption>(
          payload.referendum_option_rows,
          'Published referendum options',
          RACE_DETAIL_REFERENDUM_OPTION_LIMIT,
        ),
        referendumRegionResultRows: getBoundedPayloadRows<PublicReferendumRegionResult>(
          payload.referendum_region_result_rows,
          'Published referendum region results',
          RACE_DETAIL_REFERENDUM_REGION_LIMIT,
        ),
      };
    },

    async loadLocalOfficePeople(rawDistrictPrefixes) {
      const districtPrefixes = Array.from(new Set(
        rawDistrictPrefixes.map((prefix) => prefix.trim()).filter(Boolean),
      ));
      if (districtPrefixes.length === 0) return [];

      const response = await client
        .schema('published')
        .from<PublishedPeopleDirectoryRow>('people_directory')
        .select(PEOPLE_DIRECTORY_COLUMNS)
        .eq('list_status', 'current')
        .in('list_role', LOCAL_OFFICE_ROLES)
        .or(districtPrefixes.map((prefix) => `district.ilike.${prefix}%`).join(','))
        .order('list_role_order', { ascending: true })
        .order('name', { ascending: true })
        .order('person_id', { ascending: true })
        .limit(LOCAL_OFFICE_PERSON_LIMIT + 1);

      return getBoundedRowsOrThrow(
        response,
        'Published local office people',
        LOCAL_OFFICE_PERSON_LIMIT,
      );
    },

    async loadNationalOfficeHolders() {
      const response = await client
        .schema('published')
        .from<PublishedNationalOfficeHolderRow>('national_office_holders')
        .select(NATIONAL_OFFICE_HOLDER_COLUMNS)
        .order('display_order', { ascending: true })
        .limit(NATIONAL_OFFICE_HOLDER_LIMIT + 1);

      const rows = getBoundedRowsOrThrow(
        response,
        'Published national office holders',
        NATIONAL_OFFICE_HOLDER_LIMIT,
      );
      if (rows.length !== NATIONAL_OFFICE_HOLDER_LIMIT) {
        throw new Error('Published national office holders did not return all office slots.');
      }
      return rows;
    },

    async loadCurrentLegislatorPartySummary() {
      const response = await client
        .schema('published')
        .from<PublishedLegislatorPartySummaryRow>('current_legislator_party_summary')
        .select(LEGISLATOR_PARTY_SUMMARY_COLUMNS)
        .order('legislator_count', { ascending: false })
        .order('party_name', { ascending: true })
        .limit(LEGISLATOR_PARTY_SUMMARY_LIMIT + 1);

      return getBoundedRowsOrThrow(
        response,
        'Published current legislator party summary',
        LEGISLATOR_PARTY_SUMMARY_LIMIT,
      );
    },

    async loadPublicUpdates(rawLimit = PUBLIC_UPDATE_LIMIT) {
      const limit = Math.max(1, Math.min(Math.trunc(rawLimit), PUBLIC_UPDATE_LIMIT));
      const response = await client
        .schema('published')
        .from<PublicUpdate>('update_feed')
        .select(PUBLIC_UPDATE_COLUMNS)
        .order('published_at', { ascending: false })
        .order('update_id', { ascending: false })
        .limit(limit);

      return getRowsOrThrow(response, 'Published update feed');
    },

    async loadPartyData() {
      const published = client.schema('published');
      const [annualFinanceResponse, financeResponse] = await Promise.all([
        published
          .from<PublicPartyAnnualFinanceFiling>('party_annual_finance_filings')
          .select(PARTY_ANNUAL_FINANCE_COLUMNS)
          .order('party_id', { ascending: true })
          .order('report_year', { ascending: false })
          .limit(PARTY_ANNUAL_FINANCE_LIMIT + 1),
        published
          .from<PublicPartyFinanceSummary>('party_finance_summaries')
          .select(PARTY_FINANCE_COLUMNS)
          .order('party_id', { ascending: true })
          .order('report_year', { ascending: false })
          .limit(PARTY_FINANCE_LIMIT + 1),
      ]);

      return {
        partyRows: [],
        annualFinanceFilingRows: getBoundedRowsOrThrow(
          annualFinanceResponse,
          'Published party annual finance filings',
          PARTY_ANNUAL_FINANCE_LIMIT,
        ),
        financeRows: getBoundedRowsOrThrow(
          financeResponse,
          'Published party finance summaries',
          PARTY_FINANCE_LIMIT,
        ),
      };
    },

    async loadPartyDirectory() {
      const response = await client
        .schema('published')
        .from<PublicParty>('parties')
        .select(PARTY_COLUMNS)
        .order('name', { ascending: true })
        .order('party_id', { ascending: true })
        .limit(PARTY_LIMIT + 1);

      return getBoundedRowsOrThrow(response, 'Published parties', PARTY_LIMIT);
    },

    async loadPartyCompanyContributionCounts() {
      const response = await client
        .schema('published')
        .rpc<PublicPartyCompanyContributionCount>('party_company_contribution_counts', {});

      return getBoundedRowsOrThrow(
        response,
        'Published party company contribution counts',
        PARTY_LIMIT,
      );
    },

    async loadPartyCompanyContributionPage(rawPartyId, page, pageSize) {
      const partyId = rawPartyId.trim();
      if (!partyId) return { rows: [], total: 0 };
      const normalizedSize = Math.max(1, Math.min(Math.trunc(pageSize), PARTY_COMPANY_CONTRIBUTION_PAGE_SIZE));
      const normalizedPage = Math.max(1, Math.trunc(page));
      const from = (normalizedPage - 1) * normalizedSize;
      const response = await client
        .schema('published')
        .from<PublicPartyCompanyContributionSummary>('party_company_contribution_summaries')
        .select(PARTY_COMPANY_CONTRIBUTION_COLUMNS, { count: 'exact' })
        .eq('party_id', partyId)
        .order('amount_total', { ascending: false })
        .order('company_name', { ascending: true })
        .order('company_id', { ascending: true })
        .range(from, from + normalizedSize - 1);

      return {
        rows: getRowsOrThrow(response, 'Published party company contributions'),
        total: response.count ?? 0,
      };
    },

    async loadPartyOfficers(rawPartyId) {
      const partyId = rawPartyId.trim();
      if (!partyId) return [];

      const response = await client
        .schema('published')
        .from<PublicPartyOfficer>('party_officers')
        .select(PARTY_OFFICER_COLUMNS)
        .eq('party_id', partyId)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('person_name', { ascending: true })
        .order('affiliation_id', { ascending: true })
        .limit(PARTY_OFFICER_LIMIT + 1);

      return getBoundedRowsOrThrow(
        response,
        'Published party officers',
        PARTY_OFFICER_LIMIT,
      );
    },
    async loadPollingPlaces(eventKey, villageCode) {
      if (!eventKey || !/^\d{11}$/.test(villageCode)) return [];
      const response = await client.schema('published').rpc<PollingPlace>('polling_places_for_village', {
        p_event_key: eventKey, p_village_code: villageCode,
      });
      return getBoundedRowsOrThrow(response, 'Published polling places', 100);
    },
    async loadCandidateLifecycle(candidateId) {
      if (!candidateId.trim()) return [];
      const response = await client.schema('published').rpc<CandidateLifecycleEvent>('candidate_lifecycle_for', {
        p_candidate_id: candidateId,
      });
      return getBoundedRowsOrThrow(response, 'Published candidate lifecycle', 50);
    },
    async loadPartyPlatformHistory(rawPartyId) {
      const partyId = rawPartyId.trim();
      if (!partyId) return [];

      const response = await client
        .schema('published')
        .rpc<PublicPartyPlatformHistory>('party_platform_history_for', {
          p_party_id: partyId,
        });

      return getBoundedRowsOrThrow(
        response,
        'Published party platform history',
        PARTY_PLATFORM_HISTORY_LIMIT,
      );
    },
    async loadPartyPeopleStatistics(rawPartyName) {
      const partyName = rawPartyName.trim();
      if (!partyName) {
        throw new Error('Published party people statistics require a party name.');
      }

      const response = await client.schema('published').rpc<PublicPartyPeopleStatisticRow>('party_people_statistics', {
        p_party_name: partyName,
      });
      const rows = getBoundedRowsOrThrow(
        response,
        'Published party people statistics',
        PARTY_PEOPLE_STATISTICS_LIMIT,
      );
      if (rows.length !== PARTY_PEOPLE_STATISTICS_LIMIT) {
        throw new Error('Published party people statistics did not return the expected dimensions.');
      }
      return rows;
    },


    async loadPartyLegalStatistics(rawPartyName) {
      const partyName = rawPartyName.trim();
      if (!partyName) {
        throw new Error('Published party legal statistics require a party name.');
      }

      const response = await client.schema('published').rpc<PublicPartyLegalStatistics>('party_legal_statistics', {
        p_party_name: partyName,
      });
      const rows = getBoundedRowsOrThrow(
        response,
        'Published party legal statistics',
        1,
      );
      if (rows.length !== 1) {
        throw new Error('Published party legal statistics did not return one summary row.');
      }
      return rows[0];
    },

    async loadPeoplePage(request) {
      const pageRange = toPublicPageRange(request.page, request.pageSize ?? PUBLIC_PEOPLE_PAGE_SIZE);
      const normalizedQuery = request.query?.trim();
      let query = client
        .schema('published')
        .from<PublishedPeopleDirectoryRow>('people_directory')
        .select(PEOPLE_DIRECTORY_COLUMNS, { count: 'exact' });

      if (normalizedQuery) {
        query = query.ilike('name', `%${normalizedQuery}%`);
      } else {
        query = query.eq('list_is_grassroots', false);
        if (request.role !== 'party_officer') {
          query = query.eq('list_is_party_only', false);
        }
      }

      if (request.party) query = query.in('party', getPartyNames(request.party));
      if (request.districtPrefixes?.length) {
        query = query.or(request.districtPrefixes.map((prefix) => `district.ilike.${prefix}%`).join(','));
      }
      if (request.role) query = query.eq('list_role', request.role);
      if (request.status === 'candidate') {
        query = query.not('upcoming_candidate_label', 'is', null);
      } else if (request.status) {
        query = query.eq('list_status', request.status);
      }

      const response = await query
        .order('list_status_order', { ascending: true })
        .order('list_role_order', { ascending: true })
        .order('name', { ascending: true })
        .order('person_id', { ascending: true })
        .range(pageRange.from, pageRange.to);

      return {
        rows: getRowsOrThrow(response, 'Published people directory'),
        total: response.count ?? 0,
      };
    },

    async loadPartyCandidatePage(rawPartyName, page, pageSize) {
      const partyName = rawPartyName.trim();
      if (!partyName) return { rows: [], total: 0 };

      const pageRange = toPublicPageRange(page, pageSize);
      const response = await client
        .schema('published')
        .from<PublicCandidate>('active_party_candidates')
        .select(PERSON_CANDIDATE_COLUMNS, { count: 'exact' })
        .in('party', getPartyNames(partyName))
        .order('election_year', { ascending: false, nullsFirst: false })
        .order('region_name', { ascending: true, nullsFirst: false })
        .order('race_title', { ascending: true })
        .order('person_name', { ascending: true })
        .order('candidate_id', { ascending: true })
        .range(pageRange.from, pageRange.to);

      return {
        rows: getRowsOrThrow(response, 'Published active party candidates'),
        total: response.count ?? 0,
      };
    },

    async loadPersonProfiles(rawPersonIds) {
      const personIds = normalizePersonIds(rawPersonIds);
      if (personIds.length === 0) {
        return { personRows: [], candidateRows: [], claimRows: [], partyAffiliationRows: [] };
      }

      const response = await client.schema('published').rpc<PublishedPersonProfilesPayloadRow>(
        'person_profiles_for',
        { p_person_ids: personIds },
      );
      const rows = getBoundedRowsOrThrow(response, 'Published person profiles', 1);
      const payload = rows[0]?.payload;
      if (!payload || typeof payload !== 'object') {
        throw new Error('Published person profiles returned an invalid payload.');
      }
      assertPayloadMetadata(payload, 'Published person profiles');

      return {
        personRows: getBoundedPayloadRows<PublishedPersonProfileRow>(
          payload.person_rows,
          'Published person profiles',
          PERSON_PROFILE_BATCH_LIMIT,
        ),
        candidateRows: getBoundedPayloadRows<PublicCandidate>(
          payload.candidate_rows,
          'Published person candidates',
          PERSON_CANDIDATE_LIMIT,
        ),
        claimRows: getBoundedPayloadRows<PublicPersonClaim>(
          payload.claim_rows,
          'Published person claims',
          PERSON_CLAIM_LIMIT,
        ),
        partyAffiliationRows: getBoundedPayloadRows<PublicPersonPartyAffiliation>(
          payload.party_affiliation_rows,
          'Published person party affiliations',
          PERSON_PARTY_AFFILIATION_LIMIT,
        ),
      };
    },

    async search(rawQuery) {
      const normalizedQuery = normalizePublishedSearchQuery(rawQuery);
      if (normalizedQuery.length < 2) return [];

      const response = await client
        .schema('published')
        .rpc<PublishedSearchResultRow>('search_public_records', {
          p_query: normalizedQuery,
          p_limit: PUBLIC_SEARCH_RESULT_LIMIT,
        });

      return getRowsOrThrow(response, 'Published search');
    },
  };
}
