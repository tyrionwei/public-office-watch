SET statement_timeout = 0;

-- Four current official profiles use spacing, middle-dot or Han-character
-- variants of their CEC names. These are explicit reviewed aliases, not a new
-- global fuzzy-name rule. Two of the same reviews also close recent cross-year
-- canonical splits exposed by the official profile comparison.
CREATE TEMP TABLE _reviewed_recent_variant_merges (
    canonical_person_id UUID PRIMARY KEY,
    duplicate_person_id UUID UNIQUE NOT NULL,
    canonical_name TEXT NOT NULL,
    duplicate_name TEXT NOT NULL,
    evidence_url TEXT NOT NULL,
    reason TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_recent_variant_merges VALUES
    (
        '9d8e00d6-5386-4449-86e4-9c5c938c561a',
        '958a3993-860a-9e04-4204-abec67d46462',
        '宋雨蓁 Nikar．Falong',
        '宋雨蓁Nikar．Falong',
        'https://web.cec.gov.tw/api/file/a3831f58-b730-4a71-81b4-c8681942bb6e.pdf',
        'CEC records confirm the same New Taipei plain-indigenous council candidate across the 2018 and 2022 name-spacing variants.'
    ),
    (
        'efb22f04-6b63-47a4-8e8d-5816bd129496',
        '52b6adb4-38c5-4615-b2c2-4d149ae5c163',
        '王啓澧',
        '王啓澧',
        'https://web.cec.gov.tw/api/file/baf6e926-0ea9-4cc0-b513-0fdabb3e7b7c.pdf',
        'CEC records and the official current profile confirm the 2020 Chiayi County legislator candidate and 2022 county councilor are the same person.'
    );

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_recent_variant_merges) <> 2
       OR EXISTS (
           SELECT 1
           FROM _reviewed_recent_variant_merges input
           JOIN people canonical ON canonical.id = input.canonical_person_id
           JOIN people duplicate ON duplicate.id = input.duplicate_person_id
           WHERE canonical.name <> input.canonical_name
              OR duplicate.name <> input.duplicate_name
              OR canonical.is_public <> TRUE
              OR duplicate.is_public <> TRUE
              OR canonical.id = duplicate.id
       )
       OR EXISTS (
           SELECT 1
           FROM _reviewed_recent_variant_merges input
           JOIN person_merge_decisions existing
             ON existing.duplicate_person_id = input.duplicate_person_id
            AND existing.status IN ('suggested', 'verified')
           WHERE existing.canonical_person_id <> input.canonical_person_id
       ) THEN
        RAISE EXCEPTION 'Reviewed recent name-variant merge boundary drifted';
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
    input.duplicate_person_id,
    input.canonical_person_id,
    'verified',
    'A',
    input.reason,
    jsonb_build_object(
        'version', 'reviewed-recent-official-name-variants-v1',
        'canonicalName', input.canonical_name,
        'duplicateName', input.duplicate_name,
        'evidenceKind', 'official_election_record',
        'evidenceUrl', input.evidence_url
    ),
    'system:reviewed-recent-official-name-variants-v1',
    NOW(),
    NOW()
FROM _reviewed_recent_variant_merges input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = input.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);

UPDATE person_claims claim
SET
    person_id = input.canonical_person_id,
    scoring_reasons = COALESCE(claim.scoring_reasons, '[]'::JSONB) ||
        jsonb_build_array(
            jsonb_build_object(
                'version', 'reviewed-recent-official-name-variants-v1',
                'reason', 'pending claim relinked after reviewed recent identity merge',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _reviewed_recent_variant_merges input
WHERE claim.person_id = input.duplicate_person_id
  AND claim.review_status IN ('pending', 'needs_more_evidence');

CREATE TEMP TABLE _reviewed_recent_variant_sources (
    source_person_key TEXT PRIMARY KEY,
    person_id UUID UNIQUE NOT NULL,
    source_display_name TEXT NOT NULL,
    canonical_display_name TEXT NOT NULL,
    variant_kind TEXT NOT NULL,
    evidence_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_recent_variant_sources VALUES
    (
        'new-taipei-city-council-current-councilors:current-councilor-589',
        '9d8e00d6-5386-4449-86e4-9c5c938c561a',
        '宋雨蓁 Nikar‧Falong',
        '宋雨蓁 Nikar．Falong',
        'indigenous_name_middle_dot',
        'https://web.cec.gov.tw/api/file/a3831f58-b730-4a71-81b4-c8681942bb6e.pdf'
    ),
    (
        'new-taipei-city-council-current-councilors:current-councilor-605',
        '147c1321-53d1-4dd3-89de-7823697c7098',
        '蘇錦雄 Paylang．Caya',
        '蘇錦雄Paylang．Caya',
        'indigenous_name_spacing',
        'https://web.cec.gov.tw/api/file/a83343b8-425b-4c7e-b2f0-737465855d5e.pdf'
    ),
    (
        'chiayi-county-council-current-councilors:current-councilor-735ff388a802',
        'efb22f04-6b63-47a4-8e8d-5816bd129496',
        '王啟澧',
        '王啓澧',
        'han_character_variant',
        'https://web.cec.gov.tw/api/file/0c4262e2-9d79-4d9c-b6fc-9a6a740859cd.pdf'
    ),
    (
        'pingtung-county-council-current-councilors:current-councilor-293c61d5b6bf',
        '2fd37dc7-0a83-4f62-b481-0c40c6e1e949',
        '林蔡鳳梅',
        '林蔡鳯梅',
        'han_character_variant',
        'https://web.cec.gov.tw/api/file/65fca3ad-64ce-41b8-9aac-26fd731e6943.pdf'
    );

CREATE TEMP TABLE _reviewed_recent_variant_rows ON COMMIT DROP AS
SELECT
    input.*,
    source.id AS source_person_id,
    source.source_name,
    source.party AS source_party,
    source.position AS source_position,
    source.district AS source_district,
    jsonb_build_object(
        'version', 'official-officeholder-reviewed-name-variant-v1',
        'strategy', 'reviewed_recent_official_name_variant',
        'sourcePersonKey', input.source_person_key,
        'sourceName', source.source_name,
        'sourceNameValue', input.source_display_name,
        'canonicalNameValue', input.canonical_display_name,
        'canonicalPersonId', input.person_id,
        'variantKind', input.variant_kind,
        'evidenceUrl', input.evidence_url,
        'matchedSignals', jsonb_build_array(
            'reviewed_name_variant', '2022_current_term', 'role',
            'region', 'district'
        )
    ) AS desired_evidence_json
FROM _reviewed_recent_variant_sources input
JOIN source_people source
  ON source.source_person_key = input.source_person_key;

ALTER TABLE _reviewed_recent_variant_rows
    ADD PRIMARY KEY (source_person_id);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_recent_variant_rows) <> 4
       OR (
           SELECT COUNT(*)
           FROM person_claims claim
           JOIN _reviewed_recent_variant_rows target
             ON target.source_person_id = claim.source_person_id
       ) <> 18
       OR EXISTS (
           SELECT 1
           FROM _reviewed_recent_variant_rows target
           JOIN source_people source ON source.id = target.source_person_id
           JOIN people person ON person.id = target.person_id
           JOIN person_canonical_map canonical ON canonical.person_id = person.id
           WHERE source.source_type <> 'official_officeholder'
              OR source.raw_name <> target.source_display_name
              OR person.name <> target.canonical_display_name
              OR person.is_public <> TRUE
              OR canonical.canonical_person_id <> person.id
       )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _reviewed_recent_variant_rows target
             ON target.source_person_id = claim.source_person_id
           LEFT JOIN person_canonical_map canonical
             ON canonical.person_id = claim.person_id
           WHERE claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
              OR (
                  claim.person_id IS NOT NULL
                  AND canonical.canonical_person_id IS DISTINCT FROM target.person_id
              )
       ) THEN
        RAISE EXCEPTION 'Reviewed recent official name-variant boundary drifted';
    END IF;
END;
$$;

INSERT INTO person_identity_matches (
    source_person_id,
    person_id,
    match_status,
    score,
    match_method,
    match_reason,
    evidence_json,
    reviewed_by,
    reviewed_at,
    updated_at
)
SELECT
    target.source_person_id,
    target.person_id,
    'auto_matched',
    100,
    'official_officeholder_reviewed_name_variant_v1',
    'reviewed: official current profile and 2022 election record identify one person after an explicit name-format or character-variant comparison',
    target.desired_evidence_json,
    'system:official-officeholder-reviewed-name-variant-v1',
    NOW(),
    NOW()
FROM _reviewed_recent_variant_rows target
ON CONFLICT (source_person_id, person_id) DO UPDATE
SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = EXCLUDED.updated_at
WHERE person_identity_matches.match_status IS DISTINCT FROM EXCLUDED.match_status
   OR person_identity_matches.score IS DISTINCT FROM EXCLUDED.score
   OR person_identity_matches.match_method IS DISTINCT FROM EXCLUDED.match_method
   OR person_identity_matches.match_reason IS DISTINCT FROM EXCLUDED.match_reason
   OR person_identity_matches.evidence_json IS DISTINCT FROM EXCLUDED.evidence_json
   OR person_identity_matches.reviewed_by IS DISTINCT FROM EXCLUDED.reviewed_by;

UPDATE person_claims claim
SET
    person_id = target.person_id,
    updated_at = NOW()
FROM _reviewed_recent_variant_rows target
WHERE claim.source_person_id = target.source_person_id
  AND claim.person_id IS DISTINCT FROM target.person_id
  AND (
      claim.person_id IS NULL
      OR EXISTS (
          SELECT 1
          FROM person_canonical_map canonical
          WHERE canonical.person_id = claim.person_id
            AND canonical.canonical_person_id = target.person_id
      )
  );

UPDATE source_people source
SET
    is_public = TRUE,
    updated_at = NOW()
FROM _reviewed_recent_variant_rows target
WHERE source.id = target.source_person_id
  AND source.is_public = FALSE;

SELECT published.promote(NULL);

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _reviewed_recent_variant_merges input
        JOIN person_merge_decisions decision
          ON decision.duplicate_person_id = input.duplicate_person_id
         AND decision.canonical_person_id = input.canonical_person_id
         AND decision.status = 'verified'
        JOIN person_canonical_map canonical
          ON canonical.person_id = input.duplicate_person_id
         AND canonical.canonical_person_id = input.canonical_person_id
        WHERE decision.evidence_json->>'version' =
              'reviewed-recent-official-name-variants-v1'
    ) <> 2
       OR EXISTS (
           SELECT 1
           FROM _reviewed_recent_variant_rows target
           LEFT JOIN person_identity_matches identity_match
             ON identity_match.source_person_id = target.source_person_id
            AND identity_match.person_id = target.person_id
           WHERE identity_match.match_status IS DISTINCT FROM 'auto_matched'
              OR identity_match.score IS DISTINCT FROM 100
              OR identity_match.match_method IS DISTINCT FROM
                 'official_officeholder_reviewed_name_variant_v1'
       )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _reviewed_recent_variant_rows target
             ON target.source_person_id = claim.source_person_id
           WHERE claim.person_id IS DISTINCT FROM target.person_id
              OR claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
       )
       OR EXISTS (
           SELECT 1
           FROM identity_unmatched_source_people
           WHERE review_status = 'unmatched'
             AND source_type = 'official_officeholder'
       ) THEN
        RAISE EXCEPTION 'Reviewed recent official variants were not reconciled';
    END IF;
END;
$$;

RESET statement_timeout;
