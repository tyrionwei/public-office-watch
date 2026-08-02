-- Run only after a verified production backup and before pending data migrations.
-- candidate_status_history is internal audit history and is not read by any
-- migration after 202607300010 or by the current public runtime.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

LOCK TABLE public.candidate_status_history IN ACCESS EXCLUSIVE MODE;
TRUNCATE TABLE public.candidate_status_history;

-- These source-scoped identity rows belong to pending migrations 025/029,
-- but some were written to production before their migration versions were
-- recorded. Remove only that untracked work state so the pending migrations
-- can recreate the authoritative rows deterministically.
DELETE FROM public.person_identity_matches AS identity_match
USING public.source_people AS source
WHERE source.id = identity_match.source_person_id
  AND (
      (source.source_type = 'official_election' AND source.source_id = 'cec-2024-votedata')
      OR source.source_person_key LIKE 'cec-historical:%'
  )
  AND identity_match.match_method IN (
      'official_historical_source_scoped_new_person_v1',
      'official_historical_unresolved_source_scoped_person_v1'
  );

COMMIT;

ANALYZE public.candidate_status_history;
