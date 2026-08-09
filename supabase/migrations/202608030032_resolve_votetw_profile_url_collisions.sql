SET statement_timeout = 0;

-- The VoteTW name pages mixed same-name candidates. Archive all six claims
-- from the polluted page context, then add only the four facts independently
-- confirmed by CEC bulletins to their correct canonical people. Gender is not
-- reinserted for Hsu or Lin because equivalent public CEC claims already exist.
CREATE TEMP TABLE _votetw_collision_targets (
    claim_id UUID PRIMARY KEY,
    stored_person_id UUID NOT NULL,
    person_name TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    claim_value TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_collision_targets VALUES
    (
        '6eae0529-697c-4db5-9bfb-5343e3f803c7',
        '162edc6b-7875-4b6e-ae2d-b808866bfbcb',
        '徐欽鴻', 'birth_date', '1956-06-06'
    ),
    (
        '03235cbe-7b7a-428f-89d9-e9cc5e2bfa9b',
        '162edc6b-7875-4b6e-ae2d-b808866bfbcb',
        '徐欽鴻', 'gender', 'male'
    ),
    (
        '77b04e88-cf29-4477-932f-277843ddd324',
        '2b3bbfc6-ebc5-48f0-b8ba-a5122c9e4aa9',
        '李茂榮', 'birth_date', '1961-02-28'
    ),
    (
        'e8c458a7-513c-4df6-8f5d-525749c0f626',
        'f8618d19-35b2-4101-8bec-e97898d4e6e1',
        '林國正', 'birth_date', '1966-11-26'
    ),
    (
        '758afa89-26f2-483a-b5e8-e35eff94e33b',
        'f8618d19-35b2-4101-8bec-e97898d4e6e1',
        '林國正', 'gender', 'male'
    ),
    (
        'f0f41a4d-4bf6-4c46-940d-a9eacb8658cb',
        'f8618d19-35b2-4101-8bec-e97898d4e6e1',
        '林國正', 'party_affiliation', '中國國民黨'
    );

CREATE TEMP TABLE _cec_collision_replacements (
    claim_key TEXT PRIMARY KEY,
    person_id UUID NOT NULL,
    person_name TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    claim_value TEXT NOT NULL,
    source_url TEXT NOT NULL,
    original_claim_id UUID UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO _cec_collision_replacements VALUES
    (
        'official-cec-bulletin:xu-qin-hong:2014-result:birth-date',
        'a65adf37-81db-4218-9b59-1b93077dbb5f',
        '徐欽鴻', 'birth_date', '1956-06-06',
        'https://web.cec.gov.tw/api/file/f73cd05b-dda9-4032-bdd7-f4172e3be4f5.pdf',
        '6eae0529-697c-4db5-9bfb-5343e3f803c7'
    ),
    (
        'official-cec-bulletin:li-mao-rong:2018-taipei-03:birth-date',
        '2b3bbfc6-ebc5-48f0-b8ba-a5122c9e4aa9',
        '李茂榮', 'birth_date', '1961-02-28',
        'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/05%E7%9B%B4%E8%BD%84%E5%B8%82%E8%AD%B0%E5%93%A1/107%E5%B9%B4/01%E8%87%BA%E5%8C%97%E5%B8%82/%E8%87%BA%E5%8C%97%E5%B8%82%E7%AC%AC03%E9%81%B8%E8%88%89%E5%8D%80.pdf',
        '77b04e88-cf29-4477-932f-277843ddd324'
    ),
    (
        'official-cec-bulletin:lin-kuo-cheng:2016-kaohsiung-09:birth-date',
        'f49f504d-a0a4-4a10-afd6-db02f502baab',
        '林國正', 'birth_date', '1966-11-26',
        'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/105%E5%B9%B4%E7%AC%AC9%E5%B1%86/01%E5%8D%80%E5%9F%9F/06%E9%AB%98%E9%9B%84%E5%B8%82/%E9%AB%98%E9%9B%84%E5%B8%82%E7%AB%8B%E5%A7%94%E9%81%B8%E8%88%89%E7%AC%AC9%E9%81%B8%E8%88%89%E5%8D%80.pdf',
        'e8c458a7-513c-4df6-8f5d-525749c0f626'
    ),
    (
        'official-cec-bulletin:lin-kuo-cheng:2016-kaohsiung-09:party',
        'f49f504d-a0a4-4a10-afd6-db02f502baab',
        '林國正', 'party_affiliation', '中國國民黨',
        'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/02%E7%AB%8B%E6%B3%95%E5%A7%94%E5%93%A1/105%E5%B9%B4%E7%AC%AC9%E5%B1%86/01%E5%8D%80%E5%9F%9F/06%E9%AB%98%E9%9B%84%E5%B8%82/%E9%AB%98%E9%9B%84%E5%B8%82%E7%AB%8B%E5%A7%94%E9%81%B8%E8%88%89%E7%AC%AC9%E9%81%B8%E8%88%89%E5%8D%80.pdf',
        'f0f41a4d-4bf6-4c46-940d-a9eacb8658cb'
    );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_collision_targets) <> 6
       OR (SELECT COUNT(*) FROM _cec_collision_replacements) <> 4
       OR EXISTS (
           SELECT 1
           FROM _votetw_collision_targets target
           LEFT JOIN people person ON person.id = target.stored_person_id
           LEFT JOIN person_claims claim ON claim.id = target.claim_id
           WHERE person.id IS NULL
              OR person.name <> target.person_name
              OR claim.id IS NULL
              OR claim.person_id <> target.stored_person_id
              OR claim.claim_type <> target.claim_type
              OR claim.claim_value <> target.claim_value
              OR claim.source_name <> 'VoteTW'
              OR claim.review_status NOT IN (
                  'needs_more_evidence', 'archived'
              )
              OR claim.scoring_version NOT IN (
                  'votetw-profile-url-collision-hold-v1',
                  'votetw-profile-url-collision-archive-v1'
              )
       )
       OR EXISTS (
           SELECT 1
           FROM _cec_collision_replacements replacement
           LEFT JOIN people person ON person.id = replacement.person_id
           LEFT JOIN person_canonical_map canonical
             ON canonical.person_id = person.id
            AND canonical.canonical_person_id = person.id
           WHERE person.id IS NULL
              OR canonical.person_id IS NULL
              OR person.name <> replacement.person_name
              OR person.is_public <> TRUE
       )
       OR EXISTS (
           SELECT 1
           FROM person_claims existing
           JOIN _cec_collision_replacements replacement USING (claim_key)
           WHERE existing.person_id <> replacement.person_id
              OR existing.claim_type <> replacement.claim_type
       ) THEN
        RAISE EXCEPTION 'VoteTW profile collision boundary drifted';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-profile-url-collision-archive-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-profile-url-collision-archive-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-profile-url-collision-archive-v1',
                    'reason', 'Archived claim from a name page that mixed same-name candidate identities',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_collision_targets target
WHERE claim.id = target.claim_id
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-profile-url-collision-archive-v1'
  );

INSERT INTO person_claims (
    claim_key,
    person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_score,
    review_status,
    visibility,
    source_name,
    source_url,
    observed_at,
    is_public,
    scoring_version,
    scoring_reasons,
    auto_reviewed_at,
    updated_at
)
SELECT
    replacement.claim_key,
    replacement.person_id,
    replacement.claim_type,
    replacement.claim_value,
    jsonb_build_object(
        'sourceId', 'official-cec-election-bulletin',
        'originalVoteTwClaimId', replacement.original_claim_id,
        'identityResolution', jsonb_build_object(
            'version', 'votetw-profile-url-collision-resolution-v1',
            'matchedBy', 'official_cec_name_birth_date_and_election_context',
            'sameNameCandidatesKeptSeparate', TRUE
        ),
        'verificationPolicy', jsonb_build_object(
            'status', 'verified_from_official_source',
            'version', 'votetw-profile-url-collision-resolution-v1'
        )
    ),
    'A',
    100,
    'verified',
    'public',
    '中央選舉委員會選舉公報',
    replacement.source_url,
    NOW(),
    TRUE,
    'votetw-profile-url-collision-resolution-v1',
    jsonb_build_array(
        jsonb_build_object(
            'version', 'votetw-profile-url-collision-resolution-v1',
            'reason', 'Official CEC bulletin confirms the fact and the correct same-name candidate identity',
            'reviewedAt', NOW()
        )
    ),
    NOW(),
    NOW()
FROM _cec_collision_replacements replacement
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    claim_type = EXCLUDED.claim_type,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_score = EXCLUDED.review_score,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = EXCLUDED.updated_at
WHERE person_claims.person_id IS DISTINCT FROM EXCLUDED.person_id
   OR person_claims.claim_type IS DISTINCT FROM EXCLUDED.claim_type
   OR person_claims.claim_value IS DISTINCT FROM EXCLUDED.claim_value
   OR person_claims.claim_json IS DISTINCT FROM EXCLUDED.claim_json
   OR person_claims.confidence_level IS DISTINCT FROM EXCLUDED.confidence_level
   OR person_claims.review_score IS DISTINCT FROM EXCLUDED.review_score
   OR person_claims.review_status IS DISTINCT FROM EXCLUDED.review_status
   OR person_claims.visibility IS DISTINCT FROM EXCLUDED.visibility
   OR person_claims.source_name IS DISTINCT FROM EXCLUDED.source_name
   OR person_claims.source_url IS DISTINCT FROM EXCLUDED.source_url
   OR person_claims.is_public IS DISTINCT FROM EXCLUDED.is_public
   OR person_claims.scoring_version IS DISTINCT FROM EXCLUDED.scoring_version;

SELECT published.promote(NULL);

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_collision_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-profile-url-collision-archive-v1'
    ) <> 6
       OR (
           SELECT COUNT(*)
           FROM _cec_collision_replacements replacement
           JOIN person_claims claim USING (claim_key)
           JOIN public_person_claims public_claim
             ON public_claim.claim_id = claim.id
           WHERE claim.person_id = replacement.person_id
             AND claim.claim_type = replacement.claim_type
             AND claim.claim_value = replacement.claim_value
             AND claim.confidence_level = 'A'
             AND claim.review_status = 'verified'
             AND claim.visibility = 'public'
             AND claim.is_public = TRUE
       ) <> 4 THEN
        RAISE EXCEPTION 'VoteTW profile collision state mismatch';
    END IF;
END;
$$;
