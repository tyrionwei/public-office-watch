-- Read-only validation for the bounded published party-data contracts.
SELECT 'parties' AS relation, COUNT(*) AS row_count FROM published.parties
UNION ALL
SELECT 'finance', COUNT(*) FROM published.party_finance_summaries
UNION ALL
SELECT 'company_contributions', COUNT(*) FROM published.party_company_contribution_summaries
UNION ALL
SELECT 'party_officers', COUNT(*) FROM published.party_officers;

SELECT party_id, COUNT(*) AS row_count
FROM published.party_company_contribution_summaries
GROUP BY party_id
ORDER BY row_count DESC, party_id;

SELECT party_id, party_name, COUNT(*) AS row_count
FROM published.party_officers
GROUP BY party_id, party_name
ORDER BY row_count DESC, party_id;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    party_id, name, short_name, slug, theme_key, official_site_url,
    chairperson_name, registry_no, founded_date_text, filed_date_text,
    headquarters_address, contact_phone, status, source_name, source_url, updated_at
FROM published.parties
ORDER BY name, party_id
LIMIT 201;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    party_id, party_name, report_year, income_total, expense_total,
    balance_amount, individual_donation_total, business_donation_total,
    civil_group_donation_total, anonymous_donation_total, other_income_total,
    source_name, source_url, updated_at
FROM published.party_finance_summaries
ORDER BY party_id, report_year DESC
LIMIT 101;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    party_id, company_id, company_name, report_year, amount_total,
    donation_count, confidence_level, source_name, source_url, reviewed_at
FROM published.party_company_contribution_summaries
ORDER BY party_id, amount_total DESC, company_name, company_id
LIMIT 1001;

-- The current largest officer roster belongs to this party and has 44 rows.
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    affiliation_id, person_id, person_name, party_id, party_name, role_title,
    organization_unit, display_order, start_date, observed_date,
    current_office_label, primary_photo_thumbnail_url, source_name, source_url,
    updated_at, role_tier
FROM published.party_officers
WHERE party_id = '3cb26af6-9418-442a-99c0-f8f3a8deaa20'
ORDER BY display_order ASC NULLS LAST, person_name, affiliation_id
LIMIT 201;

SELECT
    (SELECT COUNT(*) FROM public.public_party_officers) AS public_rows,
    (SELECT COUNT(*) FROM published.party_officers) AS published_rows;
