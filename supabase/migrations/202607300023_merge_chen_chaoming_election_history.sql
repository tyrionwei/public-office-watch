SET statement_timeout = 0;

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
    '52c1ff38-4287-4e84-b8de-4a1ced5af05e'::UUID,
    '13039c92-43b8-4f0d-af44-9895f1c8500f'::UUID,
    'verified',
    'A',
    '陳超明：兩組紀錄在 2020 年均為中國國民黨籍苗栗縣第1選區立法委員候選人；另一組另有 2012、2016、2024 同選區立委紀錄、立法院現任資料及一致的 1951-12-17 生日證據。',
    jsonb_build_object(
        'version', 'chen-chaoming-election-history-v1',
        'observedDate', '2026-07-30',
        'electionYears', jsonb_build_array(2012, 2016, 2020, 2024),
        'region', '苗栗縣',
        'district', '第1選舉區',
        'role', '立法委員',
        'partyHistory', jsonb_build_array('中國國民黨', '無黨籍'),
        'verifiedBirthDate', '1951-12-17',
        'identitySignals', jsonb_build_array(
            'same normalized name',
            'same 2020 election',
            'same district',
            'same party in 2020',
            'continuous official election history'
        )
    ),
    'system:chen-chaoming-election-history-v1',
    NOW(),
    NOW()
WHERE EXISTS (
    SELECT 1
    FROM people duplicate
    WHERE duplicate.id = '52c1ff38-4287-4e84-b8de-4a1ced5af05e'
)
  AND EXISTS (
      SELECT 1
      FROM people canonical
      WHERE canonical.id = '13039c92-43b8-4f0d-af44-9895f1c8500f'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM person_merge_decisions existing
      WHERE existing.duplicate_person_id = '52c1ff38-4287-4e84-b8de-4a1ced5af05e'
        AND existing.status IN ('suggested', 'verified')
  );

SELECT published.promote(NULL);

RESET statement_timeout;
