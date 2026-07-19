-- Match official officeholder records only when the canonical public profile is
-- unique and its name, party, gender, and district agree with the source.

CREATE TEMP TABLE reconciled_officeholder_identity_matches ON COMMIT DROP AS
WITH profile_matches AS (
  SELECT
    source_person.id AS source_person_id,
    person.person_id
  FROM source_people AS source_person
  JOIN person_identity_review_queue AS review ON review.source_person_id = source_person.id
  JOIN public_people AS person
    ON lower(regexp_replace(replace(person.name, '臺', '台'), E'\\s+', '', 'g'))
      = source_person.normalized_name
  WHERE source_person.source_type = 'official_officeholder'
    AND NOT EXISTS (
      SELECT 1
      FROM person_identity_matches AS confirmed
      WHERE confirmed.source_person_id = source_person.id
        AND confirmed.match_status = 'auto_matched'
    )
    AND lower(regexp_replace(replace(COALESCE(source_person.party, ''), '臺', '台'), E'\\s+', '', 'g'))
      = lower(regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g'))
    AND (
      source_person.gender IS NULL
      OR source_person.gender = 'unknown'
      OR person.gender = source_person.gender
    )
    AND (
      lower(regexp_replace(replace(split_part(source_person.district, '（', 1), '臺', '台'), E'\\s+', '', 'g'))
        = lower(regexp_replace(replace(COALESCE(person.district, ''), '臺', '台'), E'\\s+', '', 'g'))
      OR lower(regexp_replace(replace(source_person.district, '臺', '台'), E'\\s+', '', 'g')) LIKE
        lower(regexp_replace(replace(COALESCE(person.district, ''), '臺', '台'), E'\\s+', '', 'g')) || '%'
    )
),
unique_matches AS (
  SELECT
    source_person_id,
    MIN(person_id::TEXT)::UUID AS person_id
  FROM profile_matches
  GROUP BY source_person_id
  HAVING COUNT(DISTINCT person_id) = 1
)
SELECT *
FROM unique_matches;

INSERT INTO person_identity_matches (
  source_person_id,
  person_id,
  match_status,
  score,
  match_method,
  match_reason,
  evidence_json,
  reviewed_by,
  reviewed_at,
  updated_at
)
SELECT
  reconciled.source_person_id,
  reconciled.person_id,
  'auto_matched',
  100,
  'official_officeholder_exact_profile',
  'unique canonical profile matched official name, party, gender, and district',
  jsonb_build_object(
    'version', 'official-officeholder-exact-profile-v1',
    'sourcePersonKey', source_person.source_person_key,
    'sourceName', source_person.source_name,
    'sourcePosition', source_person.position,
    'sourceDistrict', source_person.district
  ),
  'system:official-officeholder-reconciliation',
  NOW(),
  NOW()
FROM reconciled_officeholder_identity_matches AS reconciled
JOIN source_people AS source_person ON source_person.id = reconciled.source_person_id
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
  match_status = EXCLUDED.match_status,
  score = EXCLUDED.score,
  match_method = EXCLUDED.match_method,
  match_reason = EXCLUDED.match_reason,
  evidence_json = EXCLUDED.evidence_json,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = EXCLUDED.reviewed_at,
  updated_at = EXCLUDED.updated_at;

UPDATE source_people AS source_person
SET
  is_public = TRUE,
  updated_at = NOW()
FROM reconciled_officeholder_identity_matches AS reconciled
WHERE source_person.id = reconciled.source_person_id;
