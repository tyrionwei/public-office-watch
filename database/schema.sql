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
    confidence_suggestion TEXT NOT NULL CHECK (confidence_suggestion IN ('A','B','C','D')),
    evidence_text TEXT NOT NULL,
    source_record_id UUID REFERENCES raw_source_records(id),
    source_url TEXT,
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending','verified','rejected','needs_more_evidence','archived')),
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
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('A','B','C','D')),
    evidence_source_id UUID REFERENCES source_documents(id),
    evidence_text TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','needs_more_evidence','archived')),
    is_public BOOLEAN DEFAULT FALSE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_name ON people(name);
CREATE INDEX idx_people_party_position ON people(party, position);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_unified_business_no ON companies(unified_business_no);
CREATE INDEX idx_raw_source_records_source_type_fetched_at ON raw_source_records(source_type, fetched_at DESC);
CREATE INDEX idx_source_documents_source_type_source_date ON source_documents(source_type, source_date DESC);
CREATE INDEX idx_relation_candidates_person_company ON relation_candidates(person_name, company_name);
CREATE INDEX idx_relation_candidates_review_status ON relation_candidates(review_status);
CREATE INDEX idx_relation_candidates_source_record_id ON relation_candidates(source_record_id);
CREATE INDEX idx_person_company_relations_person_id ON person_company_relations(person_id);
CREATE INDEX idx_person_company_relations_company_id ON person_company_relations(company_id);
CREATE INDEX idx_person_company_relations_verification_public ON person_company_relations(verification_status, is_public);

CREATE UNIQUE INDEX uq_person_company_relations_official_relation
ON person_company_relations(person_id, company_id, relation_type, evidence_source_id);
