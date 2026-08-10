BEGIN;

-- The old matcher accepted name + election type at exactly 75 points. Reject
-- those rows because the combination does not distinguish same-name people.
UPDATE public.person_claims
SET review_status = 'rejected',
    visibility = 'review_only',
    is_public = FALSE,
    updated_at = NOW()
WHERE source_name = '中央選舉委員會 2024 選舉專區：候選人 JSON'
  AND claim_json #>> '{identityMatch,score}' = '75';

-- Official CEC candidate records override the conflicting VoteTW gender rows.
UPDATE public.person_claims
SET review_status = 'rejected',
    visibility = 'review_only',
    is_public = FALSE,
    updated_at = NOW()
WHERE claim_key IN (
    'votetw-person-enrichment:何梅娟:gender:006e3ecd40d25d95',
    'votetw-person-enrichment:張雅旻:gender:7e2c480fd884d6a5',
    'votetw-person-enrichment:林亭君:gender:012658d9bdfe65ad'
);

-- Reject only the conflicting Wikidata birthday on each canonical identity.
UPDATE public.person_claims AS claim
SET review_status = 'rejected',
    visibility = 'review_only',
    is_public = FALSE,
    updated_at = NOW()
FROM public.people AS person
WHERE claim.person_id = person.id
  AND claim.claim_type = 'birth_date'
  AND claim.source_name = 'Wikidata'
  AND person.external_id IN (
      'cec-2022-local-councilor-regional-person-45cdf2919752',
      'cec-2022-local-councilor-regional-person-f76ee519ea7e',
      'cec-2022-local-councilor-regional-person-d7be285d1055',
      'votetw-person-59c90f6f4790d0e7',
      'votetw-person-400a174cf7f9',
      'votetw-person-dce9a92f5c8b36ee',
      'ly-legislator-11-110068'
  );

-- These historical executives had been attached to unrelated same-name
-- candidates. The corrected seed creates separate stable identities.
UPDATE public.person_claims AS claim
SET review_status = 'rejected',
    visibility = 'review_only',
    is_public = FALSE,
    updated_at = NOW()
FROM public.people AS person
WHERE claim.person_id = person.id
  AND claim.source_name = '中央選舉委員會選舉資料庫'
  AND person.external_id IN (
      'votetw-person-30427fad09b603ca',
      'cec-historical-person-003d87775bd62073',
      'votetw-person-b2730c3b42eb930c'
  );

-- Remove the education claim from the unrelated same-name Yang identity. The
-- corrected supplement seed publishes it on the elected executive identity.
UPDATE public.person_claims AS claim
SET review_status = 'rejected',
    visibility = 'review_only',
    is_public = FALSE,
    updated_at = NOW()
FROM public.people AS person
WHERE claim.person_id = person.id
  AND claim.claim_type = 'education'
  AND claim.source_name = '立法院：楊秋興委員簡介'
  AND person.external_id = 'cec-historical-person-003d87775bd62073';

-- Public family claims must not retain an internal "not published" marker.
UPDATE public.person_claims AS claim
SET claim_json = jsonb_set(
        jsonb_set(
          COALESCE(claim.claim_json, '{}'::JSONB),
          '{publicationGate}',
          COALESCE(claim.claim_json->'publicationGate', '{}'::JSONB)
            || jsonb_build_object('status', 'published'),
          TRUE
        ),
        '{verificationPolicy}',
        COALESCE(claim.claim_json->'verificationPolicy', '{}'::JSONB)
          || jsonb_build_object('publicationStillRequired', FALSE),
        TRUE
      ),
    updated_at = NOW()
WHERE claim.claim_key LIKE 'research:tnl-dark-guide-family:%'
  AND claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public = TRUE
  AND (
      claim.claim_json #>> '{publicationGate,status}' IS DISTINCT FROM 'published'
      OR claim.claim_json #>> '{verificationPolicy,publicationStillRequired}' IS DISTINCT FROM 'false'
  );

SELECT public.refresh_public_people_list_cached();

COMMIT;
