CREATE TABLE IF NOT EXISTS legal_record_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_key TEXT NOT NULL UNIQUE,
    source_id TEXT,
    source_type TEXT NOT NULL DEFAULT 'court_document' CHECK (
        source_type IN (
            'court_document',
            'judicial_api',
            'government_open_data',
            'media_guide',
            'other'
        )
    ),
    source_name TEXT NOT NULL,
    source_url TEXT,
    court_name TEXT,
    case_year TEXT,
    case_code TEXT,
    case_number TEXT,
    judgment_date DATE,
    case_type TEXT,
    reason TEXT,
    title TEXT,
    summary TEXT,
    raw_name TEXT,
    normalized_name TEXT,
    matched_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    matched_source_person_id UUID REFERENCES source_people(id) ON DELETE SET NULL,
    match_score NUMERIC NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
    match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (
        match_status IN (
            'probable_match',
            'possible_match',
            'rejected_match',
            'unmatched',
            'verified'
        )
    ),
    confidence_level TEXT NOT NULL DEFAULT 'D' CHECK (confidence_level IN ('A', 'B', 'C', 'D')),
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        review_status IN (
            'pending',
            'verified',
            'rejected',
            'needs_more_evidence',
            'archived'
        )
    ),
    review_note TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_record_leads_normalized_name
    ON legal_record_leads(normalized_name);

CREATE INDEX IF NOT EXISTS idx_legal_record_leads_review
    ON legal_record_leads(review_status, match_status, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_legal_record_leads_person
    ON legal_record_leads(matched_person_id)
    WHERE matched_person_id IS NOT NULL;

ALTER TABLE legal_record_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY importer_write_legal_record_leads
    ON legal_record_leads
    FOR INSERT
    TO importer_role
    WITH CHECK (is_public = FALSE AND review_status = 'pending');

CREATE POLICY admin_manage_legal_record_leads
    ON legal_record_leads
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE OR REPLACE VIEW legal_record_review_queue AS
SELECT
    l.id AS lead_id,
    l.lead_key,
    l.source_type,
    l.source_name,
    l.source_url,
    l.court_name,
    l.case_year,
    l.case_code,
    l.case_number,
    l.judgment_date,
    l.case_type,
    l.reason,
    l.title,
    l.summary,
    l.raw_name,
    l.normalized_name,
    l.matched_person_id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    p.district AS person_district,
    l.match_score,
    l.match_status,
    l.confidence_level,
    l.review_status,
    l.review_note,
    l.updated_at
FROM legal_record_leads l
LEFT JOIN people p ON p.id = l.matched_person_id
WHERE l.review_status IN ('pending', 'needs_more_evidence')
  AND l.is_public = FALSE
ORDER BY l.match_score DESC, l.updated_at DESC;
