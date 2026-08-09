SET statement_timeout = 0;

-- Resolve VoteTW education conflicts when a context-confirmed 2020/2022
-- election record reports the same or a higher education level than the
-- current profile. Lower reported levels remain review-only because a later
-- candidacy can omit, but cannot disprove, an earlier higher qualification.
CREATE FUNCTION pg_temp._votetw_education_rank(value TEXT)
RETURNS INT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURN CASE REPLACE(TRIM(COALESCE(value, '')), '學歷', '')
    WHEN '高中(職)以下' THEN 1
    WHEN '高中(職)' THEN 2
    WHEN '專科' THEN 3
    WHEN '大學' THEN 4
    WHEN '碩士' THEN 5
    ELSE 0
END;

CREATE TEMP TABLE _votetw_education_expected (
    person_name TEXT PRIMARY KEY,
    current_education TEXT NOT NULL,
    source_education TEXT NOT NULL,
    election_year INT NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_education_expected VALUES
    ('劉文富', '高中(職)以下', '高中(職)', 2022),
    ('吳淑敏', '大學', '碩士', 2022),
    ('張昭隆', '高中(職)', '大學', 2022),
    ('李克焜', '高中(職)', '專科', 2020),
    ('李武雄', '高中(職)以下', '高中(職)', 2022),
    ('李永和', '高中(職)', '大學', 2022),
    ('林國賢', '高中(職)以下', '高中(職)', 2022),
    ('林志堅', '碩士', '大學', 2022),
    ('林文傑', '高中(職)以下', '高中(職)', 2022),
    ('林文隆', '大學', '專科', 2022),
    ('楊添發', '其他', '高中(職)以下', 2022),
    ('楊清雄', '其他', '高中(職)以下', 2022),
    ('歐金獅', '專科', '大學', 2022),
    ('洪明輝', '高中(職)', '高中(職)以下', 2022),
    ('游振輝', '高中(職)以下', '高中(職)', 2022),
    ('王國棟', '專科', '碩士', 2022),
    ('王麗雯', '大學', '碩士', 2022),
    ('胡志明', '其他', '高中(職)以下', 2022),
    ('葉淑玲', '專科', '高中(職)', 2022),
    ('蔡東海', '專科', '碩士', 2022),
    ('邱世昌', '高中(職)', '大學', 2022),
    ('邱華國', '高中(職)', '專科', 2022),
    ('陳月嬌', '其他', '高中(職)以下', 2022),
    ('陳松明', '高中(職)', '高中(職)以下', 2022),
    ('陳淑玲', '高中(職)', '碩士', 2022),
    ('陳瑞基', '大學', '碩士', 2022),
    ('陳義男', '高中(職)以下', '高中(職)', 2022),
    ('陳貴美', '其他', '高中(職)以下', 2022),
    ('黃國華', '高中(職)以下', '高中(職)', 2022),
    ('黃奇鋒', '高中(職)以下', '專科', 2022),
    ('黃振榮', '大學', '專科', 2022),
    ('黃文龍', '其他', '高中(職)以下', 2022),
    ('黃美玉', '高中(職)', '碩士', 2022),
    ('黃聰明', '專科', '高中(職)', 2022),
    ('黃雅玲', '高中(職)', '大學', 2022);

CREATE TEMP TABLE _votetw_education_targets AS
SELECT
    expected.*,
    person.id AS person_id,
    claim.id AS claim_id,
    claim.source_url,
    claim.claim_json->'identityMatch'->>'sourceProfileKey' AS profile_key,
    CASE
        WHEN pg_temp._votetw_education_rank(expected.source_education) >=
             pg_temp._votetw_education_rank(expected.current_education)
            THEN 'publish_progression'
        ELSE 'hold_regression'
    END AS action
FROM _votetw_education_expected expected
JOIN people person ON person.name = expected.person_name
JOIN person_canonical_map canonical
  ON canonical.person_id = person.id
 AND canonical.canonical_person_id = person.id
JOIN person_claims claim
  ON claim.person_id = person.id
 AND claim.source_name = 'VoteTW'
 AND claim.claim_type = 'education'
 AND REPLACE(TRIM(claim.claim_value), '學歷', '') =
     expected.source_education
 AND claim.claim_json->'identityMatch'->>'matchedBy' =
     'unique_page_profile_with_birth_date'
WHERE claim.review_status IN ('needs_more_evidence', 'verified')
  AND claim.scoring_version IN (
      'votetw-public-claims-20260704',
      'votetw-unique-profile-conflict-v1',
      'votetw-existing-local-context-conflict-v1',
      'votetw-local-context-claim-conflict-v1',
      'votetw-single-election-claim-conflict-v1',
      'votetw-relaxed-profile-claim-conflict-v1',
      'votetw-election-education-progression-v1',
      'votetw-election-education-regression-hold-v1'
  );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_education_expected) <> 35
       OR (SELECT COUNT(*) FROM _votetw_education_targets) <> 35
       OR (
           SELECT COUNT(*)
           FROM _votetw_education_targets
           WHERE action = 'publish_progression'
       ) <> 28
       OR (
           SELECT COUNT(*)
           FROM _votetw_education_targets
           WHERE action = 'hold_regression'
       ) <> 7 THEN
        RAISE EXCEPTION 'VoteTW education review boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_education_targets target
        JOIN people person ON person.id = target.person_id
        WHERE person.education NOT IN (
            target.current_education,
            target.source_education
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW education core value drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_education_targets target
        WHERE NOT EXISTS (
            SELECT 1
            FROM person_claims external
            CROSS JOIN LATERAL jsonb_array_elements(
                COALESCE(external.claim_json->'electionRecords', '[]'::JSONB)
            ) record
            WHERE external.source_name = 'VoteTW'
              AND external.claim_type = 'external_id'
              AND external.source_url = target.source_url
              AND external.claim_json->'identityMatch'->>'sourceProfileKey' =
                  target.profile_key
              AND record.value->>'education' = target.source_education
              AND SUBSTRING(record.value->>'election' FROM 1 FOR 4)::INT =
                  target.election_year
        )
    ) THEN
        RAISE EXCEPTION 'VoteTW education election evidence drifted';
    END IF;
END;
$$;

UPDATE people person
SET
    education = target.source_education,
    updated_at = NOW()
FROM _votetw_education_targets target
WHERE target.action = 'publish_progression'
  AND person.id = target.person_id
  AND person.education IS DISTINCT FROM target.source_education;

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    claim_json = claim.claim_json || jsonb_build_object(
        'educationResolution',
        jsonb_build_object(
            'version', 'votetw-election-education-progression-v1',
            'electionYear', target.election_year,
            'previousCoreValue', target.current_education,
            'resolvedValue', target.source_education,
            'reviewedAt', NOW()
        )
    ),
    scoring_version = 'votetw-election-education-progression-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-election-education-progression-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-election-education-progression-v1',
                    'reason', 'Context-confirmed newer election record reports the same or a higher education level',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_education_targets target
WHERE target.action = 'publish_progression'
  AND claim.id = target.claim_id
  AND (
      claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-election-education-progression-v1'
  );

UPDATE person_claims claim
SET
    scoring_version = 'votetw-election-education-regression-hold-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-election-education-regression-hold-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-election-education-regression-hold-v1',
                    'reason', 'Later election record reports a lower level and cannot disprove the existing higher qualification',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_education_targets target
WHERE target.action = 'hold_regression'
  AND claim.id = target.claim_id
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-election-education-regression-hold-v1';

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_education_targets target
        JOIN people person ON person.id = target.person_id
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE target.action = 'publish_progression'
          AND person.education = target.source_education
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version =
              'votetw-election-education-progression-v1'
    ) <> 28 THEN
        RAISE EXCEPTION 'VoteTW education progression state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_education_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE target.action = 'hold_regression'
          AND claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-election-education-regression-hold-v1'
    ) <> 7 THEN
        RAISE EXCEPTION 'VoteTW education regression hold state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);
