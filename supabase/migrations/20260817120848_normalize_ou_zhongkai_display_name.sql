SET statement_timeout = 0;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM people
        WHERE id IN (
            'deb7581d-4bda-4cab-83cd-a518ab10accc'::UUID,
            '88b5b143-9060-45c8-8f1f-202c158f2db1'::UUID
        )
    ) <> 2 THEN
        RAISE EXCEPTION '歐中慨姓名正規化：預期的兩筆已合併人物不存在';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM people
        WHERE id IN (
            'deb7581d-4bda-4cab-83cd-a518ab10accc'::UUID,
            '88b5b143-9060-45c8-8f1f-202c158f2db1'::UUID
        )
          AND name NOT IN ('歐中', '歐中慨')
    ) THEN
        RAISE EXCEPTION '歐中慨姓名正規化：人物姓名已出現未預期的其他值';
    END IF;
END;
$$;

UPDATE people
SET
    name = '歐中慨',
    updated_at = NOW()
WHERE id IN (
    'deb7581d-4bda-4cab-83cd-a518ab10accc'::UUID,
    '88b5b143-9060-45c8-8f1f-202c158f2db1'::UUID
)
  AND name = '歐中';

UPDATE person_claims
SET
    claim_value = '歐中慨',
    scoring_reasons = COALESCE(scoring_reasons, '[]'::JSONB) || jsonb_build_array(
        jsonb_build_object(
            'version', 'normalize-ou-zhongkai-display-name-v1',
            'reason', 'Normalized the VoteTW and CEC private-use glyph U+E036 to the standard character 慨 after the same-race identity merge was verified.',
            'observedDate', '2026-08-17'
        )
    ),
    updated_at = NOW()
WHERE person_id IN (
    'deb7581d-4bda-4cab-83cd-a518ab10accc'::UUID,
    '88b5b143-9060-45c8-8f1f-202c158f2db1'::UUID
)
  AND claim_type = 'name'
  AND claim_value = '歐中';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM people
        WHERE id IN (
            'deb7581d-4bda-4cab-83cd-a518ab10accc'::UUID,
            '88b5b143-9060-45c8-8f1f-202c158f2db1'::UUID
        )
          AND name <> '歐中慨'
    ) THEN
        RAISE EXCEPTION '歐中慨姓名正規化：人物主檔修正失敗';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims
        WHERE person_id IN (
            'deb7581d-4bda-4cab-83cd-a518ab10accc'::UUID,
            '88b5b143-9060-45c8-8f1f-202c158f2db1'::UUID
        )
          AND claim_type = 'name'
          AND claim_value = '歐中'
    ) THEN
        RAISE EXCEPTION '歐中慨姓名正規化：仍有未修正的姓名聲明';
    END IF;
END;
$$;

SELECT public.refresh_public_people_list_cached();
