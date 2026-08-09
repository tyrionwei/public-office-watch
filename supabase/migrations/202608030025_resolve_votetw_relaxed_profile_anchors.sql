SET statement_timeout = 0;

-- Resolve the remaining VoteTW birth-dated profiles whose election strings use
-- a different but compatible race label. Every accepted record must still
-- match the same profile URL, normalized name, year, party, office type and
-- geographic or indigenous context. Cross-year duplicates are merged at C.
CREATE FUNCTION pg_temp._votetw_relaxed_norm_name(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN REPLACE(
    REPLACE(
        REGEXP_REPLACE(COALESCE(value, ''), E'[\\s·．・‧]+', '', 'g'),
        '臺',
        '台'
    ),
    '黄',
    '黃'
);

CREATE FUNCTION pg_temp._votetw_relaxed_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN pg_temp._votetw_relaxed_norm_name(value) IN (
        '無', '無黨', '無黨派', '無黨籍'
    ) THEN '無黨籍'
    WHEN pg_temp._votetw_relaxed_norm_name(value) IN (
        '台灣基進', '基進黨'
    ) THEN '台灣基進'
    WHEN pg_temp._votetw_relaxed_norm_name(value) IN (
        '台灣綠黨', '綠黨'
    ) THEN '綠黨'
    ELSE REGEXP_REPLACE(
        pg_temp._votetw_relaxed_norm_name(value),
        '黨黨$',
        '黨'
    )
END;

CREATE TEMP TABLE _votetw_relaxed_targets (
    person_name TEXT PRIMARY KEY,
    target_person_id UUID UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_relaxed_targets VALUES
    ('張渝江', 'ebf1ebc6-c4aa-403e-9779-b7484727bc6d'),
    ('曾楷耀', '62c60edb-d0c0-479e-bef9-b36937166b29'),
    ('李伯利', '43af2005-12a5-4572-8ef8-3779bd5dc8c5'),
    ('李克焜', 'f770b2b8-abe5-4100-b4da-10b2cd8c0211'),
    ('李婉鈺', 'd84635b6-18e4-498b-9641-716bbb82eb97'),
    ('李建輝', '8b27c13f-30ce-4400-9aff-5cd3f4f2f3dc'),
    ('李應文', '201b58fb-70d7-4b6f-8306-935e8475fa15'),
    ('李晉豪', 'fa8dc3b6-f3f4-47dd-803b-755218112944'),
    ('李驥羣', '336547c5-5454-47a8-a098-bb1011c3ce71'),
    ('林佳瑜', '993048b3-9f69-4581-ab9e-143282689c32'),
    ('林志錦', '7bb88aa9-9e1e-4cc7-abd4-b6a784576408'),
    ('林獻山', '362f2d05-fbfb-4b25-9f6d-79b041cdea58'),
    ('林耕仁', 'a5094c86-589d-485e-8a7a-af6653af8e18'),
    ('楊石城', '866df00f-fcb1-43b6-a959-fe21f6b0b295'),
    ('洪志恒', '4a5e285d-aa75-48ad-acb0-8855c3bea41e'),
    ('洪正', 'ee569598-6c7c-44fd-aa74-16ba51330d92'),
    ('王郁揚', 'bb92dd56-c8b8-4f7d-af64-ebd049a73e7f'),
    ('王長明', '1bf5c79e-7f9d-4f86-8d9d-868f7c5e29ad'),
    ('翁語含', '1d9098a2-876b-4a07-98af-f3e6e0aaeccf'),
    ('范振揆', '3786cb7a-f037-4d06-b6e5-832dd7c650d5'),
    ('葉竹林', 'ae94da9d-49e4-4083-b351-baf869454337'),
    ('蔡媽福', 'a4173264-754d-49b6-92a3-c049647045ca'),
    ('蔡適應', '0f2c99c3-a700-4381-a823-2e888a5734e6'),
    ('蕭蒼澤', 'be1c1aa5-be33-4377-8338-13a79b79681a'),
    ('蘇博廷', '8843ac76-11b9-4161-8dad-a376c9169667'),
    ('達佶祐．卡造Takiyo．Kacaw', 'b5452486-4fed-43dc-91df-6b330856bc1d'),
    ('鄭寶清', '603e7aa0-a881-449d-b4af-82ca8b0baf67'),
    ('陳允萍', '2d2b03da-845e-4359-a4ed-fc0c9ebcbe71'),
    ('陳滄江', '55e04902-890e-4cf9-a3df-e62d78dd649d'),
    ('陳秋境', '2dde68ef-8ce2-47f6-aefa-e0338f8c9712'),
    ('陳薇仲', '397feb05-ea87-4942-a115-dae1e9426b4f'),
    ('黃源甫', 'b8246c24-203d-44e3-ba8a-7d464e393edd'),
    ('黄師鵬', '8ab5747d-ccc8-4ddc-86bd-fa531be5f984'),
    ('龔偉綸', 'd8f6aaaf-6ee9-4bb3-985c-01690465dfc5');

CREATE TEMP TABLE _votetw_relaxed_merges (
    canonical_person_id UUID NOT NULL,
    duplicate_person_id UUID PRIMARY KEY,
    person_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_relaxed_merges VALUES
    ('ebf1ebc6-c4aa-403e-9779-b7484727bc6d', '6fa3d05e-b3d1-4bb2-91fc-45a93a95153b', '張渝江'),
    ('43af2005-12a5-4572-8ef8-3779bd5dc8c5', '8beb3a99-c8c2-43a2-9aba-66220f6d605b', '李伯利'),
    ('f770b2b8-abe5-4100-b4da-10b2cd8c0211', '1499a40a-5373-4a0c-97f8-5d6138f499aa', '李克焜'),
    ('d84635b6-18e4-498b-9641-716bbb82eb97', '95a900f5-19bc-4c23-bbab-1ce825006233', '李婉鈺'),
    ('8b27c13f-30ce-4400-9aff-5cd3f4f2f3dc', 'd7abbb56-d0f2-4ed2-9461-69d198d2fbd7', '李建輝'),
    ('fa8dc3b6-f3f4-47dd-803b-755218112944', '48e3d2e8-5308-4d5f-be41-8ab6399b980d', '李晉豪'),
    ('993048b3-9f69-4581-ab9e-143282689c32', '56017305-18be-435f-b9d5-5c55479a2c0b', '林佳瑜'),
    ('7bb88aa9-9e1e-4cc7-abd4-b6a784576408', '1760a6e6-41ec-4019-a473-2d5f945178a3', '林志錦'),
    ('866df00f-fcb1-43b6-a959-fe21f6b0b295', '624e0e59-aad1-4772-bbcc-c1788588dc65', '楊石城'),
    ('4a5e285d-aa75-48ad-acb0-8855c3bea41e', '27a9a6d8-25bd-482e-97f5-df65ca81e4a0', '洪志恒'),
    ('4a5e285d-aa75-48ad-acb0-8855c3bea41e', 'dd353cc4-1717-4486-9aed-41ae95d6c9be', '洪志恒'),
    ('ee569598-6c7c-44fd-aa74-16ba51330d92', '6658904b-7ee9-46ea-8336-15bc7abc8a95', '洪正'),
    ('bb92dd56-c8b8-4f7d-af64-ebd049a73e7f', 'f890704c-502e-402e-a09e-f86443f60efd', '王郁揚'),
    ('1d9098a2-876b-4a07-98af-f3e6e0aaeccf', '41579a8e-cfc2-4dca-bbd9-113385c56e59', '翁語含'),
    ('a4173264-754d-49b6-92a3-c049647045ca', '40526d13-bf93-46fa-9aab-38832e1d8027', '蔡媽福'),
    ('0f2c99c3-a700-4381-a823-2e888a5734e6', '244928a9-66fc-4c2f-b4a7-01a530cbefa3', '蔡適應'),
    ('be1c1aa5-be33-4377-8338-13a79b79681a', '9e0ac6fa-a413-4424-a7d9-5c9fb91c6c7f', '蕭蒼澤'),
    ('8843ac76-11b9-4161-8dad-a376c9169667', 'f3156330-794e-4ed7-bc5f-f7e20143cc7e', '蘇博廷'),
    ('b5452486-4fed-43dc-91df-6b330856bc1d', '13a9ebef-1221-4b57-8301-860c2ff0376f', '達佶祐．卡造Takiyo．Kacaw'),
    ('603e7aa0-a881-449d-b4af-82ca8b0baf67', 'a6dacc2f-35d3-411e-9812-083681eb9b7f', '鄭寶清'),
    ('2d2b03da-845e-4359-a4ed-fc0c9ebcbe71', '9450ae10-fac0-4e93-b9a7-b2c99cadf2cf', '陳允萍'),
    ('2dde68ef-8ce2-47f6-aefa-e0338f8c9712', '0b3632c4-e9af-4c2d-8525-18317049e534', '陳秋境'),
    ('b8246c24-203d-44e3-ba8a-7d464e393edd', '2b0e803e-6fed-4237-a0d7-22d7e9e420ef', '黃源甫');

CREATE TEMP TABLE _votetw_relaxed_profiles AS
SELECT
    target.person_name,
    target.target_person_id,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key,
    claim.claim_json->'identityMatch'->>'sourceBirthDate' AS source_birth_date
FROM _votetw_relaxed_targets target
JOIN person_claims claim
  ON claim.source_name = 'VoteTW'
 AND claim.claim_json->'identityMatch'->>'matchedBy' =
     'unique_page_profile_with_birth_date'
 AND pg_temp._votetw_relaxed_norm_name(
         claim.claim_json->>'personName'
     ) = pg_temp._votetw_relaxed_norm_name(target.person_name)
 AND (
     (
         claim.review_status = 'needs_more_evidence'
         AND claim.visibility = 'review_only'
         AND claim.is_public = FALSE
     )
     OR claim.claim_json->'identityResolution'->>'version' =
         'votetw-relaxed-profile-election-anchor-v1'
 )
GROUP BY
    target.person_name,
    target.target_person_id,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey',
    claim.claim_json->'identityMatch'->>'sourceBirthDate';

CREATE TEMP TABLE _votetw_relaxed_records AS
SELECT DISTINCT
    profile.source_url,
    profile.profile_key,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party,
    SUBSTRING(record.value->>'election' FROM 1 FOR 4)::INT AS election_year
FROM _votetw_relaxed_profiles profile
JOIN person_claims external
  ON external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = profile.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
) record
WHERE SUBSTRING(record.value->>'election' FROM 1 FOR 4) ~ '^[0-9]{4}$';

CREATE TEMP TABLE _votetw_relaxed_candidate_anchors AS
SELECT DISTINCT
    record.source_url,
    record.profile_key,
    record.source_election,
    record.source_party,
    record.election_year,
    candidate_person.id AS anchor_person_id,
    canonical.canonical_person_id AS anchor_canonical_person_id
FROM _votetw_relaxed_profiles profile
JOIN _votetw_relaxed_records record
  ON record.source_url = profile.source_url
 AND record.profile_key = profile.profile_key
JOIN people candidate_person
  ON candidate_person.source_url = profile.source_url
 AND pg_temp._votetw_relaxed_norm_name(candidate_person.name) =
     pg_temp._votetw_relaxed_norm_name(profile.person_name)
JOIN person_canonical_map canonical ON canonical.person_id = candidate_person.id
JOIN candidates candidate
  ON candidate.person_id = candidate_person.id
 AND candidate.is_public = TRUE
 AND candidate.source_name = 'VoteTW historical election results'
 AND pg_temp._votetw_relaxed_norm_party(candidate.party) =
     pg_temp._votetw_relaxed_norm_party(record.source_party)
JOIN races race ON race.id = candidate.race_id AND race.is_public = TRUE
JOIN elections election
  ON election.id = race.election_id
 AND election.is_public = TRUE
 AND election.year = record.election_year;

CREATE TEMP TABLE _votetw_relaxed_record_anchors AS
SELECT DISTINCT
    anchor.source_url,
    anchor.profile_key,
    anchor.source_election,
    anchor.source_party,
    anchor.anchor_person_id
FROM _votetw_relaxed_candidate_anchors anchor
JOIN person_canonical_map evidence_map
  ON evidence_map.canonical_person_id = anchor.anchor_canonical_person_id
JOIN candidates candidate
  ON candidate.person_id = evidence_map.person_id
 AND candidate.is_public = TRUE
 AND pg_temp._votetw_relaxed_norm_party(candidate.party) =
     pg_temp._votetw_relaxed_norm_party(anchor.source_party)
JOIN races race ON race.id = candidate.race_id AND race.is_public = TRUE
JOIN elections election
  ON election.id = race.election_id
 AND election.is_public = TRUE
 AND election.year = anchor.election_year
LEFT JOIN regions region ON region.id = race.region_id
WHERE (
        pg_temp._votetw_relaxed_norm_name(anchor.source_election) LIKE
            '%' || pg_temp._votetw_relaxed_norm_name(race.title) || '%'
        OR (
            NULLIF(pg_temp._votetw_relaxed_norm_name(region.name), '')
                IS NOT NULL
            AND pg_temp._votetw_relaxed_norm_name(anchor.source_election) LIKE
                '%' || pg_temp._votetw_relaxed_norm_name(region.name) || '%'
        )
        OR (
            anchor.source_election LIKE '%平地原住民%'
            AND (
                race.title LIKE '%平地原住民%'
                OR region.name LIKE '%平地原住民%'
            )
        )
        OR (
            anchor.source_election LIKE '%山地原住民%'
            AND (
                race.title LIKE '%山地原住民%'
                OR region.name LIKE '%山地原住民%'
            )
        )
    )
  AND CASE
      WHEN anchor.source_election LIKE '%立法委員%'
          THEN election.name LIKE '%立法委員%'
            OR race.title LIKE '%立法委員%'
      WHEN anchor.source_election LIKE '%議員%'
          THEN election.name LIKE '%議員%'
            OR race.title LIKE '%議員%'
      WHEN anchor.source_election ~ '(縣長|市長)'
          THEN race.title ~ '(縣長|市長)'
            OR election.name ~ '(縣長|市長)'
      ELSE TRUE
  END
  AND CASE
      WHEN anchor.source_election LIKE '%平地原住民%'
          THEN race.title LIKE '%平地原住民%'
            OR region.name LIKE '%平地原住民%'
      WHEN anchor.source_election LIKE '%山地原住民%'
          THEN race.title LIKE '%山地原住民%'
            OR region.name LIKE '%山地原住民%'
      WHEN anchor.source_election LIKE '%原住民%'
          THEN race.title LIKE '%原住民%'
            OR region.name LIKE '%原住民%'
      ELSE TRUE
  END;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_relaxed_targets) <> 34
       OR (SELECT COUNT(*) FROM _votetw_relaxed_profiles) <> 34
       OR (SELECT COUNT(*) FROM _votetw_relaxed_records) <> 50
       OR (SELECT COUNT(*) FROM _votetw_relaxed_record_anchors) <> 50
       OR (SELECT COUNT(*) FROM _votetw_relaxed_merges) <> 23 THEN
        RAISE EXCEPTION 'VoteTW relaxed profile boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_relaxed_records record
        LEFT JOIN _votetw_relaxed_record_anchors anchor
          ON anchor.source_url = record.source_url
         AND anchor.profile_key = record.profile_key
         AND anchor.source_election = record.source_election
         AND anchor.source_party = record.source_party
        GROUP BY
            record.source_url,
            record.profile_key,
            record.source_election,
            record.source_party
        HAVING COUNT(DISTINCT anchor.anchor_person_id) <> 1
    ) THEN
        RAISE EXCEPTION 'VoteTW relaxed record is not uniquely anchored';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_relaxed_merges merge
        JOIN people canonical ON canonical.id = merge.canonical_person_id
        JOIN people duplicate ON duplicate.id = merge.duplicate_person_id
        WHERE pg_temp._votetw_relaxed_norm_name(canonical.name) <>
                  pg_temp._votetw_relaxed_norm_name(merge.person_name)
           OR pg_temp._votetw_relaxed_norm_name(duplicate.name) <>
                  pg_temp._votetw_relaxed_norm_name(merge.person_name)
           OR canonical.id = duplicate.id
    ) THEN
        RAISE EXCEPTION 'VoteTW relaxed merge identity boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_relaxed_merges merge
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = merge.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> merge.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'VoteTW relaxed profile has a conflicting merge decision';
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
    CONCAT(
        merge.person_name,
        '：同一 VoteTW 生日人物頁中的跨年參選紀錄，分別唯一對上被拆開的人物。'
    ),
    jsonb_build_object(
        'version', 'votetw-relaxed-profile-election-anchor-v1',
        'matchedBy', 'same profile URL, birth date, year, party and election context'
    ),
    'system:votetw-relaxed-profile-election-anchor-v1',
    NOW(),
    NOW()
FROM _votetw_relaxed_merges merge
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
        FROM _votetw_relaxed_merges merge
        JOIN person_canonical_map canonical
          ON canonical.person_id = merge.duplicate_person_id
         AND canonical.canonical_person_id = merge.canonical_person_id
    ) <> 23 THEN
        RAISE EXCEPTION 'VoteTW relaxed merge canonical map mismatch';
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
                'version', 'votetw-relaxed-profile-election-anchor-v1',
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
                'reason', 'same profile URL, birth date, year, party and election context',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-relaxed-profile-election-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-relaxed-profile-election-anchor-v1',
                    'reason', 'VoteTW profile relinked after contextual election review',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_relaxed_profiles profile
WHERE claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND (
      claim.person_id <> profile.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-relaxed-profile-election-anchor-v1'
  );

CREATE TEMP TABLE _votetw_relaxed_verified_claims AS
SELECT DISTINCT
    canonical.canonical_person_id,
    claim.claim_type,
    TRIM(claim.claim_value) AS claim_value
FROM person_claims claim
JOIN person_canonical_map canonical ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

CREATE TEMP TABLE _votetw_relaxed_claim_candidates AS
SELECT
    claim.id AS claim_id,
    profile.person_name,
    profile.target_person_id,
    profile.source_url,
    profile.profile_key,
    claim.claim_type,
    claim.claim_value,
    EXISTS (
        SELECT 1
        FROM _votetw_relaxed_records record
        WHERE record.source_url = profile.source_url
          AND record.profile_key = profile.profile_key
          AND pg_temp._votetw_relaxed_norm_party(record.source_party) =
              pg_temp._votetw_relaxed_norm_party(claim.claim_value)
    ) AS party_supported_by_profile
FROM _votetw_relaxed_profiles profile
JOIN person_claims claim
  ON claim.person_id = profile.target_person_id
 AND claim.source_name = 'VoteTW'
 AND claim.source_url = profile.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
WHERE claim.claim_type IN (
    'birth_date', 'gender', 'party_affiliation', 'education', 'experience'
)
  AND (
      (
          claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
      )
      OR claim.scoring_version IN (
          'votetw-relaxed-profile-claim-rereview-v1',
          'votetw-relaxed-profile-claim-conflict-v1'
      )
  );

CREATE TEMP TABLE _votetw_relaxed_claim_decisions AS
WITH classified AS (
    SELECT
        candidate.*,
        person.gender,
        person.party,
        person.education,
        EXISTS (
            SELECT 1
            FROM _votetw_relaxed_verified_claims verified
            WHERE verified.canonical_person_id = candidate.target_person_id
              AND verified.claim_type = candidate.claim_type
        ) AS has_verified_type,
        EXISTS (
            SELECT 1
            FROM _votetw_relaxed_verified_claims verified
            WHERE verified.canonical_person_id = candidate.target_person_id
              AND verified.claim_type = candidate.claim_type
              AND verified.claim_value = TRIM(candidate.claim_value)
        ) AS has_exact_verified
    FROM _votetw_relaxed_claim_candidates candidate
    JOIN public_people person
      ON person.person_id = candidate.target_person_id
)
SELECT
    classified.*,
    CASE
        WHEN has_exact_verified THEN 'archive_exact_source'
        WHEN claim_type IN ('education', 'experience')
             AND has_verified_type
            THEN 'archive_better_source'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
             AND REPLACE(TRIM(claim_value), '學歷', '') = TRIM(education)
            THEN 'archive_core_duplicate'
        WHEN claim_type = 'birth_date' AND has_verified_type
            THEN 'hold_conflict'
        WHEN claim_type = 'education'
             AND NULLIF(TRIM(COALESCE(education, '')), '') IS NOT NULL
            THEN 'hold_conflict'
        WHEN claim_type = 'party_affiliation'
             AND NULLIF(TRIM(COALESCE(party, '')), '') IS NOT NULL
             AND pg_temp._votetw_relaxed_norm_party(claim_value) <>
                 pg_temp._votetw_relaxed_norm_party(party)
             AND party_supported_by_profile IS NOT TRUE
            THEN 'hold_conflict'
        WHEN claim_type = 'gender'
             AND LOWER(TRIM(COALESCE(gender, ''))) NOT IN ('', 'unknown')
             AND LOWER(TRIM(COALESCE(claim_value, ''))) <>
                 LOWER(TRIM(COALESCE(gender, '')))
            THEN 'hold_conflict'
        ELSE 'publish_c'
    END AS action
FROM classified;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_relaxed_claim_decisions) <> 109
       OR (
           SELECT COUNT(*) FROM _votetw_relaxed_claim_decisions
           WHERE action = 'publish_c'
       ) <> 97
       OR (
           SELECT COUNT(*) FROM _votetw_relaxed_claim_decisions
           WHERE action LIKE 'archive_%'
       ) <> 10
       OR (
           SELECT COUNT(*) FROM _votetw_relaxed_claim_decisions
           WHERE action = 'hold_conflict'
       ) <> 2 THEN
        RAISE EXCEPTION 'VoteTW relaxed claim decision boundary drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_relaxed_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
        WHERE claim.source_name = 'VoteTW'
          AND claim.claim_type = 'legal_case'
          AND claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
    ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW relaxed legal review boundary drifted';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-relaxed-profile-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-relaxed-profile-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-relaxed-profile-claim-rereview-v1',
                    'reason', 'VoteTW profile has a context-confirmed election identity and no conflicting public value',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_relaxed_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-relaxed-profile-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-relaxed-profile-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-relaxed-profile-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-relaxed-profile-claim-rereview-v1',
                    'reason', 'VoteTW value retained privately because an equal or better public source exists',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_relaxed_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-relaxed-profile-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    scoring_version = 'votetw-relaxed-profile-claim-conflict-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-relaxed-profile-claim-conflict-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-relaxed-profile-claim-conflict-v1',
                    'reason', 'VoteTW value remains review-only because it conflicts with the public profile shape',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_relaxed_claim_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'hold_conflict'
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-relaxed-profile-claim-conflict-v1';

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-relaxed-profile-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-relaxed-profile-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-relaxed-profile-claim-rereview-v1',
                    'reason', 'VoteTW external identifier remains private after contextual profile resolution',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_relaxed_profiles profile
WHERE claim.person_id = profile.target_person_id
  AND claim.source_name = 'VoteTW'
  AND claim.source_url = profile.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      profile.profile_key
  AND claim.claim_type = 'external_id'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-relaxed-profile-claim-rereview-v1'
  );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_relaxed_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-relaxed-profile-election-anchor-v1'
        WHERE claim.source_name = 'VoteTW'
    ) <> 206 THEN
        RAISE EXCEPTION 'VoteTW relaxed profile relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_relaxed_claim_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'publish_c'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-relaxed-profile-claim-rereview-v1'
    ) <> 97 THEN
        RAISE EXCEPTION 'VoteTW relaxed public claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_relaxed_claim_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action LIKE 'archive_%'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-relaxed-profile-claim-rereview-v1'
    ) <> 10 THEN
        RAISE EXCEPTION 'VoteTW relaxed archived claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_relaxed_claim_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'hold_conflict'
          AND claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-relaxed-profile-claim-conflict-v1'
    ) <> 2 THEN
        RAISE EXCEPTION 'VoteTW relaxed held claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_relaxed_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
        WHERE claim.source_name = 'VoteTW'
          AND claim.claim_type = 'external_id'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-relaxed-profile-claim-rereview-v1'
    ) <> 34 THEN
        RAISE EXCEPTION 'VoteTW relaxed external identifier state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);
