SET statement_timeout = 0;

-- Resolve the final three VoteTW claims whose pages have no birth date or
-- election-record payload. Two genders are redundant with canonical public
-- election data. Yang Li-huan's historical KMT affiliation is retained at C,
-- while her split 2016 and 2018 candidate identities are merged at C using the
-- exact shared VoteTW profile URL and non-conflicting election history.
CREATE TEMP TABLE _votetw_unique_page_profiles (
    owner_person_id UUID PRIMARY KEY,
    target_person_id UUID NOT NULL,
    name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    expected_claim_type TEXT NOT NULL,
    expected_claim_value TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('archive', 'publish_c'))
);

INSERT INTO _votetw_unique_page_profiles VALUES
    (
        '51787107-e7f2-47b6-bf84-23bb15b7aeea',
        'd1e4b52b-af34-4061-8338-138fd253ec41',
        '劉冠吟',
        'https://votetw.com/wiki/%E5%8A%89%E5%86%A0%E5%90%9F',
        '劉冠吟:no-birth-0',
        'gender',
        'female',
        'archive'
    ),
    (
        'c68c4602-f91b-4a1b-b7eb-c55221d08275',
        'c68c4602-f91b-4a1b-b7eb-c55221d08275',
        '李金龍',
        'https://votetw.com/wiki/%E6%9D%8E%E9%87%91%E9%BE%8D',
        '李金龍:no-birth-0',
        'gender',
        'male',
        'archive'
    ),
    (
        '4311ed28-3b78-4cc8-9d56-5d07d761440f',
        '4311ed28-3b78-4cc8-9d56-5d07d761440f',
        '楊麗環',
        'https://votetw.com/wiki/%E6%A5%8A%E9%BA%97%E7%92%B0',
        '楊麗環:no-birth-0',
        'party_affiliation',
        '曾任中國國民黨',
        'publish_c'
    );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_unique_page_profiles) <> 3 THEN
        RAISE EXCEPTION 'VoteTW unique-page profile count drifted from 3';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_page_profiles profile
        JOIN people owner
          ON owner.id = profile.owner_person_id
         AND owner.name = profile.name
        JOIN public_people target
          ON target.person_id = profile.target_person_id
         AND target.name = profile.name
        JOIN person_claims claim
          ON claim.person_id IN (
              profile.owner_person_id,
              profile.target_person_id
          )
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityMatch'->>'matchedBy' =
             'unique_page_profile'
         AND claim.claim_type = profile.expected_claim_type
         AND claim.claim_value = profile.expected_claim_value
    ) <> 3 THEN
        RAISE EXCEPTION 'VoteTW unique-page pending claim anchor drifted from 3';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_unique_page_profiles profile
        JOIN public_people target
          ON target.person_id = profile.target_person_id
        WHERE profile.action = 'archive'
          AND LOWER(TRIM(target.gender)) <>
              LOWER(TRIM(profile.expected_claim_value))
    ) THEN
        RAISE EXCEPTION 'VoteTW unique-page canonical gender drifted';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM people target
        JOIN candidates candidate ON candidate.person_id = target.id
        JOIN races race ON race.id = candidate.race_id
        JOIN elections election ON election.id = race.election_id
        WHERE target.id = 'd1e4b52b-af34-4061-8338-138fd253ec41'::UUID
          AND target.source_url =
              'https://votetw.com/wiki/%E5%8A%89%E5%86%A0%E5%90%9F'
          AND candidate.source_name = 'VoteTW historical election results'
          AND candidate.is_public = TRUE
          AND election.year = 2018
          AND race.title LIKE '%新竹縣新埔鎮內立里%'
    ) THEN
        RAISE EXCEPTION 'Liu Kuan-yin VoteTW candidate anchor drifted';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN elections election ON election.id = race.election_id
        JOIN person_canonical_map canonical
          ON canonical.person_id = candidate.person_id
        WHERE canonical.canonical_person_id =
              '4311ed28-3b78-4cc8-9d56-5d07d761440f'::UUID
          AND candidate.source_name LIKE '中央選舉委員會%'
          AND candidate.party = '中國國民黨'
          AND election.year IN (1998, 2012)
    ) THEN
        RAISE EXCEPTION 'Yang Li-huan official KMT history drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_merge_decisions existing
        WHERE existing.duplicate_person_id =
              'f87ac730-05e1-4ada-9225-f42571af8e09'::UUID
          AND existing.status IN ('suggested', 'verified')
          AND existing.canonical_person_id <>
              '4311ed28-3b78-4cc8-9d56-5d07d761440f'::UUID
    ) THEN
        RAISE EXCEPTION 'Yang Li-huan gained a conflicting merge decision';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM people earlier
        JOIN candidates earlier_candidate
          ON earlier_candidate.person_id = earlier.id
        JOIN races earlier_race ON earlier_race.id = earlier_candidate.race_id
        JOIN elections earlier_election
          ON earlier_election.id = earlier_race.election_id
        JOIN people later
          ON later.id = 'f87ac730-05e1-4ada-9225-f42571af8e09'::UUID
         AND later.name = earlier.name
         AND later.source_url = earlier.source_url
        JOIN candidates later_candidate
          ON later_candidate.person_id = later.id
        JOIN races later_race ON later_race.id = later_candidate.race_id
        JOIN elections later_election
          ON later_election.id = later_race.election_id
        WHERE earlier.id = '05c23a41-7103-42fb-8e54-a859d22f89fb'::UUID
          AND earlier.source_url =
              'https://votetw.com/wiki/%E6%A5%8A%E9%BA%97%E7%92%B0'
          AND earlier_candidate.party = '中國國民黨'
          AND earlier_election.year = 2016
          AND earlier_race.title LIKE '%桃園市第4選舉區%'
          AND later_candidate.party = '無黨籍'
          AND later_election.year = 2018
          AND later_race.title LIKE '%桃園市%'
    ) THEN
        RAISE EXCEPTION 'Yang Li-huan cross-year VoteTW evidence drifted';
    END IF;
END;
$$;

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
    'f87ac730-05e1-4ada-9225-f42571af8e09'::UUID,
    '4311ed28-3b78-4cc8-9d56-5d07d761440f'::UUID,
    'verified',
    'C',
    '楊麗環：同一 VoteTW 人物頁中的 2016 國民黨立委與 2018 無黨籍市長參選紀錄為同一跨年人物。',
    jsonb_build_object(
        'version', 'votetw-unique-page-source-anchor-v1',
        'sourceUrl',
            'https://votetw.com/wiki/%E6%A5%8A%E9%BA%97%E7%92%B0',
        'earlierElection', '2016年立法委員選舉桃園市第4選舉區',
        'laterElection', '2018年桃園市市長選舉'
    ),
    'system:votetw-unique-page-source-anchor-v1',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id =
          'f87ac730-05e1-4ada-9225-f42571af8e09'::UUID
      AND existing.status IN ('suggested', 'verified')
);

UPDATE person_claims claim
SET
    person_id = profile.target_person_id,
    claim_json = claim.claim_json ||
        jsonb_build_object(
            'identityResolution',
            jsonb_build_object(
                'version', 'votetw-unique-page-source-anchor-v1',
                'originalPersonId', profile.owner_person_id,
                'targetPersonId', profile.target_person_id,
                'sourceUrl', profile.source_url,
                'reason', 'unique VoteTW page resolved by canonical candidate or canonical public value',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-unique-page-source-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-unique-page-source-anchor-v1',
                    'reason', 'VoteTW claim resolved through a canonical candidate or canonical public value',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_unique_page_profiles profile
WHERE claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND claim.person_id IN (
      profile.owner_person_id,
      profile.target_person_id
  )
  AND (
      claim.person_id <> profile.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-unique-page-source-anchor-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-unique-page-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version = 'votetw-unique-page-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-unique-page-claim-rereview-v1',
                    'reason', 'VoteTW gender retained as private audit history because the canonical public gender is identical',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_unique_page_profiles profile
WHERE profile.action = 'archive'
  AND claim.person_id = profile.target_person_id
  AND claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND claim.claim_type = profile.expected_claim_type
  AND claim.claim_value = profile.expected_claim_value
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-unique-page-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-unique-page-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version = 'votetw-unique-page-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-unique-page-claim-rereview-v1',
                    'reason', 'historical KMT affiliation is consistent with official earlier election history',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_unique_page_profiles profile
WHERE profile.action = 'publish_c'
  AND claim.person_id = profile.target_person_id
  AND claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND claim.claim_type = profile.expected_claim_type
  AND claim.claim_value = profile.expected_claim_value
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-unique-page-claim-rereview-v1'
  );

DO $$
BEGIN
    IF (
        SELECT canonical_person_id
        FROM person_canonical_map
        WHERE person_id = 'f87ac730-05e1-4ada-9225-f42571af8e09'::UUID
    ) <> '4311ed28-3b78-4cc8-9d56-5d07d761440f'::UUID THEN
        RAISE EXCEPTION 'Yang Li-huan canonical state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_page_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-unique-page-source-anchor-v1'
    ) <> 6 THEN
        RAISE EXCEPTION 'VoteTW unique-page relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_unique_page_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_type = profile.expected_claim_type
         AND claim.claim_value = profile.expected_claim_value
        WHERE (
            profile.action = 'archive'
            AND claim.review_status = 'archived'
            AND claim.visibility = 'private'
            AND claim.is_public = FALSE
        ) OR (
            profile.action = 'publish_c'
            AND claim.review_status = 'verified'
            AND claim.visibility = 'public'
            AND claim.is_public = TRUE
            AND claim.confidence_level = 'C'
        )
    ) <> 3 THEN
        RAISE EXCEPTION 'VoteTW unique-page claim state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_unique_page_profiles;

RESET statement_timeout;
