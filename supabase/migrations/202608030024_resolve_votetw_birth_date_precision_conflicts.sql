SET statement_timeout = 0;

-- Resolve VoteTW birth-date holds caused by lower-precision or incorrect
-- imported values. Ten January 1 Wikidata values only carried year precision;
-- two other Wikidata dates conflict with corroborated election-history data.
-- The remaining CEC claim contained a local ROC-year transcription error.
CREATE TEMP TABLE _votetw_birth_resolutions (
    person_id UUID PRIMARY KEY,
    person_name TEXT NOT NULL,
    correct_birth_date TEXT NOT NULL,
    votetw_action TEXT NOT NULL CHECK (
        votetw_action IN ('publish_c', 'archive_exact_official')
    )
) ON COMMIT DROP;

INSERT INTO _votetw_birth_resolutions VALUES
    ('63e51128-7f40-4131-859b-ac8bea108ce5', '劉哲彰', '1972-07-07', 'publish_c'),
    ('c6723696-38e2-457e-9880-dbebe7eea0c8', '周玉琴', '1958-05-14', 'publish_c'),
    ('9032a782-985c-4bc9-ad5e-cb1805bf1833', '張耿輝', '1961-06-24', 'publish_c'),
    ('ec752500-b11b-4814-8817-5d82ae991de8', '彭盛韶', '1984-05-11', 'publish_c'),
    ('fe9169ae-7876-4554-a7f9-ae336118bd88', '曾煥嘉', '1976-09-10', 'publish_c'),
    ('606a472e-47b8-4c1c-8a45-7a89a3c462a2', '林詩穎', '1982-06-17', 'archive_exact_official'),
    ('362fd43a-5384-432f-9f88-1f45c15e9848', '楊秀玉', '1967-09-17', 'publish_c'),
    ('bc670a37-1175-4d6a-853c-a1f430840455', '白珮茹', '1975-05-17', 'publish_c'),
    ('64a83ca4-c4dc-4d53-87e0-68afb5450b89', '簡慈坊', '1981-07-12', 'publish_c'),
    ('e503a5cb-0d94-4e7e-81b3-b3d54266041e', '蔡健棠', '1963-01-19', 'publish_c'),
    ('d532121c-8c1b-47a8-bffb-ec53feba008a', '鍾宏仁', '1957-09-25', 'publish_c'),
    ('97b0bded-52fa-4fce-8647-d6bb6ff65594', '陳志峰', '1965-07-28', 'publish_c'),
    ('4458b34f-03f1-4c72-a76c-1f84f0b6ad2e', '黃俊哲', '1978-04-27', 'publish_c');

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_birth_resolutions) <> 13
       OR EXISTS (
           SELECT 1
           FROM _votetw_birth_resolutions resolution
           LEFT JOIN people person ON person.id = resolution.person_id
           WHERE person.id IS NULL OR person.name <> resolution.person_name
       ) THEN
        RAISE EXCEPTION 'VoteTW birth-date resolution boundary drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_birth_resolutions resolution
        JOIN person_claims claim
          ON claim.person_id = resolution.person_id
         AND claim.source_name = 'VoteTW'
         AND claim.claim_type = 'birth_date'
         AND claim.claim_value = resolution.correct_birth_date
         AND claim.claim_json->'identityResolution'->>'version' =
             'votetw-unique-birth-candidate-anchor-v1'
    ) <> 13 THEN
        RAISE EXCEPTION 'VoteTW birth-date source boundary drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_birth_resolutions resolution
        JOIN person_claims claim
          ON claim.person_id = resolution.person_id
         AND claim.source_name = 'Wikidata 人物補充資料'
         AND claim.claim_type = 'birth_date'
         AND claim.claim_value <> resolution.correct_birth_date
        WHERE resolution.votetw_action = 'publish_c'
    ) <> 12 THEN
        RAISE EXCEPTION 'Competing Wikidata birth-date boundary drifted';
    END IF;
END;
$$;

-- CEC registration data gives ROC year 71 (1982), not 1983.
UPDATE source_people
SET
    source_payload = jsonb_set(
        source_payload,
        '{birthDate}',
        to_jsonb('1982-06-17'::TEXT)
    ),
    updated_at = NOW()
WHERE source_person_key =
    'official-election:2022:councilor:ilcc-current-councilor-lin-shih-ying'
  AND source_payload->>'birthDate' IS DISTINCT FROM '1982-06-17';

UPDATE person_claims
SET
    claim_value = '1982-06-17',
    claim_json = jsonb_set(
        claim_json,
        '{birthDate}',
        to_jsonb('1982-06-17'::TEXT)
    ),
    scoring_version = 'official-birth-date-correction-v1',
    scoring_reasons = COALESCE(scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN scoring_version = 'official-birth-date-correction-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'official-birth-date-correction-v1',
                    'reason', 'Corrected ROC year 71 to Gregorian year 1982',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
WHERE claim_key =
    'official-election:2022:councilor:ilcc-current-councilor-lin-shih-ying:birth_date'
  AND (
      claim_value IS DISTINCT FROM '1982-06-17'
      OR claim_json->>'birthDate' IS DISTINCT FROM '1982-06-17'
      OR scoring_version IS DISTINCT FROM 'official-birth-date-correction-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-birth-date-conflict-resolution-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-birth-date-conflict-resolution-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-birth-date-conflict-resolution-v1',
                    'reason', CASE
                        WHEN claim.claim_value LIKE '%-01-01'
                            THEN 'Archived lower-precision year-only Wikidata value after exact candidate-history match'
                        ELSE 'Archived conflicting Wikidata value after corroborated candidate-history review'
                    END,
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_birth_resolutions resolution
WHERE resolution.votetw_action = 'publish_c'
  AND claim.person_id = resolution.person_id
  AND claim.source_name = 'Wikidata 人物補充資料'
  AND claim.claim_type = 'birth_date'
  AND claim.claim_value <> resolution.correct_birth_date
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-birth-date-conflict-resolution-v1'
  );

UPDATE person_claims claim
SET
    confidence_level = 'C',
    review_status = CASE
        WHEN resolution.votetw_action = 'publish_c' THEN 'verified'
        ELSE 'archived'
    END,
    visibility = CASE
        WHEN resolution.votetw_action = 'publish_c' THEN 'public'
        ELSE 'private'
    END,
    is_public = resolution.votetw_action = 'publish_c',
    scoring_version = 'votetw-birth-date-conflict-resolution-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-birth-date-conflict-resolution-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-birth-date-conflict-resolution-v1',
                    'reason', CASE
                        WHEN resolution.votetw_action = 'publish_c'
                            THEN 'Published exact VoteTW date after candidate-history and conflicting-source review'
                        ELSE 'Archived because corrected A-level official claim now has the same exact date'
                    END,
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_birth_resolutions resolution
WHERE claim.person_id = resolution.person_id
  AND claim.source_name = 'VoteTW'
  AND claim.claim_type = 'birth_date'
  AND claim.claim_value = resolution.correct_birth_date
  AND (
      claim.review_status IS DISTINCT FROM CASE
          WHEN resolution.votetw_action = 'publish_c' THEN 'verified'
          ELSE 'archived'
      END
      OR claim.visibility IS DISTINCT FROM CASE
          WHEN resolution.votetw_action = 'publish_c' THEN 'public'
          ELSE 'private'
      END
      OR claim.is_public IS DISTINCT FROM
          (resolution.votetw_action = 'publish_c')
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-birth-date-conflict-resolution-v1'
  );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_birth_resolutions resolution
        JOIN person_claims claim
          ON claim.person_id = resolution.person_id
         AND claim.source_name = 'VoteTW'
         AND claim.claim_type = 'birth_date'
         AND claim.claim_value = resolution.correct_birth_date
         AND claim.confidence_level = 'C'
         AND claim.scoring_version =
             'votetw-birth-date-conflict-resolution-v1'
        WHERE (
            resolution.votetw_action = 'publish_c'
            AND claim.review_status = 'verified'
            AND claim.visibility = 'public'
            AND claim.is_public = TRUE
        ) OR (
            resolution.votetw_action = 'archive_exact_official'
            AND claim.review_status = 'archived'
            AND claim.visibility = 'private'
            AND claim.is_public = FALSE
        )
    ) <> 13 THEN
        RAISE EXCEPTION 'VoteTW birth-date final state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_birth_resolutions resolution
        JOIN person_claims claim
          ON claim.person_id = resolution.person_id
         AND claim.source_name LIKE 'Wikidata%'
         AND claim.claim_type = 'birth_date'
        WHERE resolution.votetw_action = 'publish_c'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
    ) <> 12 THEN
        RAISE EXCEPTION 'Competing Wikidata birth-date archive mismatch';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM person_claims
        WHERE claim_key =
            'official-election:2022:councilor:ilcc-current-councilor-lin-shih-ying:birth_date'
          AND claim_value = '1982-06-17'
          AND confidence_level = 'A'
          AND review_status = 'verified'
          AND visibility = 'public'
          AND is_public = TRUE
    ) THEN
        RAISE EXCEPTION 'Corrected official Lin Shih-ying birth claim missing';
    END IF;
END;
$$;

SELECT published.promote(NULL);
