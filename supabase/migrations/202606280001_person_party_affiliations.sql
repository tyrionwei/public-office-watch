CREATE TABLE IF NOT EXISTS person_party_affiliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliation_key TEXT NOT NULL UNIQUE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    source_person_id UUID REFERENCES source_people(id) ON DELETE SET NULL,
    source_claim_key TEXT,
    party_name TEXT NOT NULL,
    normalized_party TEXT NOT NULL,
    role_context TEXT NOT NULL DEFAULT 'official_record' CHECK (
        role_context IN (
            'candidate',
            'officeholder',
            'party_officer',
            'self_declared',
            'wiki_record',
            'official_record',
            'other'
        )
    ),
    observed_year INT,
    observed_date DATE,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    confidence_level TEXT NOT NULL DEFAULT 'D' CHECK (confidence_level IN ('A', 'B', 'C', 'D')),
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        review_status IN ('pending', 'verified', 'rejected', 'needs_more_evidence', 'archived')
    ),
    source_name TEXT,
    source_url TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE person_party_affiliations
    ADD COLUMN IF NOT EXISTS source_claim_key TEXT;

CREATE INDEX IF NOT EXISTS idx_person_party_affiliations_person_year
    ON person_party_affiliations(person_id, observed_year DESC NULLS LAST, observed_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_person_party_affiliations_party
    ON person_party_affiliations(normalized_party, observed_year DESC NULLS LAST);

ALTER TABLE person_party_affiliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_person_party_affiliations ON person_party_affiliations;
CREATE POLICY public_read_person_party_affiliations
    ON person_party_affiliations
    FOR SELECT
    USING (is_public = TRUE AND review_status = 'verified');

DROP POLICY IF EXISTS importer_write_person_party_affiliations ON person_party_affiliations;
CREATE POLICY importer_write_person_party_affiliations
    ON person_party_affiliations
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

DROP VIEW IF EXISTS public_person_party_affiliations;
CREATE VIEW public_person_party_affiliations AS
SELECT
    a.id AS affiliation_id,
    a.affiliation_key,
    a.person_id,
    p.name AS person_name,
    a.source_claim_key,
    a.party_name,
    a.role_context,
    a.observed_year,
    a.observed_date,
    a.start_date,
    a.end_date,
    a.is_current,
    a.confidence_level,
    a.source_name,
    a.source_url,
    a.updated_at
FROM person_party_affiliations a
JOIN people p ON p.id = a.person_id AND p.is_public = TRUE
WHERE a.is_public = TRUE
  AND a.review_status = 'verified';
