ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE relation_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_company_relations ENABLE ROW LEVEL SECURITY;

-- Public read: only public entities and verified public relations.
CREATE POLICY public_read_people ON people
FOR SELECT USING (is_public = TRUE);

CREATE POLICY public_read_companies ON companies
FOR SELECT USING (is_public = TRUE);

CREATE POLICY public_read_source_documents ON source_documents
FOR SELECT USING (is_public = TRUE);

CREATE POLICY public_read_relations ON person_company_relations
FOR SELECT USING (verification_status = 'verified' AND is_public = TRUE);

-- Placeholder roles below are examples only.
-- `importer_role` and `admin_role` must be replaced with real deployment roles before applying in Supabase.
-- Do not run this file unchanged in production.
--
-- Supabase practical note:
-- In many deployments, backend tooling uses `service_role`, which bypasses RLS.
-- Even then, application-layer rules must still guarantee:
--   1. Importer only writes raw_source_records / source_documents / relation_candidates
--   2. Importer never writes verification_status='verified'
--   3. Importer never writes is_public=TRUE
--   4. Review and publish actions remain separated into admin-only workflows

CREATE POLICY importer_write_raw_source_records ON raw_source_records
FOR INSERT TO importer_role WITH CHECK (TRUE);

CREATE POLICY importer_write_source_documents ON source_documents
FOR INSERT TO importer_role WITH CHECK (is_public = FALSE);

CREATE POLICY importer_write_relation_candidates ON relation_candidates
FOR INSERT TO importer_role WITH CHECK (
    review_status = 'pending'
);

CREATE POLICY importer_read_candidates ON relation_candidates
FOR SELECT TO importer_role USING (TRUE);

CREATE POLICY admin_manage_people ON people
FOR ALL TO admin_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_manage_companies ON companies
FOR ALL TO admin_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_manage_source_documents ON source_documents
FOR ALL TO admin_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_manage_relations ON person_company_relations
FOR ALL TO admin_role USING (TRUE) WITH CHECK (TRUE);

-- Public publish state remains admin-controlled only:
--   verification_status = 'verified'
--   is_public = TRUE
--
-- Anonymous read access is intentionally narrow and only covered by the SELECT
-- policies above. This file avoids broad deny-all patterns that are easy to
-- misread during review.