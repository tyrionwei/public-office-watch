-- Build private source-scoped people for every remaining unmatched historical CEC row.
-- These records preserve candidate coverage without guessing that a same-name person is identical.

CREATE TEMP TABLE _remaining_historical_cec_people_20260730 ON COMMIT DROP AS
SELECT
    source.id AS source_person_id,
    source.source_person_key,
    'cec-historical-unresolved-person-' || replace(source.source_person_key, 'cec-historical:', '') AS external_id,
    source.raw_name AS name,
    source.gender,
    CASE WHEN source.party = '無' THEN '無黨籍' ELSE source.party END AS party,
    source.position,
    source.district,
    source.election_year,
    source.source_url
FROM source_people source
WHERE source.source_type = 'official_election'
  AND source.source_id = 'cec-2024-votedata'
  AND (
      NOT EXISTS (
          SELECT 1
          FROM person_identity_matches matched
          WHERE matched.source_person_id = source.id
            AND matched.match_status IN ('auto_matched', 'probable_match')
      )
      OR EXISTS (
          SELECT 1
          FROM person_identity_matches matched
          WHERE matched.source_person_id = source.id
            AND matched.match_status = 'auto_matched'
            AND matched.match_method = 'official_historical_unresolved_source_scoped_person_v1'
      )
  );

DO $verify$
DECLARE
    actual_input_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO actual_input_count
    FROM _remaining_historical_cec_people_20260730;

    IF actual_input_count <> 3454 THEN
        RAISE EXCEPTION
            'Remaining historical CEC person input count mismatch: expected 3454, got %',
            actual_input_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _remaining_historical_cec_people_20260730 input
        WHERE input.source_person_key !~ '^cec-historical:[0-9a-f]{12}$'
           OR input.name IS NULL
           OR input.name = ''
           OR input.gender NOT IN ('male', 'female')
           OR input.position IS NULL
           OR input.position = ''
           OR input.district IS NULL
           OR input.district = ''
           OR input.election_year IS NULL
    ) THEN
        RAISE EXCEPTION 'Remaining historical CEC person source snapshot is incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _remaining_historical_cec_people_20260730 input
        JOIN person_identity_matches matched
          ON matched.source_person_id = input.source_person_id
         AND matched.match_status IN ('auto_matched', 'probable_match')
        WHERE matched.match_method <> 'official_historical_unresolved_source_scoped_person_v1'
    ) THEN
        RAISE EXCEPTION 'Remaining historical CEC source gained another active identity match';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _remaining_historical_cec_people_20260730 input
        JOIN people person ON person.external_id = input.external_id
        WHERE person.name IS DISTINCT FROM input.name
           OR person.gender IS DISTINCT FROM input.gender
    ) THEN
        RAISE EXCEPTION 'Remaining historical CEC external id identity conflict';
    END IF;
END
$verify$;

INSERT INTO people (
    name,
    party,
    position,
    election_year,
    district,
    source_url,
    is_public,
    external_id,
    gender,
    updated_at
)
SELECT
    input.name,
    input.party,
    input.position,
    input.election_year,
    input.district,
    input.source_url,
    FALSE,
    input.external_id,
    input.gender,
    NOW()
FROM _remaining_historical_cec_people_20260730 input
ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    party = EXCLUDED.party,
    position = EXCLUDED.position,
    election_year = EXCLUDED.election_year,
    district = EXCLUDED.district,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    gender = EXCLUDED.gender,
    updated_at = NOW();

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
    input.source_person_id,
    person.id,
    'auto_matched',
    100,
    'official_historical_unresolved_source_scoped_person_v1',
    'private source-scoped person created because the existing same-name candidates were ambiguous or insufficiently supported',
    jsonb_build_object(
        'version', 'official-historical-unresolved-source-scoped-person-v1',
        'sourcePersonKey', input.source_person_key,
        'electionYear', input.election_year,
        'position', input.position,
        'district', input.district,
        'identityPolicy', 'no same-name identity inference'
    ),
    'system:official-historical-unresolved-source-scoped-person-v1',
    NOW(),
    NOW()
FROM _remaining_historical_cec_people_20260730 input
JOIN people person ON person.external_id = input.external_id
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = NOW();

DO $verify$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _remaining_historical_cec_people_20260730 input
        JOIN people person
          ON person.external_id = input.external_id
         AND person.name = input.name
         AND person.gender = input.gender
         AND person.is_public = FALSE
    ) <> 3454 THEN
        RAISE EXCEPTION 'Remaining historical CEC private people result mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _remaining_historical_cec_people_20260730 input
        JOIN people person ON person.external_id = input.external_id
        JOIN person_identity_matches matched
          ON matched.source_person_id = input.source_person_id
         AND matched.person_id = person.id
         AND matched.match_status = 'auto_matched'
         AND matched.match_method = 'official_historical_unresolved_source_scoped_person_v1'
    ) <> 3454 THEN
        RAISE EXCEPTION 'Remaining historical CEC identity match result mismatch';
    END IF;
END
$verify$;

SELECT published.promote(NULL);

DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _remaining_historical_cec_people_20260730 input
        JOIN people core ON core.external_id = input.external_id
        JOIN published.people public_person ON public_person.person_id = core.id
    ) THEN
        RAISE EXCEPTION 'Remaining historical CEC migration unexpectedly published a private person';
    END IF;
END
$verify$;
