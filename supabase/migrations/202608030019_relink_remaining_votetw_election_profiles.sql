SET statement_timeout = 0;

-- Complete the remaining VoteTW election-context review by anchoring each
-- profile through its exact VoteTW candidate history and then following the
-- verified canonical-person map. VoteTW remains same-source evidence, so any
-- published profile values are capped at confidence C.
CREATE TEMP TABLE _votetw_remaining_profiles (
    owner_person_id UUID PRIMARY KEY,
    target_person_id UUID NOT NULL,
    name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    source_birth_date TEXT NOT NULL
);

INSERT INTO _votetw_remaining_profiles VALUES
    ('18f00a24-3810-4317-b253-2bff3543b390', '18f00a24-3810-4317-b253-2bff3543b390', '何秋葺', 'https://votetw.com/wiki/%E4%BD%95%E7%A7%8B%E8%91%BA', '何秋葺:1970-01-14', '1970-01-14'),
    ('1f2f5cb0-1a4e-45fe-9be1-fd4420d7f07c', '89ddeb9c-d6fc-4581-868b-9a4a728ec1df', '吳建德', 'https://votetw.com/wiki/%E5%90%B3%E5%BB%BA%E5%BE%B7', '吳建德:1996-09-15', '1996-09-15'),
    ('2328fe81-eca8-41e2-9786-314908ede019', '2c604d95-3583-42e2-b8bf-eaefee2bd157', '吳振嘉', 'https://votetw.com/wiki/%E5%90%B3%E6%8C%AF%E5%98%89', '吳振嘉:1970-08-29', '1970-08-29'),
    ('0a77d7e7-45ef-44de-856b-2d6070053bcf', 'efeaf1b6-46f1-4e18-b70e-5e58f119f7d5', '張嘉玲', 'https://votetw.com/wiki/%E5%BC%B5%E5%98%89%E7%8E%B2', '張嘉玲:1975-10-31', '1975-10-31'),
    ('3ed80bec-1c26-43aa-a0b2-642fe7776ebe', '6ccff7fb-97d7-4c48-8598-a5adb4e00904', '張文興', 'https://votetw.com/wiki/%E5%BC%B5%E6%96%87%E8%88%88', '張文興:1967-07-15', '1967-07-15'),
    ('05337d8b-935e-4bb7-9bca-65881f78944d', '882cfc32-8236-432c-8bb3-1b4f9de07079', '李文基', 'https://votetw.com/wiki/%E6%9D%8E%E6%96%87%E5%9F%BA', '李文基:1971-11-07', '1971-11-07'),
    ('1517bf97-c779-4eb6-9dda-51925c7fc29e', '976c3ad8-57c7-485f-af3e-29e03fdf766f', '林志強', 'https://votetw.com/wiki/%E6%9E%97%E5%BF%97%E5%BC%B7', '林志強:1974-10-28', '1974-10-28'),
    ('2f47fa54-45b5-4c76-9953-6714d175ef81', '5671768b-c99c-463f-aa5d-213e5731670c', '林正福', 'https://votetw.com/wiki/%E6%9E%97%E6%AD%A3%E7%A6%8F', '林正福:1965-03-02', '1965-03-02'),
    ('d327a74d-5d73-46b7-afe9-4c7c177aa08f', 'd327a74d-5d73-46b7-afe9-4c7c177aa08f', '賴文德', 'https://votetw.com/wiki/%E8%B3%B4%E6%96%87%E5%BE%B7', '賴文德:1965-10-30', '1965-10-30'),
    ('15593741-a595-407b-9973-d1086067e52d', 'a5624377-664a-44ac-90f1-9cc89976f95c', '陳建興', 'https://votetw.com/wiki/%E9%99%B3%E5%BB%BA%E8%88%88', '陳建興:1974-03-20', '1974-03-20'),
    ('0fd668e2-e01b-4cb4-92da-1c195e18f637', 'abd429ac-0a40-4421-b56f-6a3e7e6e4c15', '陳志榮', 'https://votetw.com/wiki/%E9%99%B3%E5%BF%97%E6%A6%AE', '陳志榮:1962-04-04', '1962-04-04'),
    ('23e09445-8e25-4672-ab5b-912d012e4eb4', 'd1978cfd-9cc5-4edf-a634-ae37868f4542', '黃世杰', 'https://votetw.com/wiki/%E9%BB%83%E4%B8%96%E6%9D%B0', '黃世杰:1979-01-05', '1979-01-05'),
    ('1ddbb0f8-4164-4ad2-8ccd-3c2312504d8f', 'd8b74d2d-e192-4163-b4b3-c1e01ef5dd24', '黃瓊慧', 'https://votetw.com/wiki/%E9%BB%83%E7%93%8A%E6%85%A7', '黃瓊慧:1984-06-29', '1984-06-29');

CREATE FUNCTION pg_temp._votetw_remaining_norm_text(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN REGEXP_REPLACE(
    REPLACE(COALESCE(value, ''), '臺', '台'),
    E'\\s+',
    '',
    'g'
);

CREATE FUNCTION pg_temp._votetw_remaining_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN pg_temp._votetw_remaining_norm_text(value) IN (
        '無', '無黨', '無黨派', '無黨籍'
    ) THEN '無黨籍'
    WHEN pg_temp._votetw_remaining_norm_text(value) IN (
        '台灣基進', '基進黨'
    ) THEN '台灣基進'
    WHEN pg_temp._votetw_remaining_norm_text(value) IN (
        '台灣綠黨', '綠黨'
    ) THEN '綠黨'
    ELSE pg_temp._votetw_remaining_norm_text(value)
END;

-- One VoteTW birth-dated page contains Ho Chiu-ti's 2020, 2022 and 2024
-- candidacies. The 2024 candidate is already merged into the 2022 person;
-- merge the remaining 2020 VoteTW person into that same canonical identity.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM _votetw_remaining_profiles profile
        JOIN person_claims external
          ON external.person_id = profile.owner_person_id
         AND external.source_name = 'VoteTW'
         AND external.claim_type = 'external_id'
         AND external.source_url = profile.source_url
         AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
        WHERE profile.name = '何秋葺'
          AND external.claim_json->'electionRecords' @>
              jsonb_build_array(
                  jsonb_build_object(
                      'election', '2020年立法委員選舉屏東縣第2選舉區（區域）',
                      'party', '台灣工黨'
                  )
              )
          AND external.claim_json->'electionRecords' @>
              jsonb_build_array(
                  jsonb_build_object(
                      'election', '2022年屏東縣萬巒鄉鄉長選舉',
                      'party', '台灣工黨'
                  )
              )
          AND external.claim_json->'electionRecords' @>
              jsonb_build_array(
                  jsonb_build_object(
                      'election', '2024年立法委員選舉屏東縣第2選舉區（區域）',
                      'party', '人民最大黨'
                  )
              )
    ) THEN
        RAISE EXCEPTION 'Ho Chiu-ti cross-year VoteTW evidence drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_merge_decisions existing
        WHERE existing.duplicate_person_id =
              '31f59ea3-6dc9-4999-b4cd-81691b8af603'::UUID
          AND existing.status IN ('suggested', 'verified')
          AND existing.canonical_person_id <>
              '18f00a24-3810-4317-b253-2bff3543b390'::UUID
    ) THEN
        RAISE EXCEPTION 'Ho Chiu-ti gained a conflicting merge decision';
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
    '31f59ea3-6dc9-4999-b4cd-81691b8af603'::UUID,
    '18f00a24-3810-4317-b253-2bff3543b390'::UUID,
    'verified',
    'C',
    '何秋葺：同一 VoteTW 生日人物頁的 2020、2022、2024 參選紀錄分別對上被拆開的歷史候選人。',
    jsonb_build_object(
        'version', 'votetw-remaining-election-canonical-anchor-v1',
        'sourceBirthDate', '1970-01-14',
        'elections', jsonb_build_array(
            '2020年立法委員選舉屏東縣第2選舉區（區域）',
            '2022年屏東縣萬巒鄉鄉長選舉',
            '2024年立法委員選舉屏東縣第2選舉區（區域）'
        )
    ),
    'system:votetw-remaining-election-canonical-anchor-v1',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id =
          '31f59ea3-6dc9-4999-b4cd-81691b8af603'::UUID
      AND existing.status IN ('suggested', 'verified')
);

CREATE TEMP TABLE _votetw_remaining_records AS
SELECT DISTINCT
    profile.*,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party
FROM _votetw_remaining_profiles profile
JOIN person_claims external
  ON external.person_id IN (
      profile.owner_person_id,
      profile.target_person_id
  )
 AND external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = profile.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
) record;

CREATE TEMP TABLE _votetw_remaining_matches AS
SELECT DISTINCT
    source.owner_person_id,
    source.target_person_id,
    source.source_url,
    source.profile_key,
    source.source_election
FROM _votetw_remaining_records source
JOIN people candidate_person
  ON candidate_person.name = source.name
 AND candidate_person.source_url = source.source_url
JOIN candidates candidate
  ON candidate.person_id = candidate_person.id
 AND candidate.is_public = TRUE
 AND candidate.source_name = 'VoteTW historical election results'
JOIN races race
  ON race.id = candidate.race_id
 AND race.is_public = TRUE
JOIN elections election
  ON election.id = race.election_id
 AND election.is_public = TRUE
JOIN person_canonical_map canonical
  ON canonical.person_id = candidate.person_id
 AND canonical.canonical_person_id = source.target_person_id
WHERE SUBSTRING(source.source_election FROM 1 FOR 4) ~ '^[0-9]{4}$'
  AND election.year = SUBSTRING(source.source_election FROM 1 FOR 4)::INT
  AND (
      pg_temp._votetw_remaining_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_remaining_norm_text(election.name) || '%'
      OR pg_temp._votetw_remaining_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_remaining_norm_text(race.title) || '%'
  )
  AND (
      SUBSTRING(race.title FROM '第0*([0-9]+)選舉區') IS NULL
      OR SUBSTRING(
          source.source_election FROM '第0*([0-9]+)選舉區'
      ) = SUBSTRING(race.title FROM '第0*([0-9]+)選舉區')
  )
  AND (
      CASE
          WHEN race.title LIKE '%平地原住民%'
              THEN source.source_election LIKE '%平地原住民%'
          WHEN race.title LIKE '%山地原住民%'
              THEN source.source_election LIKE '%山地原住民%'
          WHEN race.title LIKE '%原住民%'
              THEN source.source_election LIKE '%原住民%'
          ELSE TRUE
      END
  )
  AND pg_temp._votetw_remaining_norm_party(source.source_party) =
      pg_temp._votetw_remaining_norm_party(candidate.party);

CREATE TEMP TABLE _verified_non_votetw_claims AS
SELECT DISTINCT
    COALESCE(canonical.canonical_person_id, claim.person_id) AS person_id,
    claim.claim_type,
    TRIM(claim.claim_value) AS claim_value,
    MD5(TRIM(claim.claim_value)) AS value_hash
FROM person_claims claim
LEFT JOIN person_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.is_public = TRUE
  AND claim.source_name NOT LIKE 'VoteTW%';

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_remaining_profiles) <> 13 THEN
        RAISE EXCEPTION 'VoteTW remaining profile count drifted from 13';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_remaining_profiles profile
        JOIN people owner ON owner.id = profile.owner_person_id
        JOIN people target ON target.id = profile.target_person_id
        LEFT JOIN public_people public_target
          ON public_target.person_id = profile.target_person_id
        WHERE owner.name <> profile.name
           OR target.name <> profile.name
           OR target.is_public IS NOT TRUE
           OR public_target.person_id IS NULL
    ) THEN
        RAISE EXCEPTION 'VoteTW remaining canonical person anchor drifted';
    END IF;

    IF (SELECT COUNT(*) FROM _votetw_remaining_records) <> 17
       OR (SELECT COUNT(*) FROM _votetw_remaining_matches) <> 16 THEN
        RAISE EXCEPTION 'VoteTW remaining election record counts drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_remaining_profiles profile
        WHERE NOT EXISTS (
            SELECT 1
            FROM _votetw_remaining_matches matched
            WHERE matched.owner_person_id = profile.owner_person_id
              AND matched.target_person_id = profile.target_person_id
              AND matched.source_url = profile.source_url
              AND matched.profile_key = profile.profile_key
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW remaining profile lacks a canonical election anchor';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_remaining_records record
        LEFT JOIN _votetw_remaining_matches matched
          ON matched.owner_person_id = record.owner_person_id
         AND matched.target_person_id = record.target_person_id
         AND matched.source_url = record.source_url
         AND matched.profile_key = record.profile_key
         AND matched.source_election = record.source_election
        WHERE matched.owner_person_id IS NULL
          AND NOT (
              record.name = '吳建德'
              AND record.source_election =
                  '2024年立法委員選舉（全國不分區及僑居國外國民）'
              AND record.source_party = '親民黨'
          )
    ) <> 0 THEN
        RAISE EXCEPTION 'VoteTW remaining profile has an unexpected unmatched election';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_remaining_profiles profile
        JOIN person_claims claim
          ON claim.person_id IN (
              profile.owner_person_id,
              profile.target_person_id
          )
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
    ) <> 78 THEN
        RAISE EXCEPTION 'VoteTW remaining profile claim count drifted from 78';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_remaining_profiles profile
        JOIN _verified_non_votetw_claims verified
          ON verified.person_id = profile.target_person_id
         AND verified.claim_type = 'birth_date'
         AND verified.claim_value <> profile.source_birth_date
    ) THEN
        RAISE EXCEPTION 'VoteTW remaining target has a verified birth conflict';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_remaining_profiles profile
        JOIN person_claims claim
          ON claim.person_id IN (
              profile.owner_person_id,
              profile.target_person_id
          )
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
        WHERE claim.claim_type IN ('legal_case', 'platform')
    ) THEN
        RAISE EXCEPTION 'VoteTW remaining relink contains restricted claims';
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
                'version', 'votetw-remaining-election-canonical-anchor-v1',
                'originalPersonId', profile.owner_person_id,
                'targetPersonId', profile.target_person_id,
                'sourceUrl', profile.source_url,
                'reason', 'VoteTW profile anchored through exact candidate history and the verified canonical-person map',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-remaining-election-canonical-anchor-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-remaining-election-canonical-anchor-v1',
                    'reason', 'VoteTW profile relinked through exact candidate history and an existing verified canonical identity',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_remaining_profiles profile
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
          'votetw-remaining-election-canonical-anchor-v1'
  );

CREATE TEMP TABLE _votetw_remaining_claims AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value,
    EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
        ) record
        WHERE pg_temp._votetw_remaining_norm_party(
                  record.value->>'party'
              ) = pg_temp._votetw_remaining_norm_party(claim.claim_value)
    ) AS party_supported_by_profile
FROM _votetw_remaining_profiles profile
JOIN person_claims claim
  ON claim.person_id = profile.target_person_id
 AND claim.source_name = 'VoteTW'
 AND claim.source_url = profile.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
JOIN person_claims external
  ON external.person_id = profile.target_person_id
 AND external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = profile.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     profile.profile_key
WHERE claim.claim_type IN (
    'birth_date', 'gender', 'party_affiliation', 'education', 'experience'
);

CREATE TEMP TABLE _votetw_remaining_decisions AS
WITH classified AS (
    SELECT
        candidate.*,
        person.gender,
        person.party,
        person.education,
        EXISTS (
            SELECT 1
            FROM _verified_non_votetw_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
        ) AS has_verified_type,
        EXISTS (
            SELECT 1
            FROM _verified_non_votetw_claims verified
            WHERE verified.person_id = candidate.person_id
              AND verified.claim_type = candidate.claim_type
              AND verified.value_hash = MD5(TRIM(candidate.claim_value))
              AND verified.claim_value = TRIM(candidate.claim_value)
        ) AS has_exact_verified
    FROM _votetw_remaining_claims candidate
    JOIN public_people person ON person.person_id = candidate.person_id
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
             AND pg_temp._votetw_remaining_norm_party(claim_value) <>
                 pg_temp._votetw_remaining_norm_party(party)
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
    IF (SELECT COUNT(*) FROM _votetw_remaining_decisions) <> 65 THEN
        RAISE EXCEPTION 'VoteTW remaining review count drifted from 65';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_remaining_decisions
        WHERE action = 'publish_c'
    ) <> 32 THEN
        RAISE EXCEPTION 'VoteTW remaining publish count drifted from 32';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_remaining_decisions
        WHERE action LIKE 'archive_%'
    ) <> 33 THEN
        RAISE EXCEPTION 'VoteTW remaining archive count drifted from 33';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _votetw_remaining_decisions
        WHERE action = 'hold_conflict'
    ) THEN
        RAISE EXCEPTION 'VoteTW remaining review retained an unexpected conflict';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-remaining-election-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-remaining-election-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-remaining-election-claim-rereview-v1',
                    'reason', 'VoteTW profile is anchored through exact candidate history and a verified canonical identity',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_remaining_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-remaining-election-claim-rereview-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-remaining-election-claim-rereview-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-remaining-election-claim-rereview-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-remaining-election-claim-rereview-v1',
                    'reason', 'VoteTW value retained as private audit history because an equal or better public value already exists',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_remaining_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action LIKE 'archive_%'
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-remaining-election-claim-rereview-v1'
  );

DO $$
BEGIN
    IF (
        SELECT canonical_person_id
        FROM person_canonical_map
        WHERE person_id = '31f59ea3-6dc9-4999-b4cd-81691b8af603'::UUID
    ) <> '18f00a24-3810-4317-b253-2bff3543b390'::UUID THEN
        RAISE EXCEPTION 'Ho Chiu-ti cross-year canonical state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_remaining_profiles profile
        JOIN person_claims claim
          ON claim.person_id = profile.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = profile.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             profile.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-remaining-election-canonical-anchor-v1'
    ) <> 78 THEN
        RAISE EXCEPTION 'VoteTW remaining relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_remaining_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action = 'publish_c'
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-remaining-election-claim-rereview-v1'
    ) <> 32 THEN
        RAISE EXCEPTION 'VoteTW remaining public claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_remaining_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE decision.action LIKE 'archive_%'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-remaining-election-claim-rereview-v1'
    ) <> 33 THEN
        RAISE EXCEPTION 'VoteTW remaining archived claim state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_remaining_decisions;
DROP TABLE _votetw_remaining_claims;
DROP TABLE _verified_non_votetw_claims;
DROP TABLE _votetw_remaining_matches;
DROP TABLE _votetw_remaining_records;
DROP TABLE _votetw_remaining_profiles;

RESET statement_timeout;
