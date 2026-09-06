BEGIN;

ALTER TABLE public.candidates
  DROP CONSTRAINT candidates_registration_status_check,
  ADD CONSTRAINT candidates_registration_status_check CHECK (
    registration_status IN (
      'pending',
      'registered',
      'qualified',
      'disqualified',
      'withdrawn',
      'not_registered',
      'elected',
      'not_elected',
      'unknown'
    )
  ),
  DROP CONSTRAINT candidates_candidacy_status_check,
  ADD CONSTRAINT candidates_candidacy_status_check CHECK (
    candidacy_status IN (
      'potential',
      'party_nominee',
      'officially_announced',
      'registered',
      'qualified',
      'withdrawn_or_disqualified',
      'did_not_register',
      'unknown'
    )
  );

ALTER TABLE public.candidate_status_history
  DROP CONSTRAINT candidate_status_history_candidacy_status_check,
  ADD CONSTRAINT candidate_status_history_candidacy_status_check CHECK (
    candidacy_status IN (
      'potential',
      'party_nominee',
      'officially_announced',
      'registered',
      'qualified',
      'withdrawn_or_disqualified',
      'did_not_register',
      'unknown'
    )
  );

CREATE OR REPLACE FUNCTION public.candidate_candidacy_status_from_legacy(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE value
    WHEN 'pending' THEN 'potential'
    WHEN 'registered' THEN 'registered'
    WHEN 'qualified' THEN 'qualified'
    WHEN 'disqualified' THEN 'withdrawn_or_disqualified'
    WHEN 'withdrawn' THEN 'withdrawn_or_disqualified'
    WHEN 'not_registered' THEN 'did_not_register'
    WHEN 'elected' THEN 'qualified'
    WHEN 'not_elected' THEN 'qualified'
    ELSE 'unknown'
  END;
$$;

ALTER FUNCTION public.candidate_candidacy_status_from_legacy(TEXT)
SET search_path = pg_catalog;

COMMENT ON FUNCTION public.candidate_candidacy_status_from_legacy(TEXT) IS
  'Maps the legacy registration field to candidacy lifecycle status, including nominees who did not file before registration closed.';

COMMIT;
