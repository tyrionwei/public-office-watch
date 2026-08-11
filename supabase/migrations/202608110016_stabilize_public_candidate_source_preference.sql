BEGIN;

-- Equal-quality duplicate candidate rows previously depended on planner order.
-- Prefer the official CEC record, then VoteTW, and finally stable identifiers.
CREATE OR REPLACE VIEW public.public_candidates AS
WITH canonical_candidates AS (
    SELECT DISTINCT ON (pm.canonical_person_id, rm.canonical_race_id, COALESCE(c.candidate_no, ''))
        c.*,
        pm.canonical_person_id,
        rm.canonical_race_id
    FROM public.candidates c
    JOIN public.person_canonical_map pm ON pm.person_id = c.person_id
    JOIN public.race_canonical_map rm ON rm.race_id = c.race_id
    JOIN public.races canonical_race
      ON canonical_race.id = rm.canonical_race_id
     AND canonical_race.is_public = TRUE
    JOIN public.election_canonical_map em
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
        CASE
            WHEN c.external_id LIKE 'cec-%' THEN 0
            WHEN c.external_id LIKE 'votetw-%' THEN 1
            ELSE 2
        END,
        c.updated_at DESC,
        c.external_id NULLS LAST,
        c.id
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
JOIN public.people p ON p.id = c.canonical_person_id AND p.is_public = TRUE
JOIN public.races r ON r.id = c.canonical_race_id AND r.is_public = TRUE
JOIN public.elections e ON e.id = r.election_id AND e.is_public = TRUE
LEFT JOIN public.regions rg ON rg.id = r.region_id
LEFT JOIN public.public_person_primary_photos ph ON ph.person_id = p.id
WHERE r.region_id IS NULL OR rg.is_public = TRUE;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

COMMIT;
