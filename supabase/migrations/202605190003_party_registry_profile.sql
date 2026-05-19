ALTER TABLE parties ADD COLUMN IF NOT EXISTS registry_no TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS founded_date_text TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS filed_date_text TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS headquarters_address TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS contact_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_parties_registry_no
    ON parties(registry_no)
    WHERE registry_no IS NOT NULL;

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
    chairperson_name,
    registry_no,
    founded_date_text,
    filed_date_text,
    headquarters_address,
    contact_phone,
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
