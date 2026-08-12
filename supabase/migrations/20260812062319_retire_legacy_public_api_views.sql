BEGIN;

-- Move the last dynamic public read behind a narrow published RPC before
-- retiring the legacy public views.
CREATE OR REPLACE FUNCTION published.chat_status()
RETURNS TABLE (
    is_enabled BOOLEAN,
    updated_at TIMESTAMPTZ,
    terms_version TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT settings.is_enabled, settings.updated_at, settings.terms_version
    FROM public.chat_settings AS settings
    WHERE settings.id = 1;
$$;

REVOKE ALL ON FUNCTION published.chat_status()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.chat_status()
TO anon, authenticated, service_role;

-- The browser read model now lives in published. Remove the legacy public
-- views from the Data API while preserving service-role maintenance access.
REVOKE ALL ON TABLE
    public.election_canonical_map,
    public.election_hierarchy_map,
    public.identity_probable_match_queue,
    public.identity_unmatched_source_people,
    public.legal_record_review_queue,
    public.person_canonical_map,
    public.person_claim_review_queue,
    public.person_duplicate_review_queue,
    public.person_identity_review_queue,
    public.public_candidates,
    public.public_chat_messages,
    public.public_chat_status,
    public.public_companies,
    public.public_election_race_facets,
    public.public_election_race_list,
    public.public_election_race_summaries,
    public.public_elections,
    public.public_home_election_ticker,
    public.public_parties,
    public.public_party_company_contribution_summaries,
    public.public_party_finance_summaries,
    public.public_party_officers,
    public.public_people,
    public.public_people_directory,
    public.public_people_list,
    public.public_people_list_cached,
    public.public_person_claims,
    public.public_person_identity_sources,
    public.public_person_party_affiliations,
    public.public_person_party_events,
    public.public_person_primary_photos,
    public.public_races,
    public.public_region_election_summary,
    public.public_region_issue_results,
    public.public_regions,
    public.public_relation_details,
    public.race_canonical_map
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.election_canonical_map,
    public.election_hierarchy_map,
    public.identity_probable_match_queue,
    public.identity_unmatched_source_people,
    public.legal_record_review_queue,
    public.person_canonical_map,
    public.person_claim_review_queue,
    public.person_duplicate_review_queue,
    public.person_identity_review_queue,
    public.public_candidates,
    public.public_chat_messages,
    public.public_chat_status,
    public.public_companies,
    public.public_election_race_facets,
    public.public_election_race_list,
    public.public_election_race_summaries,
    public.public_elections,
    public.public_home_election_ticker,
    public.public_parties,
    public.public_party_company_contribution_summaries,
    public.public_party_finance_summaries,
    public.public_party_officers,
    public.public_people,
    public.public_people_directory,
    public.public_people_list,
    public.public_people_list_cached,
    public.public_person_claims,
    public.public_person_identity_sources,
    public.public_person_party_affiliations,
    public.public_person_party_events,
    public.public_person_primary_photos,
    public.public_races,
    public.public_region_election_summary,
    public.public_region_issue_results,
    public.public_regions,
    public.public_relation_details,
    public.race_canonical_map
TO service_role;

-- New public-schema objects are private by default. Every future API surface
-- must opt in with an explicit grant in the same migration that creates it.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
