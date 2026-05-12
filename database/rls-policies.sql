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

-- Anonymous users must not write any table.
CREATE POLICY deny_anon_people_write ON people
FOR ALL TO anon USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY deny_anon_companies_write ON companies
FOR ALL TO anon USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY deny_anon_source_documents_write ON source_documents
FOR ALL TO anon USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY deny_anon_raw_write ON raw_source_records
FOR ALL TO anon USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY deny_anon_candidates_write ON relation_candidates
FOR ALL TO anon USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY deny_anon_relations_write ON person_company_relations
FOR ALL TO anon USING (FALSE) WITH CHECK (FALSE);

-- Supabase role placeholders. Replace these with your actual deployment roles / auth strategy.
-- Example placeholders here:
--   importer_role => a backend-only role used by Importer / CI
--   admin_role    => trusted admin reviewer role
--
-- Supabase practical note:
-- In many real deployments, `service_role` bypasses RLS entirely.
-- If you use Supabase service_role from backend tooling, still keep app-layer guards:
--   1. Importer only writes raw_source_records / relation_candidates
--   2. Importer never writes verification_status='verified'
--   3. Importer never writes is_public=TRUE
--   4. Review + publish actions stay in a separate admin path

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

-- Anonymous and importer paths must not publish data directly.
-- Formal public state remains restricted to admin review flow:
--   verification_status = 'verified'
--   is_public = TRUE
