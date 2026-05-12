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
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
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
    last_checked_at TIMESTAMP,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE raw_source_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    fetched_at TIMESTAMP DEFAULT NOW(),
    raw_text TEXT,
    raw_json JSONB,
    raw_html_hash TEXT,
    crawler_name TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE source_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    source_date DATE,
    fetched_at TIMESTAMP DEFAULT NOW(),
    snapshot_hash TEXT,
    raw_record_id UUID REFERENCES raw_source_records(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE relation_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    unified_business_no TEXT,
    guessed_relation_type TEXT NOT NULL,
    confidence_suggestion TEXT NOT NULL CHECK (confidence_suggestion IN ('A','B','C','D')),
    evidence_text TEXT NOT NULL,
    source_record_id UUID REFERENCES raw_source_records(id),
    source_url TEXT,
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending','verified','rejected','needs_more_evidence','archived')),
    review_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE person_company_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    relation_type TEXT NOT NULL,
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('A','B','C','D')),
    evidence_source_id UUID REFERENCES source_documents(id),
    evidence_text TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','needs_more_evidence','archived')),
    is_public BOOLEAN DEFAULT FALSE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
