export const allowedPublicViews = [
  'public_people',
  'public_companies',
  'public_relation_details',
  'public_regions',
  'public_elections',
  'public_races',
  'public_candidates',
  'public_home_election_ticker',
  'public_region_election_summary',
  'public_person_primary_photos',
  'public_person_identity_sources',
  'public_person_claims',
  'public_parties',
  'public_party_finance_summaries',
  'public_party_company_contribution_summaries',
] as const;

export type AllowedPublicViewName = (typeof allowedPublicViews)[number];

export const blockedInternalTables = [
  'relation_candidates',
  'raw_source_records',
  'source_documents',
  'person_media',
  'source_people',
  'person_identity_matches',
  'person_claims',
  'identity_unmatched_source_people',
  'party_finance_reports',
  'party_company_contributions',
  'pending',
  'rejected',
] as const;

export function isAllowedPublicViewName(name: string): name is AllowedPublicViewName {
  return (allowedPublicViews as readonly string[]).includes(name);
}

export function assertPublicViewName(name: string): asserts name is AllowedPublicViewName {
  if ((blockedInternalTables as readonly string[]).includes(name)) {
    throw new Error(`Blocked internal data source: ${name}. Frontend data access is limited to approved public views.`);
  }

  if (!isAllowedPublicViewName(name)) {
    throw new Error(`Unsupported data source: ${name}. Frontend data access is limited to approved public views.`);
  }
}
