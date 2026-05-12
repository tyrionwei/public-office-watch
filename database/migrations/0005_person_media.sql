CREATE TABLE person_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id),
    media_type TEXT NOT NULL CHECK (
        media_type IN ('photo')
    ),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    license_type TEXT NOT NULL CHECK (
        license_type IN (
            'government_open_data',
            'creative_commons',
            'official_site_permission',
            'wikimedia_commons',
            'self_provided',
            'placeholder',
            'unknown'
        )
    ),
    license_url TEXT,
    attribution TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'verified', 'rejected', 'archived')
    ),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (NOT (is_public = TRUE AND verification_status <> 'verified')),
    CHECK (NOT (is_public = TRUE AND license_type = 'unknown'))
);

CREATE UNIQUE INDEX ux_person_media_primary_public
    ON person_media(person_id)
    WHERE is_primary = TRUE
      AND is_public = TRUE
      AND verification_status = 'verified';

CREATE INDEX idx_person_media_person_id
    ON person_media(person_id);

CREATE INDEX idx_person_media_verification_public
    ON person_media(verification_status, is_public);

CREATE INDEX idx_person_media_is_primary
    ON person_media(is_primary);

CREATE INDEX idx_person_media_license_type
    ON person_media(license_type);

CREATE VIEW public_person_primary_photos AS
SELECT
    pm.person_id,
    pm.id AS media_id,
    pm.url AS photo_url,
    pm.thumbnail_url,
    pm.source_name,
    pm.source_url,
    pm.license_type,
    pm.license_url,
    pm.attribution
FROM person_media pm
JOIN people p ON p.id = pm.person_id
WHERE pm.verification_status = 'verified'
  AND pm.is_public = TRUE
  AND pm.is_primary = TRUE
  AND pm.license_type <> 'unknown'
  AND p.is_public = TRUE;
