BEGIN;

ALTER TABLE public.person_claims
    ADD COLUMN IF NOT EXISTS candidate_id UUID
    REFERENCES public.candidates(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_person_claims_candidate_type
    ON public.person_claims(candidate_id, claim_type)
    WHERE candidate_id IS NOT NULL;

WITH candidate_context AS (
    SELECT
        claim.id AS claim_id,
        candidate.id AS candidate_id,
        race.id AS race_id,
        race.election_id,
        COUNT(*) OVER (PARTITION BY claim.id) AS candidate_count
    FROM public.person_claims claim
    JOIN public.source_people source
      ON source.id = claim.source_person_id
    JOIN public.candidates candidate
      ON candidate.external_id = source.source_person_key
    JOIN public.races race
      ON race.id = candidate.race_id
    WHERE claim.claim_type = 'platform'
      AND claim.candidate_id IS NULL
      AND source.source_person_key LIKE 'party-candidate:%'
), exact_context AS (
    SELECT claim_id, candidate_id, race_id, election_id
    FROM candidate_context
    WHERE candidate_count = 1
)
UPDATE public.person_claims claim
SET
    candidate_id = context.candidate_id,
    claim_json = JSONB_SET(
        COALESCE(claim.claim_json, '{}'::JSONB),
        '{electionContext}',
        JSONB_BUILD_OBJECT(
            'candidateId', context.candidate_id,
            'raceId', context.race_id,
            'electionId', context.election_id
        ),
        TRUE
    ),
    updated_at = NOW()
FROM exact_context context
WHERE claim.id = context.claim_id;

CREATE OR REPLACE VIEW public.public_person_claims AS
SELECT
    claim.id AS claim_id,
    canonical.canonical_person_id AS person_id,
    claim.claim_type,
    claim.claim_value,
    claim.claim_json,
    claim.confidence_level,
    claim.review_score,
    claim.source_name,
    claim.source_url,
    claim.observed_at,
    claim.updated_at,
    claim.candidate_id
FROM public.person_claims claim
JOIN public.person_canonical_map canonical
  ON canonical.person_id = claim.person_id
JOIN public.people person
  ON person.id = canonical.canonical_person_id
 AND person.is_public = TRUE
WHERE claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public = TRUE;

CREATE OR REPLACE VIEW published.person_claims
WITH (security_barrier = TRUE) AS
SELECT *
FROM public.public_person_claims;

COMMENT ON COLUMN public.person_claims.candidate_id IS
    'Optional election-specific context. Platform claims should reference the exact candidacy whenever the source identifies one.';

COMMENT ON VIEW published.person_claims IS
    'Reviewed public person claims; election-specific claims include candidate_id and electionContext in claim_json.';

NOTIFY pgrst, 'reload schema';

COMMIT;
