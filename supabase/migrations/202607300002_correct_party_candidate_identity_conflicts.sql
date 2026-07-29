BEGIN;

-- The Taipei TPP councilor and New Taipei DPP councilor candidates named
-- 張志豪 are different people. Archive claims that attached each person's
-- Wikidata entity to the other person.
UPDATE person_claims
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'identity-conflict-correction-v1',
    scoring_reasons = COALESCE(scoring_reasons, '[]'::JSONB) || jsonb_build_array(
        jsonb_build_object(
            'reason', 'Wikidata entity belongs to a different same-name person.',
            'reviewedAt', '2026-07-30'
        )
    ),
    updated_at = NOW()
WHERE (
        person_id = '6cdf9eab-203b-47f9-9d30-6629a112cdd4'
        AND source_url = 'https://www.wikidata.org/wiki/Q30945692'
    )
    OR (
        person_id = 'bb3640fb-7124-4a57-b781-84c824a5ad64'
        AND source_url = 'https://www.wikidata.org/wiki/Q111693189'
    );

UPDATE person_merge_decisions
SET
    status = 'archived',
    evidence_json = evidence_json || jsonb_build_object(
        'correction', 'same-name people from different parties and cities',
        'correctedAt', '2026-07-30'
    ),
    updated_at = NOW()
WHERE status IN ('suggested', 'verified')
  AND duplicate_person_id IN (
      'bb3640fb-7124-4a57-b781-84c824a5ad64',
      'b7a026fb-9a9b-44a8-b12e-c5850d92accd'
  )
  AND canonical_person_id = '6cdf9eab-203b-47f9-9d30-6629a112cdd4';

INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    'b7a026fb-9a9b-44a8-b12e-c5850d92accd',
    'bb3640fb-7124-4a57-b781-84c824a5ad64',
    'verified',
    'A',
    'Same 2022 New Taipei City district 6 candidate matched by name, party, candidate number, and election context.',
    jsonb_build_object(
        'rule', 'reviewed_same_race_name_number_party',
        'candidateYear', 2022,
        'party', '民主進步黨',
        'region', '新北市',
        'district', '第6選舉區',
        'reviewedDate', '2026-07-30'
    ),
    'publication-audit:2026-party-candidates',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = 'b7a026fb-9a9b-44a8-b12e-c5850d92accd'
      AND existing.canonical_person_id = 'bb3640fb-7124-4a57-b781-84c824a5ad64'
      AND existing.status IN ('suggested', 'verified')
);

-- Rebind the 2026 New Taipei DPP nomination to the correct DPP person.
UPDATE source_people
SET
    source_payload = jsonb_set(
        source_payload,
        '{identitySuggestion}',
        jsonb_build_object(
            'resolution', 'high_confidence_match',
            'canonicalCandidates', jsonb_build_array(
                jsonb_build_object(
                    'evidence', jsonb_build_array('party', 'geography'),
                    'personIds', jsonb_build_array(
                        'bb3640fb-7124-4a57-b781-84c824a5ad64',
                        'b7a026fb-9a9b-44a8-b12e-c5850d92accd'
                    ),
                    'canonicalPersonId', 'bb3640fb-7124-4a57-b781-84c824a5ad64'
                )
            ),
            'selectedCanonicalPersonId', 'bb3640fb-7124-4a57-b781-84c824a5ad64'
        ),
        TRUE
    ),
    updated_at = NOW()
WHERE source_person_key = 'party-candidate:dpp-2026-councilor-65000-6-2cf1965d079d';

UPDATE person_identity_matches match
SET
    person_id = 'bb3640fb-7124-4a57-b781-84c824a5ad64',
    match_status = 'auto_matched',
    score = 100,
    match_method = 'party_candidate_publication_correction_v1',
    match_reason = 'Exact name, DPP affiliation, and New Taipei City district 6 history identify the correct same-name person.',
    evidence_json = jsonb_build_object(
        'version', 'party-candidate-publication-correction-v1',
        'evidence', jsonb_build_array('party', 'geography', 'same-race-history'),
        'sourceCandidateKey', source.source_person_key
    ),
    reviewed_by = 'publication-audit:2026-party-candidates',
    reviewed_at = NOW(),
    updated_at = NOW()
FROM source_people source
WHERE match.source_person_id = source.id
  AND source.source_person_key = 'party-candidate:dpp-2026-councilor-65000-6-2cf1965d079d';

UPDATE person_claims claim
SET
    person_id = 'bb3640fb-7124-4a57-b781-84c824a5ad64',
    claim_json = source.source_payload,
    scoring_version = 'party-candidate-publication-correction-v1',
    scoring_reasons = jsonb_build_array(
        jsonb_build_object(
            'reason', 'Exact name, DPP affiliation, and New Taipei City district 6 history identify the correct same-name person.',
            'reviewedAt', '2026-07-30'
        )
    ),
    updated_at = NOW()
FROM source_people source
WHERE claim.source_person_id = source.id
  AND source.source_person_key = 'party-candidate:dpp-2026-councilor-65000-6-2cf1965d079d'
  AND claim.claim_type = 'candidacy';

UPDATE candidates
SET
    person_id = 'bb3640fb-7124-4a57-b781-84c824a5ad64',
    updated_at = NOW()
WHERE external_id = 'party-candidate:dpp-2026-councilor-65000-6-2cf1965d079d';

-- The current official DPP Kaohsiung district 11 page no longer lists 張耀中.
-- Keep the source row as an audit trail, reject its match and claim, and remove
-- only the invalid 2026 candidacy relation.
UPDATE source_people
SET
    is_public = FALSE,
    source_payload = source_payload || jsonb_build_object(
        'publicationReview', jsonb_build_object(
            'status', 'source_absent',
            'checkedAt', '2026-07-30',
            'reason', 'Candidate is absent from the current official district page.'
        )
    ),
    updated_at = NOW()
WHERE source_person_key = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf';

UPDATE person_identity_matches match
SET
    match_status = 'rejected_match',
    score = 0,
    match_method = 'official_source_recheck_v1',
    match_reason = 'Candidate is absent from the current official DPP Kaohsiung district 11 page.',
    evidence_json = evidence_json || jsonb_build_object(
        'officialSourceCheckedAt', '2026-07-30',
        'publicationDecision', 'rejected'
    ),
    reviewed_by = 'publication-audit:2026-party-candidates',
    reviewed_at = NOW(),
    updated_at = NOW()
FROM source_people source
WHERE match.source_person_id = source.id
  AND source.source_person_key = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf';

UPDATE person_claims claim
SET
    review_status = 'rejected',
    visibility = 'private',
    is_public = FALSE,
    claim_json = source.source_payload,
    scoring_version = 'official-source-recheck-v1',
    scoring_reasons = jsonb_build_array(
        jsonb_build_object(
            'reason', 'Candidate is absent from the current official DPP district page.',
            'reviewedAt', '2026-07-30'
        )
    ),
    updated_at = NOW()
FROM source_people source
WHERE claim.source_person_id = source.id
  AND source.source_person_key = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf'
  AND claim.claim_type = 'candidacy';

DELETE FROM candidates
WHERE external_id = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf';

DO $$
DECLARE
    taipei_canonical UUID;
    new_taipei_cec_canonical UUID;
    new_taipei_votetw_canonical UUID;
BEGIN
    SELECT canonical_person_id
    INTO taipei_canonical
    FROM person_canonical_map
    WHERE person_id = '6cdf9eab-203b-47f9-9d30-6629a112cdd4';

    SELECT canonical_person_id
    INTO new_taipei_cec_canonical
    FROM person_canonical_map
    WHERE person_id = 'bb3640fb-7124-4a57-b781-84c824a5ad64';

    SELECT canonical_person_id
    INTO new_taipei_votetw_canonical
    FROM person_canonical_map
    WHERE person_id = 'b7a026fb-9a9b-44a8-b12e-c5850d92accd';

    IF taipei_canonical <> '6cdf9eab-203b-47f9-9d30-6629a112cdd4'::UUID
       OR new_taipei_cec_canonical <> 'bb3640fb-7124-4a57-b781-84c824a5ad64'::UUID
       OR new_taipei_votetw_canonical <> 'bb3640fb-7124-4a57-b781-84c824a5ad64'::UUID THEN
        RAISE EXCEPTION '張志豪 canonical identity correction did not produce the expected groups';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM candidates
        WHERE external_id = 'party-candidate:dpp-2026-councilor-65000-6-2cf1965d079d'
          AND person_id <> 'bb3640fb-7124-4a57-b781-84c824a5ad64'::UUID
    ) THEN
        RAISE EXCEPTION '2026 New Taipei DPP 張志豪 is still linked to the wrong person';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM candidates
        WHERE external_id = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf'
    ) THEN
        RAISE EXCEPTION 'Invalid Kaohsiung 張耀中 candidacy still exists';
    END IF;
END
$$;

REFRESH MATERIALIZED VIEW public_people_list_cached;

COMMIT;
