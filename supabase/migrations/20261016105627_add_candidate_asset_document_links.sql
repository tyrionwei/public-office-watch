BEGIN;

ALTER TABLE public.candidate_lifecycle_events DROP CONSTRAINT candidate_lifecycle_events_event_type_check;
ALTER TABLE public.candidate_lifecycle_events ADD CONSTRAINT candidate_lifecycle_events_event_type_check CHECK (event_type IN (
    'party_nomination_announced', 'candidacy_announced', 'registration_filed',
    'qualification_confirmed', 'qualification_rejected', 'withdrawn',
    'ballot_number_assigned', 'official_candidate_list_published', 'election_result_published',
    'asset_declaration_published'
));
-- 本輪只提供中選會官方文件索引，沒有財產金額或親屬明細。
ALTER TABLE public.candidate_lifecycle_events ADD CONSTRAINT candidate_asset_document_official_url
    CHECK (event_type <> 'asset_declaration_published' OR
        source_url ~ '^https://pdps-dec[.]cec[.]gov[.]tw/release/formal/files/[0-9]+[.]pdf$');

CREATE FUNCTION published.candidate_asset_documents_for(p_candidate_ids UUID[])
RETURNS TABLE (candidate_id UUID, document_id UUID, source_name TEXT, source_url TEXT, source_published_on DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
    IF cardinality(p_candidate_ids) > 128 THEN
        RAISE EXCEPTION 'At most 128 candidate IDs are allowed' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    WITH subjects AS (
        SELECT c.id, false AS name_only
        FROM public.candidates c
        JOIN published.candidates visible ON visible.candidate_id = c.id
        JOIN public.races r ON r.id = c.race_id AND r.is_public
        JOIN public.elections e ON e.id = r.election_id AND e.is_public AND e.year = 2026
        WHERE c.id = ANY(p_candidate_ids) AND c.is_public
          AND c.registration_status IN ('registered', 'qualified', 'elected', 'not_elected')
          AND coalesce(c.candidacy_status, 'unknown') <> 'withdrawn_or_disqualified'
        UNION ALL
        SELECT n.id, true AS name_only
        FROM public.registration_name_roster n
        JOIN published.races r ON r.race_id = n.race_id
        JOIN published.elections e ON e.election_id = r.election_id AND e.year = 2026
        WHERE n.id = ANY(p_candidate_ids) AND n.is_public
          AND n.registration_status IN ('registered', 'qualified')
          AND NOT EXISTS (
              SELECT 1 FROM public.candidates c
              JOIN published.candidates visible ON visible.candidate_id = c.id
              WHERE c.external_id = n.candidate_external_id
          )
    )
    SELECT s.id, event.id, event.source_name, event.source_url, event.source_published_on
    FROM subjects s JOIN public.candidate_lifecycle_events event
      ON (NOT s.name_only AND event.candidate_id = s.id)
      OR (s.name_only AND event.registration_name_id = s.id)
    WHERE event.is_public AND event.event_type = 'asset_declaration_published'
    -- 客戶端接受最多 512 份；多回一列作為溢位哨兵，不能靜默截斷。
    ORDER BY s.id, event.source_url, event.id
    LIMIT 513;
END;
$function$;
REVOKE ALL ON FUNCTION published.candidate_asset_documents_for(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.candidate_asset_documents_for(UUID[]) TO anon, authenticated, service_role, admin_role;

-- 歷史資格事件照舊保留；文件連結依同一公開資格邊界載入。
CREATE OR REPLACE FUNCTION published.candidate_lifecycle_for(p_candidate_id UUID)
RETURNS TABLE (
    id UUID, candidate_id UUID, event_type TEXT, occurred_on DATE,
    source_published_on DATE, source_name TEXT, source_url TEXT, candidate_no TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
    SELECT event.id, event.candidate_id, event.event_type, event.occurred_on,
        event.source_published_on, event.source_name, event.source_url,
        CASE WHEN event.event_type = 'ballot_number_assigned'
            THEN left(event.event_data->>'candidateNo', 20) END
    FROM public.candidate_lifecycle_events event
    JOIN public.candidates candidate ON candidate.id = event.candidate_id AND candidate.is_public
    JOIN public.races race ON race.id = candidate.race_id AND race.is_public
    JOIN public.elections election ON election.id = race.election_id AND election.is_public AND election.year >= 2026
    WHERE event.candidate_id = p_candidate_id AND event.is_public
      AND EXISTS (SELECT 1 FROM published.candidates visible WHERE visible.candidate_id = candidate.id)
      AND (event.event_type <> 'asset_declaration_published' OR (
          election.year = 2026 AND candidate.registration_status IN ('registered', 'qualified', 'elected', 'not_elected')
          AND coalesce(candidate.candidacy_status, 'unknown') <> 'withdrawn_or_disqualified'
      ))
    ORDER BY coalesce(event.occurred_on, event.source_published_on) DESC NULLS LAST, event.id
    LIMIT 50;
$function$;
NOTIFY pgrst, 'reload schema';
COMMIT;
