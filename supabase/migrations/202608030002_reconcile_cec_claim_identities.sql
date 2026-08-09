SET statement_timeout = 0;

-- Two 2018 CEC source-scoped people escaped the earlier merge because their
-- names use uncommon compatibility ideographs. Their election, race, party,
-- candidate number, and result all match the established public identities.
CREATE TEMP TABLE _cec_compatibility_ideograph_merges (
    duplicate_external_id TEXT PRIMARY KEY,
    canonical_external_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    evidence JSONB NOT NULL
);

INSERT INTO _cec_compatibility_ideograph_merges (
    duplicate_external_id,
    canonical_external_id,
    display_name,
    evidence
) VALUES
    (
        'cec-historical-person-e0620c139630f3b5',
        'votetw-person-a8600ebfa86dd5ac',
        '𡍼夢龍',
        '{"electionYear":2018,"race":"新竹市第4選舉區議員選舉","party":"中國國民黨","candidateNumber":"15","normalizedName":"塗夢龍"}'::JSONB
    ),
    (
        'cec-historical-person-a0b0e3a41d24318a',
        'votetw-person-5a38504f4dc89f8e',
        '歐中慨',
        '{"electionYear":2018,"race":"澎湖縣第1選舉區議員選舉","party":"無黨籍","candidateNumber":"22","normalizedName":"歐中慨"}'::JSONB
    );

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _cec_compatibility_ideograph_merges input
        JOIN people duplicate ON duplicate.external_id = input.duplicate_external_id
        JOIN people canonical ON canonical.external_id = input.canonical_external_id
        WHERE duplicate.id <> canonical.id
          AND duplicate.is_public IS FALSE
          AND canonical.is_public IS TRUE
    ) <> 2 THEN
        RAISE EXCEPTION 'CEC compatibility ideograph identity input mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _cec_compatibility_ideograph_merges input
        JOIN people duplicate ON duplicate.external_id = input.duplicate_external_id
        JOIN people canonical ON canonical.external_id = input.canonical_external_id
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = duplicate.id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> canonical.id
    ) THEN
        RAISE EXCEPTION 'CEC compatibility ideograph identity gained a conflicting merge decision';
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
    duplicate.id,
    canonical.id,
    'verified',
    'A',
    CONCAT(
        input.display_name,
        '：CEC 2018 候選人的異體字姓名與既有人物在選舉、選區、黨籍及候選號次完全一致。'
    ),
    jsonb_build_object(
        'version', 'cec-compatibility-ideograph-merge-v1',
        'observedDate', '2026-08-03',
        'evidence', input.evidence
    ),
    'system:cec-compatibility-ideograph-merge-v1',
    NOW(),
    NOW()
FROM _cec_compatibility_ideograph_merges input
JOIN people duplicate ON duplicate.external_id = input.duplicate_external_id
JOIN people canonical ON canonical.external_id = input.canonical_external_id
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = duplicate.id
      AND existing.status IN ('suggested', 'verified')
);

SELECT published.promote(NULL);

-- Historical CEC source rows may be imported before their canonical people are
-- created or merged. Re-resolve those source identities before reviewing the
-- six low-sensitivity identity fields emitted by the importer.
CREATE TEMP TABLE _cec_claim_identity_resolution AS
SELECT
    source.id AS source_person_id,
    (MIN(COALESCE(canonical.canonical_person_id, identity_match.person_id)::TEXT))::UUID AS person_id
FROM source_people source
JOIN person_identity_matches identity_match
  ON identity_match.source_person_id = source.id
 AND identity_match.match_status = 'auto_matched'
LEFT JOIN person_canonical_map canonical
  ON canonical.person_id = identity_match.person_id
JOIN people person
  ON person.id = COALESCE(canonical.canonical_person_id, identity_match.person_id)
 AND person.is_public = TRUE
WHERE source.source_type = 'official_election'
  AND source.source_id = 'cec-2024-votedata'
GROUP BY source.id
HAVING COUNT(DISTINCT COALESCE(canonical.canonical_person_id, identity_match.person_id)) = 1;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM person_claims claim
        JOIN source_people source ON source.id = claim.source_person_id
        LEFT JOIN _cec_claim_identity_resolution resolved
          ON resolved.source_person_id = source.id
        WHERE claim.person_id IS NULL
          AND claim.review_status IN ('pending', 'needs_more_evidence')
          AND claim.source_name = '中央選舉委員會選舉資料庫：公開資料包'
          AND claim.claim_type IN ('name', 'gender', 'party', 'position', 'district', 'external_id')
          AND source.source_type = 'official_election'
          AND source.source_id = 'cec-2024-votedata'
          AND resolved.source_person_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'CEC review claims remain without one public canonical identity';
    END IF;
END;
$$;

UPDATE person_claims claim
SET
    person_id = resolved.person_id,
    review_status = 'verified',
    visibility = 'public',
    is_public = TRUE,
    scoring_version = 'official-cec-identity-rematch-v1',
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) || jsonb_build_array(
        jsonb_build_object(
            'version', 'official-cec-identity-rematch-v1',
            'reason', 'official CEC low-sensitivity identity field approved after one canonical person match',
            'reviewedAt', NOW()
        )
    ),
    auto_reviewed_at = NOW(),
    updated_at = NOW()
FROM _cec_claim_identity_resolution resolved
WHERE claim.source_person_id = resolved.source_person_id
  AND claim.person_id IS NULL
  AND claim.review_status IN ('pending', 'needs_more_evidence')
  AND claim.source_name = '中央選舉委員會選舉資料庫：公開資料包'
  AND claim.claim_type IN ('name', 'gender', 'party', 'position', 'district', 'external_id');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM person_claims claim
        JOIN source_people source ON source.id = claim.source_person_id
        WHERE claim.person_id IS NULL
          AND claim.review_status IN ('pending', 'needs_more_evidence')
          AND claim.source_name = '中央選舉委員會選舉資料庫：公開資料包'
          AND claim.claim_type IN ('name', 'gender', 'party', 'position', 'district', 'external_id')
          AND source.source_type = 'official_election'
          AND source.source_id = 'cec-2024-votedata'
    ) THEN
        RAISE EXCEPTION 'CEC low-sensitivity claims remain unresolved after rematching';
    END IF;
END;
$$;

-- Pending content claims can retain a pre-merge person id even after identity
-- review has selected a canonical person. Move only the identity link; keep the
-- existing evidence status, confidence, and visibility unchanged.
UPDATE person_claims claim
SET
    person_id = canonical_map.canonical_person_id,
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) || jsonb_build_array(
        jsonb_build_object(
            'version', 'canonical-person-rematch-v1',
            'reason', 'pending claim relinked after a verified person merge',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
FROM person_canonical_map canonical_map
JOIN people canonical
  ON canonical.id = canonical_map.canonical_person_id
 AND canonical.is_public = TRUE
WHERE claim.person_id = canonical_map.person_id
  AND claim.person_id <> canonical_map.canonical_person_id
  AND claim.review_status IN ('pending', 'needs_more_evidence');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM person_claims claim
        JOIN person_canonical_map canonical_map
          ON canonical_map.person_id = claim.person_id
        WHERE claim.person_id <> canonical_map.canonical_person_id
          AND claim.review_status IN ('pending', 'needs_more_evidence')
    ) THEN
        RAISE EXCEPTION 'Pending claims remain linked to non-canonical people';
    END IF;
END;
$$;

SELECT published.promote(NULL);

DROP TABLE _cec_claim_identity_resolution;
DROP TABLE _cec_compatibility_ideograph_merges;

RESET statement_timeout;
