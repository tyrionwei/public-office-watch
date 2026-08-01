BEGIN;

-- User review confirmed that the Kaohsiung source record is not the
-- established Taichung councilor with the same name. Keep the new identity
-- and candidacy private until the CEC publishes registration data.
INSERT INTO people (
    id, name, party, position, election_year, district, source_url,
    external_id, is_public, created_at, updated_at
)
VALUES (
    'b05ef122-1db5-442a-a3f5-0636f334c7f8',
    '張耀中',
    '民主進步黨',
    '高雄市議員擬參選人',
    2026,
    '高雄市第11選區',
    'https://teamtaiwan.dpp.org.tw/councilor?city=64000&district=%E7%AC%AC11%E9%81%B8%E5%8D%80',
    'party-candidate-person:dpp-2026-councilor-64000-11-243d4911c7bf',
    FALSE,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    party = EXCLUDED.party,
    position = EXCLUDED.position,
    election_year = EXCLUDED.election_year,
    district = EXCLUDED.district,
    source_url = EXCLUDED.source_url,
    external_id = EXCLUDED.external_id,
    is_public = FALSE,
    updated_at = NOW();

UPDATE source_people
SET
    is_public = FALSE,
    source_payload = jsonb_set(
        jsonb_set(
            source_payload,
            '{identitySuggestion}',
            jsonb_build_object(
                'resolution', 'new_person',
                'canonicalCandidates', jsonb_build_array(
                    jsonb_build_object(
                        'evidence', jsonb_build_array('user_review', 'different_geography'),
                        'personIds', jsonb_build_array('b05ef122-1db5-442a-a3f5-0636f334c7f8'),
                        'canonicalPersonId', 'b05ef122-1db5-442a-a3f5-0636f334c7f8'
                    )
                ),
                'selectedCanonicalPersonId', 'b05ef122-1db5-442a-a3f5-0636f334c7f8'
            ),
            TRUE
        ),
        '{publicationReview}',
        jsonb_build_object(
            'status', 'awaiting_cec_confirmation',
            'checkedAt', '2026-08-01',
            'reason', 'The original party-site key may be stale or incorrect; retain privately until CEC registration data is available.'
        ),
        TRUE
    ),
    updated_at = NOW()
WHERE source_person_key = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf';

UPDATE person_identity_matches match
SET
    person_id = 'b05ef122-1db5-442a-a3f5-0636f334c7f8',
    match_status = 'auto_matched',
    score = 100,
    match_method = 'user_reviewed_source_scoped_new_person_v1',
    match_reason = 'User review confirmed this source-scoped Kaohsiung identity is not the Taichung councilor with the same name.',
    evidence_json = jsonb_build_object(
        'sourceCandidateKey', source.source_person_key,
        'identityDecision', 'new_person',
        'publicationDecision', 'awaiting_cec_confirmation',
        'reviewedDate', '2026-08-01'
    ),
    reviewed_by = 'user-reviewed:party-candidate-identity',
    reviewed_at = NOW(),
    updated_at = NOW()
FROM source_people source
WHERE match.source_person_id = source.id
  AND source.source_person_key = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf';

UPDATE person_claims claim
SET
    person_id = 'b05ef122-1db5-442a-a3f5-0636f334c7f8',
    review_status = 'needs_more_evidence',
    visibility = 'private',
    is_public = FALSE,
    confidence_level = 'D',
    claim_json = source.source_payload,
    scoring_version = 'awaiting-cec-confirmation-v1',
    scoring_reasons = jsonb_build_array(
        jsonb_build_object(
            'reason', 'Identity is tracked separately, but candidacy remains private until CEC confirmation.',
            'reviewedAt', '2026-08-01'
        )
    ),
    updated_at = NOW()
FROM source_people source
WHERE claim.source_person_id = source.id
  AND source.source_person_key = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf'
  AND claim.claim_type = 'candidacy';

INSERT INTO candidates (
    person_id, race_id, party, registration_status, source_name, source_url,
    is_public, external_id, candidacy_status, election_result,
    status_updated_at, created_at, updated_at
)
VALUES (
    'b05ef122-1db5-442a-a3f5-0636f334c7f8',
    '20c57ac1-7051-4014-97d9-5d07569b5a97',
    '民主進步黨',
    'unknown',
    '民主進步黨 2026 選舉官網－直轄市議員候選人',
    'https://teamtaiwan.dpp.org.tw/councilor?city=64000&district=%E7%AC%AC11%E9%81%B8%E5%8D%80',
    FALSE,
    'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf',
    'potential',
    'pending',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (external_id) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    race_id = EXCLUDED.race_id,
    party = EXCLUDED.party,
    registration_status = EXCLUDED.registration_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = FALSE,
    candidacy_status = EXCLUDED.candidacy_status,
    election_result = EXCLUDED.election_result,
    status_updated_at = NOW(),
    updated_at = NOW();

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    'b05ef122-1db5-442a-a3f5-0636f334c7f8',
    '48d83fe9-0cc3-4c49-8511-506813e80f83',
    'rejected',
    'A',
    'The source-scoped Kaohsiung identity and the established Taichung councilor are different people.',
    jsonb_build_object(
        'rule', 'user_reviewed_same_name_different_geography',
        'kaohsiungDistrict', '高雄市第11選區',
        'existingPersonRegion', '台中市',
        'reviewedDate', '2026-08-01'
    ),
    'user-reviewed:party-candidate-identity',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = 'b05ef122-1db5-442a-a3f5-0636f334c7f8'
      AND existing.canonical_person_id = '48d83fe9-0cc3-4c49-8511-506813e80f83'
      AND existing.status = 'rejected'
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = 'b05ef122-1db5-442a-a3f5-0636f334c7f8'
          AND name = '張耀中'
          AND district = '高雄市第11選區'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Private Kaohsiung 張耀中 person was not created';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_canonical_map
        WHERE person_id = 'b05ef122-1db5-442a-a3f5-0636f334c7f8'
          AND canonical_person_id <> 'b05ef122-1db5-442a-a3f5-0636f334c7f8'
    ) THEN
        RAISE EXCEPTION 'Kaohsiung 張耀中 was incorrectly merged into another person';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates
        WHERE external_id = 'party-candidate:dpp-2026-councilor-64000-11-243d4911c7bf'
          AND person_id = 'b05ef122-1db5-442a-a3f5-0636f334c7f8'
          AND candidacy_status = 'potential'
          AND registration_status = 'unknown'
          AND is_public = FALSE
    ) THEN
        RAISE EXCEPTION 'Private Kaohsiung 張耀中 candidacy was not created';
    END IF;
END
$$;

COMMIT;
