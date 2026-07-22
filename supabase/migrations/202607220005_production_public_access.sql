ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_manage_regions ON regions;
CREATE POLICY admin_manage_regions
    ON regions
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS admin_manage_elections ON elections;
CREATE POLICY admin_manage_elections
    ON elections
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS admin_manage_races ON races;
CREATE POLICY admin_manage_races
    ON races
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS admin_manage_candidates ON candidates;
CREATE POLICY admin_manage_candidates
    ON candidates
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS admin_manage_person_media ON person_media;
CREATE POLICY admin_manage_person_media
    ON person_media
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON
    public_people,
    public_people_list,
    public_people_list_cached,
    public_companies,
    public_relation_details,
    public_regions,
    public_elections,
    public_election_race_summaries,
    public_election_race_facets,
    public_election_race_list,
    public_races,
    public_candidates,
    public_home_election_ticker,
    public_region_election_summary,
    public_region_issue_results,
    public_person_primary_photos,
    public_person_identity_sources,
    public_person_claims,
    public_person_party_affiliations,
    public_parties,
    public_party_finance_summaries,
    public_party_company_contribution_summaries
TO anon, authenticated;

REVOKE ALL ON
    people,
    companies,
    raw_source_records,
    source_documents,
    relation_candidates,
    person_company_relations,
    regions,
    elections,
    races,
    candidates,
    person_media,
    source_people,
    person_identity_matches,
    person_claims,
    person_merge_decisions,
    person_party_affiliations,
    race_merge_decisions,
    election_merge_decisions,
    candidate_status_history,
    data_sync_runs,
    legal_record_leads,
    current_office_exclusions,
    region_issues,
    region_issue_responses,
    person_feedback_submissions
FROM anon, authenticated;
