BEGIN;

CREATE OR REPLACE FUNCTION published.party_company_contribution_counts()
RETURNS TABLE (
    party_id UUID,
    contribution_count INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, published
AS $$
    SELECT
        party.id AS party_id,
        COUNT(*)::INTEGER AS contribution_count
    FROM public.party_company_contribution_summaries summary
    JOIN public.parties party
      ON party.id = summary.party_id
     AND party.is_public = TRUE
    JOIN public.companies company
      ON company.id = summary.company_id
     AND company.is_public = TRUE
    WHERE summary.is_public = TRUE
    GROUP BY party.id
    ORDER BY party.id;
$$;

REVOKE ALL ON FUNCTION published.party_company_contribution_counts()
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published.party_company_contribution_counts()
TO anon, authenticated;

COMMENT ON FUNCTION published.party_company_contribution_counts() IS
    'Returns one bounded contribution-summary count per public party for the party directory.';

NOTIFY pgrst, 'reload schema';

COMMIT;
