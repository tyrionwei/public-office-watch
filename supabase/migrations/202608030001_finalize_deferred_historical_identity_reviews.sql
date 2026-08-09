SET statement_timeout = 0;

-- Re-run the existing conservative identity rules after all historical
-- councilor batches have been loaded. Those batches were added after the
-- original rule migrations ran, leaving otherwise resolvable rows pending.
SELECT * FROM public.process_historical_anchor_identities();
SELECT * FROM public.process_unique_career_progression_identities();

CREATE TEMP TABLE _verified_mayor_councilor_identities (
    source_person_key TEXT PRIMARY KEY,
    canonical_external_id TEXT NOT NULL,
    expected_name TEXT NOT NULL,
    election_year INTEGER NOT NULL
);

INSERT INTO _verified_mayor_councilor_identities (
    source_person_key,
    canonical_external_id,
    expected_name,
    election_year
)
VALUES
    ('cec-historical:18b77b26ce0d', 'cec-2022-local-mayor-person-feab0f79c89c', '林姿妙', 1998),
    ('cec-historical:fe71464882f2', 'cec-2022-local-mayor-person-feab0f79c89c', '林姿妙', 2002),
    ('cec-historical:a2c3cc04ce39', 'cec-2022-local-mayor-person-feab0f79c89c', '林姿妙', 2005),
    ('cec-historical:3a78de1c132c', 'cec-2022-local-mayor-person-2c8ce4e3c2f4', '王惠美', 1998),
    ('cec-historical:9abb5c55ea6e', 'cec-2022-local-mayor-person-2c8ce4e3c2f4', '王惠美', 2002),
    ('cec-historical:16bcd6ef31cb', 'cec-2022-local-mayor-person-29d92d911357', '饒慶鈴', 2005),
    ('cec-historical:9ece9a2c1f18', 'cec-2022-local-mayor-person-29d92d911357', '饒慶鈴', 2009),
    ('cec-historical:f336ca91f678', 'cec-2022-local-mayor-person-29d92d911357', '饒慶鈴', 2014);

DO $$
DECLARE
    v_eligible_rows INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER
    INTO v_eligible_rows
    FROM _verified_mayor_councilor_identities verified
    JOIN source_people source
      ON source.source_person_key = verified.source_person_key
     AND source.raw_name = verified.expected_name
     AND source.election_year = verified.election_year
     AND source.source_type = 'official_election'
     AND source.source_id = 'cec-2024-votedata'
    JOIN people person
      ON person.external_id = verified.canonical_external_id
     AND person.name = verified.expected_name
     AND person.gender = source.gender
     AND regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g')
         = regexp_replace(replace(COALESCE(source.party, ''), '臺', '台'), E'\\s+', '', 'g')
     AND replace(source.district, '臺', '台') LIKE replace(person.district, '臺', '台') || '%';

    IF v_eligible_rows <> 8 THEN
        RAISE EXCEPTION
            'Expected 8 verified mayor/councilor identity rows, found %',
            v_eligible_rows;
    END IF;
END;
$$;

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
    source.id,
    person.id,
    'auto_matched',
    100,
    'official_mayor_councilor_career_anchor_v1',
    'confirmed: official CEC records identify one person across councilor and county magistrate elections with the same name, gender, party, and county',
    jsonb_build_object(
        'version', 'official-mayor-councilor-career-anchor-v1',
        'sourcePersonKey', source.source_person_key,
        'sourceElectionYear', source.election_year,
        'sourcePosition', source.position,
        'sourceDistrict', source.district,
        'canonicalExternalId', person.external_id,
        'canonicalPosition', person.position,
        'canonicalDistrict', person.district
    ),
    'system:official-mayor-councilor-career-anchor-v1',
    NOW(),
    NOW()
FROM _verified_mayor_councilor_identities verified
JOIN source_people source
  ON source.source_person_key = verified.source_person_key
JOIN people person
  ON person.external_id = verified.canonical_external_id
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at;

UPDATE source_people source
SET
    is_public = TRUE,
    updated_at = NOW()
FROM _verified_mayor_councilor_identities verified
WHERE source.source_person_key = verified.source_person_key
  AND source.is_public = FALSE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM person_identity_review_queue review
        JOIN _verified_mayor_councilor_identities verified
          ON verified.source_person_key = review.source_person_key
    ) THEN
        RAISE EXCEPTION 'Verified mayor/councilor identities remain in the review queue';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _verified_mayor_councilor_identities;

RESET statement_timeout;
