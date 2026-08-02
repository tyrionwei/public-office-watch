-- Run only after all pending data migrations have completed successfully.
-- This keeps exactly the runtime rows used by the production rehearsal.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

CREATE TEMP TABLE _compaction_expected_counts (
    relation_name TEXT PRIMARY KEY,
    retained_rows BIGINT NOT NULL
) ON COMMIT DROP;

INSERT INTO _compaction_expected_counts (relation_name, retained_rows)
VALUES
    (
        'person_claims',
        (
            SELECT COUNT(*)
            FROM public.person_claims
            WHERE is_public = TRUE
              AND visibility = 'public'
              AND review_status = 'verified'
              AND claim_type IN (
                  'education',
                  'experience',
                  'platform',
                  'family_relation',
                  'legal_case',
                  'office'
              )
        )
    ),
    (
        'person_media',
        (
            SELECT COUNT(*)
            FROM public.person_media
            WHERE is_public = TRUE
              AND verification_status = 'verified'
        )
    ),
    (
        'person_company_relations',
        (
            SELECT COUNT(*)
            FROM public.person_company_relations
            WHERE is_public = TRUE
              AND verification_status = 'verified'
        )
    ),
    (
        'person_party_affiliations',
        (
            SELECT COUNT(*)
            FROM public.person_party_affiliations
            WHERE is_public = TRUE
              AND review_status = 'verified'
        )
    ),
    (
        'person_party_events',
        (
            SELECT COUNT(*)
            FROM public.person_party_events
            WHERE is_public = TRUE
              AND review_status = 'verified'
        )
    );

DELETE FROM public.person_claims
WHERE NOT (
    is_public = TRUE
    AND visibility = 'public'
    AND review_status = 'verified'
    AND claim_type IN (
        'education',
        'experience',
        'platform',
        'family_relation',
        'legal_case',
        'office'
    )
);

DELETE FROM public.person_media
WHERE NOT (
    is_public = TRUE
    AND verification_status = 'verified'
);

DELETE FROM public.person_company_relations
WHERE NOT (
    is_public = TRUE
    AND verification_status = 'verified'
);

DELETE FROM public.person_party_affiliations
WHERE NOT (
    is_public = TRUE
    AND review_status = 'verified'
);

DELETE FROM public.person_party_events
WHERE NOT (
    is_public = TRUE
    AND review_status = 'verified'
);

TRUNCATE TABLE
    public.person_identity_matches,
    public.candidate_status_history;

DELETE FROM public.source_people source
WHERE source.source_person_key NOT LIKE 'reviewed-family-relative:%'
  AND NOT EXISTS (
      SELECT 1
      FROM public.person_claims claim
      WHERE claim.source_person_id = source.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.person_party_affiliations affiliation
      WHERE affiliation.source_person_id = source.id
  );

DO $$
DECLARE
    actual_rows BIGINT;
    expected_rows BIGINT;
BEGIN
    SELECT COUNT(*) INTO actual_rows FROM public.person_claims;
    SELECT retained_rows INTO expected_rows
    FROM _compaction_expected_counts WHERE relation_name = 'person_claims';
    IF actual_rows <> expected_rows THEN
        RAISE EXCEPTION 'person_claims retention mismatch: expected %, got %',
            expected_rows, actual_rows;
    END IF;

    SELECT COUNT(*) INTO actual_rows FROM public.person_media;
    SELECT retained_rows INTO expected_rows
    FROM _compaction_expected_counts WHERE relation_name = 'person_media';
    IF actual_rows <> expected_rows THEN
        RAISE EXCEPTION 'person_media retention mismatch: expected %, got %',
            expected_rows, actual_rows;
    END IF;

    SELECT COUNT(*) INTO actual_rows FROM public.person_company_relations;
    SELECT retained_rows INTO expected_rows
    FROM _compaction_expected_counts WHERE relation_name = 'person_company_relations';
    IF actual_rows <> expected_rows THEN
        RAISE EXCEPTION 'person_company_relations retention mismatch: expected %, got %',
            expected_rows, actual_rows;
    END IF;

    SELECT COUNT(*) INTO actual_rows FROM public.person_party_affiliations;
    SELECT retained_rows INTO expected_rows
    FROM _compaction_expected_counts WHERE relation_name = 'person_party_affiliations';
    IF actual_rows <> expected_rows THEN
        RAISE EXCEPTION 'person_party_affiliations retention mismatch: expected %, got %',
            expected_rows, actual_rows;
    END IF;

    SELECT COUNT(*) INTO actual_rows FROM public.person_party_events;
    SELECT retained_rows INTO expected_rows
    FROM _compaction_expected_counts WHERE relation_name = 'person_party_events';
    IF actual_rows <> expected_rows THEN
        RAISE EXCEPTION 'person_party_events retention mismatch: expected %, got %',
            expected_rows, actual_rows;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.source_people source
        WHERE source.source_person_key NOT LIKE 'reviewed-family-relative:%'
          AND NOT EXISTS (
              SELECT 1
              FROM public.person_claims claim
              WHERE claim.source_person_id = source.id
          )
          AND NOT EXISTS (
              SELECT 1
              FROM public.person_party_affiliations affiliation
              WHERE affiliation.source_person_id = source.id
          )
    ) THEN
        RAISE EXCEPTION 'source_people compaction candidates remain';
    END IF;
END
$$;

COMMIT;

-- These rewrites reclaim physical database size. Run during a maintenance window.
VACUUM (FULL, ANALYZE) public.source_people;
VACUUM (FULL, ANALYZE) public.person_claims;
VACUUM (FULL, ANALYZE) public.person_media;
VACUUM (FULL, ANALYZE) public.person_company_relations;
VACUUM (FULL, ANALYZE) public.person_party_affiliations;
VACUUM (FULL, ANALYZE) public.person_party_events;
