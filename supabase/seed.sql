-- Local Supabase browser validation only.
-- `supabase db push` applies migrations, not this seed file. Production grants remain revoked.
GRANT USAGE ON SCHEMA published TO anon, authenticated;

GRANT SELECT ON TABLE
  published.active_party_candidates,
  published.candidates,
  published.election_race_facets,
  published.election_race_summaries,
  published.elections,
  published.home_candidate_summaries,
  published.home_region_summary,
  published.home_ticker,
  published.current_legislator_party_summary,
  published.national_office_holders,
  published.parties,
  published.party_annual_finance_filings,
  published.party_company_contribution_summaries,
  published.party_finance_summaries,
  published.party_officers,
  published.people,
  published.people_directory,
  published.person_party_affiliations,
  published.races,
  published.referendum_options,
  published.referendum_questions,
  published.referendum_region_results,
  published.regions,
  published.search_results,
  published.update_feed
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.chat_messages(TIMESTAMPTZ, UUID, INTEGER)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.get_person_feedback_context(UUID, TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.submit_person_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.chat_status()
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.region_issue_results(UUID, TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.get_region_issue_response(UUID, TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.submit_region_issue_response(UUID, TEXT, UUID[])
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.election_race_page(
  TEXT,
  UUID[],
  TEXT[],
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

GRANT EXECUTE ON FUNCTION published.person_claims_for(UUID[])
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.party_legal_statistics(TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.party_people_statistics(TEXT)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.search_public_records(TEXT, INTEGER)
TO anon, authenticated;
