-- Add a timeline fact without changing candidate status, visibility, identity or RLS.
DO $$
DECLARE previous_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO STRICT previous_definition
  FROM pg_constraint
  WHERE conrelid='public.candidate_lifecycle_events'::regclass
    AND conname='candidate_lifecycle_events_event_type_check';
  IF position('court_provisional_candidacy_allowed' IN previous_definition)=0 THEN
    EXECUTE 'ALTER TABLE public.candidate_lifecycle_events DROP CONSTRAINT candidate_lifecycle_events_event_type_check';
    EXECUTE 'ALTER TABLE public.candidate_lifecycle_events ADD CONSTRAINT candidate_lifecycle_events_event_type_check CHECK ('
      ||substring(previous_definition from 7)||' OR event_type=''court_provisional_candidacy_allowed'')';
  END IF;
END $$;
