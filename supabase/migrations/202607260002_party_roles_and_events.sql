ALTER TABLE person_party_affiliations
    ADD COLUMN IF NOT EXISTS role_title TEXT,
    ADD COLUMN IF NOT EXISTS organization_unit TEXT,
    ADD COLUMN IF NOT EXISTS display_order INT;

CREATE TABLE IF NOT EXISTS person_party_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    party_name TEXT NOT NULL,
    normalized_party TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('joined', 'left', 'expelled', 'suspended', 'disciplined', 'reinstated', 'other')
    ),
    event_date DATE,
    end_date DATE,
    summary TEXT,
    confidence_level TEXT NOT NULL DEFAULT 'D' CHECK (confidence_level IN ('A', 'B', 'C', 'D')),
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        review_status IN ('pending', 'verified', 'rejected', 'needs_more_evidence', 'archived')
    ),
    source_name TEXT,
    source_url TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_party_events_person_date
    ON person_party_events(person_id, event_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_person_party_events_party_date
    ON person_party_events(normalized_party, event_date DESC NULLS LAST);

ALTER TABLE person_party_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_person_party_events ON person_party_events;
CREATE POLICY public_read_person_party_events
    ON person_party_events
    FOR SELECT
    USING (is_public = TRUE AND review_status = 'verified');

DROP POLICY IF EXISTS importer_write_person_party_events ON person_party_events;
CREATE POLICY importer_write_person_party_events
    ON person_party_events
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

DROP VIEW IF EXISTS public_party_officers;
DROP VIEW IF EXISTS public_person_party_events;
DROP VIEW IF EXISTS public_person_party_affiliations;

CREATE VIEW public_person_party_affiliations AS
SELECT
    a.id AS affiliation_id,
    a.affiliation_key,
    a.person_id,
    p.name AS person_name,
    a.source_claim_key,
    a.party_name,
    a.role_context,
    a.role_title,
    a.organization_unit,
    a.display_order,
    a.observed_year,
    a.observed_date,
    a.start_date,
    a.end_date,
    a.is_current,
    a.confidence_level,
    a.source_name,
    a.source_url,
    a.updated_at
FROM person_party_affiliations a
JOIN people p ON p.id = a.person_id AND p.is_public = TRUE
WHERE a.is_public = TRUE
  AND a.review_status = 'verified';

CREATE VIEW public_person_party_events AS
SELECT
    event.id AS event_id,
    event.event_key,
    event.person_id,
    person.name AS person_name,
    event.party_name,
    event.event_type,
    event.event_date,
    event.end_date,
    event.summary,
    event.confidence_level,
    event.source_name,
    event.source_url,
    event.updated_at
FROM person_party_events event
JOIN people person ON person.id = event.person_id AND person.is_public = TRUE
WHERE event.is_public = TRUE
  AND event.review_status = 'verified';

CREATE VIEW public_party_officers AS
SELECT
    affiliation.id AS affiliation_id,
    affiliation.person_id,
    person.name AS person_name,
    party.id AS party_id,
    party.name AS party_name,
    affiliation.role_title,
    affiliation.organization_unit,
    affiliation.display_order,
    affiliation.start_date,
    affiliation.observed_date,
    profile.current_office_label,
    profile.primary_photo_thumbnail_url,
    affiliation.source_name,
    affiliation.source_url,
    affiliation.updated_at
FROM person_party_affiliations affiliation
JOIN people person ON person.id = affiliation.person_id AND person.is_public = TRUE
JOIN parties party
  ON party.is_public = TRUE
 AND REPLACE(party.name, '臺', '台') = REPLACE(affiliation.normalized_party, '臺', '台')
LEFT JOIN public_people_list_cached profile ON profile.person_id = affiliation.person_id
WHERE affiliation.role_context = 'party_officer'
  AND affiliation.is_current = TRUE
  AND affiliation.is_public = TRUE
  AND affiliation.review_status = 'verified';

REVOKE ALL ON person_party_events FROM anon, authenticated;
GRANT SELECT ON public_person_party_affiliations TO anon, authenticated;
GRANT SELECT ON public_person_party_events TO anon, authenticated;
GRANT SELECT ON public_party_officers TO anon, authenticated;
