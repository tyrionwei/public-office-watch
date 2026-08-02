SET statement_timeout = 0;

BEGIN;

CREATE TEMP TABLE _councilor_1998_distinct_people (
    person_name TEXT NOT NULL,
    left_person_id UUID NOT NULL,
    right_person_id UUID NOT NULL,
    left_candidate_id UUID NOT NULL,
    right_candidate_id UUID NOT NULL,
    left_candidate_external_id TEXT NOT NULL,
    right_candidate_external_id TEXT NOT NULL,
    left_race_title TEXT NOT NULL,
    right_race_title TEXT NOT NULL,
    PRIMARY KEY (left_person_id, right_person_id),
    CHECK (left_person_id <> right_person_id)
);

INSERT INTO _councilor_1998_distinct_people (
    person_name, left_person_id, right_person_id,
    left_candidate_id, right_candidate_id,
    left_candidate_external_id, right_candidate_external_id,
    left_race_title, right_race_title
)
VALUES
    (
        '吳天福',
        '04f1444e-886c-474f-9f42-507a0585d9d6',
        'd768df81-71c5-4673-aa8a-790d96968844',
        '5dbf3419-5508-4eeb-8140-cf3f790599b5',
        '17187694-60e7-4689-a876-595327da8218',
        'cec-historical-candidate-fff7af9dd7d601a9',
        'cec-historical-candidate-57632d27826c050d',
        '屏東縣第13選舉區山地原住民議員選舉',
        '臺東縣第9選舉區平地原住民議員選舉'
    ),
    (
        '鄭輝煌',
        '03029f56-cb8c-4948-9f3a-d0906482ee73',
        '6dc5a888-1a11-4ac4-bef6-aee471bafd90',
        'c0d8b344-136a-4a57-a685-d66bde2d08e2',
        'a3ec7a08-dbff-4204-ac7e-36eec515a7c3',
        'cec-historical-candidate-3cbf9a85920d0b16',
        'cec-historical-candidate-da7b1e66404f71d2',
        '苗栗縣第4選舉區議員選舉',
        '臺東縣第1選舉區議員選舉'
    ),
    (
        '陳光宇',
        '4762d22a-a2c6-417f-b448-509ed8c8d866',
        'b0c810e5-ab92-4f3d-8ceb-042e9882268e',
        '033c7d67-0fb6-44ac-a3ee-862feb149515',
        '7686ff48-42a4-4054-ad8d-1c4294a19283',
        'cec-historical-candidate-0141a18caf8690e4',
        'cec-historical-candidate-22c2d89807eff96b',
        '臺北市第5選舉區議員選舉',
        '臺北縣第2選舉區議員選舉'
    ),
    (
        '陳益昌',
        '099ae5f3-d8ee-4391-8294-050a43bfe91c',
        '6a5cd97f-34a8-45e7-a436-0b45cafeb700',
        '3756a0ae-673f-4794-b30a-e972fc2ac895',
        '379a9974-2307-4118-9a28-817990650e29',
        'cec-historical-candidate-98f873b591768fb5',
        'cec-historical-candidate-5d4e255dcc70c55e',
        '臺中縣第1選舉區議員選舉',
        '彰化縣第2選舉區議員選舉'
    ),
    (
        '陳秀惠',
        '060829ea-c8f5-4c38-b3c8-2199442f426e',
        '43666862-47d3-4012-883c-a3c7958d88a8',
        '334dcbb4-ad61-44ca-a542-aee648a199db',
        '646b3fdc-b5c8-47e0-91b4-628e21cb99fc',
        'cec-historical-candidate-e18c6c1241393b4b',
        'cec-historical-candidate-0c621bbc619ccfd0',
        '臺北市原住民議員選舉',
        '臺北市第2選舉區議員選舉'
    ),
    (
        '陳長榮',
        '384cc8c3-5e62-42cf-a8ff-d5b43f57f52b',
        'f1d0c74f-2c39-4d99-bc16-bbcb3e4b147d',
        '552e4654-7788-416c-8f35-8e0e1457d859',
        'f2c807e3-8add-4678-aa80-618b4ca2565b',
        'cec-historical-candidate-daf702ab7bab30d8',
        'cec-historical-candidate-76e9b9a99ec8a4cc',
        '臺北市第3選舉區議員選舉',
        '臺北縣第6選舉區議員選舉'
    );

-- Resolve environment-specific candidate and person UUIDs through stable
-- candidate external IDs. Canonical person IDs preserve prior verified merges.
UPDATE _councilor_1998_distinct_people input
SET left_candidate_id = left_candidate.id,
    left_person_id = left_map.canonical_person_id,
    right_candidate_id = right_candidate.id,
    right_person_id = right_map.canonical_person_id
FROM candidates left_candidate
JOIN person_canonical_map left_map ON left_map.person_id = left_candidate.person_id
JOIN candidates right_candidate ON TRUE
JOIN person_canonical_map right_map ON right_map.person_id = right_candidate.person_id
WHERE left_candidate.external_id = input.left_candidate_external_id
  AND right_candidate.external_id = input.right_candidate_external_id;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _councilor_1998_distinct_people) <> 6 THEN
        RAISE EXCEPTION 'Unexpected 1998 same-name decision input count';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _councilor_1998_distinct_people input
        WHERE NOT EXISTS (
            SELECT 1
            FROM candidates candidate
            JOIN races race ON race.id = candidate.race_id
            JOIN people person ON person.id = candidate.person_id
            JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
            WHERE candidate.id = input.left_candidate_id
              AND canonical.canonical_person_id = input.left_person_id
              AND person.name = input.person_name
              AND race.title = input.left_race_title
              AND race.election_id IN (
                  (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
                  (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
              )
        )
           OR NOT EXISTS (
            SELECT 1
            FROM candidates candidate
            JOIN races race ON race.id = candidate.race_id
            JOIN people person ON person.id = candidate.person_id
            JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
            WHERE candidate.id = input.right_candidate_id
              AND canonical.canonical_person_id = input.right_person_id
              AND person.name = input.person_name
              AND race.title = input.right_race_title
              AND race.election_id IN (
                  (SELECT id FROM elections WHERE external_id = 'cec-historical-election-a275bfcd53f64b5f'),
                  (SELECT id FROM elections WHERE external_id = 'cec-historical-election-c900709a73a7da9f')
              )
        )
    ) THEN
        RAISE EXCEPTION '1998 same-name candidate evidence changed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _councilor_1998_distinct_people input
        JOIN person_merge_decisions decision
          ON decision.status = 'verified'
         AND (
             (decision.duplicate_person_id = input.left_person_id AND decision.canonical_person_id = input.right_person_id)
             OR
             (decision.duplicate_person_id = input.right_person_id AND decision.canonical_person_id = input.left_person_id)
         )
    ) THEN
        RAISE EXCEPTION 'A 1998 same-name pair is already verified as one person';
    END IF;
END
$$;

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    input.right_person_id,
    input.left_person_id,
    'rejected',
    'A',
    'The two 1998 candidates named ' || input.person_name || ' registered in different districts in the same election and are different people.',
    jsonb_build_object(
        'rule', 'same_election_different_district_identity',
        'electionYear', 1998,
        'leftCandidateId', input.left_candidate_id,
        'rightCandidateId', input.right_candidate_id,
        'leftRace', input.left_race_title,
        'rightRace', input.right_race_title,
        'officialSource', 'https://data.gov.tw/dataset/13119',
        'reviewedDate', '2026-08-01'
    ),
    'codex:official-election-evidence',
    NOW(),
    NOW()
FROM _councilor_1998_distinct_people input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.status IN ('verified', 'rejected', 'archived')
      AND (
          (existing.duplicate_person_id = input.left_person_id AND existing.canonical_person_id = input.right_person_id)
          OR
          (existing.duplicate_person_id = input.right_person_id AND existing.canonical_person_id = input.left_person_id)
      )
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _councilor_1998_distinct_people input
        WHERE NOT EXISTS (
            SELECT 1
            FROM person_merge_decisions decision
            WHERE decision.status = 'rejected'
              AND (
                  (decision.duplicate_person_id = input.left_person_id AND decision.canonical_person_id = input.right_person_id)
                  OR
                  (decision.duplicate_person_id = input.right_person_id AND decision.canonical_person_id = input.left_person_id)
              )
        )
    ) THEN
        RAISE EXCEPTION '1998 same-name decisions were not recorded';
    END IF;
END
$$;

SELECT published.promote(NULL);

COMMIT;

RESET statement_timeout;
