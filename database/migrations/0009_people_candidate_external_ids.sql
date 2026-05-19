ALTER TABLE people ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_people_external_id
    ON people(external_id)
    WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_external_id
    ON candidates(external_id)
    WHERE external_id IS NOT NULL;
