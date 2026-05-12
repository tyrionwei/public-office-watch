ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE relation_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_company_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_people
    ON people
    FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY public_read_companies
    ON companies
    FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY public_read_source_documents
    ON source_documents
    FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY public_read_relations
    ON person_company_relations
    FOR SELECT
    USING (verification_status = 'verified' AND is_public = TRUE);

-- Placeholder roles below are examples only.
-- `importer_role` and `admin_role` must be replaced with real deployment roles
-- before use in Supabase or any production PostgreSQL deployment.
-- Do not apply this file unchanged to production.
--
-- Supabase practical note:
-- `service_role` commonly bypasses RLS.
-- Therefore application-layer rules must still enforce that Importer:
--   1. only writes raw_source_records / source_documents / relation_candidates
--   2. never writes verification_status='verified'
--   3. never writes is_public=TRUE
--   4. never writes person_company_relations

CREATE POLICY importer_write_raw_source_records
    ON raw_source_records
    FOR INSERT
    TO importer_role
    WITH CHECK (TRUE);

CREATE POLICY importer_write_source_documents
    ON source_documents
    FOR INSERT
    TO importer_role
    WITH CHECK (is_public = FALSE);

CREATE POLICY importer_write_relation_candidates
    ON relation_candidates
    FOR INSERT
    TO importer_role
    WITH CHECK (review_status = 'pending');

CREATE POLICY importer_read_relation_candidates
    ON relation_candidates
    FOR SELECT
    TO importer_role
    USING (TRUE);

CREATE POLICY admin_manage_people
    ON people
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_companies
    ON companies
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_source_documents
    ON source_documents
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_relations
    ON person_company_relations
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_regions
    ON regions
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_elections
    ON elections
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_races
    ON races
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_candidates
    ON candidates
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_person_media
    ON person_media
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- Public publication remains admin-controlled only:
--   verification_status = 'verified'
--   is_public = TRUE
--   candidates.is_public must remain FALSE until manually confirmed
-- Frontend should read public_* views only, not relation_candidates/raw_source_records/candidates base tables.
