BEGIN;

CREATE TEMP TABLE _remaining_councilor_identity_merges (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    person_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _remaining_councilor_identity_merges (
    duplicate_person_id,
    canonical_person_id,
    person_name,
    reason,
    evidence_json
) VALUES
    (
        '4315cba3-0c0f-45f9-91fe-5dd2754c733b',
        '44188e5a-9dfd-44c9-9210-d8d8f644d5d6',
        '黃瑞傳',
        '2014、2018新北市議員及2022、2024新北市選舉紀錄為同一位無黨籍候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2014,2018,2022,2024],"geography":"新北市","party":"無黨籍"}'
    ),
    (
        'd4e74ca2-c772-4770-b830-42297e0d356b',
        '4e899438-b538-44bf-9fb6-bbfba86be4a4',
        '洪佳君',
        '2010至2022新北市議員及2024新北市立法委員紀錄為同一位中國國民黨候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2010,2014,2018,2022,2024],"geography":"新北市","party":"中國國民黨"}'
    ),
    (
        '5bf8dd2d-01db-4abf-aa0c-16c45a02b7f9',
        '4e899438-b538-44bf-9fb6-bbfba86be4a4',
        '洪佳君',
        '2005臺北縣議員紀錄與後續新北市議員及立法委員紀錄為同一位中國國民黨候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2005,2010,2014,2018,2022,2024],"geographies":["臺北縣","新北市"],"party":"中國國民黨"}'
    ),
    (
        'e141c127-78d6-49fe-aa1e-a23589000194',
        '3942ac9e-1220-47a6-a36e-d5c11d344d37',
        '林國春',
        '2010至2018新北市議員及2016至2024新北市立法委員紀錄為同一位中國國民黨候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2010,2014,2016,2018,2020,2022,2024],"geography":"新北市","party":"中國國民黨"}'
    ),
    (
        '7c60b696-8469-4acb-b9d4-10fbbd73030b',
        '1912e1fe-d9e6-46cc-b612-6ede829105e4',
        '許明偉',
        '2014臺北市及2022新北市議員紀錄的姓名、生日與無黨籍身分一致。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2014,2022],"birthDate":"1954-02-25","party":"無黨籍","source":"https://votetw.com/data/candidate/%E8%A8%B1%E6%98%8E%E5%81%89"}'
    ),
    (
        'c3f2ec0a-4257-4659-af49-bd628dc4635c',
        'd466c866-e621-499b-92f8-a15d1b3b5ff4',
        '張榮法',
        '2005臺北縣及2014至2022臺北市議員紀錄的姓名、出生年與新黨身分一致。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2005,2014,2018,2022],"birthYear":1972,"party":"新黨","source":"https://votetw.com/data/candidate/%E5%BC%B5%E6%A6%AE%E6%B3%95"}'
    ),
    (
        '8fc94618-6de6-4632-8f00-8a13ae07c728',
        '5dffdbb8-9047-49d7-988f-b43e4bb38f6c',
        '黃柏霖',
        '2002至2022高雄市議員及2016至2024高雄市立法委員紀錄為同一位候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2002,2006,2010,2014,2016,2018,2020,2022,2024],"geography":"高雄市"}'
    ),
    (
        'a5ba4908-9a30-4936-9c43-609d5d9dd5bb',
        '03cf4239-bb35-41bb-858c-368e925f4d15',
        '廖先翔',
        '2018、2022新北市議員及2024新北市立法委員紀錄為同一位中國國民黨候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2018,2022,2024],"geography":"新北市","party":"中國國民黨"}'
    ),
    (
        '611a7935-b6e5-4c89-a0cf-62603d5fd279',
        '1866c816-4439-4dba-919f-3fe3ef5c2744',
        '謝志忠',
        '2005臺中縣議員與2010至2026臺中市議員及立法委員紀錄為同一位民主進步黨候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2005,2010,2014,2016,2018,2022,2024,2026],"geographies":["臺中縣","臺中市"],"party":"民主進步黨"}'
    ),
    (
        '74a35cbd-5846-4288-930b-1a36f37c5a94',
        '769d921c-72cb-46bb-9eea-f36511e82618',
        '陳志明',
        '2018新北市與2022臺北市議員紀錄為同一位時代力量候選人。',
        '{"rule":"remaining_councilor_cross_year_identity_review","years":[2018,2022],"party":"時代力量","source":"https://whoareyou.readr.tw/politics/38500"}'
    );

DO $verify$
BEGIN
    IF (SELECT COUNT(*) FROM _remaining_councilor_identity_merges) <> 10 THEN
        RAISE EXCEPTION 'Remaining councilor identity merge input count mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _remaining_councilor_identity_merges input
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
        RAISE EXCEPTION 'Remaining councilor identity input no longer matches the reviewed people';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _remaining_councilor_identity_merges input
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = input.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Remaining councilor identity gained a conflicting active decision';
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
    'codex:remaining-councilor-identity-review',
    NOW(),
    NOW()
FROM _remaining_councilor_identity_merges input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = input.duplicate_person_id
      AND existing.canonical_person_id = input.canonical_person_id
      AND existing.status IN ('suggested', 'verified')
);

CREATE TEMP TABLE _rejected_same_name_councilor_matches (
    source_person_id UUID NOT NULL,
    wrong_canonical_person_id UUID NOT NULL,
    source_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    PRIMARY KEY (source_person_id, wrong_canonical_person_id)
) ON COMMIT DROP;

INSERT INTO _rejected_same_name_councilor_matches (
    source_person_id,
    wrong_canonical_person_id,
    source_name,
    reason
) VALUES
    (
        '516bbb0c-b18d-4e55-b0c9-3e8f1bdca55a',
        '3d97e8ff-d610-4467-a140-4ff6e367f0fa',
        '王英文',
        '2014臺北市議員候選人不可因同名自動連至2022雲林縣議員候選人。'
    ),
    (
        '82a48da6-e4b4-4870-a570-cdf6eaf71e4c',
        'e2e3a497-7e72-438b-81d5-15e2ddbade3f',
        '陳淑華',
        '2006臺北市第3選舉區候選人與臺中市第6選舉區候選人為不同人。'
    ),
    (
        '9af109d7-17ad-4819-8569-2103a7ea8c17',
        'e2e3a497-7e72-438b-81d5-15e2ddbade3f',
        '陳淑華',
        '2010臺北市第3選舉區候選人與臺中市第6選舉區候選人為不同人。'
    );

UPDATE person_identity_matches match
SET match_status = 'rejected_match',
    score = 0,
    match_method = 'manual_same_name_geography_rejection_v1',
    match_reason = rejected.reason,
    evidence_json = COALESCE(match.evidence_json, '{}'::JSONB) || jsonb_build_object(
        'version', 'manual-same-name-geography-rejection-v1',
        'wrongCanonicalPersonId', rejected.wrong_canonical_person_id,
        'reviewedAt', '2026-08-01'
    ),
    reviewed_by = 'codex:remaining-councilor-identity-review',
    reviewed_at = NOW(),
    updated_at = NOW()
FROM _rejected_same_name_councilor_matches rejected
CROSS JOIN person_canonical_map canonical
WHERE match.source_person_id = rejected.source_person_id
  AND canonical.person_id = match.person_id
  AND canonical.canonical_person_id = rejected.wrong_canonical_person_id
  AND match.match_status = 'auto_matched';

DO $verify$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _rejected_same_name_councilor_matches rejected
        JOIN person_identity_matches match ON match.source_person_id = rejected.source_person_id
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE canonical.canonical_person_id = rejected.wrong_canonical_person_id
          AND match.match_status = 'rejected_match'
    ) <> 3 THEN
        RAISE EXCEPTION 'Same-name councilor rejection count mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _remaining_councilor_identity_merges input
        JOIN person_canonical_map canonical ON canonical.person_id = input.duplicate_person_id
        WHERE canonical.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Remaining councilor identities did not resolve to the reviewed canonical people';
    END IF;
END
$verify$;

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

COMMIT;
