ALTER TABLE people
    ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'unknown')),
    ADD COLUMN IF NOT EXISTS education TEXT,
    ADD COLUMN IF NOT EXISTS experience TEXT;

CREATE OR REPLACE VIEW public_people AS
SELECT
    p.id AS person_id,
    p.name,
    p.alias,
    p.party,
    p.position,
    p.election_year,
    p.district,
    p.updated_at,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.source_name AS photo_source_name,
    ph.source_url AS photo_source_url,
    ph.license_type AS photo_license_type,
    ph.license_url AS photo_license_url,
    ph.attribution AS photo_attribution,
    p.gender,
    p.education,
    p.experience
FROM people p
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE p.is_public = TRUE;
