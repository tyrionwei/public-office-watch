DROP INDEX IF EXISTS uq_person_identity_matches_source_person;

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_identity_matches_source_person
    ON person_identity_matches(source_person_id, person_id);
