BEGIN;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS director_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS registry_source_name TEXT,
    ADD COLUMN IF NOT EXISTS registry_source_url TEXT,
    ADD COLUMN IF NOT EXISTS registry_checked_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW public.public_companies AS
SELECT
    id AS company_id,
    unified_business_no,
    name,
    representative_name,
    status,
    capital,
    address_region,
    updated_at,
    director_names,
    registry_source_name,
    registry_source_url,
    registry_checked_at
FROM public.companies
WHERE is_public = TRUE;

CREATE OR REPLACE VIEW public.public_party_company_contribution_summaries AS
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
    s.reviewed_at,
    c.representative_name,
    c.director_names,
    c.registry_source_name,
    c.registry_source_url,
    c.registry_checked_at
FROM public.party_company_contribution_summaries s
JOIN public.parties p ON p.id = s.party_id AND p.is_public = TRUE
JOIN public.companies c ON c.id = s.company_id AND c.is_public = TRUE
WHERE s.is_public = TRUE;

CREATE OR REPLACE VIEW published.companies WITH (security_barrier = true) AS
SELECT * FROM public.public_companies;

CREATE OR REPLACE VIEW published.party_company_contribution_summaries WITH (security_barrier = true) AS
SELECT * FROM public.public_party_company_contribution_summaries;

COMMENT ON COLUMN public.companies.director_names IS
    'Current director names from the Ministry of Economic Affairs company registry API, ordered as returned by the source.';
COMMENT ON COLUMN public.companies.registry_checked_at IS
    'Most recent successful official registry lookup for representative and director data.';

COMMIT;
