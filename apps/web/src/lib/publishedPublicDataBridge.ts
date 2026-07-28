import type { PublicDataProvider, PublicSearchResult, PublicSearchResultType } from './publicDataProvider';
import type {
  PublishedPeopleDirectoryRow,
  PublishedReadAdapter,
  PublishedSearchResultRow,
} from './publishedReadAdapter.ts';
import type {
  PublicPersonFilters,
  PublicPersonListItem,
  PublicPersonRole,
  PublicPersonStatus,
} from '../types/publicViews';

const roleLabels: Record<PublicPersonRole, string> = {
  president: '總統',
  vice_president: '副總統',
  legislator: '立法委員',
  local_chief: '縣市首長',
  local_deputy: '副縣市首長',
  agency_head: '主要單位首長',
  councilor: '議員',
  party_officer: '政黨職務',
  candidate: '候選人',
  other: '其他公眾人物',
};

const statusLabels: Record<PublicPersonStatus, string> = {
  current: '現任',
  candidate: '候選人',
  former: '曾參選',
  other: '其他',
};

const searchLabels: Record<PublicSearchResultType, string> = {
  person: '人物',
  company: '公司',
  party: '政黨',
  election: '選舉',
  region: '地區',
};

const searchSubtitles: Record<PublicSearchResultType, string> = {
  person: '公開人物資料',
  company: '公開公司資料',
  party: '政黨與政治獻金摘要',
  election: '公開選舉資料',
  region: '公開區域導覽',
};

export type PublishedRegionResolution = {
  regionId: string;
  regionName: string;
  districtPrefixes: string[];
};

export type PublishedRegionResolver = (regionId: string) => PublishedRegionResolution | null;

export type PublishedPublicDataBridge = Pick<PublicDataProvider, 'loadPeoplePage' | 'searchPublicRecords'>;

function getDisplayPosition(row: PublishedPeopleDirectoryRow, roleLabel: string, regionName: string | null) {
  if (row.list_status === 'current') {
    return row.current_office_label?.trim()
      || row.position?.trim()
      || (row.list_role === 'other' ? null : `${regionName ?? ''}${roleLabel}`);
  }

  if (row.list_status === 'candidate') {
    return row.upcoming_candidate_label?.trim() || row.position?.trim() || null;
  }

  return null;
}

function mapPeopleRow(
  row: PublishedPeopleDirectoryRow,
  region: PublishedRegionResolution | null,
): PublicPersonListItem {
  const roleLabel = roleLabels[row.list_role];
  const regionName = region?.regionName ?? row.district;

  return {
    person_id: row.person_id,
    name: row.name,
    alias: row.alias,
    gender: row.gender,
    party: row.party,
    position: row.position,
    current_office_label: row.current_office_label,
    upcoming_candidate_label: row.upcoming_candidate_label,
    election_year: row.election_year,
    district: row.district,
    education: null,
    experience: null,
    updated_at: row.updated_at,
    primary_photo_url: null,
    primary_photo_thumbnail_url: row.primary_photo_thumbnail_url,
    photo_source_name: null,
    photo_source_url: null,
    photo_license_type: null,
    photo_license_url: null,
    photo_attribution: null,
    role: row.list_role,
    role_label: roleLabel,
    status: row.list_status,
    status_label: statusLabels[row.list_status],
    display_position_label: getDisplayPosition(row, roleLabel, regionName),
    region_id: region?.regionId ?? null,
    region_name: regionName,
    candidate_count: 0,
    external_ids: [],
    merged_person_ids: [row.person_id],
    merged_role_labels: [roleLabel],
    merged_candidate_count: 0,
  };
}

function mapSearchRow(row: PublishedSearchResultRow): PublicSearchResult {
  return {
    id: row.document_key,
    type: row.entity_type,
    label: searchLabels[row.entity_type],
    title: row.title,
    subtitle: searchSubtitles[row.entity_type],
    href: row.href,
  };
}

function resolveRegionFilter(
  filters: PublicPersonFilters,
  resolveRegion: PublishedRegionResolver,
) {
  if (!filters.regionId) return null;

  return resolveRegion(filters.regionId) ?? {
    regionId: filters.regionId,
    regionName: filters.regionId,
    districtPrefixes: [filters.regionId],
  };
}

export function createPublishedPublicDataBridge(
  adapter: PublishedReadAdapter,
  resolveRegion: PublishedRegionResolver = () => null,
): PublishedPublicDataBridge {
  return {
    async loadPeoplePage(filters, page, pageSize) {
      const region = resolveRegionFilter(filters, resolveRegion);
      const result = await adapter.loadPeoplePage({
        page,
        pageSize,
        districtPrefixes: region?.districtPrefixes,
        party: filters.party,
        query: filters.query,
        role: filters.role,
        status: filters.status,
      });

      return {
        items: result.rows.map((row) => mapPeopleRow(row, region)),
        total: result.total,
      };
    },

    async searchPublicRecords(query) {
      return (await adapter.search(query)).map(mapSearchRow);
    },
  };
}
