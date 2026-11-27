\set ON_ERROR_STOP on
-- Digest-gated reversal of the *private stage*, not an undo of a public release.
-- Invoke after reviewing the exact stage SHA256SUMS; dry run by default.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE pow_release_20261127.input, pow_release_20261127.receipt IN EXCLUSIVE MODE;
CREATE TEMP TABLE stage_rollback_expected(kind text PRIMARY KEY, digest text NOT NULL) ON COMMIT DROP;
INSERT INTO stage_rollback_expected VALUES ('candidates', :'candidates_sha256'), ('polling', :'polling_sha256'), ('provenance', :'provenance_sha256');
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pow_release_20261127.receipt)
       OR (SELECT count(*) FROM pow_release_20261127.input) <> 3
       OR EXISTS (SELECT 1 FROM stage_rollback_expected e
                  LEFT JOIN pow_release_20261127.input i USING(kind)
                  WHERE i.artifact_sha256 IS DISTINCT FROM e.digest)
    THEN RAISE EXCEPTION 'Refusing to discard a different, incomplete or adopted release package'; END IF;
END $$;
DELETE FROM pow_release_20261127.input;
\if :{?commit_private_stage_reset}
    \if :commit_private_stage_reset
        COMMIT;
    \else
        ROLLBACK;
    \endif
\else
    ROLLBACK;
\endif
