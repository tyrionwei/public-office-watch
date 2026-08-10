BEGIN;

CREATE OR REPLACE FUNCTION published.election_education_distribution(
    p_event_key TEXT,
    p_election_ids UUID[],
    p_race_types TEXT[] DEFAULT NULL,
    p_region_key TEXT DEFAULT NULL
)
RETURNS TABLE (
    education_key TEXT,
    candidate_count INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, published
AS $$
    WITH RECURSIVE candidate_scope AS MATERIALIZED (
        SELECT
            candidate.candidate_id,
            candidate.person_id
        FROM published.candidate_facts candidate
        JOIN published.races race ON race.race_id = candidate.race_id
        WHERE p_event_key IS NOT NULL
          AND BTRIM(p_event_key) <> ''
          AND COALESCE(CARDINALITY(p_election_ids), 0) BETWEEN 1 AND 500
          AND race.event_key = BTRIM(p_event_key)
          AND candidate.election_id = ANY (p_election_ids)
          AND (p_race_types IS NULL OR race.race_type = ANY (p_race_types))
          AND (p_region_key IS NULL OR race.region_key = p_region_key)
    ),
    scope_people AS (
        SELECT DISTINCT person_id
        FROM candidate_scope
        WHERE person_id IS NOT NULL
    ),
    member_ids(canonical_person_id, source_person_id, path, depth) AS (
        SELECT
            scope.person_id,
            scope.person_id,
            ARRAY[scope.person_id],
            0
        FROM scope_people scope

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
          AND NOT decision.duplicate_person_id = ANY (member.path)
    ),
    claim_education AS (
        SELECT
            member.canonical_person_id AS person_id,
            STRING_AGG(DISTINCT NULLIF(BTRIM(claim.claim_value), ''), '；') AS education
        FROM member_ids member
        JOIN public.person_claims claim
          ON claim.person_id = member.source_person_id
         AND claim.claim_type = 'education'
         AND claim.review_status = 'verified'
         AND claim.visibility = 'public'
         AND claim.is_public
         AND NULLIF(BTRIM(claim.claim_value), '') IS NOT NULL
        GROUP BY member.canonical_person_id
    ),
    normalized_education AS (
        SELECT
            scope.candidate_id,
            LOWER(REGEXP_REPLACE(
                COALESCE(
                    NULLIF(BTRIM(person.education), ''),
                    claim.education,
                    ''
                ),
                '[[:space:];；,，、()（）\[\]．._-]+',
                '',
                'g'
            )) AS education
        FROM candidate_scope scope
        LEFT JOIN published.people person ON person.person_id = scope.person_id
        LEFT JOIN claim_education claim ON claim.person_id = scope.person_id
    ),
    classified AS (
        SELECT CASE
            WHEN education = '' THEN 'unknown'
            WHEN education ~ '高中職?以下' THEN 'secondary_or_below'
            WHEN education IN ('其他', '不詳', '未知', '無資料') THEN 'other'
            WHEN education IN ('大專', '大專學歷') THEN 'tertiary_unspecified'
            WHEN education ~ '博士|phd|doctorate' THEN 'doctorate'
            WHEN education ~ '碩士|研究所|master|emba|mba' THEN 'master'
            WHEN education ~ '大學|學院|學士|學系|university|college|bachelor' THEN 'university'
            WHEN education ~ '專科|工專|商專|醫專|護專|警專|五專|二專' THEN 'junior_college'
            WHEN education ~ '高中|高職|高級中學|職校' THEN 'high_school'
            WHEN education ~ '國中|國民中學|初中|國小|國民小學|小學' THEN 'secondary_or_below'
            ELSE 'other'
        END AS education_key
        FROM normalized_education
    )
    SELECT
        classified.education_key,
        COUNT(*)::INTEGER AS candidate_count
    FROM classified
    GROUP BY classified.education_key
    ORDER BY CASE classified.education_key
        WHEN 'doctorate' THEN 10
        WHEN 'master' THEN 20
        WHEN 'university' THEN 30
        WHEN 'tertiary_unspecified' THEN 40
        WHEN 'junior_college' THEN 50
        WHEN 'high_school' THEN 60
        WHEN 'secondary_or_below' THEN 70
        WHEN 'other' THEN 80
        ELSE 90
    END
    LIMIT 9;
$$;

REVOKE ALL ON FUNCTION published.election_education_distribution(TEXT, UUID[], TEXT[], TEXT)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published.election_education_distribution(TEXT, UUID[], TEXT[], TEXT)
TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
