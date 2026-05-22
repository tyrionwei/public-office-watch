DROP VIEW IF EXISTS public_person_identity_sources;
DROP VIEW IF EXISTS identity_unmatched_source_people;

CREATE VIEW public_person_identity_sources AS
SELECT
    sp.id AS identity_source_id,
    p.id AS person_id,
    p.name AS person_name,
    sp.source_type,
    sp.source_name,
    sp.source_url,
    sp.raw_name,
    sp.normalized_name,
    sp.party,
    sp.position,
    sp.district,
    sp.election_year,
    m.match_status,
    m.score AS match_score,
    sp.confidence_suggestion,
    sp.updated_at
FROM person_identity_matches m
JOIN source_people sp ON sp.id = m.source_person_id AND sp.is_public = TRUE
JOIN people p ON p.id = m.person_id AND p.is_public = TRUE
WHERE m.match_status = 'auto_matched';

CREATE VIEW identity_unmatched_source_people AS
SELECT
    sp.id AS source_person_id,
    sp.source_person_key,
    sp.source_type,
    sp.source_name,
    sp.source_url,
    sp.raw_name,
    sp.normalized_name,
    sp.party,
    sp.position,
    sp.district,
    sp.election_year,
    sp.confidence_suggestion,
    COALESCE(MAX(m.score), 0) AS best_match_score,
    COALESCE(
        MIN(m.match_status) FILTER (WHERE m.match_status IN ('probable_match', 'possible_match')),
        'unmatched'
    ) AS review_status,
    sp.updated_at
FROM source_people sp
LEFT JOIN person_identity_matches m ON m.source_person_id = sp.id
WHERE NOT EXISTS (
    SELECT 1
    FROM person_identity_matches confirmed
    WHERE confirmed.source_person_id = sp.id
      AND confirmed.match_status = 'auto_matched'
)
GROUP BY sp.id;
