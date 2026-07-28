BEGIN;

CREATE SCHEMA published AUTHORIZATION postgres;

COMMENT ON SCHEMA published IS
    'Compact hybrid public read boundary. Expensive candidate reads are snapshotted; reviewed low-frequency data stays behind security-barrier views.';

REVOKE ALL ON SCHEMA published FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA published TO service_role;

-- The canonical candidate graph is the measured production bottleneck. Long
-- source and photo fields are joined by stable IDs instead of repeated 42k times.
CREATE TABLE published.candidate_facts AS
SELECT
    candidate_id,
    person_id,
    person_name,
    person_party,
    person_position,
    race_id,
    race_title,
    election_id,
    election_name,
    region_id,
    region_name,
    party,
    candidate_no,
    registration_status,
    vote_count,
    vote_rate,
    is_elected,
    is_incumbent,
    election_year,
    candidacy_status,
    election_result,
    status_updated_at,
    candidate_updated_at
FROM public.public_candidates
WITH NO DATA;

ALTER TABLE published.candidate_facts ADD PRIMARY KEY (candidate_id);
CREATE INDEX candidate_facts_election_idx
    ON published.candidate_facts (election_id);
CREATE INDEX candidate_facts_race_idx
    ON published.candidate_facts (race_id, candidate_no, person_name, candidate_id);
CREATE INDEX candidate_facts_person_history_idx
    ON published.candidate_facts (person_id, election_year DESC, race_id, candidate_id);

CREATE VIEW published.candidates WITH (security_barrier = true) AS
SELECT
    facts.*,
    core.source_name,
    core.source_url,
    photo.photo_url AS primary_photo_url,
    photo.thumbnail_url AS primary_photo_thumbnail_url,
    photo.attribution AS photo_attribution,
    photo.license_type AS photo_license_type
FROM published.candidate_facts facts
LEFT JOIN public.candidates core ON core.id = facts.candidate_id
LEFT JOIN public.public_person_primary_photos photo ON photo.person_id = facts.person_id;

-- These relations are already reviewed public projections and are not measured
-- hot-path bottlenecks. Security-barrier views keep the frontend namespace small
-- without duplicating hundreds of megabytes of source data.
CREATE VIEW published.regions WITH (security_barrier = true) AS
SELECT * FROM public.public_regions;

CREATE VIEW published.elections WITH (security_barrier = true) AS
SELECT * FROM public.public_elections;

CREATE VIEW published.races WITH (security_barrier = true) AS
SELECT * FROM public.public_election_race_list;

CREATE VIEW published.companies WITH (security_barrier = true) AS
SELECT * FROM public.public_companies;

CREATE VIEW published.parties WITH (security_barrier = true) AS
SELECT
    source.*,
    LOWER(REGEXP_REPLACE(REPLACE(source.name, '臺', '台'), '[[:space:]]+', '', 'g')) AS normalized_name
FROM public.public_parties source;

CREATE VIEW published.person_claims WITH (security_barrier = true) AS
SELECT * FROM public.public_person_claims;

CREATE VIEW published.person_party_affiliations WITH (security_barrier = true) AS
SELECT
    source.*,
    LOWER(REGEXP_REPLACE(REPLACE(source.party_name, '臺', '台'), '[[:space:]]+', '', 'g')) AS normalized_party
FROM public.public_person_party_affiliations source;

CREATE VIEW published.person_party_events WITH (security_barrier = true) AS
SELECT * FROM public.public_person_party_events;

CREATE VIEW published.person_identity_sources WITH (security_barrier = true) AS
SELECT DISTINCT ON (source.identity_source_id)
    source.*,
    source.election_year AS observed_year
FROM public.public_person_identity_sources source
ORDER BY
    source.identity_source_id,
    source.match_score DESC NULLS LAST,
    source.updated_at DESC NULLS LAST,
    source.person_id;

CREATE VIEW published.relation_details WITH (security_barrier = true) AS
SELECT * FROM public.public_relation_details;

CREATE VIEW published.party_finance_summaries WITH (security_barrier = true) AS
SELECT * FROM public.public_party_finance_summaries;

CREATE VIEW published.party_company_contribution_summaries WITH (security_barrier = true) AS
SELECT * FROM public.public_party_company_contribution_summaries;

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
GRANT SELECT ON ALL TABLES IN SCHEMA published TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA published
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA published
    GRANT SELECT ON TABLES TO service_role;

COMMENT ON TABLE published.candidate_facts IS
    'Atomic narrow snapshot of the expensive canonical public candidate graph.';
COMMENT ON TABLE published.release_state IS
    'Singleton release metadata written only after compact hybrid promote validation succeeds.';

COMMIT;
