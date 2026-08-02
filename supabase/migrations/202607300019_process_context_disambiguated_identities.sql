SET statement_timeout = 0;

CREATE OR REPLACE FUNCTION public.process_context_disambiguated_identities()
RETURNS TABLE (
    matched_source_rows INTEGER,
    remaining_high_score_rows INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, published, pg_temp
AS $$
DECLARE
    v_matched_source_rows INTEGER := 0;
    v_remaining_high_score_rows INTEGER := 0;
BEGIN
    WITH source_context AS MATERIALIZED (
        SELECT
            source.id,
            source.source_person_key,
            source.raw_name,
            source.gender,
            source.party,
            source.position,
            source.district,
            source.election_year,
            lower(regexp_replace(
                replace(replace(replace(source.raw_name, '臺', '台'), '羣', '群'), '黄', '黃'),
                E'[\\s‧·．・･•]+',
                '',
                'g'
            )) AS canonical_name,
            CASE
                WHEN regexp_replace(replace(COALESCE(source.party, ''), '臺', '台'), E'\\s+', '', 'g') IN ('無', '無黨', '無黨籍') THEN '無黨籍'
                ELSE regexp_replace(replace(COALESCE(source.party, ''), '臺', '台'), E'\\s+', '', 'g')
            END AS canonical_party,
            CASE
                WHEN geography.raw_value IN ('台北縣', '新北市') THEN '新北市'
                WHEN geography.raw_value IN ('桃園縣', '桃園市') THEN '桃園市'
                WHEN geography.raw_value IN ('台中縣', '台中市') THEN '台中市'
                WHEN geography.raw_value IN ('台南縣', '台南市') THEN '台南市'
                WHEN geography.raw_value IN ('高雄縣', '高雄市') THEN '高雄市'
                ELSE geography.raw_value
            END AS canonical_geography,
            CASE
                WHEN concat_ws(' ', source.district, source.position) LIKE '%山地原住民%' THEN 'mountain_indigenous'
                WHEN concat_ws(' ', source.district, source.position) LIKE '%平地原住民%' THEN 'plain_indigenous'
                WHEN concat_ws(' ', source.district, source.position) LIKE '%原住民%' THEN 'indigenous'
                ELSE 'regional'
            END AS canonical_seat_type,
            CASE
                WHEN source.position LIKE '%總統%' THEN 'president'
                WHEN source.position LIKE '%立法委員%' THEN 'legislator'
                WHEN source.position LIKE '%縣市長%' OR source.position LIKE '%市長%' OR source.position LIKE '%地方首長%' THEN 'mayor'
                WHEN source.position LIKE '%議員%' THEN 'councilor'
                ELSE 'other'
            END AS canonical_role,
            review.candidates,
            review.candidate_count,
            review.best_match_score
        FROM source_people source
        JOIN person_identity_review_queue review ON review.source_person_id = source.id
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                substring(replace(source.district, '臺', '台') FROM '^(.+?[縣市])'),
                substring(replace(source.position, '臺', '台') FROM '^(.+?[縣市])')
            ) AS raw_value
        ) geography
        WHERE source.source_type = 'official_election'
          AND source.source_id = 'cec-2024-votedata'
          AND review.review_status = 'probable_match'
          AND review.best_match_score >= 80
          AND review.candidate_count > 1
          AND source.gender IN ('male', 'female')
    ),
    candidate_context AS MATERIALIZED (
        SELECT
            source.id AS source_person_id,
            source.source_person_key,
            source.raw_name,
            source.gender,
            source.party,
            source.position,
            source.district,
            source.election_year,
            source.canonical_name,
            source.canonical_party,
            source.canonical_geography,
            source.canonical_seat_type,
            source.canonical_role,
            source.candidate_count,
            source.best_match_score,
            person.id AS person_id,
            person.gender AS person_gender,
            CASE
                WHEN regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g') IN ('無', '無黨', '無黨籍') THEN '無黨籍'
                ELSE regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g')
            END AS person_party,
            CASE
                WHEN geography.raw_value IN ('台北縣', '新北市') THEN '新北市'
                WHEN geography.raw_value IN ('桃園縣', '桃園市') THEN '桃園市'
                WHEN geography.raw_value IN ('台中縣', '台中市') THEN '台中市'
                WHEN geography.raw_value IN ('台南縣', '台南市') THEN '台南市'
                WHEN geography.raw_value IN ('高雄縣', '高雄市') THEN '高雄市'
                ELSE geography.raw_value
            END AS person_geography,
            CASE
                WHEN concat_ws(' ', person.district, person.position) LIKE '%山地原住民%' THEN 'mountain_indigenous'
                WHEN concat_ws(' ', person.district, person.position) LIKE '%平地原住民%' THEN 'plain_indigenous'
                WHEN concat_ws(' ', person.district, person.position) LIKE '%原住民%' THEN 'indigenous'
                ELSE 'regional'
            END AS person_seat_type,
            CASE
                WHEN person.position LIKE '%總統%' THEN 'president'
                WHEN person.position LIKE '%立法委員%' THEN 'legislator'
                WHEN person.position LIKE '%縣市長%' OR person.position LIKE '%市長%' OR person.position LIKE '%地方首長%' THEN 'mayor'
                WHEN person.position LIKE '%議員%' THEN 'councilor'
                ELSE 'other'
            END AS person_role,
            person.position AS person_position,
            person.district AS person_district
        FROM source_context source
        CROSS JOIN LATERAL jsonb_array_elements(source.candidates) candidate
        JOIN people person ON person.id = (candidate->>'personId')::UUID
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                substring(replace(person.district, '臺', '台') FROM '^(.+?[縣市])'),
                substring(replace(person.position, '臺', '台') FROM '^(.+?[縣市])')
            ) AS raw_value
        ) geography
    ),
    compatible_candidates AS (
        SELECT candidate.*
        FROM candidate_context candidate
        WHERE candidate.person_party = candidate.canonical_party
          AND candidate.person_geography = candidate.canonical_geography
          AND candidate.person_role = candidate.canonical_role
          AND candidate.person_seat_type = candidate.canonical_seat_type
          AND candidate.person_gender IN (candidate.gender, 'unknown')
          AND candidate.canonical_geography IS NOT NULL
          AND candidate.canonical_role <> 'other'
          AND NOT EXISTS (
              SELECT 1
              FROM person_identity_matches rejected
              WHERE rejected.source_person_id = candidate.source_person_id
                AND rejected.person_id = candidate.person_id
                AND rejected.match_status = 'rejected_match'
          )
    ),
    unique_compatible AS (
        SELECT
            source_person_id,
            MIN(person_id::TEXT)::UUID AS person_id,
            MIN(source_person_key) AS source_person_key,
            MIN(election_year) AS election_year,
            MIN(canonical_geography) AS canonical_geography,
            MIN(canonical_role) AS canonical_role,
            MIN(canonical_seat_type) AS canonical_seat_type,
            MIN(party) AS source_party,
            MIN(district) AS source_district,
            MIN(person_position) AS person_position,
            MIN(person_district) AS person_district,
            MIN(person_gender) AS person_gender,
            MIN(candidate_count) AS original_candidate_count,
            MIN(best_match_score) AS original_score
        FROM compatible_candidates
        GROUP BY source_person_id
        HAVING COUNT(DISTINCT person_id) = 1
    ),
    upserted_matches AS (
        INSERT INTO person_identity_matches (
            source_person_id,
            person_id,
            match_status,
            score,
            match_method,
            match_reason,
            evidence_json,
            reviewed_by,
            reviewed_at,
            updated_at
        )
        SELECT
            eligible.source_person_id,
            eligible.person_id,
            'auto_matched',
            99,
            'official_unique_candidate_context_v1',
            'auto-approved: only one candidate in the one-to-many review set matches party, geography, role, constituency type, and compatible gender',
            jsonb_build_object(
                'version', 'official-unique-candidate-context-v1',
                'electionYear', eligible.election_year,
                'canonicalGeography', eligible.canonical_geography,
                'canonicalRole', eligible.canonical_role,
                'canonicalSeatType', eligible.canonical_seat_type,
                'sourceParty', eligible.source_party,
                'sourceDistrict', eligible.source_district,
                'sourcePersonKey', eligible.source_person_key,
                'personPosition', eligible.person_position,
                'personDistrict', eligible.person_district,
                'personGender', eligible.person_gender,
                'originalCandidateCount', eligible.original_candidate_count,
                'originalScore', eligible.original_score
            ),
            'system:official-unique-candidate-context-v1',
            NOW(),
            NOW()
        FROM unique_compatible eligible
        ON CONFLICT (source_person_id, person_id) DO UPDATE
        SET
            match_status = EXCLUDED.match_status,
            score = EXCLUDED.score,
            match_method = EXCLUDED.match_method,
            match_reason = EXCLUDED.match_reason,
            evidence_json = EXCLUDED.evidence_json,
            reviewed_by = EXCLUDED.reviewed_by,
            reviewed_at = EXCLUDED.reviewed_at,
            updated_at = EXCLUDED.updated_at
        RETURNING source_person_id
    ),
    published_sources AS (
        UPDATE source_people source
        SET is_public = TRUE, updated_at = NOW()
        FROM upserted_matches matched
        WHERE source.id = matched.source_person_id
          AND source.is_public = FALSE
        RETURNING source.id
    )
    SELECT COUNT(*)::INTEGER
    INTO v_matched_source_rows
    FROM upserted_matches;

    SELECT COUNT(*)::INTEGER
    INTO v_remaining_high_score_rows
    FROM person_identity_review_queue review
    JOIN source_people source ON source.id = review.source_person_id
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-2024-votedata'
      AND review.best_match_score >= 80;

    PERFORM published.promote(NULL);

    RETURN QUERY SELECT v_matched_source_rows, v_remaining_high_score_rows;
END;
$$;

COMMENT ON FUNCTION public.process_context_disambiguated_identities() IS
    'Resolves one-to-many CEC identity reviews only when complete election context leaves one compatible canonical person; unresolved ambiguity remains manual.';

SELECT * FROM public.process_context_disambiguated_identities();

RESET statement_timeout;
