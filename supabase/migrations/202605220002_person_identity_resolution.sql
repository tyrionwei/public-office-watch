CREATE TABLE IF NOT EXISTS source_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_person_key TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL CHECK (
        source_type IN (
            'official_election',
            'official_officeholder',
            'official_party_finance',
            'government_open_data',
            'court_document',
            'media_guide',
            'wikipedia',
            'wikidata',
            'official_site',
            'social_media',
            'other'
        )
    ),
    source_id TEXT,
    source_name TEXT NOT NULL,
    source_url TEXT,
    raw_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    alias TEXT,
    gender TEXT DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'unknown')),
    party TEXT,
    normalized_party TEXT,
    position TEXT,
    normalized_role TEXT,
    district TEXT,
    normalized_region TEXT,
    election_year INT,
    birth_date DATE,
    birth_date_text TEXT,
    external_person_id TEXT,
    external_record_id TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    confidence_suggestion TEXT NOT NULL DEFAULT 'D' CHECK (confidence_suggestion IN ('A', 'B', 'C', 'D')),
    ingest_batch_key TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS person_identity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_person_id UUID NOT NULL REFERENCES source_people(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (
        match_status IN (
            'auto_matched',
            'probable_match',
            'possible_match',
            'rejected_match',
            'unmatched'
        )
    ),
    score NUMERIC NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    match_method TEXT NOT NULL DEFAULT 'manual',
    match_reason TEXT,
    evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS person_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_key TEXT NOT NULL UNIQUE,
    person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    source_person_id UUID REFERENCES source_people(id) ON DELETE SET NULL,
    claim_type TEXT NOT NULL CHECK (
        claim_type IN (
            'name',
            'alias',
            'gender',
            'birth_date',
            'party',
            'position',
            'office',
            'candidacy',
            'district',
            'education',
            'experience',
            'platform',
            'finance_summary',
            'legal_case',
            'family_relation',
            'media',
            'external_id',
            'other'
        )
    ),
    claim_value TEXT,
    claim_json JSONB NOT NULL DEFAULT '{}'::JSONB,
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
    visibility TEXT NOT NULL DEFAULT 'review_only' CHECK (visibility IN ('public', 'review_only', 'private')),
    source_name TEXT,
    source_url TEXT,
    observed_at TIMESTAMPTZ DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_people_normalized_name
    ON source_people(normalized_name);

CREATE INDEX IF NOT EXISTS idx_source_people_source_type_updated
    ON source_people(source_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_people_external_person_id
    ON source_people(external_person_id)
    WHERE external_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_person_identity_matches_source_person
    ON person_identity_matches(source_person_id);

CREATE INDEX IF NOT EXISTS idx_person_identity_matches_person
    ON person_identity_matches(person_id);

CREATE INDEX IF NOT EXISTS idx_person_identity_matches_status_score
    ON person_identity_matches(match_status, score DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_identity_matches_source_person
    ON person_identity_matches(source_person_id, person_id)
    WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_person_claims_person_type
    ON person_claims(person_id, claim_type);

CREATE INDEX IF NOT EXISTS idx_person_claims_source_person
    ON person_claims(source_person_id);

CREATE INDEX IF NOT EXISTS idx_person_claims_review_public
    ON person_claims(review_status, visibility, is_public);

ALTER TABLE source_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_identity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY importer_write_source_people
    ON source_people
    FOR INSERT
    TO importer_role
    WITH CHECK (is_public = FALSE);

CREATE POLICY importer_write_person_identity_matches
    ON person_identity_matches
    FOR INSERT
    TO importer_role
    WITH CHECK (match_status IN ('possible_match', 'unmatched'));

CREATE POLICY importer_write_person_claims
    ON person_claims
    FOR INSERT
    TO importer_role
    WITH CHECK (review_status = 'pending' AND is_public = FALSE);

CREATE POLICY admin_manage_source_people
    ON source_people
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_person_identity_matches
    ON person_identity_matches
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_person_claims
    ON person_claims
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

DROP VIEW IF EXISTS public_person_identity_sources;
DROP VIEW IF EXISTS public_person_claims;
DROP VIEW IF EXISTS identity_unmatched_source_people;

CREATE VIEW public_person_identity_sources AS
SELECT
    sp.id AS identity_source_id,
    p.id AS person_id,
    p.name AS person_name,
    sp.source_type,
    sp.source_name,
    sp.source_url,
    sp.raw_name,
    sp.normalized_name,
    sp.party,
    sp.position,
    sp.district,
    m.match_status,
    m.score AS match_score,
    sp.confidence_suggestion,
    sp.updated_at
FROM person_identity_matches m
JOIN source_people sp ON sp.id = m.source_person_id AND sp.is_public = TRUE
JOIN people p ON p.id = m.person_id AND p.is_public = TRUE
WHERE m.match_status = 'auto_matched';

CREATE VIEW public_person_claims AS
SELECT
    pc.id AS claim_id,
    p.id AS person_id,
    pc.claim_type,
    pc.claim_value,
    pc.claim_json,
    pc.confidence_level,
    pc.source_name,
    pc.source_url,
    pc.observed_at,
    pc.updated_at
FROM person_claims pc
JOIN people p ON p.id = pc.person_id AND p.is_public = TRUE
WHERE pc.review_status = 'verified'
  AND pc.visibility = 'public'
  AND pc.is_public = TRUE;

CREATE VIEW identity_unmatched_source_people AS
SELECT
    sp.id AS source_person_id,
    sp.source_person_key,
    sp.source_type,
    sp.source_name,
    sp.source_url,
    sp.raw_name,
    sp.normalized_name,
    sp.party,
    sp.position,
    sp.district,
    sp.confidence_suggestion,
    COALESCE(MAX(m.score), 0) AS best_match_score,
    COALESCE(
        MIN(m.match_status) FILTER (WHERE m.match_status IN ('probable_match', 'possible_match')),
        'unmatched'
    ) AS review_status,
    sp.updated_at
FROM source_people sp
LEFT JOIN person_identity_matches m ON m.source_person_id = sp.id
WHERE NOT EXISTS (
    SELECT 1
    FROM person_identity_matches confirmed
    WHERE confirmed.source_person_id = sp.id
      AND confirmed.match_status = 'auto_matched'
)
GROUP BY sp.id;
