BEGIN;

-- Resolve the two remaining 2002 source identity conflicts and record explicit
-- same-election different-district non-merge decisions before publication.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM person_identity_matches
        WHERE source_person_id = '1f094fab-a321-450f-9d51-76203cdda35a'
          AND person_id = (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-regional-person-55a780888828')
          AND match_status NOT IN ('auto_matched', 'rejected_match')
    ) THEN
        RAISE EXCEPTION 'Taipei 陳淑華 source match has an unexpected state';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM person_identity_matches
        WHERE source_person_id = '1f094fab-a321-450f-9d51-76203cdda35a'
          AND person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-5a75f62f1ae4')
          AND match_status = 'auto_matched'
    ) THEN
        RAISE EXCEPTION 'Expected correct Taipei 陳淑華 source match was not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-fff56f5ee79b')
          AND race.title = '高雄市第1選舉區議員選舉'
          AND candidate.candidate_no = '4'
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-8fca2724e590')
          AND race.title = '高雄市第1選舉區議員選舉'
          AND candidate.candidate_no = '8'
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN person_canonical_map canonical ON canonical.person_id = candidate.person_id
        WHERE canonical.canonical_person_id = (SELECT id FROM people WHERE external_id = 'votetw-person-9a8ed0051d888d9c')
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
WHERE source_person_id = '1f094fab-a321-450f-9d51-76203cdda35a'
  AND person_id = (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-regional-person-55a780888828');

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-fff56f5ee79b'),
    (SELECT id FROM people WHERE external_id = 'votetw-person-9a8ed0051d888d9c'),
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
          (existing.duplicate_person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-fff56f5ee79b')
           AND existing.canonical_person_id = (SELECT id FROM people WHERE external_id = 'votetw-person-9a8ed0051d888d9c'))
          OR
          (existing.duplicate_person_id = (SELECT id FROM people WHERE external_id = 'votetw-person-9a8ed0051d888d9c')
           AND existing.canonical_person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-fff56f5ee79b'))
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
    ('吳宗憲', (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-149b72b68f5b'), (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-regional-person-5daf48c7de38'), '彰化縣第4選舉區', '桃園縣第12選舉區'),
    ('吳宗憲', (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-149b72b68f5b'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-79f9fa59c078'), '彰化縣第4選舉區', '高雄市第5選舉區'),
    ('吳宗憲', (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-regional-person-5daf48c7de38'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-79f9fa59c078'), '桃園縣第12選舉區', '高雄市第5選舉區'),
    ('張吉雄', (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-e851726fd72d'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-da551e2701b7'), '桃園縣第9選舉區', '高雄市第5選舉區'),
    ('張金文', (SELECT id FROM people WHERE external_id = 'votetw-person-3022cf0e4de1978c'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-d5970159e90e'), '屏東縣第1選舉區', '彰化縣第5選舉區'),
    ('李文彬', (SELECT id FROM people WHERE external_id = 'cec-historical-person-c2878ffbf17474b5'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-de53935dc3b0'), '新竹市第3選舉區', '高雄縣第5選舉區'),
    ('李武雄', (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-03cd80fdb344'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-af33457cd88b'), '彰化縣第1選舉區', '彰化縣第7選舉區'),
    ('林大傑', (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-f38ec4545daa'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-7c25813cec63'), '彰化縣第1選舉區', '臺中縣第2選舉區'),
    ('林建宏', (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-836002ab299e'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-8be14c03377e'), '宜蘭縣第3選舉區', '新竹市第2選舉區'),
    ('林清華', (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-ede5d63bca18'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-fc71bd17a54a'), '臺中市第1選舉區', '臺中市第7選舉區平地原住民'),
    ('江麗玉', (SELECT id FROM people WHERE external_id = 'cec-historical-person-92b12f2ea56c93fe'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-3cef98738dcc'), '基隆市第2選舉區', '臺北縣第8選舉區'),
    ('陳淑華', (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-regional-person-55a780888828'), (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-b2eb0c3d0dcc'), '臺中市第4選舉區', '臺北市第3選舉區');

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
    WHERE person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-fff56f5ee79b');

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
       OR chen_meiya_canonical <> (SELECT id FROM people WHERE external_id = 'votetw-person-9a8ed0051d888d9c')
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
