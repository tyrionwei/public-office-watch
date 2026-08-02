SET statement_timeout = 0;

CREATE TEMP TABLE _verified_priority_person_merges (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _verified_priority_person_merges VALUES
    (
        '51143195-edd3-3b9e-0a14-39804ccd6beb',
        '59424fc1-7274-4a56-9d4d-fd7c04014192',
        '俄鄧．殷艾：2010、2014、2018 紀錄均為民主進步黨籍高雄市平地原住民議員候選人；中文及族名僅有空白與間隔符號差異。',
        jsonb_build_object(
            'version', 'priority-historical-review-v1',
            'observedDate', '2026-07-30',
            'electionYears', jsonb_build_array(2010, 2014, 2018),
            'region', '高雄市',
            'party', '民主進步黨',
            'seatType', '平地原住民',
            'identitySignals', jsonb_build_array('canonical name', 'gender', 'party', 'region', 'seat type')
        )
    ),
    (
        '54926b84-9c8f-4ffc-b570-3fbdc42474a8',
        '1b18f28d-e81f-47e2-b88c-498b0fa06996',
        '楊春妹：2010、2014、2018、2022 紀錄均為新北市平地原住民議員選舉；2018 第11選區與 2022 第12選區為席次編號調整，姓名、性別及後續中國國民黨籍紀錄一致。',
        jsonb_build_object(
            'version', 'priority-historical-review-v1',
            'observedDate', '2026-07-30',
            'electionYears', jsonb_build_array(2010, 2014, 2018, 2022),
            'region', '新北市',
            'districts', jsonb_build_array('第11選舉區', '第12選舉區'),
            'seatType', '平地原住民',
            'verifiedBirthDate', '1961-02-19'
        )
    ),
    (
        '556d5b17-7725-4742-8e4e-9a83f8b7f1e9',
        '85f8d3cf-f36c-421b-95ed-ca3687130cd6',
        '董昌華：2018 中選會候選人與臺東縣議會現任議員資料均為臺東縣第16選區山地原住民議員，姓名、性別及無黨籍一致。',
        jsonb_build_object(
            'version', 'priority-historical-review-v1',
            'observedDate', '2026-07-30',
            'electionYear', 2018,
            'region', '臺東縣',
            'district', '第16選區',
            'seatType', '山地原住民',
            'officialCurrentSource', 'taitung-county-council-current-councilors'
        )
    ),
    (
        'cbc0ba5d-ff72-499b-a0d3-cae3b4845f7b',
        '70acf77e-1cc5-493b-8b59-18624bcf1eb9',
        '王惠美：VoteTW 2016 彰化縣第1選區立委紀錄與中選會2012立委、2018及2022彰化縣長、彰化縣政府現任縣長資料形成連續官方政治經歷。',
        jsonb_build_object(
            'version', 'priority-historical-review-v1',
            'observedDate', '2026-07-30',
            'electionYears', jsonb_build_array(2012, 2016, 2018, 2022),
            'region', '彰化縣',
            'party', '中國國民黨',
            'verifiedBirthDate', '1968-11-22',
            'officialCurrentSource', 'changhua-county-government-leaders'
        )
    );

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
    reviewed.duplicate_person_id,
    reviewed.canonical_person_id,
    'verified',
    'A',
    reviewed.reason,
    reviewed.evidence_json,
    'system:priority-historical-review-v1',
    NOW(),
    NOW()
FROM _verified_priority_person_merges reviewed
JOIN people duplicate ON duplicate.id = reviewed.duplicate_person_id
JOIN people canonical ON canonical.id = reviewed.canonical_person_id
WHERE reviewed.duplicate_person_id <> reviewed.canonical_person_id
  AND NOT EXISTS (
      SELECT 1
      FROM person_merge_decisions existing
      WHERE existing.duplicate_person_id = reviewed.duplicate_person_id
        AND existing.status IN ('suggested', 'verified')
  );

CREATE TEMP TABLE _verified_priority_source_targets (
    raw_name_pattern TEXT NOT NULL,
    election_years INTEGER[] NOT NULL,
    position_pattern TEXT NOT NULL,
    person_id UUID NOT NULL,
    evidence_label TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _verified_priority_source_targets VALUES
    ('俄鄧%', ARRAY[2010, 2014, 2018], '%高雄市%平地原住民%', '59424fc1-7274-4a56-9d4d-fd7c04014192', '2010、2014、2018 高雄市平地原住民議員官方選舉紀錄'),
    ('楊春妹', ARRAY[2010, 2014, 2018], '%新北市%平地原住民%', '1b18f28d-e81f-47e2-b88c-498b0fa06996', '2010、2014、2018 新北市平地原住民議員官方選舉紀錄'),
    ('董昌華', ARRAY[2018], '%臺東縣%山地原住民%', '85f8d3cf-f36c-421b-95ed-ca3687130cd6', '2018 臺東縣山地原住民議員與現任議員官方資料'),
    ('林姿妙', ARRAY[1998, 2002, 2005], '%宜蘭縣議員%', '03823e3c-45a7-45a3-8a03-800bc9bf7b44', '宜蘭縣議員、縣長及同黨籍官方選舉經歷'),
    ('王惠美', ARRAY[1998, 2002], '%彰化縣議員%', '70acf77e-1cc5-493b-8b59-18624bcf1eb9', '彰化縣議員、立委及縣長官方選舉經歷'),
    ('饒慶鈴', ARRAY[2005, 2009, 2014], '%臺東縣議員%', '4f1f31ff-5180-4d96-94e6-1de8d5ed408a', '臺東縣議員、立委候選人及縣長官方選舉經歷');

WITH eligible_sources AS (
    SELECT
        source.id AS source_person_id,
        target.person_id,
        source.source_person_key,
        source.raw_name,
        source.election_year,
        source.party,
        source.position,
        source.district,
        target.evidence_label
    FROM source_people source
    JOIN _verified_priority_source_targets target
      ON source.raw_name LIKE target.raw_name_pattern
     AND source.election_year = ANY(target.election_years)
     AND source.position LIKE target.position_pattern
    WHERE source.source_type = 'official_election'
      AND source.source_id = 'cec-2024-votedata'
      AND NOT EXISTS (
          SELECT 1
          FROM person_identity_matches rejected
          WHERE rejected.source_person_id = source.id
            AND rejected.person_id = target.person_id
            AND rejected.match_status = 'rejected_match'
      )
),
upserted_matches AS (
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
        eligible.source_person_id,
        eligible.person_id,
        'auto_matched',
        100,
        'manual_priority_historical_review_v1',
        'approved after cross-year official election and officeholder evidence review',
        jsonb_build_object(
            'version', 'priority-historical-review-v1',
            'evidenceLabel', eligible.evidence_label,
            'sourcePersonKey', eligible.source_person_key,
            'sourceName', eligible.raw_name,
            'sourceElectionYear', eligible.election_year,
            'sourceParty', eligible.party,
            'sourcePosition', eligible.position,
            'sourceDistrict', eligible.district
        ),
        'system:priority-historical-review-v1',
        NOW(),
        NOW()
    FROM eligible_sources eligible
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
    RETURNING source_person_id
)
UPDATE source_people source
SET is_public = TRUE, updated_at = NOW()
FROM upserted_matches matched
WHERE source.id = matched.source_person_id;

SELECT published.promote(NULL);

RESET statement_timeout;
