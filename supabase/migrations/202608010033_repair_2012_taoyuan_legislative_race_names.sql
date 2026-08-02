SET statement_timeout = 0;

BEGIN;

CREATE TEMP TABLE _taoyuan_legislative_race_repairs_2012 (
    district_number INTEGER PRIMARY KEY,
    canonical_race_id UUID NOT NULL,
    duplicate_race_id UUID NOT NULL UNIQUE,
    canonical_external_id TEXT NOT NULL,
    duplicate_external_id TEXT NOT NULL,
    corrected_title TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _taoyuan_legislative_race_repairs_2012 (
    district_number,
    canonical_race_id,
    duplicate_race_id,
    canonical_external_id,
    duplicate_external_id,
    corrected_title
) VALUES
    (1, 'e2ec4577-a705-4fd3-829c-551cb02249f1', 'c17da4e8-710f-4554-9d4b-f68f240526d5', 'cec-2012-legislative-district-06-002-01', 'cec-historical-race-969fa024c5d00bc5', '桃園縣第1選舉區立法委員選舉'),
    (2, '124dd05f-8fd2-4ae0-8f56-e3782bda4064', '7c6bc09c-cdd8-4cdb-82b1-7dae1f0546fa', 'cec-2012-legislative-district-06-002-02', 'cec-historical-race-07bc388e181f3c6f', '桃園縣第2選舉區立法委員選舉'),
    (3, 'e1446383-4c8b-4106-a4e2-890f0a345ffa', 'ee639e36-bdf1-45f0-9b62-90a141572675', 'cec-2012-legislative-district-06-002-03', 'cec-historical-race-401193bd47c885af', '桃園縣第3選舉區立法委員選舉'),
    (4, '3a48233d-21f5-4f16-9545-e04ca3282f05', '8dc02117-d431-46d5-9ec1-e5f941181a08', 'cec-2012-legislative-district-06-002-04', 'cec-historical-race-9eaa04cb52b43213', '桃園縣第4選舉區立法委員選舉'),
    (5, 'f1e3a97f-c99a-47ac-9c77-b4c6b88e1ec6', '4a68876e-f1db-466a-b1cb-0adf886224ff', 'cec-2012-legislative-district-06-002-05', 'cec-historical-race-4cdd0d18db8de657', '桃園縣第5選舉區立法委員選舉'),
    (6, '6d193295-9878-4ac6-87cb-be8961ae33f6', '7eab679d-48de-4f98-beee-3f3b005efdf7', 'cec-2012-legislative-district-06-002-06', 'cec-historical-race-c7de5b47b28597d6', '桃園縣第6選舉區立法委員選舉');

UPDATE _taoyuan_legislative_race_repairs_2012 input
SET canonical_race_id = canonical.id,
    duplicate_race_id = duplicate.id
FROM races canonical
JOIN races duplicate ON TRUE
WHERE canonical.external_id = input.canonical_external_id
  AND duplicate.external_id = input.duplicate_external_id;

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM _taoyuan_legislative_race_repairs_2012) <> 6 THEN
        RAISE EXCEPTION '2012 Taoyuan legislative race repair input count mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _taoyuan_legislative_race_repairs_2012 input
        LEFT JOIN races canonical ON canonical.id = input.canonical_race_id
        LEFT JOIN races duplicate ON duplicate.id = input.duplicate_race_id
        LEFT JOIN elections election ON election.id = canonical.election_id
        WHERE canonical.id IS NULL
           OR duplicate.id IS NULL
           OR canonical.external_id <> input.canonical_external_id
           OR duplicate.external_id <> input.duplicate_external_id
           OR canonical.is_public IS NOT TRUE
           OR duplicate.is_public IS NOT FALSE
           OR canonical.election_id <> duplicate.election_id
           OR election.year <> 2012
           OR EXISTS (SELECT 1 FROM candidates candidate WHERE candidate.race_id = input.duplicate_race_id)
    ) THEN
        RAISE EXCEPTION '2012 Taoyuan legislative race repair no longer matches the reviewed race pairs';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _taoyuan_legislative_race_repairs_2012 input
        JOIN race_merge_decisions existing
          ON existing.duplicate_race_id = input.duplicate_race_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_race_id <> input.canonical_race_id
    ) THEN
        RAISE EXCEPTION '2012 Taoyuan legislative race gained a conflicting active decision';
    END IF;
END
$verify$;

UPDATE races race
SET title = input.corrected_title,
    region_id = '5b727075-9acc-4a74-b551-5560ff53694b',
    updated_at = NOW()
FROM _taoyuan_legislative_race_repairs_2012 input
WHERE race.id = input.canonical_race_id;

INSERT INTO race_merge_decisions (
    duplicate_race_id,
    canonical_race_id,
    relation_type,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    input.duplicate_race_id,
    input.canonical_race_id,
    'same_race',
    'verified',
    'A',
    '2012選舉時桃園仍為桃園縣；兩筆為同一屆、同一選區，保留原公開race ID並正名。',
    jsonb_build_object(
        'version', 'repair-2012-taoyuan-legislative-race-name-v1',
        'districtNumber', input.district_number,
        'correctedTitle', input.corrected_title,
        'canonicalExternalId', input.canonical_external_id,
        'duplicateExternalId', input.duplicate_external_id
    ),
    'codex:historical-election-geography-review',
    NOW(),
    NOW()
FROM _taoyuan_legislative_race_repairs_2012 input
WHERE NOT EXISTS (
    SELECT 1
    FROM race_merge_decisions existing
    WHERE existing.duplicate_race_id = input.duplicate_race_id
      AND existing.canonical_race_id = input.canonical_race_id
      AND existing.status IN ('suggested', 'verified')
);

DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _taoyuan_legislative_race_repairs_2012 input
        JOIN races canonical ON canonical.id = input.canonical_race_id
        JOIN race_canonical_map duplicate_state ON duplicate_state.race_id = input.duplicate_race_id
        WHERE canonical.title <> input.corrected_title
           OR canonical.region_id <> '5b727075-9acc-4a74-b551-5560ff53694b'::UUID
           OR duplicate_state.canonical_race_id <> input.canonical_race_id
    ) THEN
        RAISE EXCEPTION '2012 Taoyuan legislative race repair did not produce the reviewed canonical state';
    END IF;
END
$verify$;

SELECT published.promote(NULL);

COMMIT;

RESET statement_timeout;
