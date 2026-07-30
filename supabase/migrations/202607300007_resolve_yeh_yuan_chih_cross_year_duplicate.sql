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
    'dc74d6b7-020f-4e06-9d93-d7ee632bdf9c'::UUID,
    'c97b365d-6112-4bd6-8038-bfc9dc5c0304'::UUID,
    'verified',
    'A',
    '葉元之：2018、2022 新北市議員及 2024 新北市立委紀錄均為中國國民黨籍；官方公報與媒體履歷一致，議員選區因改制由第4改列第5。',
    jsonb_build_object(
        'version', 'cross-year-councilor-review-v1',
        'observedDate', '2026-07-30',
        'electionYears', jsonb_build_array(2018, 2022, 2024),
        'region', '新北市',
        'party', '中國國民黨',
        'districts', jsonb_build_array(
            '2018 市議員第4選舉區',
            '2022 市議員第5選舉區',
            '2024 立法委員第7選舉區'
        ),
        'result', 'elected_all_three',
        'officialProfileMatch', jsonb_build_array(
            '新北市政府副發言人',
            '新北市政府新聞局主任秘書',
            '國立臺灣大學國家發展研究所碩士'
        )
    ),
    'system:cross-year-councilor-review',
    NOW(),
    NOW()
WHERE EXISTS (
    SELECT 1 FROM people
    WHERE id = 'dc74d6b7-020f-4e06-9d93-d7ee632bdf9c'
)
AND EXISTS (
    SELECT 1 FROM people
    WHERE id = 'c97b365d-6112-4bd6-8038-bfc9dc5c0304'
)
AND NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions
    WHERE duplicate_person_id = 'dc74d6b7-020f-4e06-9d93-d7ee632bdf9c'
      AND status IN ('suggested', 'verified')
);
