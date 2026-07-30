CREATE TEMP TABLE _reviewed_cross_year_councilor_merges (
    duplicate_person_id UUID PRIMARY KEY,
    canonical_person_id UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_cross_year_councilor_merges VALUES
    (
        'bcd9695a-fd9a-424e-ae9b-b68fde68592d',
        '262236bd-047b-4e59-9e8f-cddf6aaaae3a',
        '陳儀君：2018 與 2022 紀錄均為中國國民黨籍新北市議員候選人且當選；選區由第8改列第9，官方公報姓名、性別、學歷與連任經歷一致。',
        jsonb_build_object(
            'version', 'cross-year-councilor-review-v1',
            'observedDate', '2026-07-30',
            'electionYears', jsonb_build_array(2018, 2022),
            'region', '新北市',
            'party', '中國國民黨',
            'districts', jsonb_build_array('2018 第8選舉區', '2022 第9選舉區'),
            'candidateNumbers', jsonb_build_array('8', '2'),
            'result', 'elected_both_years',
            'officialProfileMatch', jsonb_build_array(
                '國立臺灣大學政治系公共行政組',
                '美國西北理工大學企管碩士'
            )
        )
    ),
    (
        'b4127571-89c7-4800-8586-b4b236fe9b49',
        'ec752500-b11b-4814-8817-5d82ae991de8',
        '彭盛韶：2018 與 2022 紀錄均為時代力量籍新北市議員候選人；選區由第4改列第5，官方公報姓名、性別、學歷與主要政治經歷一致。',
        jsonb_build_object(
            'version', 'cross-year-councilor-review-v1',
            'observedDate', '2026-07-30',
            'electionYears', jsonb_build_array(2018, 2022),
            'region', '新北市',
            'party', '時代力量',
            'districts', jsonb_build_array('2018 第4選舉區', '2022 第5選舉區'),
            'candidateNumbers', jsonb_build_array('6', '7'),
            'result', 'not_elected_both_years',
            'officialProfileMatch', jsonb_build_array(
                '國立臺灣大學資訊工程研究所碩士',
                '國立中正大學資訊工程學系學士',
                '經濟部部長秘書',
                '臺北市政府資訊局職務'
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
    'system:cross-year-councilor-review',
    NOW(),
    NOW()
FROM _reviewed_cross_year_councilor_merges reviewed
JOIN people duplicate ON duplicate.id = reviewed.duplicate_person_id
JOIN people canonical ON canonical.id = reviewed.canonical_person_id
WHERE NOT EXISTS (
    SELECT 1
    FROM person_merge_decisions existing
    WHERE existing.duplicate_person_id = reviewed.duplicate_person_id
      AND existing.status IN ('suggested', 'verified')
);
