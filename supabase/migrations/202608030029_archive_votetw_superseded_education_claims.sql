SET statement_timeout = 0;

-- A later election form can report a broader or lower education category
-- without disproving the person's existing higher qualification. Keep those
-- source election records for audit, consolidate the already-confirmed higher
-- value onto the canonical row, and archive the lower standalone claims.
CREATE TEMP TABLE _votetw_superseded_education_expected (
    person_name TEXT PRIMARY KEY,
    current_education TEXT NOT NULL,
    source_education TEXT NOT NULL,
    election_year INT NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_superseded_education_expected VALUES
    ('林志堅', '碩士', '大學', 2022),
    ('林文隆', '大學', '專科', 2022),
    ('洪明輝', '高中(職)', '高中(職)以下', 2022),
    ('葉淑玲', '專科', '高中(職)', 2022),
    ('陳松明', '高中(職)', '高中(職)以下', 2022),
    ('黃振榮', '大學', '專科', 2022),
    ('黃聰明', '專科', '高中(職)', 2022);

CREATE TEMP TABLE _votetw_superseded_education_targets AS
SELECT
    expected.*,
    person.id AS person_id,
    claim.id AS claim_id
FROM _votetw_superseded_education_expected expected
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
 AND claim.scoring_version IN (
     'votetw-election-education-regression-hold-v1',
     'votetw-election-education-superseded-archive-v1'
 )
WHERE EXISTS (
    SELECT 1
    FROM person_canonical_map member_map
    JOIN people member ON member.id = member_map.person_id
    WHERE member_map.canonical_person_id = person.id
      AND member.education = expected.current_education
);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_superseded_education_expected) <> 7
       OR (SELECT COUNT(*) FROM _votetw_superseded_education_targets) <> 7
       OR EXISTS (
           SELECT 1
           FROM _votetw_superseded_education_targets target
           JOIN people person ON person.id = target.person_id
           WHERE person.education IS NOT NULL
             AND person.education <> target.current_education
       )
       OR EXISTS (
           SELECT 1
           FROM _votetw_superseded_education_targets target
           WHERE NOT EXISTS (
               SELECT 1
               FROM person_claims external
               CROSS JOIN LATERAL jsonb_array_elements(
                   COALESCE(
                       external.claim_json->'electionRecords',
                       '[]'::JSONB
                   )
               ) record
               WHERE external.source_name = 'VoteTW'
                 AND external.claim_type = 'external_id'
                 AND external.source_url = (
                     SELECT claim.source_url
                     FROM person_claims claim
                     WHERE claim.id = target.claim_id
                 )
                 AND record.value->>'education' = target.source_education
                 AND SUBSTRING(
                     record.value->>'election' FROM 1 FOR 4
                 )::INT = target.election_year
           )
       ) THEN
        RAISE EXCEPTION 'VoteTW superseded education boundary drifted';
    END IF;
END;
$$;

UPDATE people person
SET
    education = target.current_education,
    updated_at = NOW()
FROM _votetw_superseded_education_targets target
WHERE person.id = target.person_id
  AND person.education IS DISTINCT FROM target.current_education;

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-election-education-superseded-archive-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-election-education-superseded-archive-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version',
                    'votetw-election-education-superseded-archive-v1',
                    'reason',
                    'Archived lower later-election category while retaining the higher canonical qualification and source election record',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_superseded_education_targets target
WHERE claim.id = target.claim_id
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-election-education-superseded-archive-v1'
  );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_superseded_education_targets target
        JOIN people person ON person.id = target.person_id
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE person.education = target.current_education
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-election-education-superseded-archive-v1'
    ) <> 7 THEN
        RAISE EXCEPTION 'VoteTW superseded education state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);
