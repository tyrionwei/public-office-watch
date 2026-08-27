BEGIN;

CREATE OR REPLACE VIEW published.parties
WITH (security_barrier = true) AS
SELECT
    source.party_id,
    source.name,
    source.short_name,
    source.slug,
    source.theme_key,
    source.official_site_url,
    source.chairperson_name,
    source.registry_no,
    source.founded_date_text,
    source.filed_date_text,
    source.headquarters_address,
    source.contact_phone,
    source.status,
    source.source_name,
    source.source_url,
    source.updated_at,
    pg_catalog.lower(
        pg_catalog.regexp_replace(
            pg_catalog.replace(
                COALESCE(
                    (
                        SELECT alias.canonical_name
                        FROM public.party_name_aliases alias
                        WHERE alias.alias_name = NULLIF(pg_catalog.btrim(source.name), '')
                        LIMIT 1
                    ),
                    NULLIF(pg_catalog.btrim(source.name), '')
                ),
                '臺',
                '台'
            ),
            '[[:space:]]+',
            '',
            'g'
        )
    ) AS normalized_name
FROM public.public_parties source;

ALTER FUNCTION published.search_public_records(TEXT, INTEGER) SECURITY DEFINER;
ALTER FUNCTION published.search_public_records(TEXT, INTEGER) SET search_path = '';

REVOKE ALL ON TABLE
    published.candidates,
    published.election_race_summaries,
    published.elections,
    published.home_candidate_summaries,
    published.home_region_summary,
    published.home_ticker,
    published.party_name_aliases,
    published.people,
    published.person_party_affiliations,
    published.races,
    published.referendum_options,
    published.referendum_questions,
    published.referendum_region_results,
    published.search_results
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    published.candidates,
    published.election_race_summaries,
    published.elections,
    published.home_candidate_summaries,
    published.home_region_summary,
    published.home_ticker,
    published.party_name_aliases,
    published.people,
    published.person_party_affiliations,
    published.races,
    published.referendum_options,
    published.referendum_questions,
    published.referendum_region_results,
    published.search_results
TO service_role, admin_role;

REVOKE ALL ON FUNCTION published.home_candidate_summaries_for(UUID[])
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION published.person_claims_for(UUID[])
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION published.home_candidate_summaries_for(UUID[])
TO service_role, admin_role;
GRANT EXECUTE ON FUNCTION published.person_claims_for(UUID[])
TO service_role, admin_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
