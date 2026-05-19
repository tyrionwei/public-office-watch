ALTER TABLE regions ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE elections ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE races ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_regions_external_id
    ON regions(external_id)
    WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_elections_external_id
    ON elections(external_id)
    WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_races_external_id
    ON races(external_id)
    WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT,
    slug TEXT NOT NULL UNIQUE,
    theme_key TEXT NOT NULL DEFAULT 'unknown' CHECK (
        theme_key IN ('dpp', 'kmt', 'tpp', 'npp', 'pfp', 'tsp', 'independent', 'unknown')
    ),
    official_site_url TEXT,
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (
        status IN ('active', 'inactive', 'unknown')
    ),
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_finance_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id),
    report_year INT NOT NULL,
    income_total NUMERIC NOT NULL DEFAULT 0,
    expense_total NUMERIC NOT NULL DEFAULT 0,
    balance_amount NUMERIC NOT NULL DEFAULT 0,
    individual_donation_total NUMERIC NOT NULL DEFAULT 0,
    business_donation_total NUMERIC NOT NULL DEFAULT 0,
    civil_group_donation_total NUMERIC NOT NULL DEFAULT 0,
    anonymous_donation_total NUMERIC NOT NULL DEFAULT 0,
    other_income_total NUMERIC NOT NULL DEFAULT 0,
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (party_id, report_year)
);

CREATE TABLE IF NOT EXISTS party_company_contribution_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    report_year INT NOT NULL,
    amount_total NUMERIC NOT NULL DEFAULT 0,
    donation_count INT NOT NULL DEFAULT 0,
    confidence_level TEXT NOT NULL DEFAULT 'D' CHECK (
        confidence_level IN ('A', 'B', 'C', 'D')
    ),
    source_name TEXT,
    source_url TEXT,
    reviewed_at TIMESTAMPTZ,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (party_id, company_id, report_year)
);

CREATE TABLE IF NOT EXISTS data_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_name TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'write')),
    status TEXT NOT NULL CHECK (status IN ('ok', 'failed', 'skipped')),
    source_hash TEXT,
    source_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    report_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parties_slug ON parties(slug);
CREATE INDEX IF NOT EXISTS idx_parties_status_public ON parties(status, is_public);
CREATE INDEX IF NOT EXISTS idx_party_finance_party_year ON party_finance_summaries(party_id, report_year DESC);
CREATE INDEX IF NOT EXISTS idx_party_company_party_year ON party_company_contribution_summaries(party_id, report_year DESC);
CREATE INDEX IF NOT EXISTS idx_data_sync_runs_sync_started ON data_sync_runs(sync_name, started_at DESC);

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_finance_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_company_contribution_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_parties
    ON parties
    FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY public_read_party_finance_summaries
    ON party_finance_summaries
    FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY public_read_party_company_contribution_summaries
    ON party_company_contribution_summaries
    FOR SELECT
    USING (is_public = TRUE);

CREATE POLICY admin_manage_parties
    ON parties
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_party_finance_summaries
    ON party_finance_summaries
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_party_company_contribution_summaries
    ON party_company_contribution_summaries
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY admin_manage_data_sync_runs
    ON data_sync_runs
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

DROP VIEW IF EXISTS public_party_company_contribution_summaries;
DROP VIEW IF EXISTS public_party_finance_summaries;
DROP VIEW IF EXISTS public_parties;

CREATE VIEW public_parties AS
SELECT
    id AS party_id,
    name,
    short_name,
    slug,
    theme_key,
    official_site_url,
    status,
    source_name,
    source_url,
    updated_at
FROM parties
WHERE is_public = TRUE;

CREATE VIEW public_party_finance_summaries AS
SELECT
    p.id AS party_id,
    p.name AS party_name,
    s.report_year,
    s.income_total,
    s.expense_total,
    s.balance_amount,
    s.individual_donation_total,
    s.business_donation_total,
    s.civil_group_donation_total,
    s.anonymous_donation_total,
    s.other_income_total,
    s.source_name,
    s.source_url,
    s.updated_at
FROM party_finance_summaries s
JOIN parties p ON p.id = s.party_id AND p.is_public = TRUE
WHERE s.is_public = TRUE;

CREATE VIEW public_party_company_contribution_summaries AS
SELECT
    p.id AS party_id,
    c.id AS company_id,
    c.name AS company_name,
    s.report_year,
    s.amount_total,
    s.donation_count,
    s.confidence_level,
    s.source_name,
    s.source_url,
    s.reviewed_at
FROM party_company_contribution_summaries s
JOIN parties p ON p.id = s.party_id AND p.is_public = TRUE
JOIN companies c ON c.id = s.company_id AND c.is_public = TRUE
WHERE s.is_public = TRUE;
