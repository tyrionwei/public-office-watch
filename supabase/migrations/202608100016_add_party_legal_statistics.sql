BEGIN;

CREATE OR REPLACE FUNCTION published.party_legal_statistics(
    p_party_name TEXT
)
RETURNS TABLE (
    party_name TEXT,
    total_people INTEGER,
    final_conviction_people INTEGER,
    non_final_people INTEGER,
    other_record_people INTEGER,
    acquittal_only_people INTEGER,
    no_confirmed_record_people INTEGER,
    confirmed_record_people INTEGER,
    record_count INTEGER,
    final_conviction_records INTEGER,
    non_final_records INTEGER,
    other_records INTEGER,
    acquittal_records INTEGER
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
        SELECT person.person_id
        FROM published.people person
        CROSS JOIN normalized_party party
        WHERE party.party_name IS NOT NULL
          AND NULLIF(BTRIM(person.party), '') = party.party_name
    ),
    raw_criminal_records AS MATERIALIZED (
        SELECT
            claim.id AS claim_id,
            claim.person_id,
            claim.claim_json->>'caseStage' AS case_stage
        FROM public.person_claims claim
        WHERE claim.claim_type = 'legal_case'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public
          AND claim.claim_json->>'recordType' = 'criminal'
    ),
    record_owner_walk(claim_id, current_person_id, path, depth) AS (
        SELECT
            record.claim_id,
            record.person_id,
            ARRAY[record.person_id],
            0
        FROM raw_criminal_records record

        UNION ALL

        SELECT
            owner.claim_id,
            decision.canonical_person_id,
            owner.path || decision.canonical_person_id,
            owner.depth + 1
        FROM record_owner_walk owner
        JOIN public.person_merge_decisions decision
          ON decision.duplicate_person_id = owner.current_person_id
         AND decision.status = 'verified'
        WHERE owner.depth < 20
          AND NOT decision.canonical_person_id = ANY (owner.path)
    ),
    record_owners AS (
        SELECT DISTINCT ON (owner.claim_id)
            owner.claim_id,
            owner.current_person_id AS person_id
        FROM record_owner_walk owner
        ORDER BY owner.claim_id, owner.depth DESC
    ),
    criminal_records AS MATERIALIZED (
        SELECT
            record.claim_id,
            owner.person_id,
            record.case_stage
        FROM raw_criminal_records record
        JOIN record_owners owner USING (claim_id)
        JOIN party_people person ON person.person_id = owner.person_id
    ),
    classified_records AS (
        SELECT
            record.claim_id,
            record.person_id,
            CASE
                WHEN record.case_stage IN (
                    'criminal_judgment_final',
                    'historical_criminal_judgment_final',
                    'historical_self_reported_conviction'
                ) THEN 'final_conviction'
                WHEN record.case_stage IN (
                    'criminal_judgment_non_final',
                    'criminal_judgment_first_instance',
                    'criminal_judgment_appellate_non_final',
                    'acquitted_non_final'
                ) THEN 'non_final'
                WHEN record.case_stage IN (
                    'acquitted_final',
                    'criminal_acquittal_final',
                    'non_prosecution'
                ) THEN 'acquittal'
                ELSE 'other'
            END AS category
        FROM criminal_records record
    ),
    person_categories AS (
        SELECT
            record.person_id,
            CASE
                WHEN BOOL_OR(record.category = 'final_conviction') THEN 'final_conviction'
                WHEN BOOL_OR(record.category = 'non_final') THEN 'non_final'
                WHEN BOOL_OR(record.category = 'other') THEN 'other'
                ELSE 'acquittal'
            END AS category
        FROM classified_records record
        GROUP BY record.person_id
    ),
    person_totals AS (
        SELECT
            COUNT(*)::INTEGER AS total_people,
            COUNT(*) FILTER (WHERE category.category = 'final_conviction')::INTEGER AS final_conviction_people,
            COUNT(*) FILTER (WHERE category.category = 'non_final')::INTEGER AS non_final_people,
            COUNT(*) FILTER (WHERE category.category = 'other')::INTEGER AS other_record_people,
            COUNT(*) FILTER (WHERE category.category = 'acquittal')::INTEGER AS acquittal_only_people,
            COUNT(*) FILTER (WHERE category.category IS NULL)::INTEGER AS no_confirmed_record_people,
            COUNT(*) FILTER (WHERE category.category IS NOT NULL)::INTEGER AS confirmed_record_people
        FROM party_people person
        LEFT JOIN person_categories category ON category.person_id = person.person_id
    ),
    record_totals AS (
        SELECT
            COUNT(*)::INTEGER AS record_count,
            COUNT(*) FILTER (WHERE category = 'final_conviction')::INTEGER AS final_conviction_records,
            COUNT(*) FILTER (WHERE category = 'non_final')::INTEGER AS non_final_records,
            COUNT(*) FILTER (WHERE category = 'other')::INTEGER AS other_records,
            COUNT(*) FILTER (WHERE category = 'acquittal')::INTEGER AS acquittal_records
        FROM classified_records
    )
    SELECT
        party.party_name,
        people.total_people,
        people.final_conviction_people,
        people.non_final_people,
        people.other_record_people,
        people.acquittal_only_people,
        people.no_confirmed_record_people,
        people.confirmed_record_people,
        records.record_count,
        records.final_conviction_records,
        records.non_final_records,
        records.other_records,
        records.acquittal_records
    FROM normalized_party party
    CROSS JOIN person_totals people
    CROSS JOIN record_totals records;
$$;

REVOKE ALL ON FUNCTION published.party_legal_statistics(TEXT)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published.party_legal_statistics(TEXT)
TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
