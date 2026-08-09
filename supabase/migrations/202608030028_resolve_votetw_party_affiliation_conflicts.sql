SET statement_timeout = 0;

-- Resolve VoteTW party-affiliation conflicts against canonical candidate
-- history. Confirmed former affiliations remain public without replacing the
-- current party. Malformed or stale text is archived, and one unsupported
-- former affiliation remains review-only.
CREATE TEMP TABLE _votetw_party_expected (
    person_name TEXT PRIMARY KEY,
    expected_claim_value TEXT NOT NULL,
    resolved_claim_value TEXT NOT NULL,
    action TEXT NOT NULL CHECK (
        action IN ('publish_historical', 'publish_current', 'archive', 'hold')
    )
) ON COMMIT DROP;

INSERT INTO _votetw_party_expected VALUES
    ('林子丞', '中國國民黨黨', '中國國民黨', 'archive'),
    ('楊石城', '國會政黨聯盟籍（原為民國黨', '國會政黨聯盟', 'archive'),
    ('王淑慧', '民主進步黨', '民主進步黨', 'publish_historical'),
    ('陳科名', '民主進步黨', '民主進步黨', 'publish_historical'),
    ('陳聿琦', '中國國民黨', '中國國民黨', 'hold'),
    ('魏嘉賢', '中國國民黨', '中國國民黨', 'publish_historical'),
    ('黃定和', '中國國民黨', '中國國民黨', 'publish_historical'),
    ('黃淑珍', '司法改革黨黨', '司法改革黨', 'publish_current');

CREATE TEMP TABLE _votetw_party_targets AS
SELECT
    expected.*,
    person.id AS person_id,
    claim.id AS claim_id,
    claim.claim_value AS stored_claim_value
FROM _votetw_party_expected expected
JOIN people person ON person.name = expected.person_name
JOIN person_canonical_map canonical
  ON canonical.person_id = person.id
 AND canonical.canonical_person_id = person.id
JOIN person_claims claim
  ON claim.person_id = person.id
 AND claim.source_name = 'VoteTW'
 AND claim.claim_type = 'party_affiliation'
 AND claim.claim_value IN (
     expected.expected_claim_value,
     expected.resolved_claim_value
 )
 AND claim.claim_json->'identityMatch'->>'matchedBy' =
     'unique_page_profile_with_birth_date'
WHERE claim.review_status IN ('needs_more_evidence', 'verified', 'archived')
  AND claim.scoring_version IN (
      'votetw-public-claims-20260704',
      'votetw-unique-profile-conflict-v1',
      'votetw-existing-local-context-conflict-v1',
      'votetw-existing-multi-context-conflict-v1',
      'votetw-existing-birth-claim-conflict-v1',
      'votetw-relaxed-profile-claim-conflict-v1',
      'votetw-party-history-resolution-v1',
      'votetw-party-stale-text-archive-v1',
      'votetw-party-unsupported-history-hold-v1'
  );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _votetw_party_expected) <> 8
       OR (SELECT COUNT(*) FROM _votetw_party_targets) <> 8
       OR (
           SELECT COUNT(*)
           FROM _votetw_party_targets
           WHERE action IN ('publish_historical', 'publish_current')
       ) <> 5
       OR (
           SELECT COUNT(*)
           FROM _votetw_party_targets
           WHERE action = 'archive'
       ) <> 2
       OR (
           SELECT COUNT(*)
           FROM _votetw_party_targets
           WHERE action = 'hold'
       ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW party review boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _votetw_party_targets target
        WHERE target.action IN ('publish_historical', 'publish_current')
          AND NOT EXISTS (
              SELECT 1
              FROM person_canonical_map member
              JOIN candidates candidate ON candidate.person_id = member.person_id
              WHERE member.canonical_person_id = target.person_id
                AND candidate.is_public = TRUE
                AND candidate.party = target.resolved_claim_value
          )
    ) THEN
        RAISE EXCEPTION 'VoteTW party claim lacks candidate-history evidence';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    claim_value = target.resolved_claim_value,
    confidence_level = 'C',
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    claim_json = claim.claim_json || jsonb_build_object(
        'partyResolution',
        jsonb_build_object(
            'version', 'votetw-party-history-resolution-v1',
            'kind', CASE
                WHEN target.action = 'publish_current'
                    THEN 'current_affiliation'
                ELSE 'historical_affiliation'
            END,
            'resolvedValue', target.resolved_claim_value,
            'reviewedAt', NOW()
        )
    ),
    scoring_version = 'votetw-party-history-resolution-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version = 'votetw-party-history-resolution-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-party-history-resolution-v1',
                    'reason', 'Affiliation is confirmed by a canonical candidate record for the same person',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_party_targets target
WHERE target.action IN ('publish_historical', 'publish_current')
  AND claim.id = target.claim_id
  AND (
      claim.claim_value IS DISTINCT FROM target.resolved_claim_value
      OR claim.review_status IS DISTINCT FROM 'verified'
      OR claim.visibility IS DISTINCT FROM 'public'
      OR claim.is_public IS DISTINCT FROM TRUE
      OR claim.confidence_level IS DISTINCT FROM 'C'
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-party-history-resolution-v1'
  );

UPDATE person_claims claim
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_version = 'votetw-party-stale-text-archive-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version = 'votetw-party-stale-text-archive-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-party-stale-text-archive-v1',
                    'reason', 'Archived malformed or stale profile prose in favor of structured candidate history',
                    'reviewedAt', NOW()
                )
            )
        END,
    auto_reviewed_at = COALESCE(claim.auto_reviewed_at, NOW()),
    updated_at = NOW()
FROM _votetw_party_targets target
WHERE target.action = 'archive'
  AND claim.id = target.claim_id
  AND (
      claim.review_status IS DISTINCT FROM 'archived'
      OR claim.visibility IS DISTINCT FROM 'private'
      OR claim.is_public IS DISTINCT FROM FALSE
      OR claim.scoring_version IS DISTINCT FROM
          'votetw-party-stale-text-archive-v1'
  );

UPDATE person_claims claim
SET
    scoring_version = 'votetw-party-unsupported-history-hold-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        CASE
            WHEN claim.scoring_version =
                 'votetw-party-unsupported-history-hold-v1'
                THEN '[]'::JSONB
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'version', 'votetw-party-unsupported-history-hold-v1',
                    'reason', 'Possible former affiliation has no corroborating candidate record',
                    'reviewedAt', NOW()
                )
            )
        END,
    updated_at = NOW()
FROM _votetw_party_targets target
WHERE target.action = 'hold'
  AND claim.id = target.claim_id
  AND claim.scoring_version IS DISTINCT FROM
      'votetw-party-unsupported-history-hold-v1';

CREATE TEMP TABLE _votetw_current_party_updates (
    person_name TEXT PRIMARY KEY,
    person_id UUID UNIQUE NOT NULL,
    previous_party TEXT NOT NULL,
    current_party TEXT NOT NULL,
    election_year INT NOT NULL
) ON COMMIT DROP;

INSERT INTO _votetw_current_party_updates VALUES
    (
        '黃淑珍',
        '5d5363a4-79c7-4f3d-8721-c34cf3c38e42',
        '無黨籍',
        '司法改革黨',
        2024
    );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _votetw_current_party_updates target
        LEFT JOIN people person ON person.id = target.person_id
        WHERE person.id IS NULL
           OR person.name <> target.person_name
           OR person.party NOT IN (target.previous_party, target.current_party)
           OR NOT EXISTS (
               SELECT 1
               FROM person_canonical_map member
               JOIN candidates candidate ON candidate.person_id = member.person_id
               JOIN races race ON race.id = candidate.race_id
               JOIN elections election ON election.id = race.election_id
               WHERE member.canonical_person_id = target.person_id
                 AND election.year = target.election_year
                 AND candidate.party = target.current_party
                 AND candidate.is_public = TRUE
           )
    ) THEN
        RAISE EXCEPTION 'VoteTW current party update boundary drifted';
    END IF;
END;
$$;

UPDATE people person
SET
    party = target.current_party,
    updated_at = NOW()
FROM _votetw_current_party_updates target
WHERE person.id = target.person_id
  AND person.party IS DISTINCT FROM target.current_party;

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _votetw_party_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE target.action IN ('publish_historical', 'publish_current')
          AND claim.claim_value = target.resolved_claim_value
          AND claim.review_status = 'verified'
          AND claim.visibility = 'public'
          AND claim.is_public = TRUE
          AND claim.confidence_level = 'C'
          AND claim.scoring_version = 'votetw-party-history-resolution-v1'
    ) <> 5 THEN
        RAISE EXCEPTION 'VoteTW published party claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_party_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE target.action = 'archive'
          AND claim.review_status = 'archived'
          AND claim.visibility = 'private'
          AND claim.is_public = FALSE
          AND claim.scoring_version = 'votetw-party-stale-text-archive-v1'
    ) <> 2 THEN
        RAISE EXCEPTION 'VoteTW archived party claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_party_targets target
        JOIN person_claims claim ON claim.id = target.claim_id
        WHERE target.action = 'hold'
          AND claim.review_status = 'needs_more_evidence'
          AND claim.visibility = 'review_only'
          AND claim.is_public = FALSE
          AND claim.scoring_version =
              'votetw-party-unsupported-history-hold-v1'
    ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW held party claim state mismatch';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM _votetw_current_party_updates target
        JOIN people person
          ON person.id = target.person_id
         AND person.party = target.current_party
    ) <> 1 THEN
        RAISE EXCEPTION 'VoteTW current party state mismatch';
    END IF;
END;
$$;

SELECT published.promote(NULL);
