-- Reconcile review rows that can be resolved from existing canonical mappings
-- or from the same 2020 election record in the CEC and VoteTW datasets.

UPDATE person_claims AS claim
SET
  person_id = canonical.canonical_person_id,
  updated_at = NOW()
FROM person_canonical_map AS canonical
WHERE canonical.person_id = claim.person_id
  AND canonical.person_id <> canonical.canonical_person_id
  AND claim.review_status IN ('pending', 'needs_more_evidence');

WITH ranked_claims AS (
  SELECT
    claim.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        claim.person_id,
        claim.source_name,
        claim.claim_type,
        COALESCE(claim.claim_value, claim.claim_json->>'value', '')
      ORDER BY claim.review_score DESC NULLS LAST, claim.updated_at DESC, claim.id
    ) AS duplicate_rank
  FROM person_claims AS claim
  WHERE claim.review_status IN ('pending', 'needs_more_evidence')
),
duplicate_claims AS (
  SELECT id
  FROM ranked_claims
  WHERE duplicate_rank > 1
)
UPDATE person_claims AS claim
SET
  review_status = 'archived',
  visibility = 'private',
  is_public = FALSE,
  scoring_version = 'canonical-review-queue-reconciliation-v1',
  scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) || jsonb_build_array(
    jsonb_build_object(
      'version', 'canonical-review-queue-reconciliation-v1',
      'reason', 'exact duplicate review claim archived after canonical person reconciliation',
      'reviewedAt', NOW()
    )
  ),
  updated_at = NOW()
FROM duplicate_claims
WHERE claim.id = duplicate_claims.id;

WITH unique_public_names AS (
  SELECT name, MIN(person_id::TEXT)::UUID AS person_id
  FROM public_people
  GROUP BY name
  HAVING COUNT(*) = 1
),
resolved_vote_tw_claims AS (
  SELECT claim.id
  FROM person_claims AS claim
  JOIN public_people AS person ON person.person_id = claim.person_id
  JOIN unique_public_names AS unique_name
    ON unique_name.name = person.name
   AND unique_name.person_id = person.person_id
  WHERE claim.source_name = 'VoteTW'
    AND claim.review_status IN ('pending', 'needs_more_evidence')
    AND claim.claim_type IN (
      'external_id',
      'birth_date',
      'gender',
      'education',
      'experience',
      'party_affiliation',
      'platform'
    )
    AND claim.claim_json#>>'{identityMatch,status}' = 'matched'
    AND claim.claim_json#>>'{publicationGate,status}' = 'review_required'
)
UPDATE person_claims AS claim
SET
  review_status = 'pending',
  claim_json = jsonb_set(
    COALESCE(claim.claim_json, '{}'::JSONB),
    '{publicationGate}',
    COALESCE(claim.claim_json->'publicationGate', '{}'::JSONB) || jsonb_build_object(
      'status', 'passed',
      'reason', 'same-name ambiguity resolved by verified canonical person merges',
      'checkedAt', NOW()
    ),
    TRUE
  ),
  updated_at = NOW()
FROM resolved_vote_tw_claims
WHERE claim.id = resolved_vote_tw_claims.id;

CREATE TEMP TABLE reconciled_2020_identity_matches ON COMMIT DROP AS
WITH election_record_matches AS (
  SELECT
    source_person.id AS source_person_id,
    canonical.canonical_person_id,
    candidate.id AS candidate_id,
    race.id AS race_id
  FROM source_people AS source_person
  JOIN candidates AS candidate
    ON candidate.candidate_no = source_person.source_payload->>'candidateNo'
  JOIN people AS candidate_person ON candidate_person.id = candidate.person_id
  JOIN person_canonical_map AS canonical ON canonical.person_id = candidate_person.id
  JOIN races AS race ON race.id = candidate.race_id
  JOIN elections AS election
    ON election.id = race.election_id
   AND election.year = source_person.election_year
  WHERE source_person.source_type = 'official_election'
    AND source_person.election_year = 2020
    AND NOT EXISTS (
      SELECT 1
      FROM person_identity_matches AS confirmed
      WHERE confirmed.source_person_id = source_person.id
        AND confirmed.match_status = 'auto_matched'
    )
    AND TRANSLATE(source_person.raw_name, '慨', '慨') = TRANSLATE(candidate_person.name, '慨', '慨')
    AND lower(regexp_replace(replace(COALESCE(source_person.party, ''), '臺', '台'), E'\\s+', '', 'g'))
      = lower(regexp_replace(replace(COALESCE(candidate.party, ''), '臺', '台'), E'\\s+', '', 'g'))
    AND (
      lower(regexp_replace(replace(source_person.district, '臺', '台'), E'\\s+', '', 'g'))
        = lower(regexp_replace(replace(race.title, '臺', '台'), E'\\s+', '', 'g'))
      OR replace(
        lower(regexp_replace(replace(source_person.district, '臺', '台'), E'\\s+', '', 'g')),
        '第1選舉區',
        '選舉區'
      ) = lower(regexp_replace(replace(race.title, '臺', '台'), E'\\s+', '', 'g'))
      OR lower(regexp_replace(replace(race.title, '臺', '台'), E'\\s+', '', 'g')) LIKE
        '%' || lower(regexp_replace(replace(source_person.district, '臺', '台'), E'\\s+', '', 'g')) || '%'
    )
),
unique_matches AS (
  SELECT
    source_person_id,
    MIN(canonical_person_id::TEXT)::UUID AS canonical_person_id,
    MIN(candidate_id::TEXT)::UUID AS candidate_id,
    MIN(race_id::TEXT)::UUID AS race_id
  FROM election_record_matches
  GROUP BY source_person_id
  HAVING COUNT(DISTINCT canonical_person_id) = 1
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
  reconciled.canonical_person_id,
  'auto_matched',
  100,
  'same_election_race_ballot_record',
  'matched by election year, race, party, ballot number, and normalized candidate name',
  jsonb_build_object(
    'version', 'same-election-record-reconciliation-v1',
    'electionYear', source_person.election_year,
    'candidateNo', source_person.source_payload->>'candidateNo',
    'sourcePersonKey', source_person.source_person_key,
    'candidateId', reconciled.candidate_id,
    'raceId', reconciled.race_id
  ),
  'system:election-record-reconciliation',
  NOW(),
  NOW()
FROM reconciled_2020_identity_matches AS reconciled
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
FROM reconciled_2020_identity_matches AS reconciled
WHERE source_person.id = reconciled.source_person_id;
