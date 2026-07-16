CREATE OR REPLACE FUNCTION candidate_candidacy_status_from_legacy(value TEXT)
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
        WHEN 'elected' THEN 'qualified'
        WHEN 'not_elected' THEN 'qualified'
        ELSE 'unknown'
    END;
$$;

CREATE OR REPLACE FUNCTION candidate_election_result_from_legacy(
    registration_value TEXT,
    elected_value BOOLEAN
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        WHEN elected_value IS TRUE OR registration_value = 'elected' THEN 'elected'
        WHEN elected_value IS FALSE OR registration_value = 'not_elected' THEN 'not_elected'
        ELSE 'unknown'
    END;
$$;

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS candidacy_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (candidacy_status IN (
            'potential',
            'party_nominee',
            'officially_announced',
            'registered',
            'qualified',
            'withdrawn_or_disqualified',
            'unknown'
        )),
    ADD COLUMN IF NOT EXISTS election_result TEXT NOT NULL DEFAULT 'unknown'
        CHECK (election_result IN ('pending', 'elected', 'not_elected', 'unknown')),
    ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

UPDATE candidates c
SET
    candidacy_status = candidate_candidacy_status_from_legacy(c.registration_status),
    election_result = CASE
        WHEN candidate_election_result_from_legacy(c.registration_status, c.is_elected) <> 'unknown'
            THEN candidate_election_result_from_legacy(c.registration_status, c.is_elected)
        WHEN r.status IN ('draft', 'announced', 'upcoming', 'registration_open', 'candidates_announced', 'voting')
            OR e.status IN ('draft', 'announced', 'upcoming', 'active')
            THEN 'pending'
        ELSE 'unknown'
    END,
    status_updated_at = COALESCE(c.updated_at, c.created_at, NOW())
FROM races r
JOIN elections e ON e.id = r.election_id
WHERE c.race_id = r.id;

ALTER TABLE candidates
    ALTER COLUMN status_updated_at SET DEFAULT NOW(),
    ALTER COLUMN status_updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_candidacy_status ON candidates(candidacy_status);
CREATE INDEX IF NOT EXISTS idx_candidates_election_result ON candidates(election_result);

CREATE TABLE candidate_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    candidacy_status TEXT NOT NULL CHECK (candidacy_status IN (
        'potential',
        'party_nominee',
        'officially_announced',
        'registered',
        'qualified',
        'withdrawn_or_disqualified',
        'unknown'
    )),
    election_result TEXT NOT NULL CHECK (election_result IN ('pending', 'elected', 'not_elected', 'unknown')),
    change_kind TEXT NOT NULL,
    change_reason TEXT,
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidate_status_history_candidate_id
    ON candidate_status_history(candidate_id, created_at DESC);

ALTER TABLE candidate_status_history ENABLE ROW LEVEL SECURITY;

INSERT INTO candidate_status_history (
    candidate_id,
    candidacy_status,
    election_result,
    change_kind,
    change_reason,
    source_name,
    source_url,
    created_at
)
SELECT
    id,
    candidacy_status,
    election_result,
    'baseline',
    'Initial status-model migration',
    source_name,
    source_url,
    COALESCE(status_updated_at, updated_at, created_at, NOW())
FROM candidates;

CREATE OR REPLACE FUNCTION normalize_candidate_status_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $
DECLARE
    derived_election_result TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.candidacy_status = 'unknown' THEN
            NEW.candidacy_status := candidate_candidacy_status_from_legacy(NEW.registration_status);
        END IF;

        IF NEW.election_result = 'unknown' THEN
            NEW.election_result := candidate_election_result_from_legacy(NEW.registration_status, NEW.is_elected);
        END IF;

        NEW.status_updated_at := COALESCE(NEW.status_updated_at, NEW.updated_at, NOW());
        RETURN NEW;
    END IF;

    IF NEW.candidacy_status IS NOT DISTINCT FROM OLD.candidacy_status
       AND NEW.registration_status IS DISTINCT FROM OLD.registration_status THEN
        NEW.candidacy_status := candidate_candidacy_status_from_legacy(NEW.registration_status);
    END IF;

    IF NEW.election_result IS NOT DISTINCT FROM OLD.election_result
       AND (
           NEW.registration_status IS DISTINCT FROM OLD.registration_status
           OR NEW.is_elected IS DISTINCT FROM OLD.is_elected
       ) THEN
        derived_election_result := candidate_election_result_from_legacy(NEW.registration_status, NEW.is_elected);
        IF derived_election_result <> 'unknown' THEN
            NEW.election_result := derived_election_result;
        END IF;
    END IF;

    IF NEW.candidacy_status IS DISTINCT FROM OLD.candidacy_status
       OR NEW.election_result IS DISTINCT FROM OLD.election_result THEN
        NEW.status_updated_at := NOW();
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_candidate_status_fields
BEFORE INSERT OR UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION normalize_candidate_status_fields();

CREATE OR REPLACE FUNCTION record_candidate_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT'
       OR NEW.candidacy_status IS DISTINCT FROM OLD.candidacy_status
       OR NEW.election_result IS DISTINCT FROM OLD.election_result THEN
        INSERT INTO candidate_status_history (
            candidate_id,
            candidacy_status,
            election_result,
            change_kind,
            source_name,
            source_url,
            created_at
        )
        VALUES (
            NEW.id,
            NEW.candidacy_status,
            NEW.election_result,
            CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'status_update' END,
            NEW.source_name,
            NEW.source_url,
            COALESCE(NEW.status_updated_at, NOW())
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_candidate_status_history
AFTER INSERT OR UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION record_candidate_status_history();

CREATE OR REPLACE VIEW public_candidates AS
WITH canonical_candidates AS (
    SELECT DISTINCT ON (pm.canonical_person_id, rm.canonical_race_id, COALESCE(c.candidate_no, ''))
        c.*,
        pm.canonical_person_id,
        rm.canonical_race_id
    FROM candidates c
    JOIN person_canonical_map pm ON pm.person_id = c.person_id
    JOIN race_canonical_map rm ON rm.race_id = c.race_id
    JOIN races canonical_race ON canonical_race.id = rm.canonical_race_id AND canonical_race.is_public = TRUE
    JOIN election_canonical_map em
        ON em.election_id = canonical_race.election_id
       AND em.canonical_election_id = canonical_race.election_id
    WHERE c.is_public = TRUE
    ORDER BY
        pm.canonical_person_id,
        rm.canonical_race_id,
        COALESCE(c.candidate_no, ''),
        CASE WHEN c.vote_count IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN c.vote_rate IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN c.is_elected IS NOT NULL THEN 0 ELSE 1 END,
        c.updated_at DESC
)
SELECT
    c.id AS candidate_id,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    r.id AS race_id,
    r.title AS race_title,
    e.id AS election_id,
    e.name AS election_name,
    rg.id AS region_id,
    rg.name AS region_name,
    c.party,
    c.candidate_no,
    c.registration_status,
    c.vote_count,
    c.vote_rate,
    c.is_elected,
    c.is_incumbent,
    c.source_name,
    c.source_url,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.attribution AS photo_attribution,
    ph.license_type AS photo_license_type,
    e.year AS election_year,
    c.candidacy_status,
    c.election_result,
    c.status_updated_at,
    c.updated_at AS candidate_updated_at
FROM canonical_candidates c
JOIN people p ON p.id = c.canonical_person_id AND p.is_public = TRUE
JOIN races r ON r.id = c.canonical_race_id AND r.is_public = TRUE
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE r.region_id IS NULL OR rg.is_public = TRUE;
