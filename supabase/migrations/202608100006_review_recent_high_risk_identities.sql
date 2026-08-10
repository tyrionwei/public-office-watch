SET statement_timeout = 0;

BEGIN;

CREATE TEMP TABLE _recent_high_risk_identity_merges (
    canonical_person_id UUID NOT NULL,
    duplicate_person_id UUID PRIMARY KEY,
    expected_name TEXT NOT NULL,
    canonical_context TEXT NOT NULL,
    duplicate_context TEXT NOT NULL,
    evidence_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _recent_high_risk_identity_merges VALUES
    ('08c78b83-b063-4f43-95d2-7f29d550203e', '2f5976e0-8d39-4f77-abc5-596eb8e4975c', '唐儀靜', '2018、2026 臺南市議員候選人', '2014 臺南市議員候選人', 'https://web.cec.gov.tw/api/file/648bc303-1ebf-4115-a133-e93c9d6af156.pdf'),
    ('08c78b83-b063-4f43-95d2-7f29d550203e', 'abebd944-9e98-4c1a-867a-d04700e416a9', '唐儀靜', '2018、2026 臺南市議員候選人', '2005 臺南市議員', 'https://web.cec.gov.tw/api/file/edeb0060-1dd7-4055-9f9c-e3d283416be5.pdf'),
    ('d84635b6-18e4-498b-9641-716bbb82eb97', '0eb535f8-c9b8-47d2-a8a0-490fd53e101c', '李婉鈺', '新北市議員及後續立委候選人', '2016 新北市第7選舉區立委候選人', 'https://web.cec.gov.tw/api/file/dae24331-a1c1-4b8d-9516-edb2a3518a49.pdf'),
    ('01bcc037-dc12-49b3-b9b2-5e04033ad2be', '731d0df9-45fd-4579-b7aa-bae172e6a28e', '張肇良', '桃園縣市議員', '2016 桃園市第5選舉區立委候選人', 'https://bulletin.cec.gov.tw/01選舉公報/02立法委員/105年第9屆/01區域/03桃園市/桃園市立委選舉第5選舉區.pdf'),
    ('53f5e2f0-8f8b-4224-820c-aadfd5c66eab', '637c35ce-d506-4807-93de-19faca0f2eff', '陳明義', '臺北縣及新北市議員', '2016 新北市第2選舉區立委候選人', 'https://bulletin.cec.gov.tw/01選舉公報/02立法委員/105年第9屆/01區域/02新北市/新北市立委選舉2.3選舉區.pdf'),
    ('af8d759a-1b06-408b-9db9-d0c2d0880ea7', '4bcbb465-c25e-4694-87a5-cc21a3634ae1', '陳麗娜', '高雄市議員', '2020 高雄市第8選舉區立委候選人', 'https://bulletin.cec.gov.tw/01選舉公報/02立法委員/109年第10屆/02區域立法委員/07高雄市/高雄市第8選區立委.pdf'),
    ('e6fecff0-169b-46ee-ae6e-888179d54342', 'bc5dfc3a-8e6b-4d79-bbce-43dc5ef0c1a7', '黃仁', '臺中市議員及第11屆平地原住民立委', '2020 平地原住民立委候選人', 'https://db.cec.gov.tw/ElecTable/Election/ElecTickets?areaCode=00&cityCode=000&dataLevel=N&dataType=tickets&deptCode=000&legisId=L2&liCode=0000&prvCode=00&subjectId=L0&themeId=199e3ebf417ddbebac3a19c0befd306f&typeId=ELC'),
    ('5dffdbb8-9047-49d7-988f-b43e4bb38f6c', '18dec222-d16b-469b-9466-7adbf0b5dd96', '黃柏霖', '高雄市議員及後續立委候選人', '2016 高雄市第6選舉區立委候選人', 'https://bulletin.cec.gov.tw/01選舉公報/02立法委員/109年第10屆/02區域立法委員/07高雄市/高雄市第5選舉區立委正面.pdf'),
    ('3a73e79e-74d5-473a-88d2-bc32554bd4fb', '3ec6e2cf-bcfd-4f2e-9a86-375ceedada3a', '李眉蓁', '2010 至 2024 高雄市議員及立委候選人', '2006 親民黨高雄市議員候選人', 'https://web.cec.gov.tw/api/file/0b5ee5dd-0316-492b-9f8b-33669f224c44.pdf');

DO $verify_merges$
BEGIN
    IF (SELECT COUNT(*) FROM _recent_high_risk_identity_merges) <> 9
       OR EXISTS (
           SELECT 1
           FROM _recent_high_risk_identity_merges input
           LEFT JOIN people canonical ON canonical.id = input.canonical_person_id
           LEFT JOIN people duplicate ON duplicate.id = input.duplicate_person_id
           LEFT JOIN person_canonical_map canonical_state
             ON canonical_state.person_id = input.canonical_person_id
           WHERE canonical.id IS NULL
              OR duplicate.id IS NULL
              OR canonical.name <> input.expected_name
              OR duplicate.name <> input.expected_name
              OR canonical_state.canonical_person_id <> input.canonical_person_id
              OR canonical.id = duplicate.id
       ) THEN
        RAISE EXCEPTION 'Recent high-risk identity merge boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _recent_high_risk_identity_merges input
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = input.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Recent high-risk identity gained a conflicting merge';
    END IF;
END
$verify_merges$;

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
    CONCAT(
        input.expected_name,
        '：中選會資料確認為同一人物（',
        input.canonical_context,
        '／',
        input.duplicate_context,
        '）。'
    ),
    jsonb_build_object(
        'version', 'recent-high-risk-identity-audit-v1',
        'canonicalContext', input.canonical_context,
        'duplicateContext', input.duplicate_context,
        'evidenceKind', 'official_cec_record',
        'evidenceUrl', input.evidence_url
    ),
    'system:recent-high-risk-identity-audit-v1',
    NOW(),
    NOW()
FROM _recent_high_risk_identity_merges input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = input.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);

-- Two unrelated 2022 candidates named 洪志明 were joined after a Wikidata
-- record for the Taichung TPP candidate was mistakenly attached to the
-- Pingtung KMT candidate. Keep each source pair together, but split the people.
DO $verify_hong_split$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people p
        WHERE p.id = '505f6c1e-6e82-40e0-ac7e-952755bd0dc5'
          AND p.name = '洪志明'
    ) OR NOT EXISTS (
        SELECT 1
        FROM people p
        WHERE p.id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
          AND p.name = '洪志明'
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN people person ON person.id = candidate.person_id
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.person_id = '505f6c1e-6e82-40e0-ac7e-952755bd0dc5'
          AND person.party = '中國國民黨'
          AND race.title = '屏東縣第4選舉區議員選舉'
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN people person ON person.id = candidate.person_id
        JOIN races race ON race.id = candidate.race_id
        WHERE candidate.person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
          AND person.party = '台灣民眾黨'
          AND race.title = '臺中市第15選舉區平地原住民議員選舉'
    ) THEN
        RAISE EXCEPTION '洪志明 split boundary drifted';
    END IF;
END
$verify_hong_split$;

UPDATE person_merge_decisions
SET
    status = 'rejected',
    reason = '同名但不同人：2022 年分屬屏東縣國民黨區域候選人與臺中市民眾黨平地原住民候選人。',
    evidence_json = COALESCE(evidence_json, '{}'::JSONB) || jsonb_build_object(
        'correctionVersion', 'recent-high-risk-identity-audit-v1',
        'correctionReason', 'same-year conflicting city, party and constituency',
        'officialPingtungSource', 'https://web.cec.gov.tw/api/file/264bae70-6716-4111-b4bc-fb6981e25249.pdf',
        'officialTaichungSource', 'https://www.tpp.org.tw/newsdetail/2041'
    ),
    reviewed_by = 'system:recent-high-risk-identity-audit-v1',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id IN (
    '6e51fbf2-c4a5-420d-910d-a8b07a311b1a',
    '3fd20695-e607-4f33-b704-0d7d5741297a'
)
  AND status = 'verified';

UPDATE person_claims
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_reasons = COALESCE(scoring_reasons, '[]'::JSONB) || jsonb_build_array(
        jsonb_build_object(
            'version', 'recent-high-risk-identity-audit-v1',
            'reason', 'Wikidata Q115116444 belongs to the Taichung TPP candidate, not the Pingtung KMT candidate',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
WHERE id IN (
    'a70e0b80-5ef4-429b-80f2-ba3e239023bf',
    '2815a5ea-8297-41e0-8401-b3c47a8e3f17',
    '7197a260-a7d0-4754-9d71-31d8d56c1a68'
)
  AND person_id = '505f6c1e-6e82-40e0-ac7e-952755bd0dc5';

UPDATE person_claims
SET
    person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845',
    scoring_reasons = COALESCE(scoring_reasons, '[]'::JSONB) || jsonb_build_array(
        jsonb_build_object(
            'version', 'recent-high-risk-identity-audit-v1',
            'reason', 'family claim relinked to the Taichung TPP candidate after same-name split',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
WHERE id = '2fe004ab-caac-49ee-a4b1-9620965dff80'
  AND person_id = '505f6c1e-6e82-40e0-ac7e-952755bd0dc5';

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
    'fc7b10e6-73c7-4ae2-aa02-b7d75a529a9f',
    'd87a57f2-becb-4be7-8272-3a1337ef3845',
    'verified',
    'A',
    '洪志明：中選會與 VoteTW 的 2022 臺中市第15選舉區平地原住民候選人紀錄為同一人。',
    jsonb_build_object(
        'version', 'recent-high-risk-identity-audit-v1',
        'evidenceKind', 'same_official_race_candidate',
        'evidenceUrl', 'https://www.tpp.org.tw/newsdetail/2041'
    ),
    'system:recent-high-risk-identity-audit-v1',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = 'fc7b10e6-73c7-4ae2-aa02-b7d75a529a9f'
      AND existing.status IN ('suggested', 'verified')
);

SELECT published.promote(NULL);

DO $verify_result$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _recent_high_risk_identity_merges input
        JOIN person_canonical_map canonical
          ON canonical.person_id = input.duplicate_person_id
         AND canonical.canonical_person_id = input.canonical_person_id
    ) <> 9 THEN
        RAISE EXCEPTION 'Recent high-risk identities were not merged';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_canonical_map canonical
        WHERE canonical.person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
          AND canonical.canonical_person_id <> 'd87a57f2-becb-4be7-8272-3a1337ef3845'
    ) OR NOT EXISTS (
        SELECT 1
        FROM person_canonical_map canonical
        WHERE canonical.person_id = 'fc7b10e6-73c7-4ae2-aa02-b7d75a529a9f'
          AND canonical.canonical_person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
    ) OR EXISTS (
        SELECT 1
        FROM person_claims claim
        WHERE claim.person_id = '505f6c1e-6e82-40e0-ac7e-952755bd0dc5'
          AND claim.claim_value = 'wikidata:Q115116444'
          AND claim.review_status = 'verified'
          AND claim.is_public = TRUE
    ) THEN
        RAISE EXCEPTION '洪志明 identity split did not converge';
    END IF;
END
$verify_result$;

COMMIT;

RESET statement_timeout;
