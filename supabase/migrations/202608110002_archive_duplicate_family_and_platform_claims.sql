BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

-- Preserve the exact public relationship/platform projection before
-- archiving. The two multi-URL education groups are intentionally outside
-- this migration.
CREATE TEMP TABLE _family_platform_expected_public_facts
ON COMMIT DROP
AS
SELECT DISTINCT
    canonical.canonical_person_id,
    claim.claim_type,
    claim.claim_value,
    claim.source_name,
    claim.source_url,
    COALESCE(claim.claim_json->>'relationType', '') AS relation_type,
    COALESCE(claim.claim_json->>'relativeQid', '') AS relative_qid,
    COALESCE(
        claim.claim_json->>'platformText',
        claim.claim_value,
        ''
    ) AS platform_text
FROM person_claims claim
JOIN person_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public
  AND (
      (
          claim.claim_type = 'family_relation'
          AND claim.source_name = 'Wikidata 人物補充資料'
          AND claim.claim_json->>'relativeQid' IS NOT NULL
      )
      OR (
          claim.claim_type = 'platform'
          AND canonical.canonical_person_id =
              '96d430bc-ecea-4b20-84da-5a218ca9d157'::UUID
          AND claim.source_name = '臺北市議會：現任議員'
      )
  );

CREATE TEMP TABLE _family_platform_ranked
ON COMMIT DROP
AS
SELECT
    claim.id AS claim_id,
    canonical.canonical_person_id,
    claim.claim_type,
    claim.claim_value,
    claim.source_name,
    claim.source_url,
    COALESCE(claim.claim_json->>'relationType', '') AS relation_type,
    COALESCE(claim.claim_json->>'relativeQid', '') AS relative_qid,
    COALESCE(
        claim.claim_json->>'platformText',
        claim.claim_value,
        ''
    ) AS platform_text,
    ROW_NUMBER() OVER (
        PARTITION BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url,
            COALESCE(claim.claim_json->>'relationType', ''),
            COALESCE(claim.claim_json->>'relativeQid', ''),
            COALESCE(
                claim.claim_json->>'platformText',
                claim.claim_value,
                ''
            )
        ORDER BY
            (claim.claim_json ? 'relativePersonId') DESC,
            (claim.claim_json ? 'identityMatch') DESC,
            (claim.claim_json ? 'reviewDecision') DESC,
            claim.review_score DESC NULLS LAST,
            claim.updated_at DESC,
            claim.id
    ) AS keep_rank,
    COUNT(*) OVER (
        PARTITION BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url,
            COALESCE(claim.claim_json->>'relationType', ''),
            COALESCE(claim.claim_json->>'relativeQid', ''),
            COALESCE(
                claim.claim_json->>'platformText',
                claim.claim_value,
                ''
            )
    ) AS group_size,
    FIRST_VALUE(claim.id) OVER (
        PARTITION BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url,
            COALESCE(claim.claim_json->>'relationType', ''),
            COALESCE(claim.claim_json->>'relativeQid', ''),
            COALESCE(
                claim.claim_json->>'platformText',
                claim.claim_value,
                ''
            )
        ORDER BY
            (claim.claim_json ? 'relativePersonId') DESC,
            (claim.claim_json ? 'identityMatch') DESC,
            (claim.claim_json ? 'reviewDecision') DESC,
            claim.review_score DESC NULLS LAST,
            claim.updated_at DESC,
            claim.id
    ) AS survivor_claim_id
FROM person_claims claim
JOIN person_canonical_map canonical
  ON canonical.person_id = claim.person_id
WHERE claim.review_status = 'verified'
  AND claim.visibility = 'public'
  AND claim.is_public
  AND (
      (
          claim.claim_type = 'family_relation'
          AND claim.source_name = 'Wikidata 人物補充資料'
          AND claim.claim_json->>'relativeQid' IS NOT NULL
      )
      OR (
          claim.claim_type = 'platform'
          AND canonical.canonical_person_id =
              '96d430bc-ecea-4b20-84da-5a218ca9d157'::UUID
          AND claim.source_name = '臺北市議會：現任議員'
      )
  );

CREATE TEMP TABLE _family_platform_archive_targets
ON COMMIT DROP
AS
SELECT *
FROM _family_platform_ranked
WHERE group_size > 1
  AND keep_rank > 1;

ALTER TABLE _family_platform_archive_targets
    ADD PRIMARY KEY (claim_id);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _family_platform_archive_targets) <> 17 THEN
        RAISE EXCEPTION 'Family/platform archive target drifted: expected 17, got %',
            (SELECT COUNT(*) FROM _family_platform_archive_targets);
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _family_platform_ranked
        WHERE group_size > 1
          AND keep_rank = 1
    ) <> 13 THEN
        RAISE EXCEPTION 'Family/platform duplicate partition count drifted';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _family_platform_archive_targets
        WHERE claim_type = 'family_relation'
    ) <> 16
       OR (
        SELECT COUNT(*)
        FROM _family_platform_archive_targets
        WHERE claim_type = 'platform'
    ) <> 1 THEN
        RAISE EXCEPTION 'Family/platform archive type boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _family_platform_archive_targets target
        WHERE target.survivor_claim_id = target.claim_id
           OR (
               target.claim_type = 'family_relation'
               AND (
                   target.relation_type = ''
                   OR target.relative_qid = ''
               )
           )
    ) THEN
        RAISE EXCEPTION 'Family/platform archive contains an unsafe row';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'canonical-family-platform-dedup-archive-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'canonical-family-platform-dedup-archive-v1',
                'reason', 'Archived duplicate public family relation or platform claim while retaining the same canonical fact and source',
                'survivorClaimId', target.survivor_claim_id,
                'reviewedAt', NOW()
            )
        ),
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _family_platform_archive_targets target
WHERE claim.id = target.claim_id;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _family_platform_archive_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND NOT claim.is_public
          AND claim.scoring_version =
              'canonical-family-platform-dedup-archive-v1'
    ) <> 17 THEN
        RAISE EXCEPTION 'Family/platform archive state mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _family_platform_archive_targets target
        JOIN person_claims survivor
          ON survivor.id = target.survivor_claim_id
        WHERE survivor.review_status <> 'verified'
           OR survivor.visibility <> 'public'
           OR NOT survivor.is_public
    ) THEN
        RAISE EXCEPTION 'Family/platform survivor was not retained publicly';
    END IF;

    IF EXISTS (
        (
            SELECT *
            FROM _family_platform_expected_public_facts
            EXCEPT
            SELECT DISTINCT
                canonical.canonical_person_id,
                claim.claim_type,
                claim.claim_value,
                claim.source_name,
                claim.source_url,
                COALESCE(claim.claim_json->>'relationType', ''),
                COALESCE(claim.claim_json->>'relativeQid', ''),
                COALESCE(
                    claim.claim_json->>'platformText',
                    claim.claim_value,
                    ''
                )
            FROM person_claims claim
            JOIN person_canonical_map canonical
              ON canonical.person_id = claim.person_id
            WHERE claim.review_status = 'verified'
              AND claim.visibility = 'public'
              AND claim.is_public
              AND (
                  (
                      claim.claim_type = 'family_relation'
                      AND claim.source_name = 'Wikidata 人物補充資料'
                      AND claim.claim_json->>'relativeQid' IS NOT NULL
                  )
                  OR (
                      claim.claim_type = 'platform'
                      AND canonical.canonical_person_id =
                          '96d430bc-ecea-4b20-84da-5a218ca9d157'::UUID
                      AND claim.source_name = '臺北市議會：現任議員'
                  )
              )
        )

        UNION ALL

        (
            SELECT DISTINCT
                canonical.canonical_person_id,
                claim.claim_type,
                claim.claim_value,
                claim.source_name,
                claim.source_url,
                COALESCE(claim.claim_json->>'relationType', ''),
                COALESCE(claim.claim_json->>'relativeQid', ''),
                COALESCE(
                    claim.claim_json->>'platformText',
                    claim.claim_value,
                    ''
                )
            FROM person_claims claim
            JOIN person_canonical_map canonical
              ON canonical.person_id = claim.person_id
            WHERE claim.review_status = 'verified'
              AND claim.visibility = 'public'
              AND claim.is_public
              AND (
                  (
                      claim.claim_type = 'family_relation'
                      AND claim.source_name = 'Wikidata 人物補充資料'
                      AND claim.claim_json->>'relativeQid' IS NOT NULL
                  )
                  OR (
                      claim.claim_type = 'platform'
                      AND canonical.canonical_person_id =
                          '96d430bc-ecea-4b20-84da-5a218ca9d157'::UUID
                      AND claim.source_name = '臺北市議會：現任議員'
                  )
              )
            EXCEPT
            SELECT *
            FROM _family_platform_expected_public_facts
        )
    ) THEN
        RAISE EXCEPTION 'Public family/platform fact projection changed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_claims claim
        JOIN person_canonical_map canonical
          ON canonical.person_id = claim.person_id
        WHERE claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public
          AND (
              (
                  claim.claim_type = 'family_relation'
                  AND claim.source_name = 'Wikidata 人物補充資料'
                  AND claim.claim_json->>'relativeQid' IS NOT NULL
              )
              OR (
                  claim.claim_type = 'platform'
                  AND canonical.canonical_person_id =
                      '96d430bc-ecea-4b20-84da-5a218ca9d157'::UUID
                  AND claim.source_name = '臺北市議會：現任議員'
              )
          )
        GROUP BY
            canonical.canonical_person_id,
            claim.claim_type,
            claim.claim_value,
            claim.source_name,
            claim.source_url,
            COALESCE(claim.claim_json->>'relationType', ''),
            COALESCE(claim.claim_json->>'relativeQid', ''),
            COALESCE(
                claim.claim_json->>'platformText',
                claim.claim_value,
                ''
            )
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate family/platform claims remain';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM (
            SELECT
                canonical.canonical_person_id,
                claim.claim_type,
                claim.claim_value,
                claim.source_name
            FROM person_claims claim
            JOIN person_canonical_map canonical
              ON canonical.person_id = claim.person_id
            WHERE claim.review_status = 'verified'
              AND claim.visibility = 'public'
              AND claim.is_public
              AND claim.claim_type IN (
                  'education',
                  'experience',
                  'platform',
                  'family_relation',
                  'legal_case',
                  'office'
              )
            GROUP BY 1, 2, 3, 4
            HAVING COUNT(*) > 1
        ) remaining_semantic_duplicates
    ) <> 2 THEN
        RAISE EXCEPTION 'Unexpected rich-claim duplicate groups remain';
    END IF;
END;
$$;

COMMIT;
