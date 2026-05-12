CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    region_type TEXT NOT NULL CHECK (
        region_type IN (
            'country',
            'municipality',
            'county',
            'city',
            'district',
            'township',
            'village',
            'election_district',
            'special'
        )
    ),
    parent_region_id UUID REFERENCES regions(id),
    official_code TEXT,
    map_code TEXT,
    display_order INT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year INT,
    election_type TEXT NOT NULL CHECK (
        election_type IN (
            'presidential',
            'legislative',
            'local',
            'recall',
            'referendum',
            'by_election',
            'other'
        )
    ),
    voting_date DATE,
    status TEXT NOT NULL DEFAULT 'announced' CHECK (
        status IN (
            'draft',
            'announced',
            'upcoming',
            'active',
            'completed',
            'cancelled',
            'unknown'
        )
    ),
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE races (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id),
    region_id UUID REFERENCES regions(id),
    race_type TEXT NOT NULL CHECK (
        race_type IN (
            'president',
            'vice_president',
            'legislator',
            'party_list_legislator',
            'municipality_mayor',
            'county_mayor',
            'city_councilor',
            'county_councilor',
            'township_mayor',
            'township_representative',
            'village_chief',
            'recall',
            'referendum',
            'other'
        )
    ),
    title TEXT NOT NULL,
    voting_date DATE,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (
        status IN (
            'draft',
            'announced',
            'upcoming',
            'registration_open',
            'candidates_announced',
            'voting',
            'completed',
            'cancelled',
            'unknown'
        )
    ),
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id),
    race_id UUID NOT NULL REFERENCES races(id),
    party TEXT,
    candidate_no TEXT,
    registration_status TEXT DEFAULT 'pending' CHECK (
        registration_status IN (
            'pending',
            'registered',
            'qualified',
            'disqualified',
            'withdrawn',
            'elected',
            'not_elected',
            'unknown'
        )
    ),
    source_name TEXT,
    source_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regions_slug ON regions(slug);
CREATE INDEX idx_regions_region_type ON regions(region_type);
CREATE INDEX idx_regions_parent_region_id ON regions(parent_region_id);
CREATE INDEX idx_regions_is_public ON regions(is_public);

CREATE INDEX idx_elections_year ON elections(year);
CREATE INDEX idx_elections_election_type ON elections(election_type);
CREATE INDEX idx_elections_voting_date ON elections(voting_date);
CREATE INDEX idx_elections_is_public ON elections(is_public);

CREATE INDEX idx_races_election_id ON races(election_id);
CREATE INDEX idx_races_region_id ON races(region_id);
CREATE INDEX idx_races_race_type ON races(race_type);
CREATE INDEX idx_races_voting_date ON races(voting_date);
CREATE INDEX idx_races_status ON races(status);
CREATE INDEX idx_races_is_public ON races(is_public);

CREATE UNIQUE INDEX uq_candidates_person_race ON candidates(person_id, race_id);
CREATE INDEX idx_candidates_person_id ON candidates(person_id);
CREATE INDEX idx_candidates_race_id ON candidates(race_id);
CREATE INDEX idx_candidates_party ON candidates(party);
CREATE INDEX idx_candidates_registration_status ON candidates(registration_status);
CREATE INDEX idx_candidates_is_public ON candidates(is_public);

CREATE VIEW public_regions AS
SELECT
    id AS region_id,
    name,
    slug,
    region_type,
    parent_region_id,
    official_code,
    map_code,
    display_order
FROM regions
WHERE is_public = TRUE;

CREATE VIEW public_elections AS
SELECT
    id AS election_id,
    name,
    year,
    election_type,
    voting_date,
    status,
    source_name,
    source_url
FROM elections
WHERE is_public = TRUE;

CREATE VIEW public_races AS
SELECT
    r.id AS race_id,
    e.id AS election_id,
    e.name AS election_name,
    rg.id AS region_id,
    rg.name AS region_name,
    rg.slug AS region_slug,
    r.race_type,
    r.title,
    r.voting_date,
    r.status,
    r.source_name,
    r.source_url
FROM races r
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
WHERE r.is_public = TRUE
  AND (r.region_id IS NULL OR rg.is_public = TRUE);

CREATE VIEW public_candidates AS
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
    c.source_name,
    c.source_url,
    ph.photo_url AS primary_photo_url,
    ph.thumbnail_url AS primary_photo_thumbnail_url,
    ph.attribution AS photo_attribution,
    ph.license_type AS photo_license_type
FROM candidates c
JOIN people p ON p.id = c.person_id AND p.is_public = TRUE
JOIN races r ON r.id = c.race_id AND r.is_public = TRUE
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE c.is_public = TRUE
  AND (r.region_id IS NULL OR rg.is_public = TRUE);

CREATE VIEW public_region_election_summary AS
WITH ranked_races AS (
    SELECT
        rg.id AS region_id,
        rg.name AS region_name,
        rg.slug AS region_slug,
        rg.region_type,
        e.id AS election_id,
        e.name AS election_name,
        r.voting_date,
        COUNT(r.id) FILTER (WHERE r.status IN ('announced', 'upcoming', 'registration_open', 'candidates_announced', 'voting'))
            OVER (PARTITION BY rg.id) AS upcoming_race_count,
        ROW_NUMBER() OVER (PARTITION BY rg.id ORDER BY r.voting_date ASC NULLS LAST, e.name, r.title) AS rn
    FROM regions rg
    LEFT JOIN races r
        ON r.region_id = rg.id
       AND r.is_public = TRUE
       AND r.status IN ('announced', 'upcoming', 'registration_open', 'candidates_announced', 'voting')
    LEFT JOIN elections e
        ON e.id = r.election_id
       AND e.is_public = TRUE
    WHERE rg.is_public = TRUE
)
SELECT
    region_id,
    region_name,
    region_slug,
    region_type,
    election_id AS next_election_id,
    election_name AS next_election_name,
    voting_date AS next_voting_date,
    COALESCE(upcoming_race_count, 0) AS upcoming_race_count
FROM ranked_races
WHERE rn = 1 OR rn IS NULL;

CREATE VIEW public_home_election_ticker AS
SELECT
    id AS election_id,
    name AS election_name,
    voting_date,
    election_type,
    status,
    source_name,
    source_url
FROM elections
WHERE is_public = TRUE
  AND status IN ('announced', 'upcoming', 'active')
  AND voting_date IS NOT NULL
ORDER BY voting_date ASC;
