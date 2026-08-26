BEGIN;

CREATE OR REPLACE VIEW published.party_name_aliases
WITH (security_barrier = true) AS
SELECT
    alias_name,
    canonical_name
FROM public.party_name_aliases;

REVOKE ALL ON published.party_name_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON published.party_name_aliases TO anon, authenticated, service_role, admin_role;

CREATE OR REPLACE FUNCTION public.canonical_party_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT alias.canonical_name
            FROM published.party_name_aliases alias
            WHERE alias.alias_name = NULLIF(pg_catalog.btrim(p_name), '')
            LIMIT 1
        ),
        NULLIF(pg_catalog.btrim(p_name), '')
    );
$$;

CREATE OR REPLACE FUNCTION public.canonical_party_key(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT pg_catalog.lower(
        pg_catalog.regexp_replace(
            pg_catalog.replace(public.canonical_party_name(p_name), '臺', '台'),
            '[[:space:]]+',
            '',
            'g'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.canonical_party_name(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_party_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_party_name(TEXT) TO anon, authenticated, service_role, admin_role;
GRANT EXECUTE ON FUNCTION public.canonical_party_key(TEXT) TO anon, authenticated, service_role, admin_role;

CREATE OR REPLACE VIEW published.home_candidate_summaries
WITH (security_invoker = false, security_barrier = true) AS
SELECT
    candidate.*,
    person.gender,
    birth_date.claim_value AS birth_date
FROM published.candidates candidate
LEFT JOIN published.people_directory person
    ON person.person_id = candidate.person_id
LEFT JOIN LATERAL (
    SELECT claim.claim_value
    FROM published.person_claims claim
    WHERE claim.person_id = candidate.person_id
      AND claim.claim_type = 'birth_date'
    ORDER BY claim.updated_at DESC, claim.claim_id
    LIMIT 1
) birth_date ON TRUE;

REVOKE ALL ON published.home_candidate_summaries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON published.home_candidate_summaries TO anon, authenticated, service_role, admin_role;

COMMENT ON VIEW published.home_candidate_summaries IS
    'Bounded homepage candidate cards with only the demographic fields required for sprite selection.';

COMMIT;
