CREATE OR REPLACE FUNCTION public.process_historical_priority_identities(
    p_family_reference_names JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
    created_people INTEGER,
    matched_source_rows INTEGER,
    remaining_source_rows INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, published, pg_temp
AS $$
DECLARE
    v_created_people INTEGER := 0;
    v_matched_source_rows INTEGER := 0;
    v_remaining_source_rows INTEGER := 0;
BEGIN
    WITH family_names AS (
        SELECT DISTINCT lower(regexp_replace(
            replace(replace(replace(value, '臺', '台'), '羣', '群'), '黄', '黃'),
            E'\\s+',
            '',
            'g'
        )) AS normalized_name
        FROM jsonb_array_elements_text(COALESCE(p_family_reference_names, '[]'::JSONB)) value
    ),
    source_base AS (
        SELECT
            source.id AS source_person_id,
            source.source_person_key,
            source.raw_name,
            canonical_name.normalized_name,
            source.gender,
            source.party,
            source.position,
            source.district,
            source.election_year,
            source.source_url,
            source.source_payload,
            COALESCE((source.source_payload->>'elected')::BOOLEAN, FALSE) AS elected,
            family.normalized_name IS NOT NULL AS dark_guide_family_reference,
            CASE
                WHEN raw_region IN ('台北縣', '新北市') THEN '新北市'
                WHEN raw_region IN ('桃園縣', '桃園市') THEN '桃園市'
                WHEN raw_region IN ('台中縣', '台中市') THEN '台中市'
                WHEN raw_region IN ('台南縣', '台南市') THEN '台南市'
                WHEN raw_region IN ('高雄縣', '高雄市') THEN '高雄市'
                WHEN raw_region IS NOT NULL THEN raw_region
                WHEN source.source_payload->>'countySubCode' = '001' THEN '新北市'
                WHEN source.source_payload->>'countySubCode' = '002' THEN '宜蘭縣'
                WHEN source.source_payload->>'countySubCode' = '003' THEN '桃園市'
                WHEN source.source_payload->>'countySubCode' = '004' THEN '新竹縣'
                WHEN source.source_payload->>'countySubCode' = '005' THEN '苗栗縣'
                WHEN source.source_payload->>'countySubCode' = '006' THEN '台中市'
                WHEN source.source_payload->>'countySubCode' = '007' THEN '彰化縣'
                WHEN source.source_payload->>'countySubCode' = '008' THEN '南投縣'
                WHEN source.source_payload->>'countySubCode' = '009' THEN '雲林縣'
                WHEN source.source_payload->>'countySubCode' = '010' THEN '嘉義縣'
                WHEN source.source_payload->>'countySubCode' = '011' THEN '台南市'
                WHEN source.source_payload->>'countySubCode' = '012' THEN '高雄市'
                WHEN source.source_payload->>'countySubCode' = '013' THEN '屏東縣'
                WHEN source.source_payload->>'countySubCode' = '014' THEN '台東縣'
                WHEN source.source_payload->>'countySubCode' = '015' THEN '花蓮縣'
                WHEN source.source_payload->>'countySubCode' = '016' THEN '澎湖縣'
                WHEN source.source_payload->>'countySubCode' = '017' THEN '基隆市'
                WHEN source.source_payload->>'countySubCode' = '018' THEN '新竹市'
                WHEN source.source_payload->>'countySubCode' = '019' THEN '台中市'
                WHEN source.source_payload->>'countySubCode' = '020' THEN '嘉義市'
                WHEN source.source_payload->>'countySubCode' = '021' THEN '台南市'
                WHEN source.source_payload->>'countySubCode' = '022' THEN '金門縣'
                WHEN source.source_payload->>'countySubCode' = '023' THEN '連江縣'
                WHEN source.source_payload->>'countyCode' = '63' THEN '台北市'
                WHEN source.source_payload->>'countyCode' = '64' THEN '高雄市'
                WHEN source.source_payload->>'countyCode' = '65' THEN '新北市'
                WHEN source.source_payload->>'countyCode' = '66' THEN '台中市'
                WHEN source.source_payload->>'countyCode' = '67' THEN '台南市'
                WHEN source.source_payload->>'countyCode' = '68' THEN '桃園市'
                WHEN source.election_year <= 2006 AND source.source_payload->>'countyCode' = '01' THEN '台北市'
                WHEN source.election_year <= 2006 AND source.source_payload->>'countyCode' = '02' THEN '高雄市'
                ELSE NULL
            END AS geography
        FROM source_people source
        CROSS JOIN LATERAL (
            SELECT substring(replace(source.district, '臺', '台') FROM '^(.+?[縣市])') AS raw_region
        ) region
        CROSS JOIN LATERAL (
            SELECT lower(regexp_replace(
                replace(replace(replace(source.raw_name, '臺', '台'), '羣', '群'), '黄', '黃'),
                E'\\s+',
                '',
                'g'
            )) AS normalized_name
        ) canonical_name
        LEFT JOIN family_names family ON family.normalized_name = canonical_name.normalized_name
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
              FROM people person
              WHERE person.is_public = TRUE
                AND lower(regexp_replace(
                    replace(replace(replace(person.name, '臺', '台'), '羣', '群'), '黄', '黃'),
                    E'\\s+',
                    '',
                    'g'
                )) = canonical_name.normalized_name
          )
    ),
    safe_names AS (
        SELECT
            normalized_name,
            MIN(gender) AS gender,
            MIN(geography) AS geography,
            COUNT(*) AS source_count,
            BOOL_OR(elected) AS ever_elected,
            BOOL_OR(dark_guide_family_reference) AS dark_guide_family_reference,
            jsonb_agg(DISTINCT election_year ORDER BY election_year) AS election_years
        FROM source_base
        GROUP BY normalized_name
        HAVING COUNT(*) = COUNT(DISTINCT election_year)
           AND COUNT(DISTINCT gender) = 1
           AND MIN(gender) IN ('male', 'female')
           AND COUNT(*) = COUNT(geography)
           AND COUNT(DISTINCT geography) = 1
           AND (
               BOOL_OR(elected)
               OR BOOL_OR(dark_guide_family_reference)
               OR COUNT(*) >= 2
           )
    ),
    priority_sources AS (
        SELECT
            source.*,
            safe.gender AS resolved_gender,
            safe.geography AS resolved_geography,
            safe.source_count,
            safe.ever_elected,
            safe.dark_guide_family_reference AS family_reference,
            safe.election_years
        FROM source_base source
        JOIN safe_names safe ON safe.normalized_name = source.normalized_name
    ),
    priority_people AS (
        SELECT DISTINCT ON (source.normalized_name)
            md5(
                'historical-official-identity-v1|' || source.normalized_name || '|' ||
                source.resolved_gender || '|' || source.resolved_geography
            )::UUID AS person_id,
            source.normalized_name,
            source.raw_name,
            source.party,
            source.position,
            source.district,
            source.election_year,
            source.source_url,
            source.resolved_gender,
            source.resolved_geography,
            source.source_count,
            source.ever_elected,
            source.family_reference,
            source.election_years
        FROM priority_sources source
        ORDER BY source.normalized_name, source.election_year DESC, source.elected DESC, source.source_person_id
    ),
    inserted_people AS (
        INSERT INTO people (
            id, name, party, position, election_year, district, source_url,
            is_public, external_id, gender, updated_at
        )
        SELECT
            priority.person_id,
            priority.raw_name,
            CASE WHEN priority.party = '無' THEN '無黨籍' ELSE priority.party END,
            priority.position,
            priority.election_year,
            priority.district,
            priority.source_url,
            TRUE,
            'cec-historical-priority:' || priority.person_id::TEXT,
            priority.resolved_gender,
            NOW()
        FROM priority_people priority
        ON CONFLICT (id) DO NOTHING
        RETURNING id
    ),
    ready_people AS (
        SELECT priority.*
        FROM priority_people priority
        WHERE EXISTS (SELECT 1 FROM people existing WHERE existing.id = priority.person_id)
           OR EXISTS (SELECT 1 FROM inserted_people inserted WHERE inserted.id = priority.person_id)
    ),
    upserted_matches AS (
        INSERT INTO person_identity_matches (
            source_person_id, person_id, match_status, score, match_method,
            match_reason, evidence_json, reviewed_by, reviewed_at, updated_at
        )
        SELECT
            source.source_person_id,
            priority.person_id,
            'auto_matched',
            CASE WHEN source.ever_elected THEN 100 WHEN source.family_reference THEN 98 ELSE 96 END,
            'official_historical_priority_identity_v1',
            concat_ws(
                '; ',
                CASE WHEN source.ever_elected THEN 'at least one official election record is elected' END,
                CASE WHEN source.family_reference THEN 'explicitly named in a TNL Dark Guide political-family claim' END,
                CASE WHEN source.source_count >= 2 THEN 'same name, gender, and geography recur across election years' END
            ),
            jsonb_build_object(
                'version', 'official-historical-priority-identity-v1',
                'geography', source.resolved_geography,
                'electionYears', source.election_years,
                'everElected', source.ever_elected,
                'darkGuideFamilyReference', source.family_reference,
                'sourceCount', source.source_count,
                'sourcePersonKey', source.source_person_key,
                'candidateNo', source.source_payload->>'candidateNo'
            ),
            'system:official-historical-priority-identity-v1',
            NOW(),
            NOW()
        FROM priority_sources source
        JOIN ready_people priority USING (normalized_name)
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
        SET
            is_public = TRUE,
            updated_at = NOW()
        FROM upserted_matches matched
        WHERE source.id = matched.source_person_id
          AND source.is_public = FALSE
        RETURNING source.id
    )
    SELECT
        (SELECT COUNT(*)::INTEGER FROM inserted_people),
        (SELECT COUNT(*)::INTEGER FROM upserted_matches)
    INTO v_created_people, v_matched_source_rows;

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

    RETURN QUERY SELECT v_created_people, v_matched_source_rows, v_remaining_source_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.process_historical_priority_identities(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_historical_priority_identities(JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.process_historical_priority_identities(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_historical_priority_identities(JSONB) TO service_role;

COMMENT ON FUNCTION public.process_historical_priority_identities(JSONB) IS
    'Creates and matches safe historical CEC identities in priority order: elected people, named Dark Guide family references, then repeated cross-year candidacies. Ambiguous names remain in review.';
