import type { RegionCard, UpcomingRace } from '../data/mockHomeData';
import { partyTheme, type PartyThemeKey } from '../styles/partyThemes';
import type {
  PublicCandidate,
  PublicCompany,
  PublicElection,
  PublicHomeElectionTicker,
  PublicParty,
  PublicPartyCompanyContributionSummary,
  PublicPartyFinanceSummary,
  PublicPerson,
  PublicPersonPrimaryPhoto,
  PublicRace,
  PublicRegion,
  PublicRegionElectionSummary,
} from '../types/publicViews';
import type { StageRegionLevel, StageRegionNode, StageRegionSummary } from '../types/stageMap';
import type { HomeTicker } from './publicDataProvider';

// TODO: Verify row fields against finalized SQL public view definitions.
type PartialRow<T> = Partial<T> | null | undefined;

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asPartyThemeKey(value: unknown): PartyThemeKey {
  return typeof value === 'string' && value in partyTheme ? (value as PartyThemeKey) : 'unknown';
}

function asElectionType(value: unknown): PublicElection['election_type'] {
  const allowed: PublicElection['election_type'][] = ['presidential', 'legislative', 'local', 'recall', 'referendum', 'by_election', 'other'];
  return typeof value === 'string' && allowed.includes(value as PublicElection['election_type'])
    ? (value as PublicElection['election_type'])
    : 'other';
}

function asElectionStatus(value: unknown): PublicElection['status'] {
  const allowed: PublicElection['status'][] = ['draft', 'announced', 'upcoming', 'active', 'completed', 'cancelled', 'unknown'];
  return typeof value === 'string' && allowed.includes(value as PublicElection['status'])
    ? (value as PublicElection['status'])
    : 'unknown';
}

function asRaceType(value: unknown): PublicRace['race_type'] {
  const allowed: PublicRace['race_type'][] = [
    'president',
    'vice_president',
    'legislator',
    'party_list_legislator',
    'municipality_mayor',
    'county_mayor',
    'city_councilor',
    'county_councilor',
    'township_mayor',
    'township_representative',
    'village_chief',
    'recall',
    'referendum',
    'other',
  ];
  return typeof value === 'string' && allowed.includes(value as PublicRace['race_type'])
    ? (value as PublicRace['race_type'])
    : 'other';
}

function asRaceStatus(value: unknown): PublicRace['status'] {
  const allowed: PublicRace['status'][] = [
    'draft',
    'announced',
    'upcoming',
    'registration_open',
    'candidates_announced',
    'voting',
    'completed',
    'cancelled',
    'unknown',
  ];
  return typeof value === 'string' && allowed.includes(value as PublicRace['status'])
    ? (value as PublicRace['status'])
    : 'unknown';
}

function asRegionType(value: unknown): PublicRegion['region_type'] {
  const allowed: PublicRegion['region_type'][] = [
    'country',
    'municipality',
    'county',
    'city',
    'district',
    'township',
    'village',
    'election_district',
    'special',
  ];
  return typeof value === 'string' && allowed.includes(value as PublicRegion['region_type'])
    ? (value as PublicRegion['region_type'])
    : 'special';
}

function asCandidateRegistrationStatus(value: unknown): PublicCandidate['registration_status'] {
  const allowed: PublicCandidate['registration_status'][] = [
    'pending',
    'registered',
    'qualified',
    'disqualified',
    'withdrawn',
    'elected',
    'not_elected',
    'unknown',
  ];
  return typeof value === 'string' && allowed.includes(value as PublicCandidate['registration_status'])
    ? (value as PublicCandidate['registration_status'])
    : 'unknown';
}

function asPhotoLicenseType(value: unknown): PublicPersonPrimaryPhoto['license_type'] {
  const allowed: PublicPersonPrimaryPhoto['license_type'][] = [
    'government_open_data',
    'creative_commons',
    'official_site_permission',
    'wikimedia_commons',
    'self_provided',
    'placeholder',
  ];
  return typeof value === 'string' && allowed.includes(value as PublicPersonPrimaryPhoto['license_type'])
    ? (value as PublicPersonPrimaryPhoto['license_type'])
    : 'placeholder';
}

export function mapPublicElectionRow(row: PartialRow<PublicElection>): PublicElection {
  return {
    election_id: asString(row?.election_id, ''),
    name: asString(row?.name, '未命名選舉'),
    year: asNullableNumber(row?.year),
    election_type: asElectionType(row?.election_type),
    voting_date: asNullableString(row?.voting_date),
    status: asElectionStatus(row?.status),
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
  };
}

export function mapPublicPersonRow(row: PartialRow<PublicPerson>): PublicPerson {
  return {
    person_id: asString(row?.person_id, ''),
    name: asString(row?.name, '未命名人物'),
    alias: asNullableString(row?.alias),
    party: asNullableString(row?.party),
    position: asNullableString(row?.position),
    election_year: asNullableNumber(row?.election_year),
    district: asNullableString(row?.district),
    updated_at: asString(row?.updated_at, ''),
    primary_photo_url: asNullableString(row?.primary_photo_url),
    primary_photo_thumbnail_url: asNullableString(row?.primary_photo_thumbnail_url),
    photo_source_name: asNullableString(row?.photo_source_name),
    photo_source_url: asNullableString(row?.photo_source_url),
    photo_license_type: asNullableString(row?.photo_license_type),
    photo_license_url: asNullableString(row?.photo_license_url),
    photo_attribution: asNullableString(row?.photo_attribution),
  };
}

export function mapPublicCompanyRow(row: PartialRow<PublicCompany>): PublicCompany {
  return {
    company_id: asString(row?.company_id, ''),
    unified_business_no: asNullableString(row?.unified_business_no),
    name: asString(row?.name, '未命名公司'),
    representative_name: asNullableString(row?.representative_name),
    status: asNullableString(row?.status),
    capital: asNullableNumber(row?.capital),
    address_region: asNullableString(row?.address_region),
    updated_at: asString(row?.updated_at, ''),
  };
}

export function mapPublicRaceRow(row: PartialRow<PublicRace>): PublicRace {
  return {
    race_id: asString(row?.race_id, ''),
    election_id: asString(row?.election_id, ''),
    election_name: asString(row?.election_name, '未命名選舉'),
    region_id: asNullableString(row?.region_id),
    region_name: asNullableString(row?.region_name),
    region_slug: asNullableString(row?.region_slug),
    race_type: asRaceType(row?.race_type),
    title: asString(row?.title, '未命名選舉項目'),
    voting_date: asNullableString(row?.voting_date),
    status: asRaceStatus(row?.status),
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
  };
}

export function mapPublicCandidateRow(row: PartialRow<PublicCandidate>): PublicCandidate {
  return {
    candidate_id: asString(row?.candidate_id, ''),
    person_id: asString(row?.person_id, ''),
    person_name: asString(row?.person_name, '未命名候選人'),
    person_party: asNullableString(row?.person_party),
    person_position: asNullableString(row?.person_position),
    race_id: asString(row?.race_id, ''),
    race_title: asString(row?.race_title, '未命名選舉項目'),
    election_id: asString(row?.election_id, ''),
    election_name: asString(row?.election_name, '未命名選舉'),
    region_id: asNullableString(row?.region_id),
    region_name: asNullableString(row?.region_name),
    party: asNullableString(row?.party),
    candidate_no: asNullableString(row?.candidate_no),
    registration_status: asCandidateRegistrationStatus(row?.registration_status),
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
    primary_photo_url: asNullableString(row?.primary_photo_url),
    primary_photo_thumbnail_url: asNullableString(row?.primary_photo_thumbnail_url),
    photo_attribution: asNullableString(row?.photo_attribution),
    photo_license_type: asNullableString(row?.photo_license_type),
  };
}

export function mapPublicRegionRow(row: PartialRow<PublicRegion>): PublicRegion {
  return {
    region_id: asString(row?.region_id, ''),
    name: asString(row?.name, '未命名區域'),
    slug: asString(row?.slug, asString(row?.region_id, 'unknown-region')),
    region_type: asRegionType(row?.region_type),
    parent_region_id: asNullableString(row?.parent_region_id),
    official_code: asNullableString(row?.official_code),
    map_code: asNullableString(row?.map_code),
    display_order: asNullableNumber(row?.display_order),
  };
}

export function mapPublicRegionElectionSummaryRow(row: PartialRow<PublicRegionElectionSummary>): PublicRegionElectionSummary {
  return {
    region_id: asString(row?.region_id, ''),
    region_name: asString(row?.region_name, '未命名區域'),
    region_slug: asString(row?.region_slug, asString(row?.region_id, 'unknown-region')),
    region_type: asRegionType(row?.region_type),
    next_election_id: asNullableString(row?.next_election_id),
    next_election_name: asNullableString(row?.next_election_name),
    next_voting_date: asNullableString(row?.next_voting_date),
    upcoming_race_count: asNumber(row?.upcoming_race_count, 0),
  };
}

export function mapPublicHomeElectionTickerRow(row: PartialRow<PublicHomeElectionTicker>): PublicHomeElectionTicker {
  return {
    election_id: asString(row?.election_id, ''),
    election_name: asString(row?.election_name, '未命名選舉'),
    voting_date: asString(row?.voting_date, '待公告'),
    election_type: asElectionType(row?.election_type),
    status: ['announced', 'upcoming', 'active'].includes(asString(row?.status))
      ? (row?.status as PublicHomeElectionTicker['status'])
      : 'upcoming',
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
  };
}

export function mapPublicPersonPrimaryPhotoRow(row: PartialRow<PublicPersonPrimaryPhoto>): PublicPersonPrimaryPhoto {
  return {
    person_id: asString(row?.person_id, ''),
    media_id: asString(row?.media_id, ''),
    photo_url: asString(row?.photo_url, ''),
    thumbnail_url: asNullableString(row?.thumbnail_url),
    source_name: asString(row?.source_name, '公開資料來源'),
    source_url: asString(row?.source_url, ''),
    license_type: asPhotoLicenseType(row?.license_type),
    license_url: asNullableString(row?.license_url),
    attribution: asNullableString(row?.attribution),
  };
}

export function mapPublicPartyRow(row: PartialRow<PublicParty>): PublicParty {
  return {
    party_id: asString(row?.party_id, ''),
    name: asString(row?.name, '未命名政黨'),
    short_name: asNullableString(row?.short_name),
    slug: asString(row?.slug, asString(row?.party_id, 'unknown-party')),
    theme_key: asPartyThemeKey(row?.theme_key),
    official_site_url: asNullableString(row?.official_site_url),
    chairperson_name: asNullableString(row?.chairperson_name),
    status: ['active', 'inactive', 'unknown'].includes(asString(row?.status))
      ? (row?.status as PublicParty['status'])
      : 'unknown',
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
    updated_at: asString(row?.updated_at, ''),
  };
}

export function mapPublicPartyFinanceSummaryRow(
  row: PartialRow<PublicPartyFinanceSummary>,
): PublicPartyFinanceSummary {
  return {
    party_id: asString(row?.party_id, ''),
    party_name: asString(row?.party_name, '未命名政黨'),
    report_year: asNumber(row?.report_year, 0),
    income_total: asNumber(row?.income_total, 0),
    expense_total: asNumber(row?.expense_total, 0),
    balance_amount: asNumber(row?.balance_amount, 0),
    individual_donation_total: asNumber(row?.individual_donation_total, 0),
    business_donation_total: asNumber(row?.business_donation_total, 0),
    civil_group_donation_total: asNumber(row?.civil_group_donation_total, 0),
    anonymous_donation_total: asNumber(row?.anonymous_donation_total, 0),
    other_income_total: asNumber(row?.other_income_total, 0),
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
    updated_at: asString(row?.updated_at, ''),
  };
}

export function mapPublicPartyCompanyContributionSummaryRow(
  row: PartialRow<PublicPartyCompanyContributionSummary>,
): PublicPartyCompanyContributionSummary {
  const confidenceLevels: PublicPartyCompanyContributionSummary['confidence_level'][] = ['A', 'B', 'C', 'D'];

  return {
    party_id: asString(row?.party_id, ''),
    company_id: asString(row?.company_id, ''),
    company_name: asString(row?.company_name, '未命名公司'),
    report_year: asNumber(row?.report_year, 0),
    amount_total: asNumber(row?.amount_total, 0),
    donation_count: asNumber(row?.donation_count, 0),
    confidence_level:
      typeof row?.confidence_level === 'string' && confidenceLevels.includes(row.confidence_level)
        ? row.confidence_level
        : 'D',
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
    reviewed_at: asNullableString(row?.reviewed_at),
  };
}

export function mapTickerToHomeTicker(row: PartialRow<PublicHomeElectionTicker>): HomeTicker {
  const ticker = mapPublicHomeElectionTickerRow(row);
  return {
    title: ticker.election_name || '範例公開選舉',
    subtitle: '依公開公告整理的下一個重點選舉節點',
    date: ticker.voting_date || '待公告',
  };
}

export function mapRegionSummaryToRegionCard(row: PartialRow<PublicRegionElectionSummary>): RegionCard {
  const summary = mapPublicRegionElectionSummaryRow(row);
  return {
    id: summary.region_slug,
    name: summary.region_name,
    tone: '公開資料導覽區塊',
    electionName: summary.next_election_name ?? '尚無公開選舉資料',
    nextVotingDate: summary.next_voting_date ?? '待公告',
    upcomingRaceCount: summary.upcoming_race_count,
  };
}

function toStageRegionLevel(regionType: PublicRegion['region_type']): StageRegionLevel {
  if (regionType === 'country') {
    return 'country';
  }

  if (regionType === 'district' || regionType === 'township' || regionType === 'village') {
    return 'district';
  }

  return 'county_city';
}

export function mapRegionToStageRegionNode(row: PartialRow<PublicRegion>, index: number, parentStageId: string | null): StageRegionNode {
  const region = mapPublicRegionRow(row);
  return {
    id: region.slug,
    label: region.name,
    level: toStageRegionLevel(region.region_type),
    parentId: parentStageId,
    publicRegionId: region.region_id || null,
    displayOrder: region.display_order ?? index,
    stageLabel: region.map_code ?? region.official_code ?? `PV-${index + 1}`,
    isPlaceholder: false,
    note: 'public view derived stage region placeholder',
  };
}

export function mapRegionSummaryToStageRegionSummary(row: PartialRow<PublicRegionElectionSummary>): StageRegionSummary {
  const summary = mapPublicRegionElectionSummaryRow(row);
  return {
    regionId: summary.region_slug,
    label: summary.region_name,
    nearestElectionName: summary.next_election_name ?? '尚無公開選舉資料',
    nearestElectionDate: summary.next_voting_date ?? '待公告',
    upcomingRaceCount: summary.upcoming_race_count,
    sourceNote: '依公開 public view 摘要資料整理。',
    boundaryNote: '僅顯示經許可的 public views。',
  };
}

function toPartyThemeKey(partyLabel: string | null): PartyThemeKey {
  if (partyLabel === '民主進步黨') return 'dpp';
  if (partyLabel === '中國國民黨') return 'kmt';
  if (partyLabel === '台灣民眾黨') return 'tpp';
  if (partyLabel === '時代力量') return 'npp';
  if (partyLabel === '親民黨') return 'pfp';
  if (partyLabel === '台灣基進') return 'tsp';
  if (partyLabel === '無黨籍') return 'independent';
  return 'unknown';
}

export function mapRaceToUpcomingRace(row: PartialRow<PublicRace>): UpcomingRace {
  const race = mapPublicRaceRow(row);
  const partyTag = toPartyThemeKey(null);
  return {
    id: race.race_id,
    electionId: race.election_id,
    title: race.title,
    region: race.region_name ?? '未指定區域',
    regionId: race.region_slug ?? race.region_id ?? 'unknown-region',
    date: race.voting_date ?? '待公告',
    status: race.status,
    partyTag,
    partyLabel: partyTheme[partyTag].label,
  };
}
