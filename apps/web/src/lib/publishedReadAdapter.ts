import type { PublicPersonRole, PublicPersonStatus } from '../types/publicViews';
import {
  PUBLIC_PEOPLE_PAGE_SIZE,
  PUBLIC_SEARCH_RESULT_LIMIT,
  normalizePublishedSearchQuery,
  toPublicPageRange,
} from './publicReadContracts.ts';

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
  order(column: string, options: { ascending: boolean }): PublishedQueryBuilder<Row>;
  range(from: number, to: number): PublishedQueryBuilder<Row>;
  limit(count: number): PublishedQueryBuilder<Row>;
}

export interface PublishedSchemaClient {
  schema(schemaName: string): {
    from<Row>(relationName: string): PublishedQueryBuilder<Row>;
  };
}

export type PublishedReadAdapter = {
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

export function createPublishedReadAdapter(client: PublishedSchemaClient): PublishedReadAdapter {
  return {
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
