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
    id AS person_id,
    name,
    alias,
    party,
    position,
    election_year,
    district,
    updated_at
FROM people
WHERE is_public = TRUE;

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
