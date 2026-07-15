WITH ambiguous_public_names AS (
  SELECT name
  FROM public_people
  GROUP BY name
  HAVING COUNT(*) > 1
),
unsafe_claims AS (
  SELECT claim.id
  FROM person_claims AS claim
  JOIN person_canonical_map AS canonical
    ON canonical.person_id = claim.person_id
  JOIN public_people AS person
    ON person.person_id = canonical.canonical_person_id
  JOIN ambiguous_public_names AS ambiguous
    ON ambiguous.name = person.name
  WHERE claim.source_name = 'VoteTW'
)
UPDATE person_claims AS claim
SET
  review_status = 'needs_more_evidence',
  visibility = 'review_only',
  is_public = FALSE,
  updated_at = NOW()
FROM unsafe_claims
WHERE claim.id = unsafe_claims.id;
