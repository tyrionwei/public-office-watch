BEGIN;

CREATE TABLE public.candidate_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL UNIQUE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'party_nomination_announced', 'candidacy_announced', 'registration_filed',
        'qualification_confirmed', 'qualification_rejected', 'withdrawn',
        'ballot_number_assigned', 'official_candidate_list_published', 'election_result_published'
    )),
    occurred_on DATE,
    source_published_on DATE,
    source_name TEXT NOT NULL CHECK (length(btrim(source_name)) > 0),
    source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
    source_hash TEXT NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
    fetched_at TIMESTAMPTZ NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(event_data) = 'object'),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX candidate_lifecycle_events_candidate_date_idx
    ON public.candidate_lifecycle_events(candidate_id, occurred_on DESC, id);
ALTER TABLE public.candidate_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidate_lifecycle_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.candidate_lifecycle_events TO service_role, admin_role;
CREATE POLICY candidate_lifecycle_admin ON public.candidate_lifecycle_events
    TO admin_role USING (TRUE) WITH CHECK (TRUE);

-- The public API follows the existing bounded published RPC boundary. Underlying
-- research rows are not granted to clients; only published candidates' explicitly
-- approved events and a fixed set of public fields may leave this function.
CREATE FUNCTION published.candidate_lifecycle_for(p_candidate_id UUID)
RETURNS TABLE (
    id UUID, candidate_id UUID, event_type TEXT, occurred_on DATE,
    source_published_on DATE, source_name TEXT, source_url TEXT,
    candidate_no TEXT
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
      AND EXISTS (
        SELECT 1 FROM published.candidates visible WHERE visible.candidate_id = candidate.id
      )
    ORDER BY coalesce(event.occurred_on, event.source_published_on) DESC NULLS LAST, event.id
    LIMIT 50;
$function$;
REVOKE ALL ON FUNCTION published.candidate_lifecycle_for(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.candidate_lifecycle_for(UUID) TO anon, authenticated, service_role, admin_role;

COMMENT ON COLUMN public.candidate_lifecycle_events.occurred_on IS
    'Actual event date only when explicitly evidenced; never copied from announcement or collection date.';
COMMENT ON COLUMN public.candidate_lifecycle_events.source_published_on IS
    'Official source page publication date, at the precision provided by the source.';
NOTIFY pgrst, 'reload schema';
COMMIT;
