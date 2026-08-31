-- Local Supabase browser validation only.
-- `supabase db push` applies migrations, not this seed file. Production grants remain revoked.
GRANT USAGE ON SCHEMA published TO anon, authenticated;

GRANT SELECT ON TABLE
  published.active_party_candidates,
  published.current_legislator_party_summary,
  published.election_race_facets,
  published.national_office_holders,
  published.parties,
  published.party_annual_finance_filings,
  published.party_company_contribution_summaries,
  published.party_finance_summaries,
  published.party_officers,
  published.people_directory,
  published.regions,
  published.update_feed
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.chat_messages(TIMESTAMPTZ, UUID, INTEGER)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.person_feedback_priorities(UUID)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.get_person_feedback_own_submissions(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION published.get_person_feedback_context(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
TO authenticated;

GRANT EXECUTE ON FUNCTION published.chat_status()
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.region_issue_results(UUID, TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.get_region_issue_response(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION published.submit_region_issue_response(UUID, UUID[])
TO authenticated;

GRANT EXECUTE ON FUNCTION published.election_race_page(
  TEXT,
  UUID[],
  TEXT[],
  TEXT,
  TEXT,
  INTEGER,
  INTEGER
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.election_education_distribution(
  TEXT,
  UUID[],
  TEXT[],
  TEXT
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.election_party_performance(
  TEXT,
  UUID[],
  TEXT[],
  TEXT
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.home_page_for(TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.election_index_page()
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.person_profiles_for(UUID[])
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.race_page_for(UUID)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.party_list_race_page_for(UUID)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.seo_catalog_page(TEXT, INTEGER, INTEGER)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.region_page_for(TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.party_legal_statistics(TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.party_people_statistics(TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.search_public_records(TEXT, INTEGER)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.chat_messages(UUID, TIMESTAMPTZ, UUID, INTEGER, TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.chat_rooms(UUID, TEXT, UUID)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.chat_room_directory()
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.platform_fulfillment_results(UUID)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.get_platform_fulfillment_votes(UUID)
TO authenticated;
