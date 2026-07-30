BEGIN;

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
    '29407533-b442-9eff-f671-9aa75450cfc2',
    '23c459f9-d96e-4948-a5a7-b6a618558367',
    'verified',
    'A',
    '劉茂群與劉茂羣為同一位桃園政治人物：姓名僅有群／羣異體差異，均為中國國民黨籍桃園第3選舉區，官方紀錄串連1998、2002與2018參選紀錄。',
    jsonb_build_object(
        'version', 'historical-name-variant-review-v1',
        'observedDate', '2026-07-30',
        'normalizedVariants', jsonb_build_array('劉茂群', '劉茂羣'),
        'electionYears', jsonb_build_array(1998, 2002, 2018),
        'party', '中國國民黨',
        'geography', '桃園市第3選舉區',
        'officialResults', jsonb_build_array('1998 elected', '2002 elected')
    ),
    'system:historical-name-variant-review-v1',
    NOW(),
    NOW()
WHERE EXISTS (
    SELECT 1 FROM people WHERE id = '29407533-b442-9eff-f671-9aa75450cfc2'
)
AND EXISTS (
    SELECT 1 FROM people WHERE id = '23c459f9-d96e-4948-a5a7-b6a618558367'
)
AND NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = '29407533-b442-9eff-f671-9aa75450cfc2'
      AND existing.canonical_person_id = '23c459f9-d96e-4948-a5a7-b6a618558367'
      AND existing.status IN ('suggested', 'verified')
);

SELECT published.promote(NULL);

COMMIT;
