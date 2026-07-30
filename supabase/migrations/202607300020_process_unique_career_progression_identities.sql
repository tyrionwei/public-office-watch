CREATE OR REPLACE FUNCTION public.process_unique_career_progression_identities()
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
          AND review.candidate_count > 0
          AND source.gender IN ('male', 'female')
    ),
    candidate_context AS MATERIALIZED (
        SELECT
            source.id AS source_person_id,
            source.source_person_key,
            source.gender,
            source.party,
            source.district,
            source.election_year,
            source.canonical_party,
            source.canonical_geography,
            source.canonical_role,
            source.candidate_count,
            source.best_match_score,
            person.id AS person_id,
            person.external_id AS person_external_id,
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
        WHERE candidate.person_gender = candidate.gender
          AND candidate.person_party = candidate.canonical_party
          AND candidate.person_geography = candidate.canonical_geography
          AND candidate.person_role <> candidate.canonical_role
          AND candidate.canonical_geography IS NOT NULL
          AND candidate.canonical_role <> 'other'
          AND candidate.person_role <> 'other'
          AND (
              candidate.person_external_id LIKE 'cec-%'
              OR candidate.person_external_id LIKE 'ly-%'
              OR EXISTS (
                  SELECT 1
                  FROM person_identity_matches anchor
                  JOIN source_people anchor_source ON anchor_source.id = anchor.source_person_id
                  LEFT JOIN person_canonical_map anchor_map ON anchor_map.person_id = anchor.person_id
                  WHERE anchor.match_status = 'auto_matched'
                    AND COALESCE(anchor_map.canonical_person_id, anchor.person_id) = candidate.person_id
                    AND anchor_source.source_type IN (
                        'official_election',
                        'official_officeholder',
                        'government_open_data',
                        'official_site'
                    )
              )
          )
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
            MIN(person_external_id) AS person_external_id,
            MIN(source_person_key) AS source_person_key,
            MIN(election_year) AS election_year,
            MIN(canonical_geography) AS canonical_geography,
            MIN(canonical_role) AS source_role,
            MIN(party) AS source_party,
            MIN(district) AS source_district,
            MIN(person_position) AS person_position,
            MIN(person_district) AS person_district,
            MIN(person_role) AS person_role,
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
            97,
            'official_unique_career_progression_v2',
            'auto-approved: one officially anchored person has the same name, known gender, party, and geography; the differing office is consistent with a political career progression',
            jsonb_build_object(
                'version', 'official-unique-career-progression-v2',
                'electionYear', eligible.election_year,
                'canonicalGeography', eligible.canonical_geography,
                'sourceRole', eligible.source_role,
                'personRole', eligible.person_role,
                'sourceParty', eligible.source_party,
                'sourceDistrict', eligible.source_district,
                'sourcePersonKey', eligible.source_person_key,
                'personExternalId', eligible.person_external_id,
                'personPosition', eligible.person_position,
                'personDistrict', eligible.person_district,
                'originalCandidateCount', eligible.original_candidate_count,
                'originalScore', eligible.original_score
            ),
            'system:official-unique-career-progression-v2',
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

COMMENT ON FUNCTION public.process_unique_career_progression_identities() IS
    'Links historical CEC records to one official person when name, known gender, party, and geography agree but the public office has changed. Direct CEC and Legislative Yuan person IDs count as official anchors.';

SELECT * FROM public.process_unique_career_progression_identities();
