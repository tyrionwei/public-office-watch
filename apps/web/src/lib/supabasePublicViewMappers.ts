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
  PublicPartyOfficer,
  PublicPerson,
  PublicPersonClaim,
  PublicPersonPartyAffiliation,
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

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function asPersonGender(value: unknown): PublicPerson['gender'] {
  return value === 'male' || value === 'female' || value === 'unknown' ? value : null;
}

function asPartyThemeKey(value: unknown): PartyThemeKey {
  return typeof value === 'string' && value in partyTheme ? (value as PartyThemeKey) : 'unknown';
}

function asElectionType(value: unknown): PublicElection['election_type'] {
  const allowed: PublicElection['election_type'][] = [
    'presidential',
    'legislative',
    'local',
    'recall',
    'referendum',
    'by_election',
    'other',
    'president',
    'legislator',
    'councilor',
    'local_chief',
    'township_representative',
    'village_chief',
  ];
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
    'legislative_district',
    'councilor_district',
    'local_chief',
    'township_representative_district',
    'indigenous',
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
    'president',
    'legislative_district',
    'councilor_district',
    'local_chief',
    'township_representative_district',
    'village_chief',
    'indigenous',
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

function asCandidateCandidacyStatus(value: unknown): PublicCandidate['candidacy_status'] {
  const allowed: PublicCandidate['candidacy_status'][] = [
    'potential',
    'party_nominee',
    'officially_announced',
    'registered',
    'qualified',
    'withdrawn_or_disqualified',
    'unknown',
  ];
  return typeof value === 'string' && allowed.includes(value as PublicCandidate['candidacy_status'])
    ? (value as PublicCandidate['candidacy_status'])
    : 'unknown';
}

function asCandidateElectionResult(value: unknown): PublicCandidate['election_result'] {
  const allowed: PublicCandidate['election_result'][] = ['pending', 'elected', 'not_elected', 'unknown'];
  return typeof value === 'string' && allowed.includes(value as PublicCandidate['election_result'])
    ? (value as PublicCandidate['election_result'])
    : 'unknown';
}

function candidacyStatusFromLegacy(status: PublicCandidate['registration_status']): PublicCandidate['candidacy_status'] {
  if (status === 'pending') return 'potential';
  if (status === 'registered' || status === 'qualified') return status;
  if (status === 'disqualified' || status === 'withdrawn') return 'withdrawn_or_disqualified';
  if (status === 'elected' || status === 'not_elected') return 'qualified';
  return 'unknown';
}

function electionResultFromLegacy(
  status: PublicCandidate['registration_status'],
  isElected: boolean | null,
): PublicCandidate['election_result'] {
  if (isElected === true || status === 'elected') return 'elected';
  if (isElected === false || status === 'not_elected') return 'not_elected';
  return 'unknown';
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
    gender: asPersonGender(row?.gender),
    party: asNullableString(row?.party),
    position: asNullableString(row?.position),
    current_office_label: asNullableString(row?.current_office_label),
    upcoming_candidate_label: asNullableString(row?.upcoming_candidate_label),
    election_year: asNullableNumber(row?.election_year),
    district: asNullableString(row?.district),
    education: asNullableString(row?.education),
    experience: asNullableString(row?.experience),
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
    director_names: asStringArray(row?.director_names),
    registry_source_name: asNullableString(row?.registry_source_name),
    registry_source_url: asNullableString(row?.registry_source_url),
    registry_checked_at: asNullableString(row?.registry_checked_at),
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
  const registrationStatus = asCandidateRegistrationStatus(row?.registration_status);
  const isElected = typeof row?.is_elected === 'boolean' ? row.is_elected : null;

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
    election_year: asNullableNumber(row?.election_year),
    region_id: asNullableString(row?.region_id),
    region_name: asNullableString(row?.region_name),
    party: asNullableString(row?.party),
    candidate_no: asNullableString(row?.candidate_no),
    registration_status: registrationStatus,
    candidacy_status: row?.candidacy_status === undefined
      ? candidacyStatusFromLegacy(registrationStatus)
      : asCandidateCandidacyStatus(row.candidacy_status),
    election_result: row?.election_result === undefined
      ? electionResultFromLegacy(registrationStatus, isElected)
      : asCandidateElectionResult(row.election_result),
    status_updated_at: asNullableString(row?.status_updated_at),
    candidate_updated_at: asNullableString(row?.candidate_updated_at),
    vote_count: asNullableNumber(row?.vote_count),
    vote_rate: asNullableNumber(row?.vote_rate),
    is_elected: isElected,
    is_incumbent: typeof row?.is_incumbent === 'boolean' ? row.is_incumbent : null,
    office_at_election: asNullableString(row?.office_at_election),
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

export function mapPublicPersonClaimRow(row: PartialRow<PublicPersonClaim>): PublicPersonClaim {
  const confidenceLevels: PublicPersonClaim['confidence_level'][] = ['A', 'B', 'C', 'D'];
  const claimTypes: PublicPersonClaim['claim_type'][] = [
    'name',
    'alias',
    'gender',
    'birth_date',
    'party',
    'party_affiliation',
    'position',
    'office',
    'candidacy',
    'district',
    'education',
    'experience',
    'platform',
    'finance_summary',
    'legal_case',
    'family_relation',
    'media',
    'external_id',
    'other',
  ];

  return {
    claim_id: asString(row?.claim_id, ''),
    person_id: asString(row?.person_id, ''),
    claim_type:
      typeof row?.claim_type === 'string' && claimTypes.includes(row.claim_type)
        ? row.claim_type
        : 'other',
    claim_value: asNullableString(row?.claim_value),
    claim_json: typeof row?.claim_json === 'object' && row.claim_json !== null ? row.claim_json : {},
    confidence_level:
      typeof row?.confidence_level === 'string' && confidenceLevels.includes(row.confidence_level)
        ? row.confidence_level
        : 'D',
    review_score: asNumber(row?.review_score, 0),
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
    observed_at: asNullableString(row?.observed_at),
    updated_at: asString(row?.updated_at, ''),
  };
}

function asPartyAffiliationRoleContext(value: unknown): PublicPersonPartyAffiliation['role_context'] {
  const allowed: PublicPersonPartyAffiliation['role_context'][] = [
    'candidate',
    'officeholder',
    'party_officer',
    'self_declared',
    'wiki_record',
    'official_record',
    'other',
  ];
  return typeof value === 'string' && allowed.includes(value as PublicPersonPartyAffiliation['role_context'])
    ? (value as PublicPersonPartyAffiliation['role_context'])
    : 'other';
}

function asPartyOfficerRoleTier(value: unknown): PublicPersonPartyAffiliation['role_tier'] {
  return value === 'secondary' || value === 'committee' ? value : 'primary';
}

export function mapPublicPersonPartyAffiliationRow(row: PartialRow<PublicPersonPartyAffiliation>): PublicPersonPartyAffiliation {
  const confidenceLevels: PublicPersonPartyAffiliation['confidence_level'][] = ['A', 'B', 'C', 'D'];

  return {
    affiliation_id: asString(row?.affiliation_id, ''),
    affiliation_key: asString(row?.affiliation_key, ''),
    person_id: asString(row?.person_id, ''),
    person_name: asString(row?.person_name, '未命名人物'),
    source_claim_key: asNullableString(row?.source_claim_key),
    party_name: asString(row?.party_name, '未知政黨'),
    role_context: asPartyAffiliationRoleContext(row?.role_context),
    role_title: asNullableString(row?.role_title),
    organization_unit: asNullableString(row?.organization_unit),
    display_order: asNullableNumber(row?.display_order),
    role_tier: asPartyOfficerRoleTier(row?.role_tier),
    observed_year: asNullableNumber(row?.observed_year),
    observed_date: asNullableString(row?.observed_date),
    start_date: asNullableString(row?.start_date),
    end_date: asNullableString(row?.end_date),
    is_current: typeof row?.is_current === 'boolean' ? row.is_current : false,
    confidence_level:
      typeof row?.confidence_level === 'string' && confidenceLevels.includes(row.confidence_level)
        ? row.confidence_level
        : 'D',
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
    updated_at: asString(row?.updated_at, ''),
  };
}

export function mapPublicPartyOfficerRow(row: PartialRow<PublicPartyOfficer>): PublicPartyOfficer {
  return {
    affiliation_id: asString(row?.affiliation_id, ''),
    person_id: asString(row?.person_id, ''),
    person_name: asString(row?.person_name, '未命名人物'),
    party_id: asString(row?.party_id, ''),
    party_name: asString(row?.party_name, '未知政黨'),
    role_title: asNullableString(row?.role_title),
    organization_unit: asNullableString(row?.organization_unit),
    display_order: asNullableNumber(row?.display_order),
    role_tier: asPartyOfficerRoleTier(row?.role_tier),
    start_date: asNullableString(row?.start_date),
    observed_date: asNullableString(row?.observed_date),
    current_office_label: asNullableString(row?.current_office_label),
    primary_photo_thumbnail_url: asNullableString(row?.primary_photo_thumbnail_url),
    source_name: asNullableString(row?.source_name),
    source_url: asNullableString(row?.source_url),
    updated_at: asString(row?.updated_at, ''),
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
    registry_no: asNullableString(row?.registry_no),
    founded_date_text: asNullableString(row?.founded_date_text),
    filed_date_text: asNullableString(row?.filed_date_text),
    headquarters_address: asNullableString(row?.headquarters_address),
    contact_phone: asNullableString(row?.contact_phone),
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
    representative_name: asNullableString(row?.representative_name),
    director_names: asStringArray(row?.director_names),
    registry_source_name: asNullableString(row?.registry_source_name),
    registry_source_url: asNullableString(row?.registry_source_url),
    registry_checked_at: asNullableString(row?.registry_checked_at),
  };
}

export function mapTickerToHomeTicker(row: PartialRow<PublicHomeElectionTicker>): HomeTicker {
  const ticker = mapPublicHomeElectionTickerRow(row);
  return {
    title: ticker.election_name || '尚無公開選舉資料',
    date: ticker.voting_date || '待公告',
    electionId: ticker.election_id || null,
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
    raceType: race.race_type,
    partyTag,
    partyLabel: partyTheme[partyTag].label,
  };
}
