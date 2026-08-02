SET statement_timeout = 0;

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
    ('update', '0b659e8f-6e8e-4dfa-a367-4c50b111bd89', 'cec-historical:466ecedf1c56', 'a058edf9-9aeb-4ebb-a490-848178441ce5', '1b5c3c57-7e9c-40c6-bc53-baabbfa850d6', '165fb16b-dd96-4254-b557-b05130bb225b', 'cec-historical-candidate-bca306944a9ab128', FALSE, '無黨籍', '4', 50501, 34.89, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|national|district-1|mountain_indigenous', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1a2b1ac4-131e-40c1-a1dc-d943ef3890ae', 'cec-historical:008668bad7fb', '558dd1d3-a4d4-49ce-985d-b42a857e0a57', 'd829b622-8706-4ced-b64b-7609aaa094b7', '50c139d1-594a-4ef6-8975-bdde3eca54cb', 'cec-historical-candidate-cf53fc41f7541b57', FALSE, '無黨籍', '6', 973, 0.49, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺南市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1a481a33-dfd8-432a-99ff-b5cc39b6d13d', 'cec-historical:9e5138fc47c5', '583c5c6b-eaae-4c9b-841f-3a0bb86bc667', '5c8c24f3-eb5f-4962-adc3-a39b0d211194', 'eea8b450-9af6-4da4-825a-7d77fa40656c', 'cec-historical-candidate-4867b18a01849d06', FALSE, '無黨籍', '8', 283, 0.6, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|金門縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1ad91902-ac8c-4577-8966-55d86599d0e0', 'cec-historical:b9074cfdc373', '71715283-c329-47f6-8cc7-3f0742cf30fd', 'e7e9a9f6-cab3-48c6-8c57-129befe2fb01', '2a841d05-c812-4528-9c4e-db7b93d8a7c4', 'cec-historical-candidate-615ef26b1bfb8773', FALSE, '無黨籍', '3', 64415, 41.2, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|嘉義縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '1bf78ba9-c0ae-4c8c-9c44-040ffffbf259', 'cec-historical:d8b7bea55165', '4ade4830-cb87-4d7b-bad7-743e0e5bc8d5', 'ce67fd2f-5c16-4a51-90de-57b468063d88', 'a2f72ec9-ee4f-4690-9753-8448eb057cf2', 'cec-historical-candidate-60d39dd0634d0cbe', FALSE, '無黨籍', '5', 437, 0.22, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|新北市|district-3|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '2dfffdae-f3e9-465b-b4ec-4adebabe4548', 'cec-historical:f955691d6fe2', '456f03d6-3722-4381-8871-56b997e45f16', '92019767-0da0-4023-bc3d-60832dc359a5', '47d7763c-3960-4c58-869c-1794f2a017c5', 'cec-historical-candidate-3faafadc04543fcc', FALSE, '民主進步黨', '6', 75718, 42.32, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺北市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '4fd000f1-c2fa-4db9-9428-55b59123bd2e', 'cec-historical:0ba5a67a5e48', '5590515a-8389-452f-8066-e469bda08e3a', '8bed0207-1b1c-45df-931e-cdd41f6a1206', '51b4bf4a-408c-4433-8d2a-9cf2b318ced9', 'cec-historical-candidate-ee986e1b43983fa0', FALSE, '無黨籍', '5', 211, 0.08, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-5|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '59097d4f-d072-4f6d-a854-5f662ba778b7', 'cec-historical:2f8590aa1432', 'abe8c75a-807e-4dfa-a9f7-bb2b3ed4c0a8', 'c3d34ec2-3253-4401-b6d2-6d8fb6ad74c8', '19f4e377-d3f9-40e3-8061-26f6b8ac8b2f', 'cec-historical-candidate-49fcfd896dab1c62', FALSE, '無黨籍', '2', 3061, 1.3, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|臺中市|district-4|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '71160e20-b45c-45da-b412-f131e9e551fe', 'cec-historical:1d6daa0dbf86', '8b25cd3a-d941-45d4-9744-27d9fcacb73f', '58523411-974d-41bf-9982-ab5e89cf620d', '23f2ec54-5d52-4e60-9eea-d0c2cc37f58b', 'cec-historical-candidate-6bf680aa5eb5155b', FALSE, '無黨籍', '4', 24118, 9.97, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|屏東縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', '955d87c0-b64d-4614-a5a5-6b5c3b40e77b', 'cec-historical:f9a14a29408e', '749e6898-ec10-4219-833c-6e493a63b9ea', 'd4a1d812-2aab-498e-b9ae-de3bce437900', 'f92b0326-0ae5-4534-ba5a-c9b80b7ee9a4', 'cec-historical-candidate-9ee2f2039699e72b', FALSE, '無黨籍', '2', 115496, 58.44, TRUE, 'qualified', 'elected', 'elected', 2020, '2020|legislator|桃園市|district-6|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'b128f9da-48ad-4ac2-ba29-8535f814e03e', 'cec-historical:acd0574bc0c4', 'd47c9716-3e38-4781-8768-774a7af7a4ca', 'e7e9a9f6-cab3-48c6-8c57-129befe2fb01', 'c5af2ba2-c171-433e-aec1-902b64c13eef', 'cec-historical-candidate-4c6772ba2c2e76e0', FALSE, '無黨籍', '4', 1443, 0.92, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|嘉義縣|district-2|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('update', 'd258cf54-e066-4dd2-a15a-785f423e0e4d', 'cec-historical:15f1589a4fcf', '7539ebdd-a8a7-4d61-8e44-665107b97465', '56ad2faa-ef94-494a-8dc7-43e353a5585a', 'e6d09150-8a50-46e5-96a7-6394660d55fa', 'cec-historical-candidate-f37c81bec80ba909', FALSE, '民主進步黨', '2', 63691, 46.43, FALSE, 'qualified', 'not_elected', 'not_elected', 2020, '2020|legislator|南投縣|district-1|regional', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE);

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
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730) <> 12
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'create') <> 0
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update') <> 12 THEN
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
    ) <> 12 THEN
        RAISE EXCEPTION 'Historical CEC migration updated candidate result mismatch';
    END IF;
    IF (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_count IS NOT NULL) <> 12
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE vote_rate IS NOT NULL) <> 12
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE is_elected) <> 2
       OR (SELECT COUNT(*) FROM _historical_cec_existing_candidate_input_20260730 WHERE operation = 'update' AND original_is_public) <> 0 THEN
        RAISE EXCEPTION 'Historical CEC migration candidate summary mismatch';
    END IF;
END
$verify$;

SELECT
    0 AS planned_creates,
    12 AS planned_updates,
    12 AS planned_total,
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

RESET statement_timeout;
