import type {
  PublicElection,
  PublicElectionRaceFacet,
  PublicElectionRaceSummary,
  PublicPersonRole,
  PublicPersonStatus,
  PublicRace,
  PublicRegion,
} from '../types/publicViews';
import {
  PUBLIC_PEOPLE_PAGE_SIZE,
  PUBLIC_SEARCH_RESULT_LIMIT,
  normalizePublishedSearchQuery,
  toPublicPageRange,
} from './publicReadContracts.ts';

export const HOME_REGION_LIMIT = 32;
export const HOME_RACE_LIMIT = 24;
export const REGION_CHILD_LIMIT = 64;
export const REGION_RACE_LIMIT = 24;
export const ELECTION_INDEX_LIMIT = 500;
export const ELECTION_ID_BATCH_SIZE = 200;
export const ELECTION_FACET_BATCH_LIMIT = 1000;

const ACTIVE_RACE_STATUSES: PublicRace['status'][] = [
  'announced',
  'upcoming',
  'registration_open',
  'candidates_announced',
  'voting',
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

export type PublishedSearchResultRow = {
  document_key: string;
  entity_type: 'person' | 'company' | 'party' | 'election' | 'region';
  entity_id: string;
  title: string;
  normalized_search_text: string;
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

export type PublishedHomePageRows = {
  tickerRows: PublishedHomeTickerRow[];
  regionSummaryRows: PublishedRegionSummaryRow[];
  regionRows: PublishedRegionRow[];
  raceRows: PublishedRaceRow[];
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
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): PublishedQueryBuilder<Row>;
  range(from: number, to: number): PublishedQueryBuilder<Row>;
  limit(count: number): PublishedQueryBuilder<Row>;
}

export interface PublishedSchemaClient {
  schema(schemaName: string): {
    from<Row>(relationName: string): PublishedQueryBuilder<Row>;
  };
}

export type PublishedReadAdapter = {
  loadHomePage(): Promise<PublishedHomePageRows>;
  loadRegionPage(regionSlug: string): Promise<PublishedRegionPageRows>;
  loadElectionIndex(): Promise<PublishedElectionIndexRows>;
  loadElectionRaceFacets(electionIds: string[]): Promise<PublishedElectionRaceFacetRow[]>;
  loadPeoplePage(request: PublishedPeoplePageRequest): Promise<PublishedPeoplePage>;
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

function normalizeElectionIds(electionIds: string[]) {
  return Array.from(new Set(
    electionIds.map((electionId) => electionId.trim()).filter(Boolean),
  )).slice(0, ELECTION_INDEX_LIMIT);
}

export function createPublishedReadAdapter(client: PublishedSchemaClient): PublishedReadAdapter {
  return {
    async loadHomePage() {
      const published = client.schema('published');
      const [tickerResponse, regionSummaryResponse, regionResponse, raceResponse] = await Promise.all([
        published
          .from<PublishedHomeTickerRow>('home_ticker')
          .select(HOME_TICKER_COLUMNS)
          .order('voting_date', { ascending: true })
          .order('election_id', { ascending: true })
          .limit(1),
        published
          .from<PublishedRegionSummaryRow>('home_region_summary')
          .select(HOME_REGION_SUMMARY_COLUMNS)
          .order('region_name', { ascending: true })
          .order('region_id', { ascending: true })
          .limit(HOME_REGION_LIMIT),
        published
          .from<PublishedRegionRow>('regions')
          .select(REGION_COLUMNS)
          .in('region_type', ['country', 'municipality', 'county', 'city'])
          .order('display_order', { ascending: true })
          .order('name', { ascending: true })
          .order('region_id', { ascending: true })
          .limit(HOME_REGION_LIMIT),
        published
          .from<PublishedRaceRow>('races')
          .select(RACE_COLUMNS)
          .in('status', ACTIVE_RACE_STATUSES)
          .order('voting_date', { ascending: true })
          .order('title', { ascending: true })
          .order('race_id', { ascending: true })
          .limit(HOME_RACE_LIMIT),
      ]);

      return {
        tickerRows: getRowsOrThrow(tickerResponse, 'Published home ticker'),
        regionSummaryRows: getRowsOrThrow(regionSummaryResponse, 'Published home region summary'),
        regionRows: getRowsOrThrow(regionResponse, 'Published home regions'),
        raceRows: getRowsOrThrow(raceResponse, 'Published home races'),
      };
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

      const published = client.schema('published');
      const [regionResponse, summaryResponse, raceResponse] = await Promise.all([
        published
          .from<PublishedRegionRow>('regions')
          .select(REGION_COLUMNS)
          .eq('slug', regionSlug)
          .order('region_id', { ascending: true })
          .limit(1),
        published
          .from<PublishedRegionSummaryRow>('home_region_summary')
          .select(HOME_REGION_SUMMARY_COLUMNS)
          .eq('region_slug', regionSlug)
          .order('region_id', { ascending: true })
          .limit(1),
        published
          .from<PublishedRaceRow>('races')
          .select(RACE_COLUMNS)
          .eq('region_slug', regionSlug)
          .in('status', ACTIVE_RACE_STATUSES)
          .order('voting_date', { ascending: true })
          .order('title', { ascending: true })
          .order('race_id', { ascending: true })
          .limit(REGION_RACE_LIMIT),
      ]);
      const regionRow = getRowsOrThrow(regionResponse, 'Published region')[0] ?? null;
      const summaryRow = getRowsOrThrow(summaryResponse, 'Published region summary')[0] ?? null;
      const raceRows = getRowsOrThrow(raceResponse, 'Published region races');

      if (!regionRow) {
        return { regionRow: null, summaryRow, childRegionRows: [], raceRows };
      }

      const childResponse = await published
        .from<PublishedRegionRow>('regions')
        .select(REGION_COLUMNS)
        .eq('parent_region_id', regionRow.region_id)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })
        .order('region_id', { ascending: true })
        .limit(REGION_CHILD_LIMIT);

      return {
        regionRow,
        summaryRow,
        childRegionRows: getRowsOrThrow(childResponse, 'Published child regions'),
        raceRows,
      };
    },

    async loadElectionIndex() {
      const published = client.schema('published');
      const electionResponse = await published
        .from<PublishedElectionRow>('elections')
        .select(ELECTION_COLUMNS)
        .order('year', { ascending: false, nullsFirst: false })
        .order('voting_date', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })
        .order('election_id', { ascending: true })
        .limit(ELECTION_INDEX_LIMIT);
      const electionRows = getRowsOrThrow(electionResponse, 'Published elections');
      const electionIds = electionRows.map((row) => row.election_id);
      const raceSummaryRows: PublishedElectionRaceSummaryRow[] = [];

      for (let index = 0; index < electionIds.length; index += ELECTION_ID_BATCH_SIZE) {
        const chunk = electionIds.slice(index, index + ELECTION_ID_BATCH_SIZE);
        const response = await published
          .from<PublishedElectionRaceSummaryRow>('election_race_summaries')
          .select(ELECTION_RACE_SUMMARY_COLUMNS)
          .in('election_id', chunk)
          .order('election_id', { ascending: true })
          .limit(chunk.length);
        raceSummaryRows.push(...getRowsOrThrow(response, 'Published election race summaries'));
      }

      return { electionRows, raceSummaryRows };
    },

    async loadElectionRaceFacets(rawElectionIds) {
      const electionIds = normalizeElectionIds(rawElectionIds);
      const facetRows: PublishedElectionRaceFacetRow[] = [];
      const published = client.schema('published');

      for (let index = 0; index < electionIds.length; index += ELECTION_ID_BATCH_SIZE) {
        const chunk = electionIds.slice(index, index + ELECTION_ID_BATCH_SIZE);
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
        facetRows.push(...rows);
      }

      return facetRows;
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
      if (request.status) query = query.eq('list_status', request.status);

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

    async search(rawQuery) {
      const normalizedQuery = normalizePublishedSearchQuery(rawQuery);
      if (normalizedQuery.length < 2) return [];

      const response = await client
        .schema('published')
        .from<PublishedSearchResultRow>('search_results')
        .select(SEARCH_RESULT_COLUMNS)
        .like('normalized_search_text', `%${normalizedQuery}%`)
        .order('entity_type', { ascending: true })
        .order('title', { ascending: true })
        .order('document_key', { ascending: true })
        .limit(PUBLIC_SEARCH_RESULT_LIMIT);

      return getRowsOrThrow(response, 'Published search');
    },
  };
}
