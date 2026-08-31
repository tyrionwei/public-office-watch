import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import { partyTheme } from '../styles/partyThemes.ts';
import type { StageRegionLevel, StageRegionNode, StageRegionSummary } from '../types/stageMap';
import { buildLocalOfficeSummaryFromItems, buildPersonProfileFromItems } from './personData.ts';
import type {
  HomePageData,
  PublicDataProvider,
  PublicSearchResult,
  PublicSearchResultType,
} from './publicDataProvider';
import type {
  PublishedHomeTickerRow,
  PublishedPeopleDirectoryRow,
  PublishedPersonProfileRow,
  PublishedRaceRow,
  PublishedReadAdapter,
  PublishedRegionRow,
  PublishedRegionSummaryRow,
  PublishedSearchResultRow,
} from './publishedReadAdapter.ts';
import type {
  PublicPersonFilters,
  PublicPersonListItem,
  PublicParty,
  PublicPartyAnnualFinanceFiling,
  PublicPartyCompanyContributionSummary,
  PublicPartyFinanceSummary,
  PublicPersonRole,
  PublicPersonStatus,
  PublicPersonProfile,
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

export type PublishedRegionPageData = {
  region: StageRegionNode | null;
  summary: StageRegionSummary | null;
  card: RegionCard | null;
  childRegions: StageRegionNode[];
  relatedRaces: UpcomingRace[];
};

export type PublishedPartyData = {
  parties: PublicParty[];
  annualFinanceFilings: PublicPartyAnnualFinanceFiling[];
  financeSummaries: PublicPartyFinanceSummary[];
  companyContributionSummaries: PublicPartyCompanyContributionSummary[];
};

export type PublishedPublicDataBridge = Pick<
  PublicDataProvider,
  | 'loadElectionIndex'
  | 'loadElectionRaceFacets'
  | 'loadElectionEducationDistribution'
  | 'loadElectionPartyPerformance'
  | 'loadElectionRacePage'
  | 'loadRaceDetail'
  | 'loadPeoplePage'
  | 'loadPartyCandidatePage'
  | 'loadPersonProfiles'
  | 'loadLocalOfficeSummaryByRegionId'
  | 'loadNationalOfficeHolders'
  | 'loadCurrentLegislatorPartySummary'
  | 'loadPublicUpdates'
  | 'loadPartyOfficers'
  | 'loadPartyPlatformHistory'
  | 'loadPartyPeopleStatistics'
  | 'loadPartyLegalStatistics'
  | 'searchPublicRecords'
> & {
  loadHomePageData(regionId?: string | null): Promise<HomePageData>;
  loadRegionDirectory(): Promise<StageRegionNode[]>;
  loadRegionPageData(regionSlug: string): Promise<PublishedRegionPageData>;
  loadPartyDirectory(): Promise<PublicParty[]>;
  loadPartyData(): Promise<PublishedPartyData>;
  loadPartyCompanyContributionPage(partyId: string, page: number, pageSize: number): Promise<{ items: PublicPartyCompanyContributionSummary[]; total: number }>;
};

const publishedDataPrinciples = [
  '只呈現公開且可追溯的資料。',
  '前端只讀經審核且有界的 published 發布資料。',
  '行政區導覽不等於正式選舉選區。',
];

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

function mapProfilePersonRow(row: PublishedPersonProfileRow): PublicPersonListItem {
  const region = row.primary_region_id
    ? {
        regionId: row.primary_region_id,
        regionName: row.primary_region_name ?? row.district ?? row.primary_region_id,
        districtPrefixes: [],
      }
    : null;
  const person = mapPeopleRow(row, region);

  return {
    ...person,
    education: row.education,
    experience: row.experience,
    primary_photo_url: row.primary_photo_url,
    photo_source_name: row.photo_source_name,
    photo_source_url: row.photo_source_url,
    photo_license_type: row.photo_license_type,
    photo_license_url: row.photo_license_url,
    photo_attribution: row.photo_attribution,
    candidate_count: row.candidate_count,
    merged_candidate_count: row.candidate_count,
  };
}

function normalizePersonIds(personIds: string[]) {
  return Array.from(new Set(
    personIds.map((personId) => personId.trim()).filter(Boolean),
  ));
}

function regionLabelVariants(label: string) {
  return Array.from(new Set([label, label.replace(/臺/g, '台'), label.replace(/台/g, '臺')]));
}

function mapSearchRow(row: PublishedSearchResultRow): PublicSearchResult {
  return {
    id: row.document_key,
    type: row.entity_type,
    label: searchLabels[row.entity_type],
    title: row.title,
    subtitle: searchSubtitles[row.entity_type],
    party: row.entity_type === 'person' ? row.party_name : null,
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

function toStageRegionLevel(regionType: PublishedRegionRow['region_type']): StageRegionLevel {
  if (regionType === 'country') return 'country';
  if (regionType === 'district' || regionType === 'township' || regionType === 'village') return 'district';
  return 'county_city';
}

function mapRegionNode(
  row: PublishedRegionRow,
  index: number,
  parentId: string | null,
): StageRegionNode {
  return {
    id: row.slug,
    label: row.name,
    level: toStageRegionLevel(row.region_type),
    parentId,
    publicRegionId: row.region_id,
    displayOrder: row.display_order ?? index,
    stageLabel: row.map_code ?? row.official_code ?? `PV-${index + 1}`,
    isPlaceholder: false,
    note: 'published region',
  };
}

function mapRegionSummary(row: PublishedRegionSummaryRow): StageRegionSummary {
  return {
    regionId: row.region_slug,
    label: row.region_name,
    nearestElectionName: row.next_election_name ?? '尚無公開選舉資料',
    nearestElectionDate: row.next_voting_date ?? '待公告',
    upcomingRaceCount: row.upcoming_race_count,
    sourceNote: '依 published 發布摘要資料整理。',
    boundaryNote: '僅顯示已審核的 published 發布資料。',
  };
}

function mapRegionCard(row: PublishedRegionSummaryRow): RegionCard {
  return {
    id: row.region_slug,
    name: row.region_name,
    tone: '公開資料導覽區塊',
    electionName: row.next_election_name ?? '尚無公開選舉資料',
    nextVotingDate: row.next_voting_date ?? '待公告',
    upcomingRaceCount: row.upcoming_race_count,
  };
}

function mapRace(row: PublishedRaceRow): UpcomingRace {
  return {
    id: row.race_id,
    electionId: row.election_id,
    title: row.title,
    region: row.region_name ?? '未指定區域',
    regionId: row.region_slug ?? row.region_id ?? 'unknown-region',
    date: row.voting_date ?? '待公告',
    status: row.status,
    raceType: row.race_type,
    partyTag: 'unknown',
    partyLabel: partyTheme.unknown.label,
  };
}

function mapTicker(row: PublishedHomeTickerRow | undefined) {
  return {
    title: row?.election_name ?? '尚無公開選舉資料',
    date: row?.voting_date ?? '待公告',
    electionId: row?.election_id ?? null,
  };
}

function fallbackRegionSummary(region: PublishedRegionRow): StageRegionSummary {
  return {
    regionId: region.slug,
    label: region.name,
    nearestElectionName: '尚無公開選舉資料',
    nearestElectionDate: '待公告',
    upcomingRaceCount: 0,
    sourceNote: 'published 尚無此區域的近期選舉摘要。',
    boundaryNote: '僅顯示已審核的 published 發布資料。',
  };
}

export function createPublishedPublicDataBridge(
  adapter: PublishedReadAdapter,
  resolveRegion: PublishedRegionResolver = () => null,
): PublishedPublicDataBridge {
  const knownRegions = new Map<string, PublishedRegionResolution>();

  function rememberRegions(regions: StageRegionNode[]) {
    knownRegions.clear();

    for (const region of regions) {
      const resolution = {
        regionId: region.publicRegionId ?? region.id,
        regionName: region.label,
        districtPrefixes: regionLabelVariants(region.label),
      };

      for (const key of [region.id, region.publicRegionId, region.label]) {
        if (key) knownRegions.set(key, resolution);
      }
    }
  }

  function resolveKnownRegion(regionId: string) {
    return resolveRegion(regionId) ?? knownRegions.get(regionId) ?? null;
  }

  return {
    async loadHomePageData(regionId = null) {
      const rows = await adapter.loadHomePage(regionId);
      const regionRows = rows.regionRows ?? [];
      const regionById = new Map(regionRows.map((region) => [region.region_id, region]));
      const stageRegions = regionRows.map((region, index) => {
        const parent = region.parent_region_id ? regionById.get(region.parent_region_id) : null;
        return mapRegionNode(region, index, parent?.slug ?? null);
      });
      if (stageRegions.length > 0) rememberRegions(stageRegions);
      return {
        ticker: mapTicker(rows.tickerRows[0]),
        regions: rows.regionSummaryRows.map(mapRegionCard),
        stageRegions,
        stageRegionSummaries: rows.regionSummaryRows.map(mapRegionSummary),
        upcomingRaces: rows.raceRows.map(mapRace),
        candidateSummaries: (rows.candidateRows ?? []).map((row) => {
          const { gender, age_group: ageGroup, ...candidate } = row;
          return { candidate, gender, birthDate: null, ageGroup };
        }),
        seatDistribution: (rows.seatRows ?? []).map((row) => ({
          party: row.party_name?.trim() || '未知黨籍',
          count: Number(row.seat_count) || 0,
        })),
        releaseId: rows.releaseId ?? null,
        publishedAt: rows.publishedAt ?? null,
        dataPrinciples: publishedDataPrinciples,
      };
    },

    async loadRegionDirectory() {
      const rows = await adapter.loadRegionDirectory();
      const regionById = new Map(rows.map((region) => [region.region_id, region]));
      const regions = rows.map((region, index) => {
        const parent = region.parent_region_id ? regionById.get(region.parent_region_id) : null;
        return mapRegionNode(region, index, parent?.slug ?? null);
      });
      rememberRegions(regions);
      return regions;
    },

    async loadRegionPageData(regionSlug) {
      const rows = await adapter.loadRegionPage(regionSlug);
      if (!rows.regionRow) {
        return {
          region: null,
          summary: null,
          card: null,
          childRegions: [],
          relatedRaces: rows.raceRows.map(mapRace),
        };
      }

      const summary = rows.summaryRow
        ? mapRegionSummary(rows.summaryRow)
        : fallbackRegionSummary(rows.regionRow);
      const card = rows.summaryRow
        ? mapRegionCard(rows.summaryRow)
        : {
            id: rows.regionRow.slug,
            name: rows.regionRow.name,
            tone: '公開資料導覽區塊',
            electionName: summary.nearestElectionName,
            nextVotingDate: summary.nearestElectionDate,
            upcomingRaceCount: summary.upcomingRaceCount,
          };

      return {
        region: mapRegionNode(rows.regionRow, 0, null),
        summary,
        card,
        childRegions: rows.childRegionRows.map((region, index) => mapRegionNode(region, index, rows.regionRow?.slug ?? null)),
        relatedRaces: rows.raceRows.map(mapRace),
      };
    },

    async loadElectionIndex() {
      const rows = await adapter.loadElectionIndex();
      return {
        elections: rows.electionRows,
        raceSummaries: rows.raceSummaryRows,
      };
    },

    loadElectionRaceFacets(electionIds) {
      return adapter.loadElectionRaceFacets(electionIds);
    },

    loadElectionEducationDistribution(eventKey, electionIds, filters = {}) {
      return adapter.loadElectionEducationDistribution(eventKey, electionIds, filters);
    },

    loadElectionPartyPerformance(eventKey, electionIds, filters = {}) {
      return adapter.loadElectionPartyPerformance(eventKey, electionIds, filters);
    },

    loadElectionRacePage(eventKey, electionIds, filters, page, pageSize) {
      return adapter.loadElectionRacePage(eventKey, electionIds, filters, page, pageSize);
    },

    async loadRaceDetail(raceId) {
      const rows = await adapter.loadRaceDetail(raceId);

      return {
        race: rows.raceRow,
        election: rows.electionRow,
        candidates: rows.candidateRows,
        partyAffiliations: rows.partyAffiliationRows,
        partyListResults: rows.partyListResultRows ?? [],
        referendumQuestion: rows.referendumQuestionRow,
        referendumOptions: rows.referendumOptionRows,
        referendumRegionResults: rows.referendumRegionResultRows,
      };
    },

    async loadLocalOfficeSummaryByRegionId(regionId) {
      const region = resolveKnownRegion(regionId);
      if (!region) {
        return buildLocalOfficeSummaryFromItems(regionId, [], []);
      }

      const rows = await adapter.loadLocalOfficePeople(region.districtPrefixes);
      const summary = buildLocalOfficeSummaryFromItems(
        region.regionId,
        rows.map((row) => mapPeopleRow(row, region)),
        [],
      );

      return {
        ...summary,
        region_id: region.regionId,
        region_name: region.regionName,
      };
    },

    loadNationalOfficeHolders() {
      return adapter.loadNationalOfficeHolders();
    },

    loadCurrentLegislatorPartySummary() {
      return adapter.loadCurrentLegislatorPartySummary();
    },

    loadPublicUpdates(limit) {
      return adapter.loadPublicUpdates(limit);
    },

    async loadPartyData() {
      const rows = await adapter.loadPartyData();
      return {
        parties: rows.partyRows,
        annualFinanceFilings: rows.annualFinanceFilingRows,
        financeSummaries: rows.financeRows,
        companyContributionSummaries: rows.companyContributionRows ?? [],
      };
    },

    loadPartyDirectory() {
      return adapter.loadPartyDirectory();
    },

    async loadPartyCompanyContributionPage(partyId, page, pageSize) {
      const result = await adapter.loadPartyCompanyContributionPage(partyId, page, pageSize);
      return {
        items: result.rows,
        total: result.total,
      };
    },

    loadPartyOfficers(partyId) {
      return adapter.loadPartyOfficers(partyId);
    },

    loadPartyPlatformHistory(partyId) {
      return adapter.loadPartyPlatformHistory(partyId);
    },

    loadPartyPeopleStatistics(partyName) {
      return adapter.loadPartyPeopleStatistics(partyName);
    },

    loadPartyLegalStatistics(partyName) {
      return adapter.loadPartyLegalStatistics(partyName);
    },

    async loadPeoplePage(filters, page, pageSize) {
      const region = resolveRegionFilter(filters, resolveKnownRegion);
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

    async loadPartyCandidatePage(partyName, page, pageSize) {
      const result = await adapter.loadPartyCandidatePage(partyName, page, pageSize);
      return {
        items: result.rows,
        total: result.total,
      };
    },

    async loadPersonProfiles(personIds) {
      const normalizedIds = normalizePersonIds(personIds);
      const rows = await adapter.loadPersonProfiles(normalizedIds);
      const people = rows.personRows.map(mapProfilePersonRow);
      const candidates = rows.candidateRows;
      const claims = rows.claimRows;
      const partyAffiliations = rows.partyAffiliationRows;

      return normalizedIds
        .map((personId) => buildPersonProfileFromItems(
          personId,
          people,
          candidates,
          claims,
          partyAffiliations,
        ))
        .filter((profile): profile is PublicPersonProfile => profile !== null);
    },

    async searchPublicRecords(query) {
      return (await adapter.search(query)).map(mapSearchRow);
    },
  };
}
