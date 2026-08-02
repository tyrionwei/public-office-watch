-- Generated existing-person historical CEC candidate migration.

CREATE TEMP TABLE _historical_cec_existing_candidate_input_20260730 (
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update')),
    source_person_id UUID PRIMARY KEY,
    source_person_key TEXT NOT NULL UNIQUE,
    person_id UUID NOT NULL,
    race_id UUID NOT NULL,
    candidate_id UUID,
    candidate_external_id TEXT,
    original_is_public BOOLEAN,
    party TEXT,
    candidate_no TEXT,
    vote_count INT,
    vote_rate NUMERIC,
    is_elected BOOLEAN,
    candidacy_status TEXT,
    election_result TEXT,
    registration_status TEXT,
    election_year INT NOT NULL,
    race_context_key TEXT NOT NULL,
    set_party BOOLEAN NOT NULL,
    set_candidate_no BOOLEAN NOT NULL,
    set_vote_count BOOLEAN NOT NULL,
    set_vote_rate BOOLEAN NOT NULL,
    set_is_elected BOOLEAN NOT NULL,
    set_candidacy_status BOOLEAN NOT NULL,
    set_election_result BOOLEAN NOT NULL,
    set_registration_status BOOLEAN NOT NULL,
    CHECK (
      (operation = 'create' AND candidate_id IS NULL AND candidate_external_id IS NOT NULL
       AND original_is_public IS NULL AND is_elected IS NOT NULL
       AND candidacy_status IS NOT NULL AND election_result IS NOT NULL AND registration_status IS NOT NULL)
      OR
      (operation = 'update' AND candidate_id IS NOT NULL AND original_is_public IS NOT NULL)
    )
);

INSERT INTO _historical_cec_existing_candidate_input_20260730 (
    operation, source_person_id, source_person_key, person_id, race_id,
    candidate_id, candidate_external_id, original_is_public, party, candidate_no,
    vote_count, vote_rate, is_elected, candidacy_status, election_result,
    registration_status, election_year, race_context_key,
    set_party, set_candidate_no, set_vote_count, set_vote_rate,
    set_is_elected, set_candidacy_status, set_election_result, set_registration_status
) VALUES
    ('update', '0cea8512-b719-4ec7-87eb-32768d4f5b6e', 'cec-historical:8f55b8771bf3', '0d001f8e-774e-4748-859b-072fdb0dd461', 'efa4f449-5d68-4b62-aeb7-57d92146aeb8', 'dd551f37-d741-402a-b2b0-87246723657b', 'cec-historical-candidate-e391470caf65381a', FALSE, '無黨籍', '2', 145, 6.48, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|臺北市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4383595b-f8e1-4f61-8fe0-58606747ec2b', 'cec-historical:7d9a0fcf972e', 'c7acb1f4-ff11-46b1-add3-b8de3c165849', '92a95f54-8812-4445-b8ae-c09f5b7e9c2f', 'd7224818-5184-48cb-a113-6681d452f8d9', 'cec-historical-candidate-67651a4c3d89db8e', FALSE, '無黨籍', '2', 286, 16.77, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|高雄市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '492ff5a7-a4dc-4010-bc69-330f229e1255', 'cec-historical:c2ea82dcffd7', 'c13c407b-fcc2-4cf7-819d-a70bf1b8d581', '92a95f54-8812-4445-b8ae-c09f5b7e9c2f', '3051a290-5f5e-4094-bb20-2e44d483c77a', 'cec-historical-candidate-a3d5ecc4dcfd7ea6', FALSE, '無黨籍', '3', 304, 17.83, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|高雄市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4bcc1c21-08f9-4bce-8e52-d719f4aa423f', 'cec-historical:5fabc35927cf', '14b56717-c53a-4d85-85a8-c03aa12ee7cd', 'efa4f449-5d68-4b62-aeb7-57d92146aeb8', '00aee552-2a14-4f5e-9bac-10d2aa6bdbf2', 'cec-historical-candidate-e824c51487ef7c08', FALSE, '無黨籍', '6', 145, 6.48, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|臺北市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '596d9091-5603-40e5-bade-a2ef5388610e', 'cec-historical:b4fbc1c170c3', '06f95f39-82a1-d1d3-48dc-9178650c0a60', '92a95f54-8812-4445-b8ae-c09f5b7e9c2f', '5804d249-5b79-4d86-88a8-05ba7c29a145', 'cec-historical-candidate-435dd3fc1c7d46b8', FALSE, '無黨籍', '4', 262, 15.37, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|高雄市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6156945f-d19c-44de-97bd-a5d65b8a469b', 'cec-historical:308cbe977e4f', 'bef9580a-bc38-4472-98f4-c27522be06af', 'efa4f449-5d68-4b62-aeb7-57d92146aeb8', 'b586c865-5ea2-4184-9146-642a001e1850', 'cec-historical-candidate-9da4765558f800cf', FALSE, '無黨籍', '1', 272, 12.16, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|臺北市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '67860afd-c87f-45ce-8644-9717a45c3543', 'cec-historical:ec39fb5de904', '23696f85-0cd5-423c-b597-b6b868eef543', '92a95f54-8812-4445-b8ae-c09f5b7e9c2f', '791b6cc6-1654-4edc-bc35-0fed9914aa6d', 'cec-historical-candidate-1d1b51ca0ee6c774', FALSE, '無黨籍', '6', 120, 7.04, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|高雄市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '67d1418b-e2ce-4bb4-8219-589d27095ba6', 'cec-historical:973ee7f23b9b', '22807ed1-d738-e574-99ed-cd345ff131c8', 'efa4f449-5d68-4b62-aeb7-57d92146aeb8', 'ead0a267-3c31-4790-be10-8db50b5c8923', 'cec-historical-candidate-d5931d053f78d596', FALSE, '中國國民黨', '4', 846, 37.82, TRUE, 'qualified', 'elected', 'elected', 1994, '1994|councilor|臺北市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '69fdf9c6-349e-4ff1-8a7c-9cb540e4dd4c', 'cec-historical:8163be53dc33', 'e21f5eee-487a-44f0-a83e-686dc189be27', 'efa4f449-5d68-4b62-aeb7-57d92146aeb8', '7fafa901-1005-43ed-855b-2badb25f6a62', 'cec-historical-candidate-cd9828e2e3159784', FALSE, '無黨籍', '5', 257, 11.49, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|臺北市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '6e0ce3f3-e3ea-4980-a09e-ecebfca38580', 'cec-historical:c22c18f4adf3', 'b91025b0-045c-45fa-a526-996b8e4148e6', 'efa4f449-5d68-4b62-aeb7-57d92146aeb8', '627f74e7-a3f7-40f4-a4a4-78f34c4742d1', 'cec-historical-candidate-211e1414c474a010', FALSE, '無黨籍', '3', 494, 22.08, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|臺北市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'a9f8fc33-bfc2-4d35-bdb2-e3da69b51698', 'cec-historical:a204fce81add', '53cd15f7-851b-2c7a-034e-a0d27f06ac74', '92a95f54-8812-4445-b8ae-c09f5b7e9c2f', 'dc50f273-e0f8-483b-87ba-8bcf988585e9', 'cec-historical-candidate-2850367dedc57d9c', FALSE, '中國國民黨', '5', 252, 14.78, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|高雄市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'c202b41f-88f9-49dd-8d30-934b0056a515', 'cec-historical:052d66e00304', '6a36d424-63c9-7a14-db03-1f448bd2d661', '92a95f54-8812-4445-b8ae-c09f5b7e9c2f', '615d40ab-8dc8-49bf-a6f1-1344325ef0b2', 'cec-historical-candidate-a6355157cf2e3c96', FALSE, '無黨籍', '1', 481, 28.21, TRUE, 'qualified', 'elected', 'elected', 1994, '1994|councilor|高雄市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
    ('update', 'c61c9c57-b770-477d-b724-81c14cc5a0fc', 'cec-historical:88423cf3f768', 'c0d2f84d-c964-4c58-ba79-715d97a52e05', 'efa4f449-5d68-4b62-aeb7-57d92146aeb8', '4137f0f2-17b2-40da-91f4-f5741a659861', 'cec-historical-candidate-accba5f499f02d23', FALSE, '民主進步黨', '7', 78, 3.49, FALSE, 'qualified', 'not_elected', 'not_elected', 1994, '1994|councilor|臺北市|indigenous|indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE);

-- Candidate, person, and race UUIDs differ between independently restored
-- environments. Resolve this update-only batch from the candidate's stable
-- external ID before validating or applying the vote backfill.
UPDATE _historical_cec_existing_candidate_input_20260730 input
SET candidate_id = candidate.id,
    person_id = person_map.canonical_person_id,
    race_id = race_map.canonical_race_id
FROM candidates candidate
JOIN person_canonical_map person_map ON person_map.person_id = candidate.person_id
JOIN race_canonical_map race_map ON race_map.race_id = candidate.race_id
WHERE input.operation = 'update'
  AND candidate.external_id = input.candidate_external_id;

UPDATE source_people source
SET source_payload = source.source_payload
        || CASE WHEN input.set_candidate_no THEN jsonb_build_object('candidateNo', input.candidate_no) ELSE '{}'::JSONB END
        || CASE WHEN input.set_vote_count THEN jsonb_build_object('voteCount', input.vote_count) ELSE '{}'::JSONB END
        || CASE WHEN input.set_vote_rate THEN jsonb_build_object('voteRate', input.vote_rate) ELSE '{}'::JSONB END
        || CASE WHEN input.set_is_elected THEN jsonb_build_object('elected', input.is_elected) ELSE '{}'::JSONB END,
    updated_at = NOW()
FROM _historical_cec_existing_candidate_input_20260730 input
WHERE source.id = input.source_person_id
  AND source.source_person_key = input.source_person_key
  AND source.source_type = 'official_election'
  AND source.source_id = 'cec-2024-votedata'
  AND source.election_year = input.election_year
  AND (input.set_candidate_no OR input.set_vote_count OR input.set_vote_rate OR input.set_is_elected);

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 13
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 13 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate input count mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        WHERE NOT EXISTS (
            SELECT 1 FROM source_people source
            WHERE source.id = input.source_person_id
              AND source.source_person_key = input.source_person_key
              AND source.source_type = 'official_election'
              AND source.source_id = 'cec-2024-votedata'
              AND (CASE WHEN source.party = '無' THEN '無黨籍' ELSE NULLIF(BTRIM(source.party), '') END)
                    IS NOT DISTINCT FROM input.party
              AND (NOT input.set_candidate_no OR NULLIF(source.source_payload->>'candidateNo', '') IS NOT DISTINCT FROM input.candidate_no)
              AND (NOT input.set_vote_count OR COALESCE(NULLIF(source.source_payload->>'voteCount', ''), NULLIF(source.source_payload->>'votes', ''))::INT
                    IS NOT DISTINCT FROM input.vote_count)
              AND (NOT input.set_vote_rate OR NULLIF(source.source_payload->>'voteRate', '')::NUMERIC IS NOT DISTINCT FROM input.vote_rate)
              AND (NOT (input.set_is_elected OR input.set_candidacy_status OR input.set_election_result OR input.set_registration_status)
                   OR (source.source_payload->>'elected')::BOOLEAN IS NOT DISTINCT FROM input.is_elected)
              AND source.election_year = input.election_year
        )
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration candidate source snapshot mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        WHERE NOT EXISTS (SELECT 1 FROM people person WHERE person.id = input.person_id)
           OR NOT EXISTS (SELECT 1 FROM races race WHERE race.id = input.race_id)
           OR (
                input.operation = 'create'
                AND NOT EXISTS (
                    SELECT 1 FROM person_identity_matches match
                    WHERE match.source_person_id = input.source_person_id
                      AND match.person_id = input.person_id
                      AND match.match_status = 'auto_matched'
                )
           )
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration candidate identity or race mismatch';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate ON candidate.external_id = input.candidate_external_id
        WHERE input.operation = 'create'
          AND (candidate.person_id IS DISTINCT FROM input.person_id OR candidate.race_id IS DISTINCT FROM input.race_id)
    ) OR EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate ON candidate.person_id = input.person_id AND candidate.race_id = input.race_id
        WHERE input.operation = 'create'
          AND candidate.external_id IS DISTINCT FROM input.candidate_external_id
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration create candidate conflict';
    END IF;
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        WHERE input.operation = 'update'
          AND NOT EXISTS (
              SELECT 1 FROM candidates candidate
              JOIN person_canonical_map person_map ON person_map.person_id = candidate.person_id
              JOIN race_canonical_map race_map ON race_map.race_id = candidate.race_id
              WHERE candidate.id = input.candidate_id
                AND person_map.canonical_person_id = input.person_id
                AND race_map.canonical_race_id = input.race_id
                AND candidate.external_id IS NOT DISTINCT FROM input.candidate_external_id
                AND candidate.is_public = input.original_is_public
          )
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration update candidate target changed';
    END IF;
END
$verify$;

INSERT INTO candidates (
    person_id, race_id, party, candidate_no, registration_status,
    source_name, source_url, is_public, external_id, vote_count, vote_rate,
    is_elected, candidacy_status, election_result, status_updated_at, updated_at
)
SELECT
    input.person_id, input.race_id, input.party, input.candidate_no, input.registration_status,
    '中央選舉委員會開放資料', source.source_url, FALSE, input.candidate_external_id,
    input.vote_count, input.vote_rate, input.is_elected, input.candidacy_status,
    input.election_result, NOW(), NOW()
FROM _historical_cec_existing_candidate_input_20260730 input
JOIN source_people source ON source.id = input.source_person_id
WHERE input.operation = 'create'
ON CONFLICT (external_id) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    race_id = EXCLUDED.race_id,
    party = EXCLUDED.party,
    candidate_no = EXCLUDED.candidate_no,
    registration_status = EXCLUDED.registration_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    vote_count = EXCLUDED.vote_count,
    vote_rate = EXCLUDED.vote_rate,
    is_elected = EXCLUDED.is_elected,
    candidacy_status = EXCLUDED.candidacy_status,
    election_result = EXCLUDED.election_result,
    status_updated_at = NOW(),
    updated_at = NOW();

UPDATE candidates candidate
SET party = CASE WHEN input.set_party THEN input.party ELSE candidate.party END,
    candidate_no = CASE WHEN input.set_candidate_no THEN input.candidate_no ELSE candidate.candidate_no END,
    registration_status = CASE WHEN input.set_registration_status THEN input.registration_status ELSE candidate.registration_status END,
    vote_count = CASE WHEN input.set_vote_count THEN input.vote_count ELSE candidate.vote_count END,
    vote_rate = CASE WHEN input.set_vote_rate THEN input.vote_rate ELSE candidate.vote_rate END,
    is_elected = CASE WHEN input.set_is_elected THEN input.is_elected ELSE candidate.is_elected END,
    candidacy_status = CASE WHEN input.set_candidacy_status THEN input.candidacy_status ELSE candidate.candidacy_status END,
    election_result = CASE WHEN input.set_election_result THEN input.election_result ELSE candidate.election_result END,
    status_updated_at = NOW(),
    updated_at = NOW()
FROM _historical_cec_existing_candidate_input_20260730 input
WHERE input.operation = 'update'
  AND candidate.id = input.candidate_id;

DO $verify$
BEGIN
    IF (
        SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate
          ON input.operation = 'create'
         AND candidate.external_id = input.candidate_external_id
         AND candidate.person_id = input.person_id
         AND candidate.race_id = input.race_id
         AND candidate.party IS NOT DISTINCT FROM input.party
         AND candidate.candidate_no IS NOT DISTINCT FROM input.candidate_no
         AND candidate.vote_count IS NOT DISTINCT FROM input.vote_count
         AND candidate.vote_rate IS NOT DISTINCT FROM input.vote_rate
         AND candidate.is_elected = input.is_elected
         AND candidate.candidacy_status = input.candidacy_status
         AND candidate.election_result = input.election_result
         AND candidate.registration_status = input.registration_status
         AND candidate.is_public = FALSE
    ) <> 0 THEN
        RAISE EXCEPTION 'Historical CEC migration created candidate result mismatch';
    END IF;
    IF (
        SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates candidate
          ON input.operation = 'update'
         AND candidate.id = input.candidate_id
         AND (NOT input.set_party OR candidate.party IS NOT DISTINCT FROM input.party)
         AND (NOT input.set_candidate_no OR candidate.candidate_no IS NOT DISTINCT FROM input.candidate_no)
         AND (NOT input.set_vote_count OR candidate.vote_count IS NOT DISTINCT FROM input.vote_count)
         AND (NOT input.set_vote_rate OR candidate.vote_rate IS NOT DISTINCT FROM input.vote_rate)
         AND (NOT input.set_is_elected OR candidate.is_elected IS NOT DISTINCT FROM input.is_elected)
         AND (NOT input.set_candidacy_status OR candidate.candidacy_status IS NOT DISTINCT FROM input.candidacy_status)
         AND (NOT input.set_election_result OR candidate.election_result IS NOT DISTINCT FROM input.election_result)
         AND (NOT input.set_registration_status OR candidate.registration_status IS NOT DISTINCT FROM input.registration_status)
         AND candidate.is_public = input.original_is_public
    ) <> 13 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 13
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 13
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 2
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 0 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    13 AS planned_updates,
    13 AS planned_total,
    0 AS publication_states_preserved;

SELECT published.promote(NULL);

DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1 FROM _historical_cec_existing_candidate_input_20260730 input
        JOIN candidates core ON input.operation = 'create' AND core.external_id = input.candidate_external_id
        JOIN published.candidates public_candidate ON public_candidate.candidate_id = core.id
    ) THEN
        RAISE EXCEPTION 'Historical CEC migration unexpectedly published a newly created private candidate';
    END IF;
END
$verify$;

DROP TABLE _historical_cec_existing_candidate_input_20260730;
