-- 保留登記歷程；不把資格不符當落選，也不刪除人物歷屆資料。
BEGIN;
ALTER TABLE public.registration_name_roster ADD COLUMN registration_status TEXT NOT NULL
    DEFAULT 'registered' CHECK (registration_status IN ('registered', 'qualified', 'disqualified', 'withdrawn'));
COMMENT ON COLUMN public.registration_name_roster.registration_status IS
    'Latest reviewed registration eligibility; original registration evidence remains unchanged.';

-- 姓名名錄也可保存審定事件，不為此建立或推定人物身分。
ALTER TABLE public.candidate_lifecycle_events ALTER COLUMN candidate_id DROP NOT NULL;
ALTER TABLE public.candidate_lifecycle_events ADD COLUMN registration_name_id UUID
    REFERENCES public.registration_name_roster(id) ON DELETE CASCADE;
ALTER TABLE public.candidate_lifecycle_events ADD CONSTRAINT candidate_lifecycle_one_subject
    CHECK (num_nonnulls(candidate_id, registration_name_id) = 1);
CREATE INDEX candidate_lifecycle_events_registration_date_idx
    ON public.candidate_lifecycle_events(registration_name_id, occurred_on DESC, id)
    WHERE registration_name_id IS NOT NULL;

-- 沿用受限 RPC 與白名單欄位；沒有新增私人表或事件 JSON 的公開權限。
CREATE OR REPLACE FUNCTION published.registration_names_for(p_race_ids uuid[])
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'candidate_id', n.id, 'person_id', '', 'person_name', n.display_name,
    'person_party', NULL, 'person_position', NULL,
    'race_id', r.race_id, 'race_title', r.title,
    'election_id', r.election_id, 'election_name', r.election_name,
    'election_year', e.year, 'region_id', r.region_id, 'region_name', r.region_name,
    'party', n.party, 'candidate_no', NULL,
    'registration_status', n.registration_status, 'candidacy_status', n.registration_status,
    'election_result', 'pending', 'status_updated_at', n.reviewed_at,
    'candidate_updated_at', n.reviewed_at,
    'vote_count', NULL, 'vote_rate', NULL, 'is_elected', NULL,
    'is_incumbent', NULL, 'office_at_election', NULL,
    'source_name', n.source_name, 'source_url', n.source_url,
    'primary_photo_url', NULL, 'primary_photo_thumbnail_url', NULL,
    'photo_attribution', NULL, 'photo_license_type', NULL,
    'gender', 'unknown', 'age_group', NULL
  )
  FROM public.registration_name_roster n
  JOIN published.races r ON r.race_id = n.race_id
  JOIN published.elections e ON e.election_id = r.election_id AND e.year = 2026
  WHERE n.is_public AND n.registration_status IN ('registered', 'qualified')
    AND n.race_id = ANY(p_race_ids)
    AND cardinality(p_race_ids) BETWEEN 1 AND 128
    -- After identity review, the published candidate replaces this text-only row.
    AND NOT EXISTS (
      SELECT 1 FROM public.candidates c
      JOIN published.candidates visible ON visible.candidate_id = c.id
      WHERE c.external_id = n.candidate_external_id
    )
  ORDER BY n.race_id, n.display_name, n.id
  LIMIT 2001;
$function$
;

-- 只替換已知查詢邊界；完整保留現有權限、其他欄位、效能及人物查詢。
-- 任一函式版本不符就中止交易，不能悄悄覆蓋後續修正。
DO $migration$
DECLARE
    change RECORD;
    definition TEXT;
BEGIN
    FOR change IN SELECT * FROM (VALUES
        ('published.race_page_for(uuid)', $old$WHERE candidate.race_id = p_race_id$old$, $new$WHERE candidate.race_id = p_race_id
      AND COALESCE(candidate.registration_status, 'unknown') NOT IN ('disqualified', 'withdrawn') AND COALESCE(candidate.candidacy_status, 'unknown') NOT IN ('withdrawn_or_disqualified')$new$, 1),
        ('published.home_page_for(text)', $old$ON candidate.race_id = race.race_id$old$, $new$ON candidate.race_id = race.race_id
      AND COALESCE(candidate.registration_status, 'unknown') NOT IN ('disqualified', 'withdrawn') AND COALESCE(candidate.candidacy_status, 'unknown') NOT IN ('withdrawn_or_disqualified')$new$, 2),
        ('published.home_candidate_summaries_for(uuid[])', $old$ON fact.race_id = requested.race_id$old$, $new$ON fact.race_id = requested.race_id
          AND COALESCE(fact.registration_status, 'unknown') NOT IN ('disqualified', 'withdrawn') AND COALESCE(fact.candidacy_status, 'unknown') NOT IN ('withdrawn_or_disqualified')$new$, 1),
        ('published.election_party_performance(text,uuid[],text[],text)', $old$AND candidate.election_id = ANY (p_election_ids)$old$, $new$AND candidate.election_id = ANY (p_election_ids)
      AND COALESCE(candidate.registration_status, 'unknown') NOT IN ('disqualified', 'withdrawn') AND COALESCE(candidate.candidacy_status, 'unknown') NOT IN ('withdrawn_or_disqualified')$new$, 1),
        ('published.election_education_distribution(text,uuid[],text[],text)', $old$AND candidate.election_id = ANY (p_election_ids)$old$, $new$AND candidate.election_id = ANY (p_election_ids)
      AND COALESCE(candidate.registration_status, 'unknown') NOT IN ('disqualified', 'withdrawn') AND COALESCE(candidate.candidacy_status, 'unknown') NOT IN ('withdrawn_or_disqualified')$new$, 1),
        ('published.seo_share_catalog_page(text,integer,integer)', $old$WHERE candidate.person_id IS NOT NULL$old$, $new$WHERE candidate.person_id IS NOT NULL
          AND COALESCE(candidate.registration_status, 'unknown') NOT IN ('disqualified', 'withdrawn') AND COALESCE(candidate.candidacy_status, 'unknown') NOT IN ('withdrawn_or_disqualified')$new$, 1)
    ) AS changes(signature, old_fragment, new_fragment, expected_count)
    LOOP
        definition := pg_catalog.pg_get_functiondef(change.signature::regprocedure);
        IF (length(definition) - length(replace(definition, change.old_fragment, '')))
            / length(change.old_fragment) <> change.expected_count THEN
            RAISE EXCEPTION 'Unexpected qualification query boundary in %', change.signature;
        END IF;
        EXECUTE replace(definition, change.old_fragment, change.new_fragment);
    END LOOP;
END;
$migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
