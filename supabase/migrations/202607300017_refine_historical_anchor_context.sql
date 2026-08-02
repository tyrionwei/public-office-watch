SET statement_timeout = 0;

CREATE OR REPLACE FUNCTION public.process_historical_anchor_identities()
RETURNS TABLE (
    matched_source_rows INTEGER,
    remaining_source_rows INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, published, pg_temp
AS $$
DECLARE
    v_matched_source_rows INTEGER := 0;
    v_remaining_source_rows INTEGER := 0;
BEGIN
    WITH source_normalized AS MATERIALIZED (
        SELECT
            source.*,
            lower(regexp_replace(
                replace(replace(replace(source.raw_name, '臺', '台'), '羣', '群'), '黄', '黃'),
                E'[\\s‧·．・･•]+',
                '',
                'g'
            )) AS canonical_name,
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
                WHEN source.position LIKE '%縣市長%' OR source.position LIKE '%市長%' THEN 'mayor'
                WHEN source.position LIKE '%議員%' THEN 'councilor'
                ELSE 'other'
            END AS canonical_role
        FROM source_people source
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                substring(replace(source.district, '臺', '台') FROM '^(.+?[縣市])'),
                substring(replace(source.position, '臺', '台') FROM '^(.+?[縣市])')
            ) AS raw_value
        ) geography
    ),
    public_people_normalized AS MATERIALIZED (
        SELECT
            person.id,
            lower(regexp_replace(
                replace(replace(replace(person.name, '臺', '台'), '羣', '群'), '黄', '黃'),
                E'[\\s‧·．・･•]+',
                '',
                'g'
            )) AS canonical_name,
            person.gender,
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
                WHEN person.position LIKE '%縣市長%' OR person.position LIKE '%市長%' THEN 'mayor'
                WHEN person.position LIKE '%議員%' THEN 'councilor'
                ELSE 'other'
            END AS canonical_role
        FROM people person
        JOIN person_canonical_map canonical
          ON canonical.person_id = person.id
         AND canonical.canonical_person_id = person.id
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                substring(replace(person.district, '臺', '台') FROM '^(.+?[縣市])'),
                substring(replace(person.position, '臺', '台') FROM '^(.+?[縣市])')
            ) AS raw_value
        ) geography
        WHERE person.is_public = TRUE
    ),
    safe_source_groups AS (
        SELECT
            canonical_name,
            gender,
            canonical_geography,
            canonical_role,
            canonical_seat_type
        FROM source_normalized
        WHERE source_type = 'official_election'
          AND source_id = 'cec-2024-votedata'
          AND gender IN ('male', 'female')
          AND canonical_geography IS NOT NULL
          AND canonical_role <> 'other'
        GROUP BY canonical_name, gender, canonical_geography, canonical_role, canonical_seat_type
        HAVING COUNT(*) = COUNT(DISTINCT election_year)
    ),
    unique_public_people AS (
        SELECT
            canonical_name,
            gender,
            canonical_geography,
            canonical_role,
            canonical_seat_type,
            MIN(id::TEXT)::UUID AS person_id
        FROM public_people_normalized
        WHERE gender IN ('male', 'female')
          AND canonical_geography IS NOT NULL
          AND canonical_role <> 'other'
        GROUP BY canonical_name, gender, canonical_geography, canonical_role, canonical_seat_type
        HAVING COUNT(*) = 1
    ),
    anchor_people AS (
        SELECT
            source.canonical_name,
            source.gender,
            source.canonical_geography,
            source.canonical_role,
            source.canonical_seat_type,
            COALESCE(canonical.canonical_person_id, identity_match.person_id) AS person_id,
            COUNT(*) AS anchor_count,
            jsonb_agg(DISTINCT source.election_year ORDER BY source.election_year) AS anchor_years
        FROM source_normalized source
        JOIN person_identity_matches identity_match
          ON identity_match.source_person_id = source.id
         AND identity_match.match_status = 'auto_matched'
        LEFT JOIN person_canonical_map canonical ON canonical.person_id = identity_match.person_id
        WHERE source.gender IN ('male', 'female')
          AND source.canonical_geography IS NOT NULL
          AND source.canonical_role <> 'other'
        GROUP BY
            source.canonical_name,
            source.gender,
            source.canonical_geography,
            source.canonical_role,
            source.canonical_seat_type,
            COALESCE(canonical.canonical_person_id, identity_match.person_id)
    ),
    unique_anchor_people AS (
        SELECT
            canonical_name,
            gender,
            canonical_geography,
            canonical_role,
            canonical_seat_type,
            MIN(person_id::TEXT)::UUID AS person_id,
            SUM(anchor_count)::INTEGER AS anchor_count,
            MIN(anchor_years::TEXT)::JSONB AS anchor_years
        FROM anchor_people
        GROUP BY canonical_name, gender, canonical_geography, canonical_role, canonical_seat_type
        HAVING COUNT(DISTINCT person_id) = 1
    ),
    eligible_sources AS (
        SELECT
            source.id AS source_person_id,
            source.source_person_key,
            source.election_year,
            source.party,
            source.district,
            source.canonical_geography,
            source.canonical_role,
            source.canonical_seat_type,
            anchor.person_id,
            anchor.anchor_count,
            anchor.anchor_years
        FROM source_normalized source
        JOIN safe_source_groups safe USING (
            canonical_name,
            gender,
            canonical_geography,
            canonical_role,
            canonical_seat_type
        )
        JOIN unique_anchor_people anchor USING (
            canonical_name,
            gender,
            canonical_geography,
            canonical_role,
            canonical_seat_type
        )
        JOIN unique_public_people public_person USING (
            canonical_name,
            gender,
            canonical_geography,
            canonical_role,
            canonical_seat_type,
            person_id
        )
        WHERE source.source_type = 'official_election'
          AND source.source_id = 'cec-2024-votedata'
          AND NOT EXISTS (
              SELECT 1
              FROM person_identity_matches confirmed
              WHERE confirmed.source_person_id = source.id
                AND confirmed.match_status = 'auto_matched'
          )
          AND NOT EXISTS (
              SELECT 1
              FROM person_identity_matches rejected
              WHERE rejected.source_person_id = source.id
                AND rejected.person_id = anchor.person_id
                AND rejected.match_status = 'rejected_match'
          )
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
            'official_historical_contextual_anchor_v2',
            'auto-approved: a unique official identity anchor has the same canonical name, gender, geography, role, and constituency type; election years are non-duplicated',
            jsonb_build_object(
                'version', 'official-historical-contextual-anchor-v2',
                'canonicalGeography', eligible.canonical_geography,
                'canonicalRole', eligible.canonical_role,
                'canonicalSeatType', eligible.canonical_seat_type,
                'sourceElectionYear', eligible.election_year,
                'sourceParty', eligible.party,
                'sourceDistrict', eligible.district,
                'sourcePersonKey', eligible.source_person_key,
                'anchorCount', eligible.anchor_count,
                'anchorYears', eligible.anchor_years
            ),
            'system:official-historical-contextual-anchor-v2',
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
    INTO v_remaining_source_rows
    FROM source_people source
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-2024-votedata'
      AND NOT EXISTS (
          SELECT 1
          FROM person_identity_matches confirmed
          WHERE confirmed.source_person_id = source.id
            AND confirmed.match_status = 'auto_matched'
      );

    PERFORM published.promote(NULL);

    RETURN QUERY SELECT v_matched_source_rows, v_remaining_source_rows;
END;
$$;

COMMENT ON FUNCTION public.process_historical_anchor_identities() IS
    'Extends unique official identities across historical CEC records using canonical name, gender, geography, role, and indigenous constituency type. Geography falls back to the office label when the district is generic.';

RESET statement_timeout;
