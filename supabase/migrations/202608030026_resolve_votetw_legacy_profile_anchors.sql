SET statement_timeout = 0;

-- Resolve legacy VoteTW profiles that lack a directly matching candidate row
-- but have been manually anchored through the same profile URL, birth date,
-- cross-year election history, or an official current-office biography.
-- Three profile URLs that mix distinct people remain review-only.
CREATE TEMP TABLE _votetw_legacy_profiles (
    person_name TEXT PRIMARY KEY,
    source_person_id UUID UNIQUE NOT NULL,
    target_person_id UUID UNIQUE NOT NULL,
    profile_key TEXT UNIQUE NOT NULL,
    source_url TEXT UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_legacy_profiles VALUES
    (
        '丁守中',
        '12c11d12-5224-4e37-8edc-66cb5867f632',
        '0316a348-2543-4792-8cd6-44951bea85fc',
        '丁守中:1954-09-01',
        'https://votetw.com/wiki/%E4%B8%81%E5%AE%88%E4%B8%AD'
    ),
    (
        '李慶元',
        '56ee5f44-8753-429e-a9c8-29b1bfae9a08',
        '56ee5f44-8753-429e-a9c8-29b1bfae9a08',
        '李慶元:1958-08-29',
        'https://votetw.com/wiki/%E6%9D%8E%E6%85%B6%E5%85%83'
    ),
    (
        '李柏融',
        '10ee3e02-300e-471a-af0a-1ac76d18e8d5',
        'd0f14ae2-bc5e-43a0-9438-7a55350e260d',
        '李柏融:1949-11-02',
        'https://votetw.com/wiki/%E6%9D%8E%E6%9F%8F%E8%9E%8D'
    ),
    (
        '林昊宜',
        'cac68ce5-7794-421c-8aaa-2aa49c45a7f0',
        '3958009f-dd9d-4404-b7ad-99101495bb40',
        '林昊宜:1982-03-22',
        'https://votetw.com/wiki/%E6%9E%97%E6%98%8A%E5%AE%9C'
    ),
    (
        '梁蓓禎',
        '1ad1a650-8270-476b-9a21-e44e93237571',
        '2b8f3323-53ff-4571-80e1-42ea26929020',
        '梁蓓禎:1980-07-27',
        'https://votetw.com/wiki/%E6%A2%81%E8%93%93%E7%A6%8E'
    ),
    (
        '潘懷宗',
        '04d59c7b-6645-443f-8fb5-cca569cda73e',
        '04d59c7b-6645-443f-8fb5-cca569cda73e',
        '潘懷宗:1961-07-02',
        'https://votetw.com/wiki/%E6%BD%98%E6%87%B7%E5%AE%97'
    ),
    (
        '羅美玲',
        '9830c592-827f-4ac9-9d52-e35f0578e067',
        '9830c592-827f-4ac9-9d52-e35f0578e067',
        '羅美玲:1969-05-01',
        'https://votetw.com/wiki/%E7%BE%85%E7%BE%8E%E7%8E%B2'
    ),
    (
        '陳永德',
        '25472ac2-4a0f-4066-b974-1379e7107bf7',
        '3e5ef61f-0ddc-43cf-9ddf-67ba308bb9fa',
        '陳永德:1965-08-14',
        'https://votetw.com/wiki/%E9%99%B3%E6%B0%B8%E5%BE%B7'
    ),
    (
        '高閔琳',
        '21770c00-5c66-4f0d-976e-9d10df538746',
        '49a93f84-65b9-426a-b449-736ac7c0e7f7',
        '高閔琳:1982-08-03',
        'https://votetw.com/wiki/%E9%AB%98%E9%96%94%E7%90%B3'
    );

CREATE TEMP TABLE _votetw_legacy_merges (
    canonical_person_id UUID NOT NULL,
    duplicate_person_id UUID PRIMARY KEY,
    person_name TEXT NOT NULL,
    reason TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_legacy_merges VALUES
    (
        '0316a348-2543-4792-8cd6-44951bea85fc',
        '12c11d12-5224-4e37-8edc-66cb5867f632',
        '丁守中',
        '2012、2016立委與2018臺北市長紀錄使用同一VoteTW人物頁，姓名、生日及黨籍一致。'
    ),
    (
        '56ee5f44-8753-429e-a9c8-29b1bfae9a08',
        'cedb0d1e-3603-4518-a965-926ebb7520c4',
        '李慶元',
        '2016立委與歷屆臺北市議員紀錄使用同一VoteTW人物頁，姓名與無黨籍參選脈絡一致。'
    ),
    (
        'd0f14ae2-bc5e-43a0-9438-7a55350e260d',
        '10ee3e02-300e-471a-af0a-1ac76d18e8d5',
        '李柏融',
        '2020立委與2018、2022議員紀錄使用同一VoteTW生日人物頁。'
    ),
    (
        'd0f14ae2-bc5e-43a0-9438-7a55350e260d',
        'ccfbbf1d-ed12-4d17-ba54-c874972428b3',
        '李柏融',
        '2016立委與2018至2024參選紀錄使用同一VoteTW生日人物頁。'
    ),
    (
        '3958009f-dd9d-4404-b7ad-99101495bb40',
        'cac68ce5-7794-421c-8aaa-2aa49c45a7f0',
        '林昊宜',
        '2016平地原住民立委、2018臺東平地原住民議員及2020不分區紀錄姓名與親民黨身分一致。'
    ),
    (
        '2b8f3323-53ff-4571-80e1-42ea26929020',
        '1ad1a650-8270-476b-9a21-e44e93237571',
        '梁蓓禎',
        '2016立委與2018高雄市議員紀錄使用同一VoteTW生日人物頁，政黨與地區脈絡一致。'
    ),
    (
        '04d59c7b-6645-443f-8fb5-cca569cda73e',
        '916c98d0-10a6-41a1-91fe-3e407d05da1e',
        '潘懷宗',
        '2016立委與歷屆臺北市議員紀錄使用同一VoteTW生日人物頁，姓名與新黨身分一致。'
    ),
    (
        '9830c592-827f-4ac9-9d52-e35f0578e067',
        'e8f0cdef-24d7-4080-b86c-d12792a0453e',
        '羅美玲',
        '2014、2018南投縣議員與第10、11屆立法委員官方履歷為同一人。'
    ),
    (
        '3e5ef61f-0ddc-43cf-9ddf-67ba308bb9fa',
        '25472ac2-4a0f-4066-b974-1379e7107bf7',
        '陳永德',
        '臺北市政府官方履歷載明第7至13屆市議員，與歷屆候選人紀錄連續一致。'
    ),
    (
        '49a93f84-65b9-426a-b449-736ac7c0e7f7',
        '21770c00-5c66-4f0d-976e-9d10df538746',
        '高閔琳',
        '高雄市政府現任首長資料與2014、2018高雄市議員紀錄為同一公共人物。'
    );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_legacy_profiles) <> 9
       OR (SELECT COUNT(*) FROM _votetw_legacy_merges) <> 10
       OR EXISTS (
           SELECT 1
           FROM _votetw_legacy_profiles profile
           LEFT JOIN people source ON source.id = profile.source_person_id
           LEFT JOIN people target ON target.id = profile.target_person_id
           WHERE source.id IS NULL
              OR target.id IS NULL
              OR source.name <> profile.person_name
              OR target.name <> profile.person_name
       ) THEN
        RAISE EXCEPTION 'VoteTW legacy profile boundary drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_legacy_profiles profile
        JOIN person_claims claim
          ON claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
    ) <> 37 THEN
        RAISE EXCEPTION 'VoteTW legacy profile claim boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_legacy_merges merge
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = merge.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> merge.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'VoteTW legacy profile has a conflicting merge decision';
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
    merge.duplicate_person_id,
    merge.canonical_person_id,
    'verified',
    'C',
    merge.reason,
    jsonb_build_object(
        'version', 'votetw-legacy-profile-anchor-v1',
        'matchedBy', 'reviewed cross-year profile and official biography context'
    ),
    'system:votetw-legacy-profile-anchor-v1',
    NOW(),
    NOW()
FROM _votetw_legacy_merges merge
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = merge.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_legacy_merges merge
        JOIN person_canonical_map canonical
          ON canonical.person_id = merge.duplicate_person_id
         AND canonical.canonical_person_id = merge.canonical_person_id
    ) <> 10 THEN
        RAISE EXCEPTION 'VoteTW legacy canonical map mismatch';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    person_id = profile.target_person_id,
    claim_json = claim.claim_json ||
        jsonb_build_object(
            'identityResolution',
            jsonb_build_object(
                'version', 'votetw-legacy-profile-anchor-v1',
                'originalPersonId', COALESCE(
                    NULLIF(
                        claim.claim_json->'identityResolution'->>
                            'originalPersonId',
                        ''
                    )::UUID,
                    claim.person_id
                ),
                'targetPersonId', profile.target_person_id,
                'sourceUrl', profile.source_url,
                'reason', 'reviewed cross-year profile and official biography context',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-legacy-profile-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-legacy-profile-anchor-v1',
                    'reason', 'VoteTW legacy profile relinked after manual identity review',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_legacy_profiles profile
WHERE claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND (
      claim.person_id <> profile.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-legacy-profile-anchor-v1'
  );

CREATE TEMP TABLE _votetw_legacy_claim_actions (
    person_name TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    action TEXT NOT NULL CHECK (
        action IN ('publish_c', 'archive_better_source', 'hold_legal')
    ),
    PRIMARY KEY (person_name, claim_type)
) ON COMMIT DROP;

INSERT INTO _votetw_legacy_claim_actions VALUES
    ('丁守中', 'birth_date', 'publish_c'),
    ('李慶元', 'birth_date', 'publish_c'),
    ('李柏融', 'party_affiliation', 'publish_c'),
    ('林昊宜', 'birth_date', 'publish_c'),
    ('林昊宜', 'education', 'publish_c'),
    ('林昊宜', 'experience', 'publish_c'),
    ('林昊宜', 'gender', 'archive_better_source'),
    ('林昊宜', 'party_affiliation', 'archive_better_source'),
    ('梁蓓禎', 'birth_date', 'publish_c'),
    ('潘懷宗', 'birth_date', 'publish_c'),
    ('潘懷宗', 'legal_case', 'hold_legal'),
    ('羅美玲', 'birth_date', 'publish_c'),
    ('羅美玲', 'education', 'archive_better_source'),
    ('羅美玲', 'experience', 'archive_better_source'),
    ('羅美玲', 'party_affiliation', 'archive_better_source'),
    ('陳永德', 'birth_date', 'publish_c'),
    ('高閔琳', 'birth_date', 'publish_c'),
    ('高閔琳', 'party_affiliation', 'archive_better_source');

CREATE TEMP TABLE _votetw_legacy_claim_decisions AS
SELECT
    claim.id AS claim_id,
    action.person_name,
    action.claim_type,
    action.action
FROM _votetw_legacy_profiles profile
JOIN _votetw_legacy_claim_actions action
  ON action.person_name = profile.person_name
JOIN person_claims claim
  ON claim.person_id = profile.target_person_id
 AND claim.source_name = 'VoteTW'
 AND claim.source_url = profile.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
 AND claim.claim_type = action.claim_type;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_legacy_claim_decisions) <> 18
       OR (
           SELECT COUNT(*)
           FROM _votetw_legacy_claim_decisions
           WHERE action = 'publish_c'
       ) <> 11
       OR (
           SELECT COUNT(*)
           FROM _votetw_legacy_claim_decisions
           WHERE action = 'archive_better_source'
       ) <> 6
       OR (
           SELECT COUNT(*)
           FROM _votetw_legacy_claim_decisions
           WHERE action = 'hold_legal'
       ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW legacy claim decision boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_legacy_claim_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'hold_legal'
          AND (
              claim.claim_type <> 'legal_case'
              OR claim.review_status <> 'needs_more_evidence'
              OR claim.visibility <> 'review_only'
              OR claim.is_public <> FALSE
          )
    ) THEN
        RAISE EXCEPTION 'VoteTW legacy legal claim boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_legacy_claim_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        JOIN person_canonical_map canonical
          ON canonical.person_id = claim.person_id
        WHERE decision.action = 'archive_better_source'
          AND NOT EXISTS (
              SELECT 1
              FROM person_claims better
              JOIN person_canonical_map better_canonical
                ON better_canonical.person_id = better.person_id
              WHERE better_canonical.canonical_person_id =
                    canonical.canonical_person_id
                AND better.source_name NOT LIKE 'VoteTW%'
                AND better.review_status = 'verified'
                AND better.is_public = TRUE
                AND better.claim_type = CASE
                    WHEN claim.claim_type = 'party_affiliation'
                        THEN 'party'
                    ELSE claim.claim_type
                END
          )
    ) THEN
        RAISE EXCEPTION 'VoteTW legacy archive lacks a better public source';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-legacy-profile-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-legacy-profile-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-legacy-profile-claim-rereview-v1',
                    'reason', 'Published after reviewed legacy profile identity anchor',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_legacy_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-legacy-profile-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-legacy-profile-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-legacy-profile-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-legacy-profile-claim-rereview-v1',
                    'reason', 'Archived because a stronger public source covers this field',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_legacy_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'archive_better_source'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-legacy-profile-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    scoring_version = 'votetw-legacy-profile-legal-hold-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-legacy-profile-legal-hold-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-legacy-profile-legal-hold-v1',
                    'reason', 'Legal claim remains review-only after identity resolution',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_legacy_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_legal'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-legacy-profile-legal-hold-v1';

CREATE TEMP TABLE _votetw_collision_holds (
    person_name TEXT PRIMARY KEY,
    person_id UUID UNIQUE NOT NULL,
    profile_key TEXT UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_collision_holds VALUES
    (
        '徐欽鴻',
        '162edc6b-7875-4b6e-ae2d-b808866bfbcb',
        '徐欽鴻:1956-06-06'
    ),
    (
        '李茂榮',
        '2b3bbfc6-ebc5-48f0-b8ba-a5122c9e4aa9',
        '李茂榮:1961-02-28'
    ),
    (
        '林國正',
        'f8618d19-35b2-4101-8bec-e97898d4e6e1',
        '林國正:1966-11-26'
    );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_collision_holds collision
        JOIN person_claims claim
          ON claim.person_id = collision.person_id
         AND claim.source_name = 'VoteTW'
         AND claim.review_status = 'needs_more_evidence'
         AND claim.visibility = 'review_only'
         AND claim.is_public = FALSE
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             collision.profile_key
    ) <> 6 THEN
        RAISE EXCEPTION 'VoteTW collision hold boundary drifted';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    scoring_version = 'votetw-profile-url-collision-hold-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-profile-url-collision-hold-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-profile-url-collision-hold-v1',
                    'reason', 'VoteTW URL is shared by distinct same-name people in incompatible election contexts',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_collision_holds collision
WHERE claim.person_id = collision.person_id
  AND claim.source_name = 'VoteTW'
  AND claim.review_status = 'needs_more_evidence'
  AND claim.visibility = 'review_only'
  AND claim.is_public = FALSE
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      collision.profile_key
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-profile-url-collision-hold-v1';

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_legacy_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-legacy-profile-anchor-v1'
    ) <> 37 THEN
        RAISE EXCEPTION 'VoteTW legacy profile relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_legacy_claim_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'publish_c'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-legacy-profile-claim-rereview-v1'
    ) <> 11 THEN
        RAISE EXCEPTION 'VoteTW legacy published claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_legacy_claim_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'archive_better_source'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-legacy-profile-claim-rereview-v1'
    ) <> 6 THEN
        RAISE EXCEPTION 'VoteTW legacy archived claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_collision_holds collision
        JOIN person_claims claim
          ON claim.person_id = collision.person_id
         AND claim.source_name = 'VoteTW'
         AND claim.review_status = 'needs_more_evidence'
         AND claim.visibility = 'review_only'
         AND claim.is_public = FALSE
         AND claim.scoring_version =
             'votetw-profile-url-collision-hold-v1'
    ) <> 6 THEN
        RAISE EXCEPTION 'VoteTW collision hold state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);
