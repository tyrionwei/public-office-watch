BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM release_staging_20260826.birth_dates) <> 18826
       OR (SELECT COUNT(DISTINCT person_external_id) FROM release_staging_20260826.birth_dates) <> 18826
       OR EXISTS (
           SELECT 1
           FROM release_staging_20260826.birth_dates
           WHERE claim_type <> 'birth_date'
              OR review_status <> 'verified'
              OR visibility <> 'public'
              OR is_public IS DISTINCT FROM TRUE
              OR claim_value !~ '^([0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})$'
              OR claim_json->>'productionRelease' IS DISTINCT FROM '20260826-birth-dates'
       ) THEN
        RAISE EXCEPTION 'Verified birth-date release payload drift';
    END IF;
END
$$;

CREATE TEMP TABLE _release_birth_person_ids ON COMMIT DROP AS
SELECT release.person_external_id, person.id AS target_id
FROM (SELECT DISTINCT person_external_id FROM release_staging_20260826.birth_dates) release
LEFT JOIN public.people person ON person.external_id = release.person_external_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT person_external_id FROM _release_birth_person_ids
        GROUP BY person_external_id HAVING COUNT(*) <> 1
    ) OR EXISTS (
        SELECT 1 FROM _release_birth_person_ids WHERE target_id IS NULL
    ) OR EXISTS (
        SELECT 1
        FROM _release_birth_person_ids mapping
        LEFT JOIN published.people person ON person.person_id = mapping.target_id
        WHERE person.person_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Birth-date release person mapping is incomplete or ambiguous';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims existing
        JOIN release_staging_20260826.birth_dates incoming ON existing.claim_key = incoming.claim_key
        WHERE existing.claim_type <> 'birth_date'
    ) THEN
        RAISE EXCEPTION 'Birth-date release claim key conflicts with another claim type';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.person_claims existing
        WHERE existing.claim_type = 'birth_date'
          AND NOT EXISTS (
              SELECT 1 FROM release_staging_20260826.birth_dates incoming
              WHERE incoming.claim_key = existing.claim_key
          )
    ) THEN
        RAISE EXCEPTION 'Unexpected pre-existing birth-date claims require review';
    END IF;
END
$$;

ALTER TABLE release_staging_20260826.birth_dates ADD COLUMN person_id uuid;

UPDATE release_staging_20260826.birth_dates incoming
SET person_id = mapping.target_id
FROM _release_birth_person_ids mapping
WHERE mapping.person_external_id = incoming.person_external_id;

UPDATE release_staging_20260826.birth_dates incoming
SET id = existing.id
FROM public.person_claims existing
WHERE existing.claim_key = incoming.claim_key;

UPDATE release_staging_20260826.birth_dates incoming
SET id = gen_random_uuid()
WHERE EXISTS (
    SELECT 1 FROM public.person_claims existing
    WHERE existing.id = incoming.id
      AND existing.claim_key IS DISTINCT FROM incoming.claim_key
);

INSERT INTO public.person_claims (
    id, claim_key, person_id, source_person_id, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url, observed_at,
    is_public, created_at, updated_at, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, candidate_id
)
SELECT
    id, claim_key, person_id, NULL, claim_type, claim_value, claim_json,
    confidence_level, review_status, visibility, source_name, source_url, observed_at,
    is_public, created_at, updated_at, review_score, scoring_version, scoring_reasons,
    auto_reviewed_at, NULL
FROM release_staging_20260826.birth_dates
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    source_person_id = NULL,
    claim_type = EXCLUDED.claim_type,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    updated_at = EXCLUDED.updated_at,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    candidate_id = NULL;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);
ANALYZE public.person_claims;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM public.person_claims claim
        JOIN release_staging_20260826.birth_dates release ON release.claim_key = claim.claim_key
        WHERE claim.claim_type = 'birth_date'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
    ) <> 18826
       OR (
           SELECT COUNT(DISTINCT person_id)
           FROM public.person_claims
           WHERE claim_type = 'birth_date'
             AND review_status = 'verified'
             AND visibility = 'public'
             AND is_public = TRUE
       ) <> 18826
       OR (
           SELECT COUNT(*) FROM published.release_state WHERE state_key = 'current'
       ) <> 1 THEN
        RAISE EXCEPTION 'Verified birth-date publication verification failed';
    END IF;
END
$$;

DROP SCHEMA release_staging_20260826 CASCADE;

COMMIT;
