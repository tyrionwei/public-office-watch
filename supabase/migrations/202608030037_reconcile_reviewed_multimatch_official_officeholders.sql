SET statement_timeout = 0;

-- These current elected officials had more than one exact-name person in the
-- canonical graph. Their party, office and county/city identify one current
-- official, while historical cross-role duplicates were reviewed separately.
CREATE TEMP TABLE _reviewed_multimatch_official_targets (
    source_person_key TEXT PRIMARY KEY,
    person_id UUID UNIQUE NOT NULL,
    expected_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_multimatch_official_targets VALUES
    ('hsinchu-city-council-current-councilors:current-councilor-32', '5db607c6-c694-4c6d-8cef-b79f8918ce99', '吳國寶'),
    ('taichung-city-council-current-councilors:current-councilor-81', '2c604d95-3583-42e2-b8bf-eaefee2bd157', '吳振嘉'),
    ('hsinchu-city-council-current-councilors:current-councilor-18', '14133509-6f53-4093-9023-47d4f192b831', '徐美惠'),
    ('taichung-city-council-current-councilors:current-councilor-47', '61717702-3e81-4603-9a15-c0751aa13441', '李中'),
    ('taichung-city-council-current-councilors:current-councilor-67', 'fa677c61-a531-40ff-8ed0-3434a730f65a', '李文傑'),
    ('yunlin-county-council-current-councilors:current-councilor-b06b85d72d1e', '6fbed1cc-d8b6-4be7-9860-e002016c8cb0', '李明哲'),
    ('hsinchu-city-council-current-councilors:current-councilor-24', '81bb7edb-a5af-4d85-899c-05a01f2f7bf0', '林彥甫'),
    ('tainan-city-council-current-councilors:current-councilor-DF5652F8-552C-4139-8437-084E442F5F7E', '50585235-40a9-49a9-b861-8c4f3062da31', '林志展'),
    ('hualien-county-council-current-councilors:current-councilor-9681c8992d43', '5671768b-c99c-463f-aa5d-213e5731670c', '林正福'),
    ('tainan-city-council-current-councilors:current-councilor-51D511F9-46E4-4B13-8DCF-35DCE176976A', 'c56135aa-d267-454b-8d8f-3fec1a219cca', '林燕祝'),
    ('hualien-county-council-current-councilors:current-councilor-2da8049e364a', 'ae4fd7bb-d0b0-4164-b25c-f8fed49eadee', '林玉芬'),
    ('yunlin-county-council-current-councilors:current-councilor-4124a84cb448', '75453570-7d78-4a11-99b7-5e769852e95b', '洪如萍'),
    ('kinmen-county-council-current-councilors:current-councilor-7f887eeb314a', '0df2fc94-dcb4-45ee-bfbf-a8b5e172df8c', '王國代'),
    ('hualien-county-council-current-councilors:current-councilor-fff40245ea5d', '57e983c9-0415-47aa-a361-f372a6a24dbd', '胡仁順'),
    ('yunlin-county-council-current-councilors:current-councilor-403570dbcc5d', 'f7773d04-9ebc-451e-9116-0f8448af3dda', '蔡東富'),
    ('tainan-city-council-current-councilors:current-councilor-EBB90AC7-C4DB-4CDE-8786-1E686D32B092', '99842f38-e9e0-4f15-b68c-9a27b190ffba', '蔡淑惠'),
    ('tainan-city-council-current-councilors:current-councilor-053E553A-B244-4F42-9BF5-0716C40A7EAD', 'b1845cb1-5092-4afc-8943-d7fd83478cc1', '蔡育輝'),
    ('hualien-county-council-current-councilors:current-councilor-78e71761d28b', '95c9aa21-8963-40aa-a33b-324fc5f2438f', '詹金富'),
    ('taichung-city-council-current-councilors:current-councilor-51', '0d5088e5-c898-43b3-bf95-e3988d87cccd', '賴義鍠'),
    ('hualien-county-council-current-councilors:current-councilor-9aaedbbaf362', 'e2fcf662-2829-4486-be5f-9031c183ae4f', '鄭乾龍'),
    ('hualien-county-council-current-councilors:current-councilor-e6db9bb0bd87', 'ab87f02f-b03f-476e-8d7e-3e24e53a597b', '金淑敏'),
    ('hsinchu-city-council-current-councilors:current-councilor-19', '06e7c308-e832-4548-aa10-0649ba1eda11', '陳建名'),
    ('taichung-city-council-current-councilors:current-councilor-28', 'e2e3a497-7e72-438b-81d5-15e2ddbade3f', '陳淑華'),
    ('hualien-county-council-current-councilors:current-councilor-dcb8959d56a9', '484c4550-a44a-43c3-bd75-86072128164c', '韓林梅'),
    ('hualien-county-council-current-councilors:current-councilor-94d62eec92f7', '56ecb266-4ca0-47ee-82a9-2755c32a94b6', '魏嘉賢'),
    ('hsinchu-city-council-current-councilors:current-councilor-9', '6daac75e-813f-4114-a5ff-9d1a97fc68cf', '黃文政'),
    ('new-taipei-city-council-current-councilors:current-councilor-514', 'ab789c43-2c98-4a02-a1f8-30d1615c9074', '黃桂蘭'),
    ('taichung-city-council-current-councilors:current-councilor-25', 'e65fab08-6bef-4d0f-89b1-8251e7203851', '黃馨慧');

CREATE TEMP TABLE _reviewed_multimatch_official_rows ON COMMIT DROP AS
SELECT
    target.*,
    source.id AS source_person_id,
    source.source_name,
    source.raw_name,
    source.party AS source_party,
    source.position AS source_position,
    source.district AS source_district,
    person.party AS target_party,
    person.position AS target_position,
    person.district AS target_district,
    jsonb_build_object(
        'version', 'official-officeholder-reviewed-multimatch-v1',
        'strategy', 'reviewed_exact_name_party_role_region_after_cross_role_merge',
        'sourcePersonKey', target.source_person_key,
        'sourceName', source.source_name,
        'sourceNameValue', source.raw_name,
        'canonicalPersonId', target.person_id,
        'matchedSignals', jsonb_build_array('exact_name', 'party', 'role', 'region')
    ) AS desired_evidence_json
FROM _reviewed_multimatch_official_targets target
JOIN source_people source
  ON source.source_person_key = target.source_person_key
JOIN people person ON person.id = target.person_id;

ALTER TABLE _reviewed_multimatch_official_rows
    ADD PRIMARY KEY (source_person_id);

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_multimatch_official_rows) <> 28
       OR (
           SELECT COUNT(*)
           FROM person_claims claim
           JOIN _reviewed_multimatch_official_rows target
             ON target.source_person_id = claim.source_person_id
       ) <> 140
       OR EXISTS (
           SELECT 1
           FROM _reviewed_multimatch_official_rows target
           JOIN source_people source ON source.id = target.source_person_id
           JOIN people person ON person.id = target.person_id
           JOIN person_canonical_map canonical ON canonical.person_id = person.id
           WHERE source.source_type <> 'official_officeholder'
              OR source.raw_name <> target.expected_name
              OR person.name <> target.expected_name
              OR person.is_public <> TRUE
              OR canonical.canonical_person_id <> person.id
              OR CASE
                    WHEN regexp_replace(replace(COALESCE(source.party, ''), '臺', '台'), E'\\s+', '', 'g') IN ('無', '無黨', '無黨籍') THEN '無黨籍'
                    ELSE regexp_replace(replace(COALESCE(source.party, ''), '臺', '台'), E'\\s+', '', 'g')
                 END
                 <> CASE
                    WHEN regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g') IN ('無', '無黨', '無黨籍') THEN '無黨籍'
                    ELSE regexp_replace(replace(COALESCE(person.party, ''), '臺', '台'), E'\\s+', '', 'g')
                 END
              OR source.position NOT LIKE '%議員%'
              OR person.position NOT LIKE '%議員%'
              OR COALESCE(
                    substring(replace(source.district, '臺', '台') FROM '^(.+?[縣市])'),
                    substring(replace(source.position, '臺', '台') FROM '^(.+?[縣市])')
                 ) IS DISTINCT FROM COALESCE(
                    substring(replace(person.district, '臺', '台') FROM '^(.+?[縣市])'),
                    substring(replace(person.position, '臺', '台') FROM '^(.+?[縣市])')
                 )
       )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _reviewed_multimatch_official_rows target
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
       )
       OR EXISTS (
           SELECT 1
           FROM person_identity_matches rejected
           JOIN _reviewed_multimatch_official_rows target
             ON target.source_person_id = rejected.source_person_id
           JOIN person_canonical_map rejected_canonical
             ON rejected_canonical.person_id = rejected.person_id
           WHERE rejected.match_status = 'rejected_match'
             AND rejected_canonical.canonical_person_id = target.person_id
       ) THEN
        RAISE EXCEPTION 'Reviewed multi-match official identity boundary drifted';
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
    98,
    'official_officeholder_reviewed_multimatch_v1',
    'reviewed: exact name plus official party, council role and county/city select this canonical person after cross-role identity review',
    target.desired_evidence_json,
    'system:official-officeholder-reviewed-multimatch-v1',
    NOW(),
    NOW()
FROM _reviewed_multimatch_official_rows target
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
FROM _reviewed_multimatch_official_rows target
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
FROM _reviewed_multimatch_official_rows target
WHERE source.id = target.source_person_id
  AND source.is_public = FALSE;

SELECT published.promote(NULL);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _reviewed_multimatch_official_rows target
        LEFT JOIN person_identity_matches identity_match
          ON identity_match.source_person_id = target.source_person_id
         AND identity_match.person_id = target.person_id
        WHERE identity_match.match_status IS DISTINCT FROM 'auto_matched'
           OR identity_match.score IS DISTINCT FROM 98
           OR identity_match.match_method IS DISTINCT FROM
              'official_officeholder_reviewed_multimatch_v1'
    )
       OR EXISTS (
           SELECT 1
           FROM person_claims claim
           JOIN _reviewed_multimatch_official_rows target
             ON target.source_person_id = claim.source_person_id
           WHERE claim.person_id IS DISTINCT FROM target.person_id
              OR claim.review_status <> 'verified'
              OR claim.visibility <> 'public'
              OR claim.is_public <> TRUE
       )
       OR (
           SELECT COUNT(*)
           FROM identity_unmatched_source_people
           WHERE review_status = 'unmatched'
             AND source_type = 'official_officeholder'
       ) <> 289 THEN
        RAISE EXCEPTION 'Reviewed multi-match official identities were not reconciled';
    END IF;
END;
$$;

RESET statement_timeout;
