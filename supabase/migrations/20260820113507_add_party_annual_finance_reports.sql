BEGIN;

CREATE TABLE public.party_annual_finance_filings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    report_year INTEGER NOT NULL CHECK (report_year >= 2000),
    filing_status TEXT NOT NULL CHECK (
        filing_status IN ('filed', 'correction_required', 'not_filed', 'unknown')
    ),
    ratification_status TEXT NOT NULL CHECK (
        ratification_status IN ('ratified', 'not_ratified', 'unknown')
    ),
    assembly_approval_status TEXT NOT NULL CHECK (
        assembly_approval_status IN ('approved', 'not_approved', 'unknown')
    ),
    detail_url TEXT NOT NULL CHECK (detail_url LIKE 'https://party.moi.gov.tw/%'),
    report_pdf_url TEXT CHECK (
        report_pdf_url IS NULL OR report_pdf_url LIKE 'https://ws.moi.gov.tw/%'
    ),
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL CHECK (source_url LIKE 'https://party.moi.gov.tw/%'),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (party_id, report_year)
);

CREATE INDEX idx_party_annual_finance_filings_party_year
    ON public.party_annual_finance_filings(party_id, report_year DESC);

ALTER TABLE public.party_annual_finance_filings ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_party_annual_finance_filings
    ON public.party_annual_finance_filings
    FOR SELECT
    TO anon, authenticated
    USING (is_public = TRUE);

CREATE POLICY admin_manage_party_annual_finance_filings
    ON public.party_annual_finance_filings
    FOR ALL
    TO admin_role
    USING (TRUE)
    WITH CHECK (TRUE);

REVOKE ALL ON TABLE public.party_annual_finance_filings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.party_annual_finance_filings TO service_role;

CREATE VIEW published.party_annual_finance_filings WITH (security_barrier = true) AS
SELECT
    p.id AS party_id,
    p.name AS party_name,
    f.report_year,
    f.filing_status,
    f.ratification_status,
    f.assembly_approval_status,
    f.detail_url,
    f.report_pdf_url,
    f.source_name,
    f.source_url,
    f.updated_at
FROM public.party_annual_finance_filings f
JOIN public.parties p ON p.id = f.party_id AND p.is_public = TRUE
WHERE f.is_public = TRUE;

REVOKE ALL ON TABLE published.party_annual_finance_filings FROM PUBLIC;
GRANT SELECT ON TABLE published.party_annual_finance_filings TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
