import type { PartyThemeKey } from '../styles/partyThemes';

export type PublicPerson = {
  person_id: string;
  name: string;
  alias: string | null;
  gender: 'male' | 'female' | 'unknown' | null;
  party: string | null;
  position: string | null;
  election_year: number | null;
  district: string | null;
  education: string | null;
  experience: string | null;
  updated_at: string;
  primary_photo_url: string | null;
  primary_photo_thumbnail_url: string | null;
  photo_source_name: string | null;
  photo_source_url: string | null;
  photo_license_type: string | null;
  photo_license_url: string | null;
  photo_attribution: string | null;
};

export type PublicCompany = {
  company_id: string;
  unified_business_no: string | null;
  name: string;
  representative_name: string | null;
  status: string | null;
  capital: number | null;
  address_region: string | null;
  updated_at: string;
};

export type PublicRelationDetail = {
  relation_id: string;
  person_id: string;
  person_name: string;
  person_party: string | null;
  person_position: string | null;
  person_district: string | null;
  company_id: string;
  company_name: string;
  unified_business_no: string | null;
  relation_type: string;
  confidence_level: 'A' | 'B' | 'C' | 'D';
  evidence_text: string | null;
  source_document_id: string | null;
  source_name: string | null;
  source_url: string | null;
  verification_status: 'verified';
  relation_created_at: string;
  relation_updated_at: string;
};

export type PublicRegion = {
  region_id: string;
  name: string;
  slug: string;
  region_type:
    | 'country'
    | 'municipality'
    | 'county'
    | 'city'
    | 'district'
    | 'township'
    | 'village'
    | 'election_district'
    | 'special';
  parent_region_id: string | null;
  official_code: string | null;
  map_code: string | null;
  display_order: number | null;
};

export type PublicElection = {
  election_id: string;
  name: string;
  year: number | null;
  election_type: 'presidential' | 'legislative' | 'local' | 'recall' | 'referendum' | 'by_election' | 'other';
  voting_date: string | null;
  status: 'draft' | 'announced' | 'upcoming' | 'active' | 'completed' | 'cancelled' | 'unknown';
  source_name: string | null;
  source_url: string | null;
};

export type PublicRace = {
  race_id: string;
  election_id: string;
  election_name: string;
  region_id: string | null;
  region_name: string | null;
  region_slug: string | null;
  race_type:
    | 'president'
    | 'vice_president'
    | 'legislator'
    | 'party_list_legislator'
    | 'municipality_mayor'
    | 'county_mayor'
    | 'city_councilor'
    | 'county_councilor'
    | 'township_mayor'
    | 'township_representative'
    | 'village_chief'
    | 'recall'
    | 'referendum'
    | 'other';
  title: string;
  voting_date: string | null;
  status:
    | 'draft'
    | 'announced'
    | 'upcoming'
    | 'registration_open'
    | 'candidates_announced'
    | 'voting'
    | 'completed'
    | 'cancelled'
    | 'unknown';
  source_name: string | null;
  source_url: string | null;
};

export type PublicCandidate = {
  candidate_id: string;
  person_id: string;
  person_name: string;
  person_party: string | null;
  person_position: string | null;
  race_id: string;
  race_title: string;
  election_id: string;
  election_name: string;
  region_id: string | null;
  region_name: string | null;
  party: string | null;
  candidate_no: string | null;
  registration_status: 'pending' | 'registered' | 'qualified' | 'disqualified' | 'withdrawn' | 'elected' | 'not_elected' | 'unknown';
  source_name: string | null;
  source_url: string | null;
  primary_photo_url: string | null;
  primary_photo_thumbnail_url: string | null;
  photo_attribution: string | null;
  photo_license_type: string | null;
};

export type PublicHomeElectionTicker = {
  election_id: string;
  election_name: string;
  voting_date: string;
  election_type: PublicElection['election_type'];
  status: 'announced' | 'upcoming' | 'active';
  source_name: string | null;
  source_url: string | null;
};

export type PublicRegionElectionSummary = {
  region_id: string;
  region_name: string;
  region_slug: string;
  region_type: PublicRegion['region_type'];
  next_election_id: string | null;
  next_election_name: string | null;
  next_voting_date: string | null;
  upcoming_race_count: number;
};

export type PublicPersonPrimaryPhoto = {
  person_id: string;
  media_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  source_name: string;
  source_url: string;
  license_type:
    | 'government_open_data'
    | 'creative_commons'
    | 'official_site_permission'
    | 'wikimedia_commons'
    | 'self_provided'
    | 'placeholder';
  license_url: string | null;
  attribution: string | null;
};

export type PublicParty = {
  party_id: string;
  name: string;
  short_name: string | null;
  slug: string;
  theme_key: PartyThemeKey;
  official_site_url: string | null;
  chairperson_name: string | null;
  registry_no: string | null;
  founded_date_text: string | null;
  filed_date_text: string | null;
  headquarters_address: string | null;
  contact_phone: string | null;
  status: 'active' | 'inactive' | 'unknown';
  source_name: string | null;
  source_url: string | null;
  updated_at: string;
};

export type PublicPartyFinanceSummary = {
  party_id: string;
  party_name: string;
  report_year: number;
  income_total: number;
  expense_total: number;
  balance_amount: number;
  individual_donation_total: number;
  business_donation_total: number;
  civil_group_donation_total: number;
  anonymous_donation_total: number;
  other_income_total: number;
  source_name: string | null;
  source_url: string | null;
  updated_at: string;
};

export type PublicPartyCompanyContributionSummary = {
  party_id: string;
  company_id: string;
  company_name: string;
  report_year: number;
  amount_total: number;
  donation_count: number;
  confidence_level: PublicRelationDetail['confidence_level'];
  source_name: string | null;
  source_url: string | null;
  reviewed_at: string | null;
};

export type PublicPersonStatus = 'current' | 'candidate' | 'former' | 'other';

export type PublicPersonRole =
  | 'president'
  | 'vice_president'
  | 'legislator'
  | 'local_chief'
  | 'local_deputy'
  | 'agency_head'
  | 'councilor'
  | 'party_officer'
  | 'candidate'
  | 'other';

export type PublicPersonFilters = {
  query?: string;
  regionId?: string;
  party?: string;
  role?: PublicPersonRole;
  status?: PublicPersonStatus;
};

export type PublicPersonListItem = PublicPerson & {
  role: PublicPersonRole;
  role_label: string;
  status: PublicPersonStatus;
  status_label: string;
  region_id: string | null;
  region_name: string | null;
  candidate_count: number;
  merged_person_ids: string[];
  merged_role_labels: string[];
  merged_candidate_count: number;
};

export type PublicCouncilorPartyCount = {
  party: string;
  count: number;
};

export type PublicLocalOfficeSummary = {
  region_id: string;
  region_name: string;
  chief_executive: PublicPersonListItem | null;
  deputies: PublicPersonListItem[];
  agency_heads: PublicPersonListItem[];
  councilor_party_counts: PublicCouncilorPartyCount[];
  councilor_total: number;
  data_status: {
    label: string;
    status: 'available' | 'partial' | 'todo';
    note: string;
  }[];
};

export type PublicPersonProfile = {
  person: PublicPersonListItem;
  candidate_records: PublicCandidate[];
  experience_status: 'available' | 'todo';
  contribution_status: 'available' | 'summary_only' | 'todo';
  platform_status: 'available' | 'todo';
  legal_record_status: 'review_required' | 'todo';
  family_relation_status: 'review_required' | 'todo';
};
