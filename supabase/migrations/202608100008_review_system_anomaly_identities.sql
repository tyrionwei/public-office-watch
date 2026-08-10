SET statement_timeout = 0;

BEGIN;

CREATE TEMP TABLE _system_anomaly_identity_merges (
    canonical_person_id UUID NOT NULL,
    duplicate_person_id UUID PRIMARY KEY,
    expected_name TEXT NOT NULL,
    confidence_level TEXT NOT NULL,
    basis TEXT NOT NULL,
    evidence_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _system_anomaly_identity_merges VALUES
    ('85334462-0763-4e72-ae58-7ad0f1d3df08', '547d51e3-1c32-401b-bedd-5b30b7d9a588', '何開忠', 'A', '2018、2022 均為金門縣金沙鎮鎮民代表，姓名、職務、選區及候選號次相符。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E4%BD%95%E9%96%8B%E5%BF%A0&is_current=false&page=1'),
    ('2556112f-29ff-4fe9-a46f-2c7574a3585d', '87fa0582-daae-4370-9f59-528d4196116d', '余瑞凱', 'A', '2018、2022 均參選臺南市龍崎區石𥕢里里長，姓名、村里及候選號次相符；2022 字形為來源編碼差異。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E4%BD%99%E7%91%9E%E5%87%B1&is_current=false&page=1'),
    ('54709b82-1761-4aa8-aec2-6a1eb704aef2', '7a0b90c8-8775-4bc0-8b60-85957f894288', '余筱菁', 'A', '同一筆 2024 新竹縣第1選舉區立委候選紀錄被綠黨與台灣綠黨別名拆成兩人，候選號次均為4。', 'https://db.cec.gov.tw/ElecTable/Election/ElecTickets?areaCode=00&cityCode=004&dataLevel=A&dataType=tickets&deptCode=000&legisId=L1&liCode=0000&prvCode=10&subjectId=L0&themeId=be404784efb488c1004009663c892e18&typeId=ELC'),
    ('d40f84b6-9c7b-4247-95f1-d81c40f65a48', '177c872c-2893-433c-a4ba-692005aaf686', '余遠山', 'A', '2018、2022 均為桃園市復興區第2選舉區區民代表，姓名、職務及選區相符。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E4%BD%99%E9%81%A0%E5%B1%B1&is_current=false&page=1'),
    ('871d482b-dcfe-4a6f-a395-e073d4a2a5fd', '18741fc5-dbf8-4094-a691-ce0c87a6bb90', '余金鐘', 'A', '2018、2022 均為高雄市桃源區第1選舉區區民代表，姓名、職務及選區相符。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E4%BD%99%E9%87%91%E9%90%98&is_current=false&page=1'),
    ('690049d3-514b-423e-ae13-11977795ad6b', '92e97c5d-3a08-40d8-adcb-533929807d16', '倪于媃', 'A', '2018、2022 均為金門縣金城鎮鎮民代表，姓名、政黨、職務及選區相符。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E5%80%AA%E4%BA%8E%E5%AA%83&is_current=false&page=1'),
    ('01b02eb3-ea82-4f91-a8bb-2653f3691f79', 'f2162822-91c3-40f2-b10e-71fbd8f309d8', '凌子楚', 'A', '中選會候選人歷史及嘉義市議會履歷確認2018、2020、2022參選紀錄為同一人。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E5%87%8C%E5%AD%90%E6%A5%9A&is_current=false&page=1'),
    ('63259b19-8560-4b7b-a40f-ee3248232754', 'b936db69-8463-4f14-893f-e9a150c04c4a', '冼義哲', 'A', '中選會資料及候選人履歷確認2016澎湖立委與2018澎湖縣議員候選紀錄為同一人。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E5%86%BC%E7%BE%A9%E5%93%B2&is_current=false&page=1'),
    ('1d942783-e840-47df-a3fa-282d56fc605c', '5dad1532-02d8-4100-a044-97e9b9057941', '余振維', 'A', '中選會資料確認2018臺東市民代表與2022臺東縣議員候選紀錄同屬民主進步黨同名政治人物。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E4%BD%99%E6%8C%AF%E7%B6%AD&is_current=false&page=1'),
    ('9a175b2c-8d45-4aac-a18d-4d247e9092e5', 'e950080f-70e1-4edf-8ca0-28d24b5fc907', '何在鑫', 'A', '中選會資料確認2018公館鄉民代表與2022公館鄉長候選紀錄為同一地方政治人物。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E4%BD%95%E5%9C%A8%E9%91%AB&is_current=false&page=1'),
    ('f2f520e1-93b6-40b8-8561-c5b95b932419', 'd4505237-8bdb-45a0-9c34-6ff6835303b7', '何麗莉', 'A', '中選會資料確認2018屏東縣議員與2020屏東縣立委候選紀錄同屬中華統一促進黨同名人物；2022桃園同名里長維持獨立。', 'https://db.cec.gov.tw/Candidate/?cand_name=%E4%BD%95%E9%BA%97%E8%8E%89&is_current=false&page=1');

DO $verify_merges$
BEGIN
    IF (SELECT COUNT(*) FROM _system_anomaly_identity_merges) <> 11
       OR EXISTS (
           SELECT 1
           FROM _system_anomaly_identity_merges input
           LEFT JOIN people canonical ON canonical.id = input.canonical_person_id
           LEFT JOIN people duplicate ON duplicate.id = input.duplicate_person_id
           LEFT JOIN person_canonical_map canonical_state ON canonical_state.person_id = input.canonical_person_id
           WHERE canonical.id IS NULL
              OR duplicate.id IS NULL
              OR canonical.name <> input.expected_name
              OR duplicate.name <> input.expected_name
              OR canonical_state.canonical_person_id <> input.canonical_person_id
       ) THEN
        RAISE EXCEPTION 'System anomaly merge boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _system_anomaly_identity_merges input
        JOIN person_merge_decisions decision ON decision.duplicate_person_id = input.duplicate_person_id
        WHERE decision.status IN ('suggested', 'verified')
          AND decision.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'System anomaly person already maps to another canonical person';
    END IF;
END
$verify_merges$;

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    input.duplicate_person_id,
    input.canonical_person_id,
    'verified',
    input.confidence_level,
    input.basis,
    jsonb_build_object(
        'version', 'system-anomaly-audit-v1',
        'evidenceKind', 'official_cec_cross_year_identity',
        'evidenceUrl', input.evidence_url
    ),
    'system:system-anomaly-audit-v1',
    NOW(),
    NOW()
FROM _system_anomaly_identity_merges input
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions decision
    WHERE decision.duplicate_person_id = input.duplicate_person_id
      AND decision.status IN ('suggested', 'verified')
);

-- Two different people named 葉光明 ran in different counties on the same day.
-- A colliding VoteTW external ID had incorrectly connected the Hualien Umin
-- Havang identity to the Taitung candidate.
UPDATE person_merge_decisions
SET
    status = 'rejected',
    reason = '同名但不同人：2018年分別參選臺東縣達仁鄉新化村與花蓮縣卓溪鄉立山村村長。',
    evidence_json = COALESCE(evidence_json, '{}'::JSONB) || jsonb_build_object(
        'correctionVersion', 'system-anomaly-audit-v1',
        'taitungOfficialSource', 'https://web.cec.gov.tw/api/file/cf4bf84b-ec91-4457-a8aa-937da5e82e37.pdf',
        'hualienOfficialSource', 'https://web.cec.gov.tw/api/file/c9e86162-e1db-4228-9322-196330a66a56.pdf'
    ),
    reviewed_by = 'system:system-anomaly-audit-v1',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id IN (
    'e7b51bc1-8abb-4909-b717-2c4217cbaaa8',
    'e2397ada-fd14-40d5-a202-a8b78c63815b'
)
  AND status = 'verified';

INSERT INTO person_merge_decisions (
    duplicate_person_id, canonical_person_id, status, confidence_level,
    reason, evidence_json, reviewed_by, reviewed_at, updated_at
)
SELECT
    '84158525-b499-4bc3-a5c8-2c6f45e863b4',
    '44553526-9948-4f7e-b5e1-532f33d87ab7',
    'verified',
    'A',
    '中選會與VoteTW的2018花蓮縣卓溪鄉立山村候選紀錄為同一位葉光明 Umin．Havang。',
    jsonb_build_object(
        'version', 'system-anomaly-audit-v1',
        'evidenceKind', 'same_official_race_candidate',
        'evidenceUrl', 'https://web.cec.gov.tw/api/file/c9e86162-e1db-4228-9322-196330a66a56.pdf'
    ),
    'system:system-anomaly-audit-v1',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions decision
    WHERE decision.duplicate_person_id = '84158525-b499-4bc3-a5c8-2c6f45e863b4'
      AND decision.status IN ('suggested', 'verified')
);

UPDATE person_claims
SET
    review_status = 'archived',
    visibility = 'private',
    is_public = FALSE,
    scoring_reasons = COALESCE(scoring_reasons, '[]'::JSONB) || jsonb_build_array(
        jsonb_build_object(
            'version', 'system-anomaly-audit-v1',
            'reason', 'VoteTW profile collision copied Taitung profile fields onto the Hualien Umin Havang identity',
            'reviewedAt', NOW()
        )
    ),
    updated_at = NOW()
WHERE person_id = '84158525-b499-4bc3-a5c8-2c6f45e863b4'
  AND (
      claim_type IN ('birth_date', 'education', 'experience', 'party_affiliation')
      OR (claim_type = 'external_id' AND claim_value = 'votetw:134185:葉光明:1962-07-10')
  );

SELECT published.promote(NULL);

DO $verify_result$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _system_anomaly_identity_merges input
        JOIN person_canonical_map canonical
          ON canonical.person_id = input.duplicate_person_id
         AND canonical.canonical_person_id = input.canonical_person_id
    ) <> 11 THEN
        RAISE EXCEPTION 'System anomaly identities were not merged';
    END IF;

    IF EXISTS (
        SELECT 1 FROM person_canonical_map
        WHERE person_id = '44553526-9948-4f7e-b5e1-532f33d87ab7'
          AND canonical_person_id <> '44553526-9948-4f7e-b5e1-532f33d87ab7'
    ) OR NOT EXISTS (
        SELECT 1 FROM person_canonical_map
        WHERE person_id = '84158525-b499-4bc3-a5c8-2c6f45e863b4'
          AND canonical_person_id = '44553526-9948-4f7e-b5e1-532f33d87ab7'
    ) OR EXISTS (
        SELECT 1 FROM person_claims
        WHERE person_id = '84158525-b499-4bc3-a5c8-2c6f45e863b4'
          AND review_status = 'verified'
          AND is_public = TRUE
          AND (
              claim_type IN ('birth_date', 'education', 'experience', 'party_affiliation')
              OR (claim_type = 'external_id' AND claim_value = 'votetw:134185:葉光明:1962-07-10')
          )
    ) THEN
        RAISE EXCEPTION '葉光明 identity split did not converge';
    END IF;
END
$verify_result$;

COMMIT;

RESET statement_timeout;
