-- 必須以單一交易執行；本機使用 compact-grassroots-local.py，發布由 migration runner 管理。
-- 候選人可保存獨立姓名。此 migration 不刪除人物，不改變既有發布範圍。
-- 身分合併原有部分索引無法支援刪除人物時的完整外鍵查找。
CREATE INDEX IF NOT EXISTS idx_person_merge_decisions_duplicate_fk ON public.person_merge_decisions(duplicate_person_id);
ALTER TABLE public.candidates ADD COLUMN candidate_name TEXT;
-- Linked candidates use people.name; name-only conversion backfills only affected rows.
ALTER TABLE public.candidates ALTER COLUMN person_id DROP NOT NULL;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_name_only_name_check
    CHECK (person_id IS NOT NULL OR NULLIF(BTRIM(candidate_name), '') IS NOT NULL);
COMMENT ON COLUMN public.candidates.candidate_name IS '候選紀錄獨立保存的姓名；無人物連結時仍保留選舉紀錄。';

-- 只有基層選舉可使用無人物候選；既有人物可繼續參選任何層級。
CREATE FUNCTION public.validate_candidate_name_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.person_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.races r WHERE r.id = NEW.race_id
        AND r.race_type IN ('village_chief', 'township_representative', 'township_representative_district')
    ) THEN
        RAISE EXCEPTION 'Name-only candidates require a grassroots race';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_candidate_name_only() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_candidate_name_only
BEFORE INSERT OR UPDATE OF person_id, race_id, candidate_name ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.validate_candidate_name_only();

-- 僅修改目標現有 view 的候選姓名/連結，不帶入本機額外欄位或未發布功能。
-- 每個片段先核對出現次數；結構不同就回滾，不能猜測重建。
DO $migration$
DECLARE
    definition TEXT;
    before_parts TEXT[] := ARRAY[
        'pm.canonical_person_id, rm.canonical_race_id, (COALESCE(c_1.candidate_no',
        'c_1.status_updated_at,',
        'JOIN person_canonical_map pm',
        'p.name AS person_name',
        'JOIN people p ON',
        'WHERE r.region_id IS NULL OR rg.is_public = true;'
    ];
    after_parts TEXT[] := ARRAY[
        '(CASE WHEN c_1.person_id IS NULL THEN ''candidate:'' || c_1.id::text ELSE ''person:'' || pm.canonical_person_id::text END), rm.canonical_race_id, (COALESCE(c_1.candidate_no',
        'c_1.status_updated_at, c_1.candidate_name,',
        'LEFT JOIN person_canonical_map pm',
        'COALESCE(p.name, c.candidate_name) AS person_name',
        'LEFT JOIN people p ON',
        'WHERE (c.person_id IS NULL OR p.id IS NOT NULL) AND (r.region_id IS NULL OR rg.is_public = true);'
    ];
    expected_occurrences INTEGER[] := ARRAY[2, 1, 1, 1, 1, 1];
    i INTEGER;
BEGIN
    PERFORM set_config('search_path', 'public, pg_catalog', true);
    definition := pg_get_viewdef('public.public_candidates'::regclass, true);
    FOR i IN 1..array_length(before_parts, 1) LOOP
        IF (length(definition) - length(replace(definition, before_parts[i], ''))) / length(before_parts[i]) <> expected_occurrences[i] THEN
            RAISE EXCEPTION 'Unexpected public_candidates definition at patch %; review before changing', i;
        END IF;
        definition := replace(definition, before_parts[i], after_parts[i]);
    END LOOP;
    EXECUTE 'CREATE OR REPLACE VIEW public.public_candidates AS ' || definition;
END;
$migration$;

-- 修改選舉類別時，也不能把已存在的 name-only 候選變成高層級候選。
CREATE FUNCTION public.validate_race_name_only_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.race_type NOT IN ('village_chief', 'township_representative', 'township_representative_district')
       AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.race_id=NEW.id AND c.person_id IS NULL) THEN
        RAISE EXCEPTION 'A race with name-only candidates must remain grassroots';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_race_name_only_candidates() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_race_name_only_candidates
BEFORE UPDATE OF race_type ON public.races
FOR EACH ROW EXECUTE FUNCTION public.validate_race_name_only_candidates();
