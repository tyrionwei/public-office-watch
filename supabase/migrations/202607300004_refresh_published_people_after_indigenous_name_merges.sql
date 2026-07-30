BEGIN;

-- The release batch applies several reviewed identity corrections in sequence.
-- Defer the expensive public cache refresh and published snapshot promotion to
-- 202607300010 so production performs this work once after all corrections.

COMMIT;
