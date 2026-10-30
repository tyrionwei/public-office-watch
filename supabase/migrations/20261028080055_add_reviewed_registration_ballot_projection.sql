-- Prepared only: no candidate data or review/public flags are changed.
-- Requires the already-reviewed registration eligibility/lifecycle schema.
BEGIN;
DO $guard$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='registration_name_roster' AND column_name='registration_status')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='candidate_lifecycle_events' AND column_name='registration_name_id') THEN
        RAISE EXCEPTION 'Ballot projection requires reviewed registration lifecycle prerequisites';
    END IF;
    IF (SELECT md5(prosrc) FROM pg_catalog.pg_proc
        WHERE oid='published.registration_names_for(uuid[])'::regprocedure) IS DISTINCT FROM '2af4a948461581b01e46d0eb60b2192f' THEN
        RAISE EXCEPTION 'Unexpected registration_names_for definition; review schema drift before applying';
    END IF;
END;
$guard$;

-- NOT VALID preserves legacy rows untouched; new/updated ballot events must be valid.
ALTER TABLE public.candidate_lifecycle_events ADD CONSTRAINT candidate_ballot_number_payload
CHECK (event_type <> 'ballot_number_assigned' OR coalesce(
    jsonb_typeof(event_data->'candidateNo') = 'string'
    AND event_data->>'candidateNo' ~ '^[1-9][0-9]{0,19}$', false)) NOT VALID;

-- Replace only the number expression, preserving every eligibility gate and grant.
DO $projection$
DECLARE definition TEXT;
BEGIN
    SELECT pg_catalog.pg_get_functiondef('published.registration_names_for(uuid[])'::regprocedure) INTO definition;
    IF (length(definition)-length(replace(definition,$old$'party', n.party, 'candidate_no', NULL,$old$,'')))
        / length($old$'party', n.party, 'candidate_no', NULL,$old$) <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one ballot projection fragment';
    END IF;
    EXECUTE replace(definition,$old$'party', n.party, 'candidate_no', NULL,$old$,$new$'party', n.party, 'candidate_no', (
      SELECT CASE
        WHEN bool_and(coalesce(jsonb_typeof(event.event_data->'candidateNo') = 'string'
             AND event.event_data->>'candidateNo' ~ '^[1-9][0-9]{0,19}$', false))
         AND count(DISTINCT event.event_data->>'candidateNo') = 1
        THEN min(event.event_data->>'candidateNo') END
      FROM public.candidate_lifecycle_events event
      WHERE event.registration_name_id = n.id
        AND event.event_type = 'ballot_number_assigned' AND event.is_public
    ),$new$);
END;
$projection$;

-- 名錄號次只投影已明確公開的來源事件；不改人物、資格、原來源或公開旗標。
CREATE FUNCTION published.registration_name_ballots_for(p_registration_name_ids UUID[])
RETURNS TABLE (
    registration_name_id UUID, event_id UUID, occurred_on DATE,
    source_published_on DATE, source_name TEXT, source_url TEXT, candidate_no TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
    IF cardinality(p_registration_name_ids) > 128 THEN
        RAISE EXCEPTION 'At most 128 registration name IDs are allowed' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    SELECT n.id, event.id, event.occurred_on, event.source_published_on,
           event.source_name, event.source_url, event.event_data->>'candidateNo'
    FROM public.registration_name_roster n
    JOIN published.races r ON r.race_id = n.race_id
    JOIN published.elections e ON e.election_id = r.election_id AND e.year = 2026
    JOIN public.candidate_lifecycle_events event ON event.registration_name_id = n.id
    WHERE n.id = ANY(p_registration_name_ids) AND n.is_public
      AND n.registration_status IN ('registered', 'qualified')
      AND event.event_type = 'ballot_number_assigned' AND event.is_public
      AND jsonb_typeof(event.event_data->'candidateNo') = 'string'
      AND event.event_data->>'candidateNo' ~ '^[1-9][0-9]{0,19}$'
      AND NOT EXISTS (
          SELECT 1 FROM public.candidates c
          JOIN published.candidates visible ON visible.candidate_id = c.id
          WHERE c.external_id = n.candidate_external_id
      )
    ORDER BY n.id, coalesce(event.occurred_on, event.source_published_on) DESC NULLS LAST, event.id
    LIMIT 513;
END;
$function$;
REVOKE ALL ON FUNCTION published.registration_name_ballots_for(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.registration_name_ballots_for(UUID[]) TO anon, authenticated, service_role, admin_role;
COMMENT ON FUNCTION published.registration_name_ballots_for(UUID[]) IS
    'Reviewed public ballot evidence for name-only registrations. At most 128 input IDs; 513 rows is an overflow sentinel. No person identity or raw event JSON is exposed.';

NOTIFY pgrst, 'reload schema';
COMMIT;
