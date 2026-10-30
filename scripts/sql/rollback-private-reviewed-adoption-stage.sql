-- Only after separately approved retention/cleanup. Refuse to discard any input.
BEGIN;
SET LOCAL lock_timeout='1s';
LOCK TABLE reviewed_adoption_private.packages, reviewed_adoption_private.chunks IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM reviewed_adoption_private.packages) OR EXISTS(SELECT 1 FROM reviewed_adoption_private.chunks) THEN RAISE EXCEPTION 'STAGED_EVIDENCE_REQUIRES_EXPLICIT_RETENTION_DECISION'; END IF; END $$;
DROP TABLE reviewed_adoption_private.chunks;
DROP TABLE reviewed_adoption_private.packages;
DROP SCHEMA reviewed_adoption_private;
COMMIT;
