UPDATE elections
SET
    name = year || '年地方公職人員選舉',
    updated_at = NOW()
WHERE year IN (2022, 2026)
  AND name IN ('111年地方公職人員選舉', '115年地方公職人員選舉');

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
    e.year AS election_year
FROM canonical_candidates c
JOIN people p ON p.id = c.canonical_person_id AND p.is_public = TRUE
JOIN races r ON r.id = c.canonical_race_id AND r.is_public = TRUE
JOIN elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN regions rg ON rg.id = r.region_id
LEFT JOIN public_person_primary_photos ph ON ph.person_id = p.id
WHERE r.region_id IS NULL OR rg.is_public = TRUE;

UPDATE people
SET
    party = '無黨籍',
    updated_at = NOW()
WHERE id = 'a058edf9-9aeb-4ebb-a490-848178441ce5'
  AND name = '高金素梅'
  AND party = '中國國民黨';

INSERT INTO person_party_affiliations (
    affiliation_key,
    person_id,
    source_person_id,
    source_claim_key,
    party_name,
    normalized_party,
    role_context,
    observed_year,
    observed_date,
    start_date,
    end_date,
    is_current,
    confidence_level,
    review_status,
    source_name,
    source_url,
    source_payload,
    is_public,
    created_at,
    updated_at
)
SELECT
    affiliation_key || ':party-correction-20260714',
    person_id,
    source_person_id,
    source_claim_key,
    '無黨籍',
    '無黨籍',
    role_context,
    observed_year,
    observed_date,
    start_date,
    end_date,
    is_current,
    'A',
    'verified',
    source_name,
    'https://www.ly.gov.tw/Pages/List.aspx?nodeid=46801',
    source_payload || jsonb_build_object(
        'correctedAt', '2026-07-14',
        'correctionReason', 'Legislative Yuan lists party as independent and caucus as Kuomintang'
    ),
    TRUE,
    NOW(),
    NOW()
FROM person_party_affiliations
WHERE person_id = 'a058edf9-9aeb-4ebb-a490-848178441ce5'
  AND party_name = '中國國民黨'
  AND role_context = 'officeholder'
  AND source_name LIKE '立法院%'
ON CONFLICT (affiliation_key) DO UPDATE SET
    party_name = EXCLUDED.party_name,
    normalized_party = EXCLUDED.normalized_party,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    source_url = EXCLUDED.source_url,
    source_payload = EXCLUDED.source_payload,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

UPDATE person_party_affiliations
SET
    review_status = 'archived',
    is_public = FALSE,
    source_payload = source_payload || jsonb_build_object(
        'archivedAt', '2026-07-14',
        'archiveReason', 'partyGroup was previously imported as party'
    ),
    updated_at = NOW()
WHERE person_id = 'a058edf9-9aeb-4ebb-a490-848178441ce5'
  AND party_name = '中國國民黨'
  AND role_context = 'officeholder'
  AND source_name LIKE '立法院%';
