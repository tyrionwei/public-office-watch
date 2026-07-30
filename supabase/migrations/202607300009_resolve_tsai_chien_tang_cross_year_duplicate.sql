INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    '87fd3b6d-9cf7-43c6-acd0-ebbb8ab265d6'::UUID,
    'e503a5cb-0d94-4e7e-81b3-b3d54266041e'::UUID,
    'verified',
    'A',
    '蔡健棠：2018 與 2022 紀錄均為中國國民黨籍新北市議員候選人；官方公報的姓名、性別、學歷及新莊市第5至8屆市民代表經歷一致，選區因改制由第2改列第3。',
    jsonb_build_object(
        'version', 'cross-year-councilor-review-v1',
        'observedDate', '2026-07-30',
        'electionYears', jsonb_build_array(2018, 2022),
        'region', '新北市',
        'party', '中國國民黨',
        'districts', jsonb_build_array('2018 第2選舉區', '2022 第3選舉區'),
        'result', 'not_elected_2018_elected_2022',
        'officialProfileMatch', jsonb_build_array(
            '新莊市第5、6、7、8屆市民代表',
            '東吳大學日文系',
            '醒吾商專'
        )
    ),
    'system:cross-year-councilor-review',
    NOW(),
    NOW()
WHERE EXISTS (
    SELECT 1 FROM people
    WHERE id = '87fd3b6d-9cf7-43c6-acd0-ebbb8ab265d6'
)
AND EXISTS (
    SELECT 1 FROM people
    WHERE id = 'e503a5cb-0d94-4e7e-81b3-b3d54266041e'
)
AND NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions
    WHERE duplicate_person_id = '87fd3b6d-9cf7-43c6-acd0-ebbb8ab265d6'
      AND status IN ('suggested', 'verified')
);
