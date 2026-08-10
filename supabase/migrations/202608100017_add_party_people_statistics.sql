BEGIN;

CREATE OR REPLACE FUNCTION published.party_people_statistics(
    p_party_name TEXT
)
RETURNS TABLE (
    party_name TEXT,
    dimension_key TEXT,
    bucket_key TEXT,
    people_count INTEGER,
    total_people INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, published
AS $$
    WITH RECURSIVE normalized_party AS (
        SELECT public.canonical_party_name(NULLIF(BTRIM(p_party_name), '')) AS party_name
    ),
    party_people AS MATERIALIZED (
        SELECT
            person.person_id,
            person.gender,
            person.education,
            person.list_status
        FROM published.people person
        CROSS JOIN normalized_party party
        WHERE party.party_name IS NOT NULL
          AND NULLIF(BTRIM(person.party), '') = party.party_name
    ),
    current_party_officers AS MATERIALIZED (
        SELECT DISTINCT officer.person_id
        FROM published.party_officers officer
        CROSS JOIN normalized_party party
        WHERE officer.party_name = party.party_name
    ),
    party_member_ids(canonical_person_id, source_person_id, path, depth) AS (
        SELECT
            person.person_id,
            person.person_id,
            ARRAY[person.person_id],
            0
        FROM party_people person

        UNION ALL

        SELECT
            member.canonical_person_id,
            decision.duplicate_person_id,
            member.path || decision.duplicate_person_id,
            member.depth + 1
        FROM party_member_ids member
        JOIN public.person_merge_decisions decision
          ON decision.canonical_person_id = member.source_person_id
         AND decision.status = 'verified'
        WHERE member.depth < 20
          AND NOT decision.duplicate_person_id = ANY (member.path)
    ),
    resolved_birth_dates AS (
        SELECT
            member.canonical_person_id AS person_id,
            MIN(claim.claim_value::DATE) AS birth_date
        FROM party_member_ids member
        JOIN public.person_claims claim
          ON claim.person_id = member.source_person_id
         AND claim.claim_type = 'birth_date'
         AND claim.review_status = 'verified'
         AND claim.visibility = 'public'
         AND claim.is_public
         AND claim.claim_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         AND pg_input_is_valid(claim.claim_value, 'date')
        GROUP BY member.canonical_person_id
        HAVING COUNT(DISTINCT claim.claim_value::DATE) = 1
    ),
    normalized_people AS MATERIALIZED (
        SELECT
            person.person_id,
            CASE
                WHEN person.gender = 'male' THEN 'male'
                WHEN person.gender = 'female' THEN 'female'
                ELSE 'unknown'
            END AS gender_key,
            CASE
                WHEN person.education IS NULL OR BTRIM(person.education) = '' THEN 'unknown'
                WHEN LOWER(REGEXP_REPLACE(person.education, '[[:space:];；,，、()（）\[\]．._-]+', '', 'g')) ~ '高中職?以下' THEN 'secondary_or_below'
                WHEN LOWER(REGEXP_REPLACE(person.education, '[[:space:];；,，、()（）\[\]．._-]+', '', 'g')) IN ('其他', '不詳', '未知', '無資料') THEN 'other'
                WHEN LOWER(REGEXP_REPLACE(person.education, '[[:space:];；,，、()（）\[\]．._-]+', '', 'g')) IN ('大專', '大專學歷') THEN 'tertiary_unspecified'
                WHEN LOWER(person.education) ~ 'phd|doctorate' OR person.education ~ '博士' THEN 'doctorate'
                WHEN LOWER(person.education) ~ 'master|emba|mba' OR person.education ~ '碩士|研究所' THEN 'master'
                WHEN LOWER(person.education) ~ 'university|college|bachelor' OR person.education ~ '大學|學院|學士|學系' THEN 'university'
                WHEN person.education ~ '專科|工專|商專|醫專|護專|警專|五專|二專' THEN 'junior_college'
                WHEN person.education ~ '高中|高職|高級中學|職校' THEN 'high_school'
                WHEN person.education ~ '國中|國民中學|初中|國小|國民小學|小學' THEN 'secondary_or_below'
                ELSE 'other'
            END AS education_key,
            CASE
                WHEN birth.birth_date IS NULL THEN 'unknown'
                WHEN DATE_PART('year', AGE(CURRENT_DATE, birth.birth_date)) >= 0
                 AND DATE_PART('year', AGE(CURRENT_DATE, birth.birth_date)) < 40
                    THEN 'under_40'
                WHEN DATE_PART('year', AGE(CURRENT_DATE, birth.birth_date)) < 50 THEN '40_49'
                WHEN DATE_PART('year', AGE(CURRENT_DATE, birth.birth_date)) < 60 THEN '50_59'
                WHEN DATE_PART('year', AGE(CURRENT_DATE, birth.birth_date)) <= 120 THEN '60_plus'
                ELSE 'unknown'
            END AS age_key,
            (
                person.list_status = 'current'
                OR officer.person_id IS NOT NULL
            ) AS is_current
        FROM party_people person
        LEFT JOIN resolved_birth_dates birth ON birth.person_id = person.person_id
        LEFT JOIN current_party_officers officer ON officer.person_id = person.person_id
    ),
    totals AS (
        SELECT
            COUNT(*)::INTEGER AS total_people,
            COUNT(*) FILTER (WHERE is_current)::INTEGER AS current_people,
            COUNT(*) FILTER (WHERE NOT is_current)::INTEGER AS not_current_people,
            COUNT(*) FILTER (WHERE gender_key = 'male')::INTEGER AS male_people,
            COUNT(*) FILTER (WHERE gender_key = 'female')::INTEGER AS female_people,
            COUNT(*) FILTER (WHERE gender_key = 'unknown')::INTEGER AS unknown_gender_people,
            COUNT(*) FILTER (WHERE age_key = 'under_40')::INTEGER AS under_40_people,
            COUNT(*) FILTER (WHERE age_key = '40_49')::INTEGER AS age_40_49_people,
            COUNT(*) FILTER (WHERE age_key = '50_59')::INTEGER AS age_50_59_people,
            COUNT(*) FILTER (WHERE age_key = '60_plus')::INTEGER AS age_60_plus_people,
            COUNT(*) FILTER (WHERE age_key = 'unknown')::INTEGER AS unknown_age_people,
            COUNT(*) FILTER (WHERE education_key = 'doctorate')::INTEGER AS doctorate_people,
            COUNT(*) FILTER (WHERE education_key = 'master')::INTEGER AS master_people,
            COUNT(*) FILTER (WHERE education_key = 'university')::INTEGER AS university_people,
            COUNT(*) FILTER (WHERE education_key = 'tertiary_unspecified')::INTEGER AS tertiary_unspecified_people,
            COUNT(*) FILTER (WHERE education_key = 'junior_college')::INTEGER AS junior_college_people,
            COUNT(*) FILTER (WHERE education_key = 'high_school')::INTEGER AS high_school_people,
            COUNT(*) FILTER (WHERE education_key = 'secondary_or_below')::INTEGER AS secondary_or_below_people,
            COUNT(*) FILTER (WHERE education_key = 'other')::INTEGER AS other_education_people,
            COUNT(*) FILTER (WHERE education_key = 'unknown')::INTEGER AS unknown_education_people
        FROM normalized_people
    )
    SELECT
        party.party_name,
        bucket.dimension_key,
        bucket.bucket_key,
        bucket.people_count,
        totals.total_people
    FROM normalized_party party
    CROSS JOIN totals
    CROSS JOIN LATERAL (
        VALUES
            ('current_status', 'current', totals.current_people),
            ('current_status', 'not_current', totals.not_current_people),
            ('gender', 'male', totals.male_people),
            ('gender', 'female', totals.female_people),
            ('gender', 'unknown', totals.unknown_gender_people),
            ('age', 'under_40', totals.under_40_people),
            ('age', '40_49', totals.age_40_49_people),
            ('age', '50_59', totals.age_50_59_people),
            ('age', '60_plus', totals.age_60_plus_people),
            ('age', 'unknown', totals.unknown_age_people),
            ('education', 'doctorate', totals.doctorate_people),
            ('education', 'master', totals.master_people),
            ('education', 'university', totals.university_people),
            ('education', 'tertiary_unspecified', totals.tertiary_unspecified_people),
            ('education', 'junior_college', totals.junior_college_people),
            ('education', 'high_school', totals.high_school_people),
            ('education', 'secondary_or_below', totals.secondary_or_below_people),
            ('education', 'other', totals.other_education_people),
            ('education', 'unknown', totals.unknown_education_people)
    ) AS bucket(dimension_key, bucket_key, people_count);
$$;

REVOKE ALL ON FUNCTION published.party_people_statistics(TEXT)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published.party_people_statistics(TEXT)
TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
