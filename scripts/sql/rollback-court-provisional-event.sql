-- Run only after an approved exact business rollback, never delete history here.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='10s';
LOCK TABLE public.candidate_lifecycle_events IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT md5(pg_get_constraintdef(oid)) FROM pg_constraint
      WHERE conrelid='public.candidate_lifecycle_events'::regclass
        AND conname='candidate_lifecycle_events_event_type_check') IS DISTINCT FROM '27b8329e1951df7b1d8cbf4515fcb8ff' THEN
    RAISE EXCEPTION 'Event constraint drift: refuse to overwrite later schema changes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.candidate_lifecycle_events WHERE event_type='court_provisional_candidacy_allowed') THEN
    RAISE EXCEPTION 'Court events remain: refuse schema rollback; preserve history';
  END IF;
END $$;
ALTER TABLE public.candidate_lifecycle_events DROP CONSTRAINT candidate_lifecycle_events_event_type_check;
ALTER TABLE public.candidate_lifecycle_events ADD CONSTRAINT candidate_lifecycle_events_event_type_check CHECK ((event_type = ANY (ARRAY['party_nomination_announced'::text, 'candidacy_announced'::text, 'registration_filed'::text, 'qualification_confirmed'::text, 'qualification_rejected'::text, 'withdrawn'::text, 'ballot_number_assigned'::text, 'official_candidate_list_published'::text, 'election_result_published'::text, 'asset_declaration_published'::text])));
COMMIT;
