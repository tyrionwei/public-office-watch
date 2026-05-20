DROP INDEX IF EXISTS uq_regions_external_id;
DROP INDEX IF EXISTS uq_elections_external_id;
DROP INDEX IF EXISTS uq_races_external_id;
DROP INDEX IF EXISTS uq_people_external_id;
DROP INDEX IF EXISTS uq_candidates_external_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_regions_external_id
    ON regions(external_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_elections_external_id
    ON elections(external_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_races_external_id
    ON races(external_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_people_external_id
    ON people(external_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_external_id
    ON candidates(external_id);
