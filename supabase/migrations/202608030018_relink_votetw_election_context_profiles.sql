SET statement_timeout = 0;

-- Repair 21 VoteTW profiles that were attached to a different same-name
-- person. Every source election record must match the target person's public
-- VoteTW candidate history by year, race and party. This remains same-source
-- evidence, so public claims are capped at confidence C.
CREATE TEMP TABLE _votetw_election_context_relinks (
    owner_person_id UUID PRIMARY KEY,
    target_person_id UUID NOT NULL,
    name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    source_birth_date TEXT NOT NULL
);

INSERT INTO _votetw_election_context_relinks VALUES
    ('35e538d6-0cbe-4452-9fdc-41b736786f5b', '742f7e76-5f81-4dca-ade2-b00f8b45a783', '吳勝雄', 'https://votetw.com/wiki/%E5%90%B3%E5%8B%9D%E9%9B%84', '吳勝雄:1976-06-19', '1976-06-19'),
    ('0ca4c7b4-7d59-47d0-bbcb-9ad5854c7d3d', '6e2a3edc-dca8-4c90-b272-19285aece1fa', '吳武宗', 'https://votetw.com/wiki/%E5%90%B3%E6%AD%A6%E5%AE%97', '吳武宗:1981-01-10', '1981-01-10'),
    ('698e8edd-ea97-4ea1-91f2-3765e9d15317', 'c8e9eb52-50e7-49aa-85b8-af121c67968a', '張家豪', 'https://votetw.com/wiki/%E5%BC%B5%E5%AE%B6%E8%B1%AA', '張家豪:1984-12-31', '1984-12-31'),
    ('1fe7be0d-bee1-4b05-a439-f505e0bb3805', 'ee9fc9b7-506f-4e7a-9e47-744340ff7e1c', '張銘祐', 'https://votetw.com/wiki/%E5%BC%B5%E9%8A%98%E7%A5%90', '張銘祐:1984-07-17', '1984-07-17'),
    ('1e63018b-2441-4113-9310-5ac9d05ab850', '2b2395a7-2bb5-4c41-938d-2f6ab075e203', '李武龍', 'https://votetw.com/wiki/%E6%9D%8E%E6%AD%A6%E9%BE%8D', '李武龍:1976-04-16', '1976-04-16'),
    ('1f177fdc-0c57-4c7a-80a2-7b85eff8271e', '891837fe-e344-4c1c-919f-df7baa351fb9', '林建華', 'https://votetw.com/wiki/%E6%9E%97%E5%BB%BA%E8%8F%AF', '林建華:1985-08-04', '1985-08-04'),
    ('03bbdc5e-1561-4fe2-b793-f1df14d6e6f9', 'aa9fa93c-9fb3-491c-9dbb-bdc5b1d30287', '林淑娟', 'https://votetw.com/wiki/%E6%9E%97%E6%B7%91%E5%A8%9F', '林淑娟:1971-11-10', '1971-11-10'),
    ('77b21cf9-5e4b-49ec-a2e7-2ff559853e71', 'd3cf56fc-2012-4891-b631-1f4fd8a5996c', '楊萬福', 'https://votetw.com/wiki/%E6%A5%8A%E8%90%AC%E7%A6%8F', '楊萬福:1954-11-20', '1954-11-20'),
    ('316bae44-6662-4ba2-9cf2-764ead0565de', 'f96c120b-77a3-41ce-b73c-1224e8326788', '洪國雄', 'https://votetw.com/wiki/%E6%B4%AA%E5%9C%8B%E9%9B%84', '洪國雄:1969-06-18', '1969-06-18'),
    ('09661b9f-246c-4ca9-87d8-cb47c361c37f', 'b50ab093-ff1c-4988-b793-64b43b23b041', '洪順天', 'https://votetw.com/wiki/%E6%B4%AA%E9%A0%86%E5%A4%A9', '洪順天:1970-01-19', '1970-01-19'),
    ('2f6c7788-a6e1-447f-8cf1-6210a086902b', '9da57387-0376-4d7a-bd45-35c006e2a873', '王俊雄', 'https://votetw.com/wiki/%E7%8E%8B%E4%BF%8A%E9%9B%84', '王俊雄:1970-01-02', '1970-01-02'),
    ('339a40c9-9c88-45ea-a257-ba6dde421f81', '4781fc69-f545-4443-9bb7-0f087f4abe89', '詹嘉文', 'https://votetw.com/wiki/%E8%A9%B9%E5%98%89%E6%96%87', '詹嘉文:1989-09-22', '1989-09-22'),
    ('1a6fb024-dfa9-4fd4-bf3c-adf83438e0bd', 'd8b47b6b-9d67-4f27-bb43-f90f5263f6d0', '陳信志', 'https://votetw.com/wiki/%E9%99%B3%E4%BF%A1%E5%BF%97', '陳信志:1965-11-01', '1965-11-01'),
    ('bf45ed00-c27d-4f79-a88b-3c0add5e5a6c', 'a354447d-b6c1-4b66-a390-96da3c6eb495', '陳冠廷', 'https://votetw.com/wiki/%E9%99%B3%E5%86%A0%E5%BB%B7', '陳冠廷:1968-09-15', '1968-09-15'),
    ('345c8d3a-9c70-4429-bd83-0e7471211a1d', 'a8720f9d-97c8-493b-ab83-825731c8390d', '陳志傑', 'https://votetw.com/wiki/%E9%99%B3%E5%BF%97%E5%82%91', '陳志傑:1967-09-01', '1967-09-01'),
    ('a5efb5a8-8e7c-49fb-9fca-eec007bbfa25', 'c3b9b5a9-cf9e-49ee-9744-89268e542e82', '陳志宏', 'https://votetw.com/wiki/%E9%99%B3%E5%BF%97%E5%AE%8F', '陳志宏:1970-06-27', '1970-06-27'),
    ('194bed49-8d73-4294-9abd-95d132b2f9db', '888d4033-a213-4481-ae4b-703b53f39bf0', '陳明燦', 'https://votetw.com/wiki/%E9%99%B3%E6%98%8E%E7%87%A6', '陳明燦:1952-11-01', '1952-11-01'),
    ('5d90febb-4c08-42a6-aa3d-d6179c3d5efe', '90317c30-f636-4691-b69c-f1c10529430c', '陳桂香', 'https://votetw.com/wiki/%E9%99%B3%E6%A1%82%E9%A6%99', '陳桂香:1970-08-01', '1970-08-01'),
    ('4df4b865-3650-452e-be11-678a7b6d2621', 'dfebb7e2-25e1-49b5-9dac-5913594b720a', '陳秋月', 'https://votetw.com/wiki/%E9%99%B3%E7%A7%8B%E6%9C%88', '陳秋月:1958-09-25', '1958-09-25'),
    ('615eb324-83fe-4509-b65a-554715520e5a', '9f12aef2-84ea-4554-a1dc-8942cbf65c41', '高明達', 'https://votetw.com/wiki/%E9%AB%98%E6%98%8E%E9%81%94', '高明達:1965-10-27', '1965-10-27'),
    ('71a24e1d-f31a-437e-b39c-bae067a0943e', 'da349417-e1d8-44eb-a2a8-64fb39fe9f11', '黃建智', 'https://votetw.com/wiki/%E9%BB%83%E5%BB%BA%E6%99%BA', '黃建智:1985-04-01', '1985-04-01');

CREATE FUNCTION pg_temp._votetw_context_norm_text(value TEXT)
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

CREATE FUNCTION pg_temp._votetw_context_norm_party(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE
    WHEN pg_temp._votetw_context_norm_text(value) IN (
        '無', '無黨', '無黨派', '無黨籍'
    ) THEN '無黨籍'
    WHEN pg_temp._votetw_context_norm_text(value) IN (
        '台灣基進', '基進黨'
    ) THEN '台灣基進'
    WHEN pg_temp._votetw_context_norm_text(value) IN (
        '台灣綠黨', '綠黨'
    ) THEN '綠黨'
    ELSE pg_temp._votetw_context_norm_text(value)
END;

CREATE TEMP TABLE _votetw_election_context_records AS
SELECT DISTINCT
    relink.owner_person_id,
    relink.target_person_id,
    relink.source_url,
    relink.profile_key,
    record.value->>'election' AS source_election,
    record.value->>'party' AS source_party
FROM _votetw_election_context_relinks relink
JOIN person_claims external
  ON external.person_id IN (
      relink.owner_person_id,
      relink.target_person_id
  )
 AND external.source_name = 'VoteTW'
 AND external.claim_type = 'external_id'
 AND external.source_url = relink.source_url
 AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
     relink.profile_key
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
) record;

CREATE TEMP TABLE _votetw_election_context_matches AS
SELECT DISTINCT
    source.owner_person_id,
    source.target_person_id,
    source.source_url,
    source.profile_key,
    source.source_election
FROM _votetw_election_context_records source
JOIN candidates candidate
  ON candidate.person_id = source.target_person_id
 AND candidate.is_public = TRUE
 AND candidate.source_name = 'VoteTW historical election results'
JOIN races race
  ON race.id = candidate.race_id
 AND race.is_public = TRUE
JOIN elections election
  ON election.id = race.election_id
 AND election.is_public = TRUE
WHERE SUBSTRING(source.source_election FROM 1 FOR 4) ~ '^[0-9]{4}$'
  AND election.year = SUBSTRING(source.source_election FROM 1 FOR 4)::INT
  AND (
      pg_temp._votetw_context_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_context_norm_text(election.name) || '%'
      OR pg_temp._votetw_context_norm_text(source.source_election) LIKE '%' ||
          pg_temp._votetw_context_norm_text(race.title) || '%'
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
  AND pg_temp._votetw_context_norm_party(source.source_party) =
      pg_temp._votetw_context_norm_party(candidate.party);

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
    IF (SELECT COUNT(*) FROM _votetw_election_context_relinks) <> 21 THEN
        RAISE EXCEPTION 'VoteTW election-context relink count drifted from 21';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_election_context_relinks relink
        JOIN people owner ON owner.id = relink.owner_person_id
        JOIN people target ON target.id = relink.target_person_id
        WHERE owner.name <> relink.name
           OR target.name <> relink.name
           OR target.is_public IS NOT TRUE
           OR target.source_url <> relink.source_url
    ) THEN
        RAISE EXCEPTION 'VoteTW election-context person anchor drifted';
    END IF;

    IF (SELECT COUNT(*) FROM _votetw_election_context_records) <> 21
       OR (SELECT COUNT(*) FROM _votetw_election_context_matches) <> 21 THEN
        RAISE EXCEPTION 'VoteTW election-context source record match drifted from 21';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_election_context_records source
        LEFT JOIN _votetw_election_context_matches matched
          ON matched.owner_person_id = source.owner_person_id
         AND matched.target_person_id = source.target_person_id
         AND matched.source_url = source.source_url
         AND matched.profile_key = source.profile_key
         AND matched.source_election = source.source_election
        WHERE matched.owner_person_id IS NULL
    ) THEN
        RAISE EXCEPTION 'VoteTW election-context contains an unmatched source record';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_election_context_relinks relink
        JOIN person_claims claim
          ON claim.person_id IN (
              relink.owner_person_id,
              relink.target_person_id
          )
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
    ) <> 126 THEN
        RAISE EXCEPTION 'VoteTW election-context profile claim count drifted from 126';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_election_context_relinks relink
        JOIN _verified_non_votetw_claims verified
          ON verified.person_id = relink.target_person_id
         AND verified.claim_type = 'birth_date'
         AND verified.claim_value <> relink.source_birth_date
    ) THEN
        RAISE EXCEPTION 'VoteTW election-context target has a verified birth conflict';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_election_context_relinks relink
        JOIN person_claims claim
          ON claim.person_id IN (
              relink.owner_person_id,
              relink.target_person_id
          )
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
        WHERE claim.claim_type IN ('legal_case', 'platform')
    ) THEN
        RAISE EXCEPTION 'VoteTW election-context relink contains restricted claims';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    person_id = relink.target_person_id,
    claim_json = claim.claim_json ||
        jsonb_build_object(
            'identityResolution',
            jsonb_build_object(
                'version', 'votetw-election-context-source-anchor-v2',
                'originalPersonId', relink.owner_person_id,
                'targetPersonId', relink.target_person_id,
                'sourceUrl', relink.source_url,
                'reason', 'exact VoteTW source URL and every source election record match the target year, race and party',
                'reviewedAt', NOW()
            )
        ),
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.claim_json->'identityResolution'->>'version' =
                 'votetw-election-context-source-anchor-v2'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-election-context-source-anchor-v2',
                    'reason', 'VoteTW profile relinked to the same-name person whose exact source URL and complete election history match',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_election_context_relinks relink
WHERE claim.source_name = 'VoteTW'
  AND claim.source_url = relink.source_url
  AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
      relink.profile_key
  AND claim.person_id IN (
      relink.owner_person_id,
      relink.target_person_id
  )
  AND (
      claim.person_id <> relink.target_person_id
      OR claim.claim_json->'identityResolution'->>'version' IS DISTINCT FROM
          'votetw-election-context-source-anchor-v2'
  );

CREATE TEMP TABLE _votetw_election_context_claims AS
SELECT
    claim.id AS claim_id,
    claim.person_id,
    claim.claim_type,
    claim.claim_value
FROM _votetw_election_context_relinks relink
JOIN person_claims claim
  ON claim.person_id = relink.target_person_id
 AND claim.source_name = 'VoteTW'
 AND claim.source_url = relink.source_url
 AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
     relink.profile_key
WHERE claim.claim_type IN (
    'birth_date', 'gender', 'party_affiliation', 'education', 'experience'
);

CREATE TEMP TABLE _votetw_election_context_decisions AS
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
    FROM _votetw_election_context_claims candidate
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
             AND pg_temp._votetw_context_norm_party(claim_value) <>
                 pg_temp._votetw_context_norm_party(party)
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
    IF (SELECT COUNT(*) FROM _votetw_election_context_decisions) <> 105 THEN
        RAISE EXCEPTION 'VoteTW election-context review count drifted from 105';
    END IF;

    IF (
        SELECT COUNT(*) FROM _votetw_election_context_decisions
        WHERE action = 'publish_c'
    ) <> 105 THEN
        RAISE EXCEPTION 'VoteTW election-context publish count drifted from 105';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _votetw_election_context_decisions
        WHERE action <> 'publish_c'
    ) THEN
        RAISE EXCEPTION 'VoteTW election-context unexpected conflict or duplicate';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'votetw-election-context-claim-rereview-v2',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-election-context-claim-rereview-v2'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-election-context-claim-rereview-v2',
                    'reason', 'VoteTW claim is attached to the person whose exact source URL and every source election record match',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_election_context_decisions decision
WHERE claim.id = decision.claim_id
  AND decision.action = 'publish_c'
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-election-context-claim-rereview-v2'
  );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_election_context_relinks relink
        JOIN person_claims claim
          ON claim.person_id = relink.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-election-context-source-anchor-v2'
    ) <> 126 THEN
        RAISE EXCEPTION 'VoteTW election-context relink state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_election_context_decisions decision
        JOIN person_claims claim ON claim.id = decision.claim_id
        WHERE claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-election-context-claim-rereview-v2'
    ) <> 105 THEN
        RAISE EXCEPTION 'VoteTW election-context public claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_election_context_relinks relink
        JOIN person_claims claim
          ON claim.person_id = relink.target_person_id
         AND claim.source_name = 'VoteTW'
         AND claim.source_url = relink.source_url
         AND claim.claim_json->'identityMatch'->>'sourceProfileKey' =
             relink.profile_key
        WHERE claim.claim_type = 'external_id'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
    ) <> 21 THEN
        RAISE EXCEPTION 'VoteTW election-context external ID state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _votetw_election_context_decisions;
DROP TABLE _votetw_election_context_claims;
DROP TABLE _verified_non_votetw_claims;
DROP TABLE _votetw_election_context_matches;
DROP TABLE _votetw_election_context_records;
DROP TABLE _votetw_election_context_relinks;

RESET statement_timeout;
