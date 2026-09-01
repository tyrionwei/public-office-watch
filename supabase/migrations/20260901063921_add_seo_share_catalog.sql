BEGIN;

CREATE OR REPLACE FUNCTION published.seo_share_catalog_page(
    p_dataset TEXT,
    p_offset INTEGER DEFAULT 0,
    p_page_size INTEGER DEFAULT 100
)
RETURNS TABLE(items JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_dataset NOT IN ('people', 'races') THEN
        RAISE EXCEPTION 'Unsupported SEO share catalog dataset';
    END IF;
    IF p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN
        RAISE EXCEPTION 'SEO share catalog offset must be between 0 and 100000';
    END IF;
    IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
        RAISE EXCEPTION 'SEO share catalog page size must be between 1 and 100';
    END IF;

    IF p_dataset = 'people' THEN
        RETURN QUERY
        WITH RECURSIVE selected_people AS MATERIALIZED (
            SELECT person.person_id
            FROM published.people_directory person
            ORDER BY person.person_id
            LIMIT p_page_size
            OFFSET p_offset
        ),
        member_ids(canonical_person_id, source_person_id, path, depth) AS (
            SELECT
                person.person_id,
                person.person_id,
                ARRAY[person.person_id],
                0
            FROM selected_people person

            UNION ALL

            SELECT
                member.canonical_person_id,
                decision.duplicate_person_id,
                member.path || decision.duplicate_person_id,
                member.depth + 1
            FROM member_ids member
            JOIN public.person_merge_decisions decision
              ON decision.canonical_person_id = member.source_person_id
             AND decision.status = 'verified'
            WHERE member.depth < 20
              AND NOT decision.duplicate_person_id = ANY(member.path)
        ),
        policy_items AS MATERIALIZED (
            SELECT
                member.canonical_person_id AS person_id,
                claim.id AS claim_id,
                item.ordinality,
                pg_catalog.btrim(item.value) AS policy_text,
                claim.observed_at
            FROM member_ids member
            JOIN public.people canonical
              ON canonical.id = member.canonical_person_id
             AND canonical.is_public
            JOIN public.person_claims claim
              ON claim.person_id = member.source_person_id
            CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(claim.claim_json -> 'items')
                WITH ORDINALITY AS item(value, ordinality)
            WHERE claim.claim_type = 'platform'
              AND claim.review_status = 'verified'
              AND claim.visibility = 'public'
              AND claim.is_public
              AND pg_catalog.jsonb_typeof(claim.claim_json -> 'items') = 'array'
              AND claim.claim_json #>> '{contentSplit,reviewStatus}' IS DISTINCT FROM 'needs_review'
              AND pg_catalog.btrim(item.value) <> ''
        ),
        page AS (
            SELECT
                person.person_id,
                COALESCE((
                    SELECT pg_catalog.jsonb_agg(
                        pg_catalog.jsonb_build_object(
                            'key', policy.claim_id::TEXT || ':static-' || policy.ordinality::TEXT,
                            'text', policy.policy_text
                        )
                        ORDER BY policy.observed_at DESC NULLS LAST, policy.claim_id, policy.ordinality
                    )
                    FROM policy_items policy
                    WHERE policy.person_id = person.person_id
                ), '[]'::JSONB) AS policies
            FROM selected_people person
        )
        SELECT COALESCE(
            pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page) ORDER BY page.person_id),
            '[]'::JSONB
        )
        FROM page;
        RETURN;
    END IF;

    RETURN QUERY
    WITH selected_races AS MATERIALIZED (
        SELECT race.race_id
        FROM published.races race
        ORDER BY race.race_id
        LIMIT p_page_size
        OFFSET p_offset
    ),
    candidate_dedup AS MATERIALIZED (
        SELECT DISTINCT ON (candidate.race_id, candidate.person_id)
            candidate.race_id,
            candidate.person_id,
            candidate.person_name,
            candidate.candidate_no,
            candidate.candidate_id
        FROM published.candidates candidate
        JOIN selected_races race ON race.race_id = candidate.race_id
        WHERE candidate.person_id IS NOT NULL
          AND pg_catalog.btrim(COALESCE(candidate.person_name, '')) <> ''
        ORDER BY
            candidate.race_id,
            candidate.person_id,
            candidate.candidate_no NULLS LAST,
            candidate.candidate_id
    ),
    candidate_rows AS MATERIALIZED (
        SELECT
            candidate.*,
            pg_catalog.row_number() OVER (
                PARTITION BY candidate.race_id
                ORDER BY candidate.candidate_no NULLS LAST, candidate.person_name, candidate.candidate_id
            ) AS candidate_rank
        FROM candidate_dedup candidate
    ),
    page AS (
        SELECT
            race.race_id,
            COALESCE((
                SELECT pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                        'person_id', candidate.person_id,
                        'name', candidate.person_name
                    )
                    ORDER BY candidate.candidate_rank
                )
                FROM candidate_rows candidate
                WHERE candidate.race_id = race.race_id
                  AND candidate.candidate_rank <= 100
            ), '[]'::JSONB) AS candidates
        FROM selected_races race
    )
    SELECT COALESCE(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page) ORDER BY page.race_id),
        '[]'::JSONB
    )
    FROM page;
END;
$$;

REVOKE ALL ON FUNCTION published.seo_share_catalog_page(TEXT, INTEGER, INTEGER)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published.seo_share_catalog_page(TEXT, INTEGER, INTEGER)
TO anon, authenticated, service_role;

COMMENT ON FUNCTION published.seo_share_catalog_page(TEXT, INTEGER, INTEGER) IS
    'Bounded read-only catalog of released policy items and race candidate names for social preview generation.';

COMMIT;
