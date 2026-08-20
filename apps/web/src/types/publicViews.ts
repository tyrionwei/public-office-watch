import type { PartyThemeKey } from '../styles/partyThemes';

export type PublicUpdateType = 'candidate' | 'person' | 'party' | 'election' | 'correction' | 'site';

export type PublicUpdate = {
  update_id: string;
  update_type: PublicUpdateType;
  title: string;
  summary: string;
  entity_type: 'person' | 'party' | 'election' | 'race' | 'region' | null;
  entity_id: string | null;
  entity_href: string | null;
  source_name: string | null;
  source_url: string | null;
  occurred_at: string | null;
  published_at: string;
};

export type PublicPerson = {
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

export type PublicPersonPartyAffiliation = {
  affiliation_id: string;
  affiliation_key: string;
  person_id: string;
  person_name: string;
  source_claim_key: string | null;
  party_name: string;
  role_context: 'candidate' | 'officeholder' | 'party_officer' | 'self_declared' | 'wiki_record' | 'official_record' | 'other';
  role_title: string | null;
  organization_unit: string | null;
  display_order: number | null;
  role_tier: 'primary' | 'secondary' | 'committee';
  observed_year: number | null;
  observed_date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  confidence_level: 'A' | 'B' | 'C' | 'D';
  source_name: string | null;
  source_url: string | null;
  updated_at: string;
};

export type PublicPartyOfficer = {
  affiliation_id: string;
  person_id: string;
  person_name: string;
  party_id: string;
  party_name: string;
  role_title: string | null;
  organization_unit: string | null;
  display_order: number | null;
  role_tier: 'primary' | 'secondary' | 'committee';
  start_date: string | null;
  observed_date: string | null;
  current_office_label: string | null;
  primary_photo_thumbnail_url: string | null;
  source_name: string | null;
  source_url: string | null;
  updated_at: string;
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
  director_names: string[];
  registry_source_name: string | null;
  registry_source_url: string | null;
  registry_checked_at: string | null;
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
    | 'special'
    | 'president'
    | 'legislative_district'
    | 'councilor_district'
    | 'local_chief'
    | 'township_representative_district'
    | 'village_chief'
    | 'indigenous';
  parent_region_id: string | null;
  official_code: string | null;
  map_code: string | null;
  display_order: number | null;
};

export type PublicElection = {
  election_id: string;
  name: string;
  year: number | null;
  election_type:
    | 'presidential'
    | 'legislative'
    | 'local'
    | 'recall'
    | 'referendum'
    | 'by_election'
    | 'other'
    | 'president'
    | 'legislator'
    | 'councilor'
    | 'local_chief'
    | 'township_representative'
    | 'village_chief';
  voting_date: string | null;
  status: 'draft' | 'announced' | 'upcoming' | 'active' | 'completed' | 'cancelled' | 'unknown';
  source_name: string | null;
  source_url: string | null;
};

export type PublicElectionRaceSummary = {
  election_id: string;
  race_count: number;
  race_types: PublicRace['race_type'][];
};

export type PublicElectionRaceFacet = {
  election_id: string;
  race_type: PublicRace['race_type'];
  region_key: string;
  region_label: string;
  race_count: number;
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
    | 'other'
    | 'legislative_district'
    | 'councilor_district'
    | 'local_chief'
    | 'township_representative_district'
    | 'indigenous';
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

export type PublicReferendumQuestion = {
  question_id: string;
  race_id: string;
  election_id: string;
  referendum_type: 'national' | 'constitutional' | 'local';
  case_number: number;
  jurisdiction_name: string;
  proposal_text: string;
  result_status: 'passed' | 'not_passed' | 'pending' | 'cancelled';
  eligible_voters: number | null;
  total_votes: number | null;
  valid_votes: number | null;
  invalid_votes: number | null;
  turnout_rate: number | null;
  approval_rule: string | null;
  source_name: string;
  source_url: string;
  source_document_url: string | null;
  updated_at: string;
};

export type PublicReferendumOption = {
  option_id: string;
  question_id: string;
  race_id: string;
  option_code: 'yes' | 'no';
  label: string;
  vote_count: number | null;
  vote_rate: number | null;
  display_order: number;
  updated_at: string;
};

export type PublicReferendumRegionResult = {
  result_id: string;
  question_id: string;
  race_id: string;
  region_id: string;
  region_name: string;
  region_slug: string;
  eligible_voters: number | null;
  yes_votes: number | null;
  no_votes: number | null;
  invalid_votes: number | null;
  turnout_rate: number | null;
  source_name: string;
  source_url: string;
  updated_at: string;
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
  election_year: number | null;
  region_id: string | null;
  region_name: string | null;
  party: string | null;
  candidate_no: string | null;
  registration_status: 'pending' | 'registered' | 'qualified' | 'disqualified' | 'withdrawn' | 'elected' | 'not_elected' | 'unknown';
  candidacy_status: 'potential' | 'party_nominee' | 'officially_announced' | 'registered' | 'qualified' | 'withdrawn_or_disqualified' | 'unknown';
  election_result: 'pending' | 'elected' | 'not_elected' | 'unknown';
  status_updated_at: string | null;
  candidate_updated_at: string | null;
  vote_count: number | null;
  vote_rate: number | null;
  is_elected: boolean | null;
  is_incumbent: boolean | null;
  source_name: string | null;
  source_url: string | null;
  primary_photo_url: string | null;
  primary_photo_thumbnail_url: string | null;
  photo_attribution: string | null;
  photo_license_type: string | null;
};

export type PublicPartyElectionPerformance = {
  party_name: string;
  candidate_count: number;
  elected_count: number;
  pending_count: number;
};

export type PublicPartyLegalStatistics = {
  party_name: string;
  total_people: number;
  final_conviction_people: number;
  non_final_people: number;
  other_record_people: number;
  acquittal_only_people: number;
  no_confirmed_record_people: number;
  confirmed_record_people: number;
  record_count: number;
  final_conviction_records: number;
  non_final_records: number;
  other_records: number;
  acquittal_records: number;
};

export type PublicPartyPeopleStatisticDimension =
  | 'current_status'
  | 'gender'
  | 'age'
  | 'education';

export type PublicPartyPeopleStatisticBucket =
  | 'current'
  | 'not_current'
  | 'male'
  | 'female'
  | 'under_40'
  | '40_49'
  | '50_59'
  | '60_plus'
  | 'doctorate'
  | 'master'
  | 'university'
  | 'tertiary_unspecified'
  | 'junior_college'
  | 'high_school'
  | 'secondary_or_below'
  | 'other'
  | 'unknown';

export type PublicPartyPeopleStatisticRow = {
  party_name: string;
  dimension_key: PublicPartyPeopleStatisticDimension;
  bucket_key: PublicPartyPeopleStatisticBucket;
  people_count: number;
  total_people: number;
};

export type PublicElectionEducationDistribution = {
  education_key:
    | 'doctorate'
    | 'master'
    | 'university'
    | 'tertiary_unspecified'
    | 'junior_college'
    | 'high_school'
    | 'secondary_or_below'
    | 'other'
    | 'unknown';
  candidate_count: number;
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

export type PublicPersonIdentitySource = {
  identity_source_id: string;
  person_id: string;
  person_name: string;
  source_type:
    | 'official_election'
    | 'official_officeholder'
    | 'official_party_finance'
    | 'government_open_data'
    | 'court_document'
    | 'media_guide'
    | 'wikipedia'
    | 'wikidata'
    | 'official_site'
    | 'social_media'
    | 'public_reference'
    | 'other';
  source_name: string;
  source_url: string | null;
  raw_name: string;
  normalized_name: string;
  party: string | null;
  position: string | null;
  district: string | null;
  election_year: number | null;
  match_status: 'auto_matched';
  match_score: number;
  confidence_suggestion: PublicRelationDetail['confidence_level'];
  updated_at: string;
};

export type PublicPersonClaim = {
  claim_id: string;
  person_id: string;
  candidate_id?: string | null;
  claim_type:
    | 'name'
    | 'alias'
    | 'gender'
    | 'birth_date'
    | 'party'
    | 'party_affiliation'
    | 'position'
    | 'office'
    | 'candidacy'
    | 'district'
    | 'education'
    | 'experience'
    | 'platform'
    | 'finance_summary'
    | 'legal_case'
    | 'family_relation'
    | 'media'
    | 'external_id'
    | 'other';
  claim_value: string | null;
  claim_json: Record<string, unknown>;
  confidence_level: PublicRelationDetail['confidence_level'];
  review_score: number;
  source_name: string | null;
  source_url: string | null;
  observed_at: string | null;
  updated_at: string;
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

export type PublicPartyAnnualFinanceFiling = {
  party_id: string;
  party_name: string;
  report_year: number;
  filing_status: 'filed' | 'correction_required' | 'not_filed' | 'unknown';
  ratification_status: 'ratified' | 'not_ratified' | 'unknown';
  assembly_approval_status: 'approved' | 'not_approved' | 'unknown';
  detail_url: string;
  report_pdf_url: string | null;
  source_name: string;
  source_url: string;
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
  representative_name: string | null;
  director_names: string[];
  registry_source_name: string | null;
  registry_source_url: string | null;
  registry_checked_at: string | null;
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
  current_office_label: string | null;
  display_position_label: string | null;
  region_id: string | null;
  region_name: string | null;
  candidate_count: number;
  external_ids: string[];
  merged_person_ids: string[];
  merged_role_labels: string[];
  merged_candidate_count: number;
};

export type PublicCouncilorPartyCount = {
  party: string;
  count: number;
};

export type PublicPersonIdentityRecord = {
  person_id: string;
  name: string;
  party: string | null;
  position: string | null;
  district: string | null;
  role_label: string;
  status_label: string;
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

export type PublicNationalOfficeInstitution =
  | 'presidency'
  | 'executive_yuan'
  | 'legislative_yuan'
  | 'judicial_yuan'
  | 'examination_yuan'
  | 'control_yuan';

export type PublicNationalOfficeHolder = {
  institution_key: PublicNationalOfficeInstitution;
  role_key: 'chief' | 'deputy';
  holder_name: string | null;
  holder_person_id: string | null;
  party_name: string | null;
  tenure_status: 'current' | 'acting' | 'vacant';
  source_name: string;
  source_url: string;
  observed_at: string;
  display_order: number;
  updated_at: string;
};

export type PublicLegislatorPartySummary = {
  party_name: string;
  legislator_count: number;
};

export type PublicPersonTimelineItem = {
  id: string;
  year: number | null;
  date: string | null;
  label: string;
  detail: string | null;
  category: 'office' | 'candidacy' | 'party' | 'experience';
  status: 'current' | 'past' | 'candidate' | 'unknown';
  source_name: string | null;
  source_url: string | null;
  confidence_level: PublicRelationDetail['confidence_level'] | null;
};

export type PublicPersonProfile = {
  person: PublicPersonListItem;
  identity_records: PublicPersonIdentityRecord[];
  candidate_records: PublicCandidate[];
  party_affiliations: PublicPersonPartyAffiliation[];
  timeline_records: PublicPersonTimelineItem[];
  public_claims: PublicPersonClaim[];
  experience_status: 'available' | 'todo';
  contribution_status: 'available' | 'summary_only' | 'todo';
  platform_status: 'available' | 'todo';
  legal_record_status: 'review_required' | 'todo';
  family_relation_status: 'review_required' | 'todo';
};
