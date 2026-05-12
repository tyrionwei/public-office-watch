ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE relation_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_company_relations ENABLE ROW LEVEL SECURITY;

-- Public read: only verified and public relations
CREATE POLICY public_read_people ON people
FOR SELECT USING (is_public = TRUE);

CREATE POLICY public_read_companies ON companies
FOR SELECT USING (is_public = TRUE);

CREATE POLICY public_read_relations ON person_company_relations
FOR SELECT USING (verification_status = 'verified' AND is_public = TRUE);

-- Anonymous users cannot write
CREATE POLICY deny_anon_people_write ON people
FOR ALL USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY deny_anon_companies_write ON companies
FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- Importer role: write only raw/candidates
-- Replace `importer_role` and `admin_role` with actual DB roles in deployment.
CREATE POLICY importer_write_raw_source_records ON raw_source_records
FOR INSERT TO importer_role WITH CHECK (TRUE);

CREATE POLICY importer_write_relation_candidates ON relation_candidates
FOR INSERT TO importer_role WITH CHECK (
    review_status = 'pending'
);

CREATE POLICY admin_manage_people ON people
FOR ALL TO admin_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_manage_companies ON companies
FOR ALL TO admin_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_manage_relations ON person_company_relations
FOR ALL TO admin_role USING (TRUE) WITH CHECK (TRUE);
