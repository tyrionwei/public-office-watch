CREATE TEMP TABLE _reviewed_indigenous_name_merges (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_indigenous_name_merges VALUES
    (
        'b6cf0ca0-978c-43bf-ab4f-b0d87b61f6bd',
        'e0e84214-1295-4aca-866d-eef7598625cf',
        '高忠德 Takiludun．Anu：2022 中選會與 VoteTW 紀錄同為高雄市第14選舉區、無黨籍、1號且當選；高雄市議會現任名冊僅使用不同空格、括號與分隔符格式。',
        jsonb_build_object(
            'version', 'indigenous-name-format-review-v1',
            'observedDate', '2026-07-30',
            'electionYear', 2022,
            'region', '高雄市',
            'district', '第14選舉區（山地原住民）',
            'candidateNumber', '1',
            'nameVariants', jsonb_build_array(
                '高忠德 Takiludun．Anu',
                '高忠德(Taki ludun‧Anu)'
            )
        )
    ),
    (
        '3b29cc8e-b1eb-44f6-953f-9d2d690b83de',
        'bdfc752d-470c-46d4-8b47-ad8aa9cb6651',
        '范織欽 Pasulang．Tomatalate：2018 與 2022 紀錄均為高雄市第15選舉區；2022 中選會與 VoteTW 紀錄同為無黨籍、1號且當選，高雄市議會現任名冊僅使用不同括號與分隔符格式。',
        jsonb_build_object(
            'version', 'indigenous-name-format-review-v1',
            'observedDate', '2026-07-30',
            'electionYears', jsonb_build_array(2018, 2022),
            'region', '高雄市',
            'district', '第15選舉區（山地原住民）',
            'candidateNumber', '1',
            'nameVariants', jsonb_build_array(
                '范織欽 Pasulang．Tomatalate',
                '范織欽(Pasulang‧Tomatalate)'
            )
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
    'system:indigenous-name-format-review',
    NOW(),
    NOW()
FROM _reviewed_indigenous_name_merges reviewed
JOIN people duplicate ON duplicate.id = reviewed.duplicate_person_id
JOIN people canonical ON canonical.id = reviewed.canonical_person_id
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = reviewed.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);
