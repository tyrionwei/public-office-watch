CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    alias TEXT,
    party TEXT,
    position TEXT,
    election_year INT,
    district TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unified_business_no TEXT UNIQUE,
    name TEXT NOT NULL,
    representative_name TEXT,
    status TEXT,
    capital NUMERIC,
    address_region TEXT,
    source_url TEXT,
    last_checked_at TIMESTAMPTZ,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE raw_source_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    raw_text TEXT,
    raw_json JSONB,
    raw_html_hash TEXT,
    crawler_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE source_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    source_date DATE,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    snapshot_hash TEXT,
    raw_record_id UUID REFERENCES raw_source_records(id),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE relation_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    unified_business_no TEXT,
    guessed_relation_type TEXT NOT NULL CHECK (
        guessed_relation_type IN (
            'SelfDeclaredInvestment',
            'SpouseDeclaredInvestment',
            'MinorChildDeclaredInvestment',
            'CompanyDirector',
            'CompanyRepresentative',
            'PoliticalDonation',
            'GovernmentProcurement',
            'NewsMention',
            'CourtDocumentMention',
            'ManualResearchLead'
        )
    ),
    confidence_suggestion TEXT NOT NULL CHECK (
        confidence_suggestion IN ('A', 'B', 'C', 'D')
    ),
    evidence_text TEXT NOT NULL,
    source_record_id UUID REFERENCES raw_source_records(id),
    source_url TEXT,
    review_status TEXT DEFAULT 'pending' CHECK (
        review_status IN (
            'pending',
            'verified',
            'rejected',
            'needs_more_evidence',
            'archived'
        )
    ),
    review_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE person_company_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    relation_type TEXT NOT NULL CHECK (
        relation_type IN (
            'SelfDeclaredInvestment',
            'SpouseDeclaredInvestment',
            'MinorChildDeclaredInvestment',
            'CompanyDirector',
            'CompanyRepresentative',
            'PoliticalDonation',
            'GovernmentProcurement',
            'NewsMention',
            'CourtDocumentMention',
            'ManualResearchLead'
        )
    ),
    confidence_level TEXT NOT NULL CHECK (
        confidence_level IN ('A', 'B', 'C', 'D')
    ),
    evidence_source_id UUID REFERENCES source_documents(id),
    evidence_text TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK (
        verification_status IN (
            'pending',
            'verified',
            'rejected',
            'needs_more_evidence',
            'archived'
        )
    ),
    is_public BOOLEAN DEFAULT FALSE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_name
    ON people(name);

CREATE INDEX idx_people_party_position
    ON people(party, position);

CREATE INDEX idx_companies_name
    ON companies(name);

CREATE INDEX idx_companies_unified_business_no
    ON companies(unified_business_no);

CREATE INDEX idx_raw_source_records_source_type_fetched_at
    ON raw_source_records(source_type, fetched_at DESC);

CREATE INDEX idx_source_documents_source_type_source_date
    ON source_documents(source_type, source_date DESC);

CREATE INDEX idx_relation_candidates_person_company
    ON relation_candidates(person_name, company_name);

CREATE INDEX idx_relation_candidates_review_status
    ON relation_candidates(review_status);

CREATE INDEX idx_relation_candidates_source_record_id
    ON relation_candidates(source_record_id);

CREATE INDEX idx_person_company_relations_person_id
    ON person_company_relations(person_id);

CREATE INDEX idx_person_company_relations_company_id
    ON person_company_relations(company_id);

CREATE INDEX idx_person_company_relations_verification_public
    ON person_company_relations(verification_status, is_public);

CREATE UNIQUE INDEX uq_person_company_relations_official_relation
    ON person_company_relations(person_id, company_id, relation_type, evidence_source_id);

CREATE VIEW public_people AS
SELECT
    p.id AS person_id,
    p.name,
    p.alias,
    p.party,
    p.position,
    p.election_year,
    p.district,
    p.updated_at,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.source_name AS photo_source_name,
    ph.source_url AS photo_source_url,
    ph.license_type AS photo_license_type,
    ph.license_url AS photo_license_url,
    ph.attribution AS photo_attribution
FROM people p
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE p.is_public = TRUE;

CREATE VIEW public_companies AS
SELECT
    id AS company_id,
    unified_business_no,
    name,
    representative_name,
    status,
    capital,
    address_region,
    updated_at
FROM companies
WHERE is_public = TRUE;

CREATE VIEW public_relation_details AS
SELECT
    r.id AS relation_id,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    p.district AS person_district,
    c.id AS company_id,
    c.name AS company_name,
    c.unified_business_no,
    r.relation_type,
    r.confidence_level,
    r.evidence_text,
    sd.id AS source_document_id,
    sd.source_name,
    sd.source_url,
    r.verification_status,
    r.created_at AS relation_created_at,
    r.updated_at AS relation_updated_at
FROM person_company_relations r
JOIN people p ON p.id = r.person_id
JOIN companies c ON c.id = r.company_id
LEFT JOIN source_documents sd ON sd.id = r.evidence_source_id AND sd.is_public = TRUE
WHERE r.verification_status = 'verified'
  AND r.is_public = TRUE
  AND p.is_public = TRUE
  AND c.is_public = TRUE;

CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    region_type TEXT NOT NULL CHECK (
        region_type IN (
            'country',
            'municipality',
            'county',
            'city',
            'district',
            'township',
            'village',
            'election_district',
            'special'
        )
    ),
    parent_region_id UUID REFERENCES regions(id),
    official_code TEXT,
    map_code TEXT,
    display_order INT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year INT,
    election_type TEXT NOT NULL CHECK (
        election_type IN (
            'presidential',
            'legislative',
            'local',
            'recall',
            'referendum',
            'by_election',
            'other'
        )
    ),
    voting_date DATE,
    status TEXT NOT NULL DEFAULT 'announced' CHECK (
        status IN (
            'draft',
            'announced',
            'upcoming',
            'active',
            'completed',
            'cancelled',
            'unknown'
        )
    ),
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE races (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id),
    region_id UUID REFERENCES regions(id),
    race_type TEXT NOT NULL CHECK (
        race_type IN (
            'president',
            'vice_president',
            'legislator',
            'party_list_legislator',
            'municipality_mayor',
            'county_mayor',
            'city_councilor',
            'county_councilor',
            'township_mayor',
            'township_representative',
            'village_chief',
            'recall',
            'referendum',
            'other'
        )
    ),
    title TEXT NOT NULL,
    voting_date DATE,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (
        status IN (
            'draft',
            'announced',
            'upcoming',
            'registration_open',
            'candidates_announced',
            'voting',
            'completed',
            'cancelled',
            'unknown'
        )
    ),
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id),
    race_id UUID NOT NULL REFERENCES races(id),
    party TEXT,
    candidate_no TEXT,
    registration_status TEXT DEFAULT 'pending' CHECK (
        registration_status IN (
            'pending',
            'registered',
            'qualified',
            'disqualified',
            'withdrawn',
            'elected',
            'not_elected',
            'unknown'
        )
    ),
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regions_slug ON regions(slug);
CREATE INDEX idx_regions_region_type ON regions(region_type);
CREATE INDEX idx_regions_parent_region_id ON regions(parent_region_id);
CREATE INDEX idx_regions_is_public ON regions(is_public);

CREATE INDEX idx_elections_year ON elections(year);
CREATE INDEX idx_elections_election_type ON elections(election_type);
CREATE INDEX idx_elections_voting_date ON elections(voting_date);
CREATE INDEX idx_elections_is_public ON elections(is_public);

CREATE INDEX idx_races_election_id ON races(election_id);
CREATE INDEX idx_races_region_id ON races(region_id);
CREATE INDEX idx_races_race_type ON races(race_type);
CREATE INDEX idx_races_voting_date ON races(voting_date);
CREATE INDEX idx_races_status ON races(status);
CREATE INDEX idx_races_is_public ON races(is_public);

CREATE UNIQUE INDEX uq_candidates_person_race ON candidates(person_id, race_id);
CREATE INDEX idx_candidates_person_id ON candidates(person_id);
CREATE INDEX idx_candidates_race_id ON candidates(race_id);
CREATE INDEX idx_candidates_party ON candidates(party);
CREATE INDEX idx_candidates_registration_status ON candidates(registration_status);
CREATE INDEX idx_candidates_is_public ON candidates(is_public);

CREATE VIEW public_regions AS
SELECT
    id AS region_id,
    name,
    slug,
    region_type,
    parent_region_id,
    official_code,
    map_code,
    display_order
FROM regions
WHERE is_public = TRUE;

CREATE VIEW public_elections AS
SELECT
    id AS election_id,
    name,
    year,
    election_type,
    voting_date,
    status,
    source_name,
    source_url
FROM elections
WHERE is_public = TRUE;

CREATE VIEW public_races AS
SELECT
    r.id AS race_id,
    e.id AS election_id,
    e.name AS election_name,
    rg.id AS region_id,
    rg.name AS region_name,
    rg.slug AS region_slug,
    r.race_type,
    r.title,
    r.voting_date,
    r.status,
    r.source_name,
    r.source_url
FROM races r
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
WHERE r.is_public = TRUE
  AND (r.region_id IS NULL OR rg.is_public = TRUE);

CREATE VIEW public_candidates AS
SELECT
    c.id AS candidate_id,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    r.id AS race_id,
    r.title AS race_title,
    e.id AS election_id,
    e.name AS election_name,
    rg.id AS region_id,
    rg.name AS region_name,
    c.party,
    c.candidate_no,
    c.registration_status,
    c.source_name,
    c.source_url,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.attribution AS photo_attribution,
    ph.license_type AS photo_license_type
FROM candidates c
JOIN people p ON p.id = c.person_id AND p.is_public = TRUE
JOIN races r ON r.id = c.race_id AND r.is_public = TRUE
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE c.is_public = TRUE
  AND (r.region_id IS NULL OR rg.is_public = TRUE);

CREATE VIEW public_region_election_summary AS
WITH ranked_races AS (
    SELECT
        rg.id AS region_id,
        rg.name AS region_name,
        rg.slug AS region_slug,
        rg.region_type,
        e.id AS election_id,
        e.name AS election_name,
        r.voting_date,
        COUNT(r.id) FILTER (WHERE r.status IN ('announced', 'upcoming', 'registration_open', 'candidates_announced', 'voting'))
            OVER (PARTITION BY rg.id) AS upcoming_race_count,
        ROW_NUMBER() OVER (PARTITION BY rg.id ORDER BY r.voting_date ASC NULLS LAST, e.name, r.title) AS rn
    FROM regions rg
    LEFT JOIN races r
        ON r.region_id = rg.id
       AND r.is_public = TRUE
       AND r.status IN ('announced', 'upcoming', 'registration_open', 'candidates_announced', 'voting')
    LEFT JOIN elections e
        ON e.id = r.election_id
       AND e.is_public = TRUE
    WHERE rg.is_public = TRUE
)
SELECT
    region_id,
    region_name,
    region_slug,
    region_type,
    election_id AS next_election_id,
    election_name AS next_election_name,
    voting_date AS next_voting_date,
    COALESCE(upcoming_race_count, 0) AS upcoming_race_count
FROM ranked_races
WHERE rn = 1 OR rn IS NULL;

CREATE VIEW public_home_election_ticker AS
SELECT
    id AS election_id,
    name AS election_name,
    voting_date,
    election_type,
    status,
    source_name,
    source_url
FROM elections
WHERE is_public = TRUE
  AND status IN ('announced', 'upcoming', 'active')
  AND voting_date IS NOT NULL
ORDER BY voting_date ASC;

CREATE TABLE person_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id),
    media_type TEXT NOT NULL CHECK (
        media_type IN ('photo')
    ),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    license_type TEXT NOT NULL CHECK (
        license_type IN (
            'government_open_data',
            'creative_commons',
            'official_site_permission',
            'wikimedia_commons',
            'self_provided',
            'placeholder',
            'unknown'
        )
    ),
    license_url TEXT,
    attribution TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'verified', 'rejected', 'archived')
    ),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (NOT (is_public = TRUE AND verification_status <> 'verified')),
    CHECK (NOT (is_public = TRUE AND license_type = 'unknown'))
);

CREATE UNIQUE INDEX ux_person_media_primary_public
    ON person_media(person_id)
    WHERE is_primary = TRUE
      AND is_public = TRUE
      AND verification_status = 'verified';

CREATE INDEX idx_person_media_person_id
    ON person_media(person_id);

CREATE INDEX idx_person_media_verification_public
    ON person_media(verification_status, is_public);

CREATE INDEX idx_person_media_is_primary
    ON person_media(is_primary);

CREATE INDEX idx_person_media_license_type
    ON person_media(license_type);

CREATE VIEW public_person_primary_photos AS
SELECT
    pm.person_id,
    pm.id AS media_id,
    pm.url AS photo_url,
    pm.thumbnail_url,
    pm.source_name,
    pm.source_url,
    pm.license_type,
    pm.license_url,
    pm.attribution
FROM person_media pm
JOIN people p ON p.id = pm.person_id
WHERE pm.verification_status = 'verified'
  AND pm.is_public = TRUE
  AND pm.is_primary = TRUE
  AND pm.license_type <> 'unknown'
  AND p.is_public = TRUE;
