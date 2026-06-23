ALTER TABLE person_claims
    ADD COLUMN IF NOT EXISTS review_score NUMERIC NOT NULL DEFAULT 0 CHECK (review_score >= 0 AND review_score <= 100),
    ADD COLUMN IF NOT EXISTS scoring_version TEXT,
    ADD COLUMN IF NOT EXISTS scoring_reasons JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS auto_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_person_claims_review_score
    ON person_claims(review_score DESC);

UPDATE person_claims
SET review_status = 'archived',
    visibility = 'private',
    is_public = FALSE
WHERE (length(claim_key) - length(replace(claim_key, ':', ''))) >= 3;

DROP VIEW IF EXISTS public_person_claims;

CREATE VIEW public_person_claims AS
SELECT
    pc.id AS claim_id,
    p.id AS person_id,
    pc.claim_type,
    pc.claim_value,
    pc.claim_json,
    pc.confidence_level,
    pc.review_score,
    pc.source_name,
    pc.source_url,
    pc.observed_at,
    pc.updated_at
FROM person_claims pc
JOIN people p ON p.id = pc.person_id AND p.is_public = TRUE
WHERE pc.review_status = 'verified'
  AND pc.visibility = 'public'
  AND pc.is_public = TRUE;

CREATE OR REPLACE VIEW person_claim_review_queue AS
SELECT
    pc.id AS claim_id,
    pc.person_id,
    pc.source_person_id,
    sp.raw_name,
    sp.normalized_name,
    pc.claim_type,
    pc.claim_value,
    pc.claim_json,
    pc.confidence_level,
    pc.review_score,
    pc.review_status,
    pc.visibility,
    pc.source_name,
    pc.source_url,
    pc.scoring_version,
    pc.scoring_reasons,
    pc.updated_at
FROM person_claims pc
LEFT JOIN source_people sp ON sp.id = pc.source_person_id
WHERE pc.review_status IN ('pending', 'needs_more_evidence')
ORDER BY pc.review_score DESC, pc.updated_at DESC;

CREATE OR REPLACE VIEW identity_probable_match_queue AS
SELECT
    m.id AS match_id,
    sp.id AS source_person_id,
    sp.source_person_key,
    sp.raw_name,
    sp.party AS source_party,
    sp.position AS source_position,
    sp.district AS source_district,
    sp.election_year,
    p.id AS person_id,
    p.name AS person_name,
    p.party AS person_party,
    p.position AS person_position,
    p.district AS person_district,
    m.score,
    m.match_method,
    m.match_reason,
    m.evidence_json,
    m.updated_at
FROM person_identity_matches m
JOIN source_people sp ON sp.id = m.source_person_id
JOIN people p ON p.id = m.person_id
WHERE m.match_status = 'probable_match'
ORDER BY m.score DESC, sp.election_year, sp.raw_name;
