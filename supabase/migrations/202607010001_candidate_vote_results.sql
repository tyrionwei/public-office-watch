ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS vote_count INTEGER,
    ADD COLUMN IF NOT EXISTS vote_rate NUMERIC(7, 4),
    ADD COLUMN IF NOT EXISTS is_elected BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_incumbent BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_candidates_vote_count ON candidates(vote_count);
CREATE INDEX IF NOT EXISTS idx_candidates_is_elected ON candidates(is_elected);

CREATE OR REPLACE VIEW public_candidates AS
WITH canonical_candidates AS (
    SELECT DISTINCT ON (cm.canonical_person_id, c.race_id, COALESCE(c.candidate_no, ''))
        c.*,
        cm.canonical_person_id
    FROM candidates c
    JOIN person_canonical_map cm ON cm.person_id = c.person_id
    ORDER BY cm.canonical_person_id, c.race_id, COALESCE(c.candidate_no, ''), c.updated_at DESC
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
    ph.license_type AS photo_license_type
FROM canonical_candidates c
JOIN people p ON p.id = c.canonical_person_id AND p.is_public = TRUE
JOIN races r ON r.id = c.race_id AND r.is_public = TRUE
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE c.is_public = TRUE
  AND (r.region_id IS NULL OR rg.is_public = TRUE);
