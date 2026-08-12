BEGIN;

-- Maintenance functions run with the owner privileges and must never be
-- callable through the public Data API. PostgreSQL grants EXECUTE to PUBLIC
-- by default when a function is created, so revoke both inherited and any
-- explicit grants before restoring the service-only contract.
REVOKE ALL ON FUNCTION public.process_high_confidence_identity_reviews()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_context_disambiguated_identities()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_unique_career_progression_identities()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_public_people_list_cached()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_high_confidence_identity_reviews()
TO service_role;
GRANT EXECUTE ON FUNCTION public.process_context_disambiguated_identities()
TO service_role;
GRANT EXECUTE ON FUNCTION public.process_unique_career_progression_identities()
TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_public_people_list_cached()
TO service_role;
-- Views created by the local Supabase defaults inherited write privileges fo
-- API roles. Keep the documented public surfaces readable, but never writable.
REVOKE ALL ON TABLE
    public.election_hierarchy_map,
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
    public.public_person_claims,
    public.public_person_identity_sources,
    public.public_person_party_affiliations,
    public.public_person_party_events,
    public.public_person_primary_photos,
    public.public_races,
    public.public_region_election_summary,
    public.public_region_issue_results,
    public.public_regions,
    public.public_relation_details
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.election_hierarchy_map,
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
    public.public_person_claims,
    public.public_person_identity_sources,
    public.public_person_party_affiliations,
    public.public_person_party_events,
    public.public_person_primary_photos,
    public.public_races,
    public.public_region_election_summary,
    public.public_region_issue_results,
    public.public_regions,
    public.public_relation_details
TO anon, authenticated;

-- Review queues and canonical maps are maintenance-only surfaces. They expose
-- unpublished identity and legal-review data and are not used by the web app.
REVOKE ALL ON TABLE
    public.election_canonical_map,
    public.identity_probable_match_queue,
    public.identity_unmatched_source_people,
    public.legal_record_review_queue,
    public.person_canonical_map,
    public.person_claim_review_queue,
    public.person_duplicate_review_queue,
    public.person_identity_review_queue,
    public.race_canonical_map
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.election_canonical_map,
    public.identity_probable_match_queue,
    public.identity_unmatched_source_people,
    public.legal_record_review_queue,
    public.person_canonical_map,
    public.person_claim_review_queue,
    public.person_duplicate_review_queue,
    public.person_identity_review_queue,
    public.race_canonical_map
TO service_role;

-- Import policies were accidentally created for PUBLIC. Existing table grants
-- already restrict writes to the service role; encode that boundary in RLS too.
DROP POLICY IF EXISTS importer_write_person_party_affiliations
ON public.person_party_affiliations;
CREATE POLICY importer_write_person_party_affiliations
ON public.person_party_affiliations
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS importer_write_person_party_events
ON public.person_party_events;
CREATE POLICY importer_write_person_party_events
ON public.person_party_events
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- Pin name resolution for the functions reported by the database advisor.
ALTER FUNCTION public.candidate_candidacy_status_from_legacy(TEXT)
SET search_path = pg_catalog;
ALTER FUNCTION public.candidate_election_result_from_legacy(TEXT, BOOLEAN)
SET search_path = pg_catalog;
ALTER FUNCTION public.normalize_candidate_status_fields()
SET search_path = public, pg_temp;
ALTER FUNCTION public.record_candidate_status_history()
SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_election_district_label(TEXT)
SET search_path = pg_catalog;

REVOKE ALL ON FUNCTION public.normalize_candidate_status_fields()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_candidate_status_history()
FROM PUBLIC, anon, authenticated;

-- Trigger functions do not need direct API execution. Revoking these grants
-- does not disable their existing triggers.
REVOKE ALL ON FUNCTION public.broadcast_chat_moderation_change()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_chat_profile_moderation_change()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_chat_status_change()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_public_chat_message()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_election_district_fields()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_party_affiliation_column()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_party_column()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_party_registry_name()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_source_party_column()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_hidden_chat_reply()
FROM PUBLIC, anon, authenticated;

COMMIT;
