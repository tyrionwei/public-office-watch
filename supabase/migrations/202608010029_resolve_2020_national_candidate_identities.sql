BEGIN;

CREATE TEMP TABLE _national_candidate_identity_merges_2020 (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    person_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _national_candidate_identity_merges_2020 (
    duplicate_person_id,
    canonical_person_id,
    person_name,
    reason,
    evidence_json
) VALUES
    (
        '360e2a26-3548-4ea4-a9db-8717a5ce8218',
        'a058edf9-9aeb-4ebb-a490-848178441ce5',
        '高金素梅',
        '2020山地原住民立法委員紀錄與既有第8至11屆立法委員身分為同一人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2012,2016,2020,2024],"office":"mountain_indigenous_legislator","candidateNumber2020":"4"}'
    ),
    (
        '7ebac98b-4f5d-4456-b212-6e7305f90737',
        '558dd1d3-a4d4-49ce-985d-b42a857e0a57',
        '吳炳輝',
        '2020臺南立委、2022臺南市長與2024雲林立委紀錄的姓名、生日及連續參選履歷一致。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2022,2024],"birthDate":"1967-12-01","source":"https://tcmb.culture.tw/zh-tw/detail?id=733256&indexCode=Culture_Object"}'
    ),
    (
        'bf435193-83a8-457b-81df-01d04be67356',
        '583c5c6b-eaae-4c9b-841f-3a0bb86bc667',
        '洪和成',
        '2018金門縣長及2020、2024金門立法委員紀錄為同一位無黨籍候選人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2018,2020,2024],"geography":"金門縣","party":"無黨籍"}'
    ),
    (
        'efee167a-c842-44a1-aa3a-3922d023a405',
        '71715283-c329-47f6-8cc7-3f0742cf30fd',
        '林國慶',
        '2020與2024嘉義縣第2選舉區紀錄的姓名、黨籍、選區及號次一致。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2024],"geography":"嘉義縣第2選舉區","party":"無黨籍","candidateNumber":"3"}'
    ),
    (
        'c4fe00b7-5390-4845-b001-045d22a88229',
        '4ade4830-cb87-4d7b-bad7-743e0e5bc8d5',
        '蘇卿彥',
        '2020與2024新北市第3選舉區紀錄的姓名、黨籍及選區一致。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2024],"geography":"新北市第3選舉區","party":"無黨籍"}'
    ),
    (
        '901c041b-d31b-43bf-8595-90e36787bcf4',
        '456f03d6-3722-4381-8871-56b997e45f16',
        '謝佩芬',
        '2020與2024臺北市立法委員紀錄為同一位民主進步黨候選人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2024],"geographies":["臺北市第6選舉區","臺北市第3選舉區"],"party":"民主進步黨"}'
    ),
    (
        'beee5b8e-39d6-488e-a04c-f0c6ef115281',
        '5590515a-8389-452f-8066-e469bda08e3a',
        '苗豐隆',
        '2020與2024臺中市第5選舉區紀錄的姓名、黨籍、選區及號次一致。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2024],"geography":"臺中市第5選舉區","party":"無黨籍","candidateNumber":"5"}'
    ),
    (
        'f7c981e4-a9b2-405a-91dc-a6a9305e7dc9',
        'abe8c75a-807e-4dfa-a9f7-bb2b3ed4c0a8',
        '陳志彬',
        '2020與2024臺中市第4選舉區紀錄的姓名、黨籍及選區一致。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2024],"geography":"臺中市第4選舉區","party":"無黨籍"}'
    ),
    (
        'd07ced2f-2319-4e85-bec3-2048a6e13aa6',
        '8b25cd3a-d941-45d4-9744-27d9fcacb73f',
        '蔣月惠',
        '歷屆屏東縣議員及2020、2024屏東縣立法委員紀錄為同一人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2005,2009,2014,2018,2020,2022,2024],"geography":"屏東縣第1選舉區","party":"無黨籍"}'
    ),
    (
        '44108dc0-2e64-4279-bb64-cb0152c4e92b',
        '1c244034-9f75-43c8-8544-1ebd976584a1',
        '趙天麟',
        '2012與2020高雄市立法委員紀錄為同一位民主進步黨候選人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2012,2020],"geography":"高雄市","party":"民主進步黨"}'
    ),
    (
        'bce60adc-7042-4ff7-9036-2089e3055aee',
        '749e6898-ec10-4219-833c-6e493a63b9ea',
        '趙正宇',
        '2016、2020與2024桃園市第6選舉區紀錄的姓名、黨籍、選區及號次一致。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2016,2020,2024],"geography":"桃園市第6選舉區","party":"無黨籍","candidateNumber":"2"}'
    ),
    (
        '6b9b813f-3923-4383-ba68-46bfa2bf1e24',
        'a06e2043-f6dc-45f5-8a92-3ce8351b9722',
        '陳學聖',
        '2012與2020桃園市立法委員紀錄為同一位中國國民黨候選人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2012,2020],"geography":"桃園市","party":"中國國民黨","candidateNumber":"1"}'
    ),
    (
        'cb6c06ee-29a8-4ec6-8f29-b52f2d2cec2c',
        'd47c9716-3e38-4781-8768-774a7af7a4ca',
        '簡明廉',
        '公開選舉履歷明列2020嘉義縣及2024嘉義市立法委員參選紀錄為同一人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2024],"geographies":["嘉義縣第2選舉區","嘉義市第1選舉區"],"source":"https://whoareyou.readr.tw/politics/36764"}'
    ),
    (
        '880fcc3c-bf46-49f5-9b21-1b45fa1a2695',
        '7539ebdd-a8a7-4d61-8e44-665107b97465',
        '蔡培慧',
        '2020與2024南投縣立法委員及2022南投縣長紀錄為同一位民主進步黨候選人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2020,2022,2024],"geography":"南投縣","party":"民主進步黨"}'
    ),
    (
        '82a18468-fbe9-4b39-a27e-ffaeb20bbc9f',
        '80b628bb-0565-4059-b5d9-bea5820dd22f',
        '孫大千',
        '2012桃園市及2020臺北市立法委員紀錄為同一位中國國民黨候選人。',
        '{"rule":"official_2020_cross_year_identity_review","years":[2012,2020],"party":"中國國民黨"}'
    );

CREATE TEMP TABLE _national_candidate_identity_person_external_ids_2020 (
    local_person_id UUID PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO _national_candidate_identity_person_external_ids_2020 (local_person_id, external_id)
VALUES
    ('360e2a26-3548-4ea4-a9db-8717a5ce8218', 'cec-historical-unresolved-person-466ecedf1c56'),
    ('a058edf9-9aeb-4ebb-a490-848178441ce5', 'ly-legislator-11-110051'),
    ('7ebac98b-4f5d-4456-b212-6e7305f90737', 'votetw-person-03093fc214372894'),
    ('558dd1d3-a4d4-49ce-985d-b42a857e0a57', 'votetw-person-b17a3dddc00c79a1'),
    ('bf435193-83a8-457b-81df-01d04be67356', 'votetw-person-5a7d3dbed039f3e1'),
    ('583c5c6b-eaae-4c9b-841f-3a0bb86bc667', 'votetw-person-6df93d9e30d99084'),
    ('efee167a-c842-44a1-aa3a-3922d023a405', 'votetw-person-496d8a4a91cb9baf'),
    ('71715283-c329-47f6-8cc7-3f0742cf30fd', 'votetw-person-bbe34de7a190933d'),
    ('c4fe00b7-5390-4845-b001-045d22a88229', 'votetw-person-d1bffa664976da49'),
    ('4ade4830-cb87-4d7b-bad7-743e0e5bc8d5', 'votetw-person-45372c6079634ccd'),
    ('901c041b-d31b-43bf-8595-90e36787bcf4', 'votetw-person-2db22297afb235ce'),
    ('456f03d6-3722-4381-8871-56b997e45f16', 'votetw-person-5757b0f5670b91a6'),
    ('beee5b8e-39d6-488e-a04c-f0c6ef115281', 'votetw-person-fbb8b4a691be3de4'),
    ('5590515a-8389-452f-8066-e469bda08e3a', 'votetw-person-5cf2fc4c1590b306'),
    ('f7c981e4-a9b2-405a-91dc-a6a9305e7dc9', 'votetw-person-7456f19e4656d0ba'),
    ('abe8c75a-807e-4dfa-a9f7-bb2b3ed4c0a8', 'votetw-person-5db7b893a64023db'),
    ('d07ced2f-2319-4e85-bec3-2048a6e13aa6', 'votetw-person-c3f1188aa7e18830'),
    ('8b25cd3a-d941-45d4-9744-27d9fcacb73f', 'votetw-person-38fcd1199df7a658'),
    ('44108dc0-2e64-4279-bb64-cb0152c4e92b', 'votetw-person-266e8740c28c8c11'),
    ('1c244034-9f75-43c8-8544-1ebd976584a1', 'cec-2012-person-04867707e7d5'),
    ('bce60adc-7042-4ff7-9036-2089e3055aee', 'votetw-person-c449ce497d537379'),
    ('749e6898-ec10-4219-833c-6e493a63b9ea', 'votetw-person-1fff6a4c13c779f7'),
    ('6b9b813f-3923-4383-ba68-46bfa2bf1e24', 'votetw-person-1c630eeba089d6f7'),
    ('a06e2043-f6dc-45f5-8a92-3ce8351b9722', 'cec-2012-person-bc949eb05b17'),
    ('cb6c06ee-29a8-4ec6-8f29-b52f2d2cec2c', 'votetw-person-99c52fe5cfef286a'),
    ('d47c9716-3e38-4781-8768-774a7af7a4ca', 'votetw-person-03847221cb241ddc'),
    ('880fcc3c-bf46-49f5-9b21-1b45fa1a2695', 'votetw-person-b1cfb506af259084'),
    ('7539ebdd-a8a7-4d61-8e44-665107b97465', 'votetw-person-fcfd02004db489a4'),
    ('82a18468-fbe9-4b39-a27e-ffaeb20bbc9f', 'votetw-person-c30112dde1b2ce27'),
    ('80b628bb-0565-4059-b5d9-bea5820dd22f', 'cec-2012-person-2ce6cd90c80f');

UPDATE _national_candidate_identity_merges_2020 input
SET duplicate_person_id = duplicate.id,
    canonical_person_id = canonical.id
FROM _national_candidate_identity_person_external_ids_2020 duplicate_map
JOIN people duplicate ON duplicate.external_id = duplicate_map.external_id
JOIN _national_candidate_identity_person_external_ids_2020 canonical_map ON TRUE
JOIN people canonical ON canonical.external_id = canonical_map.external_id
WHERE duplicate_map.local_person_id = input.duplicate_person_id
  AND canonical_map.local_person_id = input.canonical_person_id;

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM _national_candidate_identity_merges_2020) <> 15 THEN
        RAISE EXCEPTION '2020 national candidate identity input count mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _national_candidate_identity_merges_2020 input
        LEFT JOIN people duplicate ON duplicate.id = input.duplicate_person_id
        LEFT JOIN people canonical ON canonical.id = input.canonical_person_id
        LEFT JOIN person_canonical_map canonical_state ON canonical_state.person_id = input.canonical_person_id
        WHERE duplicate.id IS NULL
           OR canonical.id IS NULL
           OR duplicate.name <> input.person_name
           OR canonical.name <> input.person_name
           OR canonical.is_public IS NOT TRUE
           OR canonical_state.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION '2020 national candidate identity input no longer matches the reviewed people';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _national_candidate_identity_merges_2020 input
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = input.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION '2020 national candidate identity gained a conflicting active decision';
    END IF;
END
$verify$;

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
    input.evidence_json,
    'codex:official-2020-cross-year-identity-review',
    NOW(),
    NOW()
FROM _national_candidate_identity_merges_2020 input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = input.duplicate_person_id
      AND existing.canonical_person_id = input.canonical_person_id
      AND existing.status IN ('suggested', 'verified')
);

DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _national_candidate_identity_merges_2020 input
        JOIN person_canonical_map canonical ON canonical.person_id = input.duplicate_person_id
        WHERE canonical.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION '2020 national candidate identities did not resolve to the reviewed canonical people';
    END IF;
END
$verify$;

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

COMMIT;
