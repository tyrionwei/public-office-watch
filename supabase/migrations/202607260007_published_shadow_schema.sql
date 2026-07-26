BEGIN;

CREATE SCHEMA published AUTHORIZATION postgres;

COMMENT ON SCHEMA published IS
    'Shadow read layer populated only by trusted promote operations. Not exposed to frontend roles in this migration.';

REVOKE ALL ON SCHEMA published FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA published TO service_role;

CREATE TABLE published.regions AS
SELECT * FROM public.public_regions WITH NO DATA;

CREATE TABLE published.elections AS
SELECT * FROM public.public_elections WITH NO DATA;

CREATE TABLE published.races AS
SELECT * FROM public.public_election_race_list WITH NO DATA;

CREATE TABLE published.candidates AS
SELECT * FROM public.public_candidates WITH NO DATA;

CREATE TABLE published.people AS
SELECT * FROM public.public_people_directory WITH NO DATA;

CREATE TABLE published.companies AS
SELECT * FROM public.public_companies WITH NO DATA;

CREATE TABLE published.parties AS
SELECT * FROM public.public_parties WITH NO DATA;

CREATE TABLE published.person_claims AS
SELECT * FROM public.public_person_claims WITH NO DATA;

CREATE TABLE published.person_party_affiliations AS
SELECT * FROM public.public_person_party_affiliations WITH NO DATA;

CREATE TABLE published.person_party_events AS
SELECT * FROM public.public_person_party_events WITH NO DATA;

CREATE TABLE published.person_identity_sources AS
SELECT * FROM public.public_person_identity_sources WITH NO DATA;

CREATE TABLE published.relation_details AS
SELECT * FROM public.public_relation_details WITH NO DATA;

CREATE TABLE published.party_finance_summaries AS
SELECT * FROM public.public_party_finance_summaries WITH NO DATA;

CREATE TABLE published.party_company_contribution_summaries AS
SELECT * FROM public.public_party_company_contribution_summaries WITH NO DATA;

ALTER TABLE published.regions
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.elections
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.races
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.candidates
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.people
    ADD COLUMN candidate_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN latest_candidacy JSONB,
    ADD COLUMN primary_region_id UUID,
    ADD COLUMN primary_region_name TEXT,
    ADD COLUMN primary_region_slug TEXT,
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.companies
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.parties
    ADD COLUMN normalized_name TEXT,
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.person_claims
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.person_party_affiliations
    ADD COLUMN normalized_party TEXT,
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.person_party_events
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.person_identity_sources
    ADD COLUMN observed_year INT,
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.relation_details
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.party_finance_summaries
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;
ALTER TABLE published.party_company_contribution_summaries
    ADD COLUMN published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN source_updated_at TIMESTAMPTZ;

ALTER TABLE published.regions ADD PRIMARY KEY (region_id);
ALTER TABLE published.elections ADD PRIMARY KEY (election_id);
ALTER TABLE published.races ADD PRIMARY KEY (race_id);
ALTER TABLE published.candidates ADD PRIMARY KEY (candidate_id);
ALTER TABLE published.people ADD PRIMARY KEY (person_id);
ALTER TABLE published.companies ADD PRIMARY KEY (company_id);
ALTER TABLE published.parties ADD PRIMARY KEY (party_id);
ALTER TABLE published.person_claims ADD PRIMARY KEY (claim_id);
ALTER TABLE published.person_party_affiliations ADD PRIMARY KEY (affiliation_id);
ALTER TABLE published.person_party_events ADD PRIMARY KEY (event_id);
ALTER TABLE published.person_identity_sources ADD PRIMARY KEY (identity_source_id);
ALTER TABLE published.relation_details ADD PRIMARY KEY (relation_id);
ALTER TABLE published.party_finance_summaries ADD PRIMARY KEY (party_id, report_year);
ALTER TABLE published.party_company_contribution_summaries
    ADD PRIMARY KEY (party_id, company_id, report_year);

ALTER TABLE published.regions
    ADD FOREIGN KEY (parent_region_id) REFERENCES published.regions(region_id);
ALTER TABLE published.races
    ADD FOREIGN KEY (election_id) REFERENCES published.elections(election_id),
    ADD FOREIGN KEY (region_id) REFERENCES published.regions(region_id);
ALTER TABLE published.candidates
    ADD FOREIGN KEY (person_id) REFERENCES published.people(person_id),
    ADD FOREIGN KEY (race_id) REFERENCES published.races(race_id),
    ADD FOREIGN KEY (election_id) REFERENCES published.elections(election_id),
    ADD FOREIGN KEY (region_id) REFERENCES published.regions(region_id);
ALTER TABLE published.people
    ADD FOREIGN KEY (primary_region_id) REFERENCES published.regions(region_id);
ALTER TABLE published.person_claims
    ADD FOREIGN KEY (person_id) REFERENCES published.people(person_id);
ALTER TABLE published.person_party_affiliations
    ADD FOREIGN KEY (person_id) REFERENCES published.people(person_id);
ALTER TABLE published.person_party_events
    ADD FOREIGN KEY (person_id) REFERENCES published.people(person_id);
ALTER TABLE published.person_identity_sources
    ADD FOREIGN KEY (person_id) REFERENCES published.people(person_id);
ALTER TABLE published.relation_details
    ADD FOREIGN KEY (person_id) REFERENCES published.people(person_id),
    ADD FOREIGN KEY (company_id) REFERENCES published.companies(company_id);
ALTER TABLE published.party_finance_summaries
    ADD FOREIGN KEY (party_id) REFERENCES published.parties(party_id);
ALTER TABLE published.party_company_contribution_summaries
    ADD FOREIGN KEY (party_id) REFERENCES published.parties(party_id),
    ADD FOREIGN KEY (company_id) REFERENCES published.companies(company_id);

CREATE UNIQUE INDEX regions_slug_idx ON published.regions (slug);
CREATE INDEX regions_type_order_idx
    ON published.regions (region_type, display_order, region_id);
CREATE INDEX regions_parent_idx ON published.regions (parent_region_id);

CREATE INDEX elections_voting_date_idx
    ON published.elections (voting_date, election_id);
CREATE INDEX elections_type_status_idx
    ON published.elections (election_type, status);

CREATE INDEX races_election_idx ON published.races (election_id);
CREATE INDEX races_region_idx ON published.races (region_id);
CREATE INDEX races_status_voting_date_idx
    ON published.races (status, voting_date, race_id);
CREATE INDEX races_event_order_idx ON published.races (
    event_key,
    sort_category_order,
    sort_region_order,
    sort_district_order ASC NULLS FIRST,
    region_name,
    title,
    race_id
);

CREATE INDEX candidates_election_idx ON published.candidates (election_id);
CREATE INDEX candidates_race_idx
    ON published.candidates (race_id, candidate_no, person_name, candidate_id);
CREATE INDEX candidates_person_history_idx
    ON published.candidates (person_id, election_year DESC, race_id);

CREATE INDEX people_directory_order_idx ON published.people (
    list_is_grassroots,
    list_is_party_only,
    list_status_order,
    list_role_order,
    name,
    person_id
);
CREATE INDEX people_party_status_idx
    ON published.people (party, list_status, name, person_id);
CREATE INDEX people_primary_region_idx
    ON published.people (primary_region_id, name, person_id);

CREATE UNIQUE INDEX companies_business_no_idx
    ON published.companies (unified_business_no)
    WHERE unified_business_no IS NOT NULL;
CREATE UNIQUE INDEX parties_slug_idx ON published.parties (slug);
CREATE INDEX parties_normalized_name_idx ON published.parties (normalized_name);

CREATE INDEX person_claims_person_observed_idx
    ON published.person_claims (person_id, observed_at DESC, claim_id);
CREATE INDEX person_party_affiliations_person_current_idx
    ON published.person_party_affiliations (person_id, is_current, display_order, affiliation_id);
CREATE INDEX person_party_affiliations_normalized_party_idx
    ON published.person_party_affiliations (normalized_party, is_current, affiliation_id);
CREATE INDEX person_party_events_person_date_idx
    ON published.person_party_events (person_id, event_date DESC, event_id);
CREATE INDEX person_identity_sources_person_year_idx
    ON published.person_identity_sources (person_id, observed_year DESC, identity_source_id);
CREATE INDEX relation_details_person_idx
    ON published.relation_details (person_id, relation_id);
CREATE INDEX relation_details_company_idx
    ON published.relation_details (company_id, relation_id);
CREATE INDEX party_finance_party_year_idx
    ON published.party_finance_summaries (party_id, report_year DESC);
CREATE INDEX party_company_party_year_idx
    ON published.party_company_contribution_summaries (party_id, report_year DESC, company_id);
CREATE INDEX party_company_company_idx
    ON published.party_company_contribution_summaries (company_id, report_year DESC, party_id);

CREATE TABLE published.release_state (
    state_key TEXT PRIMARY KEY CHECK (state_key = 'current'),
    release_id UUID NOT NULL,
    promoted_at TIMESTAMPTZ NOT NULL,
    source_sync_run_id UUID,
    schema_version TEXT NOT NULL,
    validated_row_counts JSONB NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON ALL TABLES IN SCHEMA published FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    ON ALL TABLES IN SCHEMA published TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA published
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA published
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO service_role;

COMMENT ON TABLE published.release_state IS
    'Singleton release metadata written only after a complete promote validation succeeds.';

COMMIT;
