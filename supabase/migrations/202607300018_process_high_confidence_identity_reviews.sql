SET statement_timeout = 0;

CREATE OR REPLACE FUNCTION public.process_high_confidence_identity_reviews()
RETURNS TABLE (
    votetw_crosschecked_rows INTEGER,
    unique_context_rows INTEGER,
    remaining_high_score_rows INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, published, pg_temp
AS $$
DECLARE
    v_votetw_crosschecked_rows INTEGER := 0;
    v_unique_context_rows INTEGER := 0;
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
            COALESCE(
                NULLIF(NULLIF(source.source_payload->>'districtCode', '')::INTEGER, 0),
                (regexp_match(public.normalize_election_district_label(source.district), '第([0-9]+)(選舉區|選區)'))[1]::INTEGER
            ) AS district_number,
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
          AND review.candidate_count > 0
    ),
    votetw_context AS MATERIALIZED (
        SELECT
            reference.id AS source_person_id,
            reference.source_person_key,
            lower(regexp_replace(
                replace(replace(replace(reference.raw_name, '臺', '台'), '羣', '群'), '黄', '黃'),
                E'[\\s‧·．・･•]+',
                '',
                'g'
            )) AS canonical_name,
            CASE
                WHEN regexp_replace(replace(COALESCE(reference.party, ''), '臺', '台'), E'\\s+', '', 'g') IN ('無', '無黨', '無黨籍') THEN '無黨籍'
                ELSE regexp_replace(replace(COALESCE(reference.party, ''), '臺', '台'), E'\\s+', '', 'g')
            END AS canonical_party,
            CASE
                WHEN geography.raw_value IN ('台北縣', '新北市') THEN '新北市'
                WHEN geography.raw_value IN ('桃園縣', '桃園市') THEN '桃園市'
                WHEN geography.raw_value IN ('台中縣', '台中市') THEN '台中市'
                WHEN geography.raw_value IN ('台南縣', '台南市') THEN '台南市'
                WHEN geography.raw_value IN ('高雄縣', '高雄市') THEN '高雄市'
                ELSE geography.raw_value
            END AS canonical_geography,
            (regexp_match(public.normalize_election_district_label(reference.district), '第([0-9]+)(選舉區|選區)'))[1]::INTEGER AS district_number,
            CASE
                WHEN concat_ws(' ', reference.district, reference.position) LIKE '%山地原住民%' THEN 'mountain_indigenous'
                WHEN concat_ws(' ', reference.district, reference.position) LIKE '%平地原住民%' THEN 'plain_indigenous'
                WHEN concat_ws(' ', reference.district, reference.position) LIKE '%原住民%' THEN 'indigenous'
                ELSE 'regional'
            END AS canonical_seat_type,
            CASE
                WHEN reference.position LIKE '%總統%' THEN 'president'
                WHEN reference.position LIKE '%立法委員%' THEN 'legislator'
                WHEN reference.position LIKE '%縣市長%' OR reference.position LIKE '%市長%' OR reference.position LIKE '%地方首長%' THEN 'mayor'
                WHEN reference.position LIKE '%議員%' THEN 'councilor'
                ELSE 'other'
            END AS canonical_role,
            reference.election_year,
            reference.party,
            reference.position,
            reference.district,
            COALESCE(canonical.canonical_person_id, identity_match.person_id) AS person_id
        FROM source_people reference
        JOIN person_identity_matches identity_match
          ON identity_match.source_person_id = reference.id
         AND identity_match.match_status = 'auto_matched'
        LEFT JOIN person_canonical_map canonical ON canonical.person_id = identity_match.person_id
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                substring(replace(reference.district, '臺', '台') FROM '^(.+?[縣市])'),
                substring(replace(reference.position, '臺', '台') FROM '^(.+?[縣市])')
            ) AS raw_value
        ) geography
        WHERE reference.source_id = 'votetw-election-history'
    ),
    corroborated_candidates AS (
        SELECT
            source.id AS source_person_id,
            reference.person_id,
            MIN(reference.source_person_key) AS reference_source_person_key,
            MIN(reference.district) AS reference_district,
            MIN(source.district) AS source_district,
            MIN(source.election_year) AS election_year,
            MIN(source.canonical_geography) AS canonical_geography,
            MIN(source.district_number) AS district_number,
            MIN(source.canonical_role) AS canonical_role,
            MIN(source.canonical_seat_type) AS canonical_seat_type,
            MIN(source.party) AS source_party,
            COUNT(*) AS corroborating_reference_count
        FROM source_context source
        JOIN votetw_context reference
          ON reference.canonical_name = source.canonical_name
         AND reference.election_year = source.election_year
         AND reference.canonical_party = source.canonical_party
         AND reference.canonical_geography = source.canonical_geography
         AND reference.canonical_role = source.canonical_role
         AND reference.canonical_seat_type = source.canonical_seat_type
         AND (
              source.canonical_seat_type <> 'regional'
              OR (
                  source.district_number IS NOT NULL
                  AND reference.district_number = source.district_number
              )
         )
        WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements(source.candidates) candidate
            WHERE (candidate->>'personId')::UUID = reference.person_id
        )
          AND NOT EXISTS (
              SELECT 1
              FROM person_identity_matches rejected
              WHERE rejected.source_person_id = source.id
                AND rejected.person_id = reference.person_id
                AND rejected.match_status = 'rejected_match'
          )
        GROUP BY source.id, reference.person_id
    ),
    corroborated_counts AS (
        SELECT
            source_person_id,
            COUNT(*) AS corroborated_person_count
        FROM corroborated_candidates
        GROUP BY source_person_id
    ),
    unique_corroborated AS (
        SELECT candidate.*
        FROM corroborated_candidates candidate
        JOIN corroborated_counts counts USING (source_person_id)
        WHERE counts.corroborated_person_count = 1
    ),
    votetw_upserts AS (
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
            100,
            'official_votetw_exact_election_crosscheck_v1',
            'auto-approved: the same election year, party, geography, district, role, and constituency type identify one VoteTW-linked canonical person',
            jsonb_build_object(
                'version', 'official-votetw-exact-election-crosscheck-v1',
                'electionYear', eligible.election_year,
                'canonicalGeography', eligible.canonical_geography,
                'districtNumber', eligible.district_number,
                'canonicalRole', eligible.canonical_role,
                'canonicalSeatType', eligible.canonical_seat_type,
                'sourceParty', eligible.source_party,
                'sourceDistrict', eligible.source_district,
                'referenceSourcePersonKey', eligible.reference_source_person_key,
                'referenceDistrict', eligible.reference_district
            ),
            'system:official-votetw-exact-election-crosscheck-v1',
            NOW(),
            NOW()
        FROM unique_corroborated eligible
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
    published_votetw_sources AS (
        UPDATE source_people source
        SET is_public = TRUE, updated_at = NOW()
        FROM votetw_upserts matched
        WHERE source.id = matched.source_person_id
          AND source.is_public = FALSE
        RETURNING source.id
    )
    SELECT COUNT(*)::INTEGER
    INTO v_votetw_crosschecked_rows
    FROM votetw_upserts;

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
            (review.candidates -> 0 ->> 'personId')::UUID AS person_id,
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
          AND review.candidate_count = 1
          AND source.gender IN ('male', 'female')
    ),
    person_context AS MATERIALIZED (
        SELECT
            person.id,
            person.gender,
            CASE
                WHEN regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g') IN ('無', '無黨', '無黨籍') THEN '無黨籍'
                ELSE regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g')
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
                WHEN concat_ws(' ', person.district, person.position) LIKE '%山地原住民%' THEN 'mountain_indigenous'
                WHEN concat_ws(' ', person.district, person.position) LIKE '%平地原住民%' THEN 'plain_indigenous'
                WHEN concat_ws(' ', person.district, person.position) LIKE '%原住民%' THEN 'indigenous'
                ELSE 'regional'
            END AS canonical_seat_type,
            CASE
                WHEN person.position LIKE '%總統%' THEN 'president'
                WHEN person.position LIKE '%立法委員%' THEN 'legislator'
                WHEN person.position LIKE '%縣市長%' OR person.position LIKE '%市長%' OR person.position LIKE '%地方首長%' THEN 'mayor'
                WHEN person.position LIKE '%議員%' THEN 'councilor'
                ELSE 'other'
            END AS canonical_role
        FROM people person
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                substring(replace(person.district, '臺', '台') FROM '^(.+?[縣市])'),
                substring(replace(person.position, '臺', '台') FROM '^(.+?[縣市])')
            ) AS raw_value
        ) geography
    ),
    eligible_sources AS (
        SELECT source.*
        FROM source_context source
        JOIN person_context person ON person.id = source.person_id
        WHERE person.gender = source.gender
          AND person.canonical_party = source.canonical_party
          AND person.canonical_geography = source.canonical_geography
          AND person.canonical_role = source.canonical_role
          AND person.canonical_seat_type = source.canonical_seat_type
          AND source.canonical_geography IS NOT NULL
          AND source.canonical_role <> 'other'
          AND NOT EXISTS (
              SELECT 1
              FROM source_context collision
              WHERE collision.id <> source.id
                AND collision.canonical_name = source.canonical_name
                AND collision.gender = source.gender
                AND collision.canonical_geography = source.canonical_geography
                AND collision.canonical_role = source.canonical_role
                AND collision.canonical_seat_type = source.canonical_seat_type
                AND collision.election_year = source.election_year
          )
          AND NOT EXISTS (
              SELECT 1
              FROM person_identity_matches rejected
              WHERE rejected.source_person_id = source.id
                AND rejected.person_id = source.person_id
                AND rejected.match_status = 'rejected_match'
          )
    ),
    context_upserts AS (
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
            eligible.id,
            eligible.person_id,
            'auto_matched',
            98,
            'official_unique_complete_context_v1',
            'auto-approved: one canonical candidate has the same name, gender, party, geography, role, and constituency type with no same-year contextual collision',
            jsonb_build_object(
                'version', 'official-unique-complete-context-v1',
                'electionYear', eligible.election_year,
                'canonicalGeography', eligible.canonical_geography,
                'canonicalRole', eligible.canonical_role,
                'canonicalSeatType', eligible.canonical_seat_type,
                'sourceParty', eligible.party,
                'sourceDistrict', eligible.district,
                'sourcePersonKey', eligible.source_person_key,
                'originalScore', eligible.best_match_score
            ),
            'system:official-unique-complete-context-v1',
            NOW(),
            NOW()
        FROM eligible_sources eligible
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
    published_context_sources AS (
        UPDATE source_people source
        SET is_public = TRUE, updated_at = NOW()
        FROM context_upserts matched
        WHERE source.id = matched.source_person_id
          AND source.is_public = FALSE
        RETURNING source.id
    )
    SELECT COUNT(*)::INTEGER
    INTO v_unique_context_rows
    FROM context_upserts;

    SELECT COUNT(*)::INTEGER
    INTO v_remaining_high_score_rows
    FROM person_identity_review_queue review
    JOIN source_people source ON source.id = review.source_person_id
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-2024-votedata'
      AND review.best_match_score >= 80;

    PERFORM published.promote(NULL);

    RETURN QUERY
    SELECT
        v_votetw_crosschecked_rows,
        v_unique_context_rows,
        v_remaining_high_score_rows;
END;
$$;

COMMENT ON FUNCTION public.process_high_confidence_identity_reviews() IS
    'Auto-matches high-score CEC identities only after exact VoteTW election corroboration or a unique full-context comparison; ambiguous one-to-many candidates remain in review.';

SELECT * FROM public.process_high_confidence_identity_reviews();

RESET statement_timeout;
