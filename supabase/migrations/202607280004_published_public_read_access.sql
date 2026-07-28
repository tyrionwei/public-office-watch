BEGIN;

GRANT USAGE ON SCHEMA published TO anon, authenticated;

GRANT SELECT ON TABLE
    published.candidates,
    published.election_race_facets,
    published.election_race_summaries,
    published.elections,
    published.home_region_summary,
    published.home_ticker,
    published.parties,
    published.party_company_contribution_summaries,
    published.party_finance_summaries,
    published.party_officers,
    published.people,
    published.people_directory,
    published.person_party_affiliations,
    published.races,
    published.regions,
    published.search_results
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.election_race_page(
    TEXT,
    UUID[],
    TEXT[],
    TEXT,
    INTEGER,
    INTEGER
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION published.person_claims_for(UUID[])
TO anon, authenticated;

REVOKE ALL ON FUNCTION published.promote(UUID)
FROM PUBLIC, anon, authenticated;

ALTER ROLE authenticator
SET pgrst.db_schemas = 'public, graphql_public, published';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

COMMIT;
