-- Fill only missing canonical genders from unanimous, verified 2022 CEC gazette claims.
-- Existing male/female values are deliberately preserved.
WITH normalized_gender_claims AS (
  SELECT
    person_map.canonical_person_id,
    CASE trim(lower(claim.claim_value))
      WHEN '男' THEN 'male'
      WHEN 'male' THEN 'male'
      WHEN '女' THEN 'female'
      WHEN 'female' THEN 'female'
      ELSE NULL
    END AS gender
  FROM public.person_claims AS claim
  JOIN public.person_canonical_map AS person_map
    ON person_map.person_id = claim.person_id
  WHERE claim.claim_type = 'gender'
    AND claim.source_name IN (
      '中央選舉委員會：2022年縣市議員選舉公報',
      '中央選舉委員會：2022年縣市議員選舉公報 OCR'
    )
    AND claim.review_status = 'verified'
    AND claim.visibility = 'public'
    AND claim.is_public = true
),
unambiguous_gender AS (
  SELECT
    canonical_person_id,
    min(gender) AS gender
  FROM normalized_gender_claims
  WHERE gender IS NOT NULL
  GROUP BY canonical_person_id
  HAVING count(DISTINCT gender) = 1
)
UPDATE public.people AS person
SET
  gender = verified.gender,
  updated_at = now()
FROM unambiguous_gender AS verified
WHERE person.id = verified.canonical_person_id
  AND coalesce(nullif(trim(person.gender), ''), 'unknown') = 'unknown';

SELECT public.refresh_public_people_list_cached();
