SET statement_timeout = 0;

-- Current council sources exposed sixteen historical candidate profiles that
-- belong to the same people but were still separate canonical identities.
-- Every pair below was checked against an official council, election, party,
-- ministry or local-government source. Media-only corroboration remains B.
CREATE TEMP TABLE _reviewed_cross_role_official_merges (
    canonical_person_id UUID PRIMARY KEY,
    duplicate_person_id UUID UNIQUE NOT NULL,
    expected_name TEXT NOT NULL,
    canonical_context TEXT NOT NULL,
    duplicate_context TEXT NOT NULL,
    confidence_level TEXT NOT NULL,
    evidence_kind TEXT NOT NULL,
    evidence_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _reviewed_cross_role_official_merges VALUES
    ('61717702-3e81-4603-9a15-c0751aa13441', 'b63e779a-47e9-4162-9047-71d78b1343d2', '李中', '臺中市議員', '2020 臺中市第6選舉區立法委員候選人', 'A', 'official_party_candidate_page', 'https://www.kmt.org.tw/2019/12/blog-post_2.html'),
    ('c56135aa-d267-454b-8d8f-3fec1a219cca', '6483e2a3-08a8-42f7-a3ec-a4d63875a93a', '林燕祝', '臺南市議員', '2020 臺南市第4選舉區立法委員候選人', 'A', 'official_party_candidate_page', 'https://www.kmt.org.tw/2019/12/blog-post_1.html?m=1'),
    ('ae4fd7bb-d0b0-4164-b25c-f8fed49eadee', 'fee9b242-331f-41df-aa19-7ab5cacce51b', '林玉芬', '花蓮縣議員', '瑞穗鄉鄉民代表', 'A', 'official_council_profile', 'https://www.hlcc.gov.tw/councillor-data.php?index_no=86'),
    ('75453570-7d78-4a11-99b7-5e769852e95b', '267eca56-6669-4526-9d05-322d253a5c2a', '洪如萍', '雲林縣議員', '崙背鄉民代表', 'A', 'official_council_profile', 'https://www.ylcc.gov.tw/Congress_Detail.aspx?n=22127&sms=21659&s=514130'),
    ('0df2fc94-dcb4-45ee-bfbf-a8b5e172df8c', '31215178-938e-4a97-88a7-c9d978dda33b', '王國代', '金門縣議員', '2018 金沙鎮長候選人', 'A', 'official_local_government_report', 'https://www.kinmen.gov.tw/News_Content2.aspx?n=98E3CA7358C89100&s=080E572BB02C984A&sms=BF7D6D478B935644'),
    ('57e983c9-0415-47aa-a361-f372a6a24dbd', '2c59c3ea-300d-480d-945c-daf8a84b9684', '胡仁順', '花蓮縣議員', '花蓮市民代表', 'A', 'official_ministry_profile', 'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112UB00004&_TYP=REP&n=574'),
    ('99842f38-e9e0-4f15-b68c-9a27b190ffba', '50b80683-9734-468c-bcba-e843f2bd3e55', '蔡淑惠', '臺南市議員', '2020 臺南市第5選舉區立法委員候選人', 'A', 'official_party_candidate_page', 'https://www.kmt.org.tw/2019/12/blog-post_1.html?m=1'),
    ('b1845cb1-5092-4afc-8943-d7fd83478cc1', 'af939a8c-1183-40b7-b570-5b97d6d8f573', '蔡育輝', '臺南市議員', '2020 臺南市第1選舉區立法委員候選人', 'A', 'official_party_candidate_page', 'https://www.kmt.org.tw/2019/12/blog-post_1.html?m=1'),
    ('95c9aa21-8963-40aa-a33b-324fc5f2438f', 'fcf0a3bc-f11b-4074-a34b-6485e37b7ca3', '詹金富', '花蓮縣議員', '富里鄉民代表', 'A', 'official_council_profile', 'https://www.hlcc.gov.tw/councillor-data.php?index_no=82'),
    ('0d5088e5-c898-43b3-bf95-e3988d87cccd', '35160c78-58c2-49f5-ba32-2a8bf19d4a63', '賴義鍠', '臺中市議員', '2016 臺中市第7選舉區立法委員候選人', 'A', 'official_party_nomination', 'https://www.kmt.org.tw/2015/08/91-15.html'),
    ('e2fcf662-2829-4486-be5f-9031c183ae4f', '21e2b04d-51f2-447f-b7f0-9bf6b2abfd77', '鄭乾龍', '花蓮縣議員', '2018 吉安鄉長候選人', 'B', 'trusted_media_crosscheck', 'https://www.cna.com.tw/news/aipl/202204160092.aspx'),
    ('ab87f02f-b03f-476e-8d7e-3e24e53a597b', '68bdbcc2-bcc8-4a7f-869d-f08dfb6a6c48', '金淑敏', '花蓮縣議員', '卓溪鄉民代表', 'A', 'official_representative_history', 'https://www.zhuo-xi.gov.tw/cp.aspx?n=25471'),
    ('484c4550-a44a-43c3-bd75-86072128164c', '6c853726-cd3b-4645-8973-4b7705b71830', '韓林梅', '花蓮縣議員', '花蓮市民代表', 'A', 'official_ministry_profile', 'https://www.moi.gov.tw/LocalOfficial_Content.aspx?TYP=KND0002&_PARENT_ID=ER11112UB00006&_TYP=REP&n=574'),
    ('56ecb266-4ca0-47ee-82a9-2755c32a94b6', 'd71c4089-52dd-4b98-9bed-431bb9bd1e0c', '魏嘉賢', '花蓮縣議員', '花蓮市長', 'A', 'official_council_profile', 'https://www.hlcc.gov.tw/councillor-data.php?index_no=75'),
    ('ab789c43-2c98-4a02-a1f8-30d1615c9074', 'a5d153ce-94ae-4f7b-b4c1-df01a944a458', '黃桂蘭', '新北市議員', '2020 新北市第2選舉區立法委員候選人', 'A', 'official_party_candidate_page', 'https://www.kmt.org.tw/2019/12/blog-post_91.html'),
    ('e65fab08-6bef-4d0f-89b1-8251e7203851', 'd549a34a-cfd2-40f3-9d62-0cd376160e0d', '黃馨慧', '臺中市議員', '2020 臺中市第4選舉區立法委員候選人', 'A', 'official_party_candidate_page', 'https://www.kmt.org.tw/2019/12/blog-post_2.html');

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _reviewed_cross_role_official_merges) <> 16
       OR (
           SELECT COUNT(DISTINCT expected_name)
           FROM _reviewed_cross_role_official_merges
       ) <> 16
       OR EXISTS (
           SELECT 1
           FROM _reviewed_cross_role_official_merges input
           JOIN people canonical ON canonical.id = input.canonical_person_id
           JOIN people duplicate ON duplicate.id = input.duplicate_person_id
           WHERE canonical.name <> input.expected_name
              OR duplicate.name <> input.expected_name
              OR canonical.is_public <> TRUE
              OR duplicate.is_public <> TRUE
              OR canonical.id = duplicate.id
              OR input.confidence_level NOT IN ('A', 'B')
              OR NOT EXISTS (
                  SELECT 1 FROM candidates
                  WHERE person_id = canonical.id
              )
              OR NOT EXISTS (
                  SELECT 1 FROM candidates
                  WHERE person_id = duplicate.id
              )
       ) THEN
        RAISE EXCEPTION 'Reviewed cross-role official identity boundary drifted';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _reviewed_cross_role_official_merges input
        JOIN person_merge_decisions existing
          ON existing.duplicate_person_id = input.duplicate_person_id
         AND existing.status IN ('suggested', 'verified')
        WHERE existing.canonical_person_id <> input.canonical_person_id
    ) THEN
        RAISE EXCEPTION 'Reviewed cross-role identity gained a conflicting merge';
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
    input.confidence_level,
    CONCAT(
        input.expected_name,
        '：官方現任職務資料與歷史參選資料確認為同一人（',
        input.canonical_context,
        '／',
        input.duplicate_context,
        '）。'
    ),
    jsonb_build_object(
        'version', 'reviewed-cross-role-official-identity-v1',
        'canonicalContext', input.canonical_context,
        'duplicateContext', input.duplicate_context,
        'evidenceKind', input.evidence_kind,
        'evidenceUrl', input.evidence_url
    ),
    'system:reviewed-cross-role-official-identity-v1',
    NOW(),
    NOW()
FROM _reviewed_cross_role_official_merges input
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
                'version', 'reviewed-cross-role-official-identity-v1',
                'reason', 'pending claim relinked after reviewed cross-role identity merge',
                'reviewedAt', NOW()
            )
        ),
    updated_at = NOW()
FROM _reviewed_cross_role_official_merges input
WHERE claim.person_id = input.duplicate_person_id
  AND claim.review_status IN ('pending', 'needs_more_evidence');

SELECT published.promote(NULL);

DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM _reviewed_cross_role_official_merges input
        JOIN person_merge_decisions decision
          ON decision.duplicate_person_id = input.duplicate_person_id
         AND decision.canonical_person_id = input.canonical_person_id
         AND decision.status = 'verified'
        JOIN person_canonical_map canonical
          ON canonical.person_id = input.duplicate_person_id
         AND canonical.canonical_person_id = input.canonical_person_id
        WHERE decision.evidence_json->>'version' =
              'reviewed-cross-role-official-identity-v1'
    ) <> 16 THEN
        RAISE EXCEPTION 'Reviewed cross-role official identities were not merged';
    END IF;
END;
$$;

RESET statement_timeout;
