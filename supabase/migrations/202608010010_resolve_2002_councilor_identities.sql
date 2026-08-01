BEGIN;

-- Resolve the two remaining 2002 source identity conflicts and record explicit
-- same-election different-district non-merge decisions before publication.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM person_identity_matches
        WHERE id = 'd7da0314-c29e-4b73-8256-16a47a3bed57'
          AND source_person_id = '1f094fab-a321-450f-9d51-76203cdda35a'
          AND person_id = 'e2e3a497-7e72-438b-81d5-15e2ddbade3f'
          AND match_status = 'auto_matched'
    ) THEN
        RAISE EXCEPTION 'Expected incorrect Taipei 陳淑華 source match was not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM person_identity_matches
        WHERE id = '909cc015-e80e-4ed4-bf27-73a2b342412f'
          AND source_person_id = '1f094fab-a321-450f-9d51-76203cdda35a'
          AND person_id = '7fae003d-f166-481c-85dd-0674462c0075'
          AND match_status = 'auto_matched'
    ) THEN
        RAISE EXCEPTION 'Expected correct Taipei 陳淑華 source match was not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.person_id = '08f31470-08ca-478c-bc07-d84a7b44cac1'
          AND race.title = '高雄市第1選舉區議員選舉'
          AND candidate.candidate_no = '4'
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.person_id = '346a434f-fd59-4eda-9c88-7bf8e1a07409'
          AND race.title = '高雄市第1選舉區議員選舉'
          AND candidate.candidate_no = '8'
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE canonical.canonical_person_id = '383c916b-6a03-499d-a656-da0a27fea389'
          AND race.title = '高雄市第6選舉區議員選舉'
    ) THEN
        RAISE EXCEPTION 'Expected cross-election 高雄市 陳美雅 progression was not found';
    END IF;
END
$$;

UPDATE person_identity_matches
SET match_status = 'rejected_match',
    match_reason = '2002臺北市第3選舉區陳淑華與臺中市議員陳淑華為同年不同地區的不同人物。',
    evidence_json = evidence_json || jsonb_build_object(
        'rule', 'same_election_different_jurisdiction_identity',
        'sourceDistrict', '臺北市第3選舉區',
        'rejectedPersonDistrict', '臺中市第4選舉區',
        'officialSource', 'https://data.gov.tw/dataset/13119',
        'reviewedDate', '2026-08-01'
    ),
    reviewed_by = 'codex:official-election-evidence',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = 'd7da0314-c29e-4b73-8256-16a47a3bed57';

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    '08f31470-08ca-478c-bc07-d84a7b44cac1',
    '383c916b-6a03-499d-a656-da0a27fea389',
    'verified',
    'A',
    '陳美雅連續參選2002、2006改制前高雄市第1選舉區及2010年後高雄市第6選舉區，姓名與黨籍一致，為同一人物。',
    jsonb_build_object(
        'rule', 'cross_election_boundary_progression',
        'years', jsonb_build_array(2002, 2006, 2010, 2014, 2018, 2022),
        'party', '中國國民黨',
        'oldDistrict', '高雄市第1選舉區',
        'newDistrict', '高雄市第6選舉區',
        'officialSource', 'https://data.gov.tw/dataset/13119',
        'reviewedDate', '2026-08-01'
    ),
    'codex:official-election-evidence',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.status IN ('verified', 'rejected', 'archived')
      AND (
          (existing.duplicate_person_id = '08f31470-08ca-478c-bc07-d84a7b44cac1'
           AND existing.canonical_person_id = '383c916b-6a03-499d-a656-da0a27fea389')
          OR
          (existing.duplicate_person_id = '383c916b-6a03-499d-a656-da0a27fea389'
           AND existing.canonical_person_id = '08f31470-08ca-478c-bc07-d84a7b44cac1')
      )
);

CREATE TEMP TABLE _councilor_2002_distinct_people (
    name TEXT NOT NULL,
    left_person_id UUID NOT NULL,
    right_person_id UUID NOT NULL,
    left_district TEXT NOT NULL,
    right_district TEXT NOT NULL,
    PRIMARY KEY (left_person_id, right_person_id)
);

INSERT INTO _councilor_2002_distinct_people (
    name, left_person_id, right_person_id, left_district, right_district
)
VALUES
    ('吳宗憲', '1687cf55-81df-4d8f-9bc0-456cdc9fc6e3', '6dad34bb-07e4-4669-9e82-90b9763187d1', '彰化縣第4選舉區', '桃園縣第12選舉區'),
    ('吳宗憲', '1687cf55-81df-4d8f-9bc0-456cdc9fc6e3', 'cbcb27ef-4e95-4c18-bc65-73c418522f8f', '彰化縣第4選舉區', '高雄市第5選舉區'),
    ('吳宗憲', '6dad34bb-07e4-4669-9e82-90b9763187d1', 'cbcb27ef-4e95-4c18-bc65-73c418522f8f', '桃園縣第12選舉區', '高雄市第5選舉區'),
    ('張吉雄', 'd1ba2142-11f8-4c41-b2c2-def695648936', '9780f86a-63df-42b6-805d-f78e7bf97ab2', '桃園縣第9選舉區', '高雄市第5選舉區'),
    ('張金文', 'abfff5c4-e83b-43c5-b98d-59f7879f8414', '57fb8073-f6a2-4539-8bcf-ffb3b70a72b5', '屏東縣第1選舉區', '彰化縣第5選舉區'),
    ('李文彬', 'acf63d9d-a8d9-44f1-b5a2-9dc020abc232', '9df74a07-156e-4483-a31e-77b8d912be2b', '新竹市第3選舉區', '高雄縣第5選舉區'),
    ('李武雄', '8b46d408-24ef-4bed-8712-fc2f76fadd17', '34ba7067-dc21-40b4-bc00-ac862e6ceadb', '彰化縣第1選舉區', '彰化縣第7選舉區'),
    ('林大傑', '464ab18c-85a8-4a20-b304-cd8a507b7894', '55a4d8ca-304d-4070-bdbb-06b3ffa9d231', '彰化縣第1選舉區', '臺中縣第2選舉區'),
    ('林建宏', '417132d0-beff-498a-9703-a9aed26d3871', '38457b9e-bf9b-4c30-be8a-7a648bbdc2c1', '宜蘭縣第3選舉區', '新竹市第2選舉區'),
    ('林清華', '15558695-739e-4fb3-bed1-2b85de5105c6', '92369906-9100-4b89-b411-e35769716754', '臺中市第1選舉區', '臺中市第7選舉區平地原住民'),
    ('江麗玉', '4db66154-2877-425a-80f2-0ce99e3e483f', '5a6136df-d25d-46c2-9a59-e6a8d0c58dc5', '基隆市第2選舉區', '臺北縣第8選舉區'),
    ('陳淑華', 'e2e3a497-7e72-438b-81d5-15e2ddbade3f', '1fda6a12-6a42-4976-927e-8cddba2b1bbc', '臺中市第4選舉區', '臺北市第3選舉區');

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _councilor_2002_distinct_people) <> 12 THEN
        RAISE EXCEPTION 'Expected 12 same-name 2002 non-merge pairs';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _councilor_2002_distinct_people input
        WHERE NOT EXISTS (SELECT 1 FROM people WHERE id = input.left_person_id)
           OR NOT EXISTS (SELECT 1 FROM people WHERE id = input.right_person_id)
    ) THEN
        RAISE EXCEPTION 'A 2002 same-name canonical person is missing';
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
    input.name || '在2002年同一輪地方議員選舉登記於不同選區，為不同人物。',
    jsonb_build_object(
        'rule', 'same_election_different_district_identity',
        'name', input.name,
        'leftDistrict', input.left_district,
        'rightDistrict', input.right_district,
        'officialSource', 'https://data.gov.tw/dataset/13119',
        'reviewedDate', '2026-08-01'
    ),
    'codex:official-election-evidence',
    NOW(),
    NOW()
FROM _councilor_2002_distinct_people input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.status IN ('verified', 'rejected', 'archived')
      AND (
          (existing.duplicate_person_id = input.right_person_id
           AND existing.canonical_person_id = input.left_person_id)
          OR
          (existing.duplicate_person_id = input.left_person_id
           AND existing.canonical_person_id = input.right_person_id)
      )
);

DO $$
DECLARE
    same_name_rejections INTEGER;
    chen_meiya_canonical UUID;
    unresolved_source_conflicts INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO same_name_rejections
    FROM _councilor_2002_distinct_people input
    WHERE EXISTS (
        SELECT 1
        FROM person_merge_decisions decision
        WHERE decision.status = 'rejected'
          AND (
              (decision.duplicate_person_id = input.right_person_id
               AND decision.canonical_person_id = input.left_person_id)
              OR
              (decision.duplicate_person_id = input.left_person_id
               AND decision.canonical_person_id = input.right_person_id)
          )
    );

    SELECT canonical_person_id
    INTO chen_meiya_canonical
    FROM person_canonical_map
    WHERE person_id = '08f31470-08ca-478c-bc07-d84a7b44cac1';

    SELECT COUNT(*)
    INTO unresolved_source_conflicts
    FROM (
        SELECT
            match.source_person_id,
            COUNT(DISTINCT canonical.canonical_person_id) AS canonical_count
        FROM person_identity_matches match
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE match.source_person_id IN (
            '1f094fab-a321-450f-9d51-76203cdda35a',
            'd45614af-0ed2-4c99-bd52-3881f1c88cb3'
        )
          AND match.match_status = 'auto_matched'
        GROUP BY match.source_person_id
        HAVING COUNT(DISTINCT canonical.canonical_person_id) <> 1
    ) conflict;

    IF same_name_rejections <> 12
       OR chen_meiya_canonical <> '383c916b-6a03-499d-a656-da0a27fea389'
       OR unresolved_source_conflicts <> 0 THEN
        RAISE EXCEPTION
            '2002 identity resolution failed: rejections %, 陳美雅 canonical %, source conflicts %',
            same_name_rejections,
            chen_meiya_canonical,
            unresolved_source_conflicts;
    END IF;
END
$$;

SELECT published.promote(NULL);

DROP TABLE _councilor_2002_distinct_people;

COMMIT;
