WITH target_election AS (
    INSERT INTO elections (
        external_id,
        name,
        year,
        election_type,
        voting_date,
        status,
        source_name,
        source_url,
        is_public,
        updated_at
    )
    VALUES (
        'cec-2022-chiayi-city-mayor-rerun',
        '2022年嘉義市第11屆市長重行選舉',
        2022,
        'local',
        DATE '2022-12-18',
        'completed',
        '中央選舉委員會：嘉義市第11屆市長重行選舉',
        'https://db.cec.gov.tw/ElecTable/Election?type=CountyMayor',
        TRUE,
        NOW()
    )
    ON CONFLICT (external_id) DO UPDATE SET
        name = EXCLUDED.name,
        year = EXCLUDED.year,
        election_type = EXCLUDED.election_type,
        voting_date = EXCLUDED.voting_date,
        status = EXCLUDED.status,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        is_public = EXCLUDED.is_public,
        updated_at = NOW()
    RETURNING id
)
INSERT INTO races (
    external_id,
    election_id,
    region_id,
    race_type,
    title,
    voting_date,
    status,
    source_name,
    source_url,
    is_public,
    updated_at
)
SELECT
    'cec-2022-chiayi-city-mayor-rerun',
    target_election.id,
    regions.id,
    'county_mayor',
    '嘉義市市長選舉',
    DATE '2022-12-18',
    'completed',
    '中央選舉委員會：嘉義市第11屆市長重行選舉結果',
    'https://web.cec.gov.tw/central/article/37714',
    TRUE,
    NOW()
FROM target_election
JOIN regions ON regions.slug = 'chiayi-city'
ON CONFLICT (external_id) DO UPDATE SET
    election_id = EXCLUDED.election_id,
    region_id = EXCLUDED.region_id,
    race_type = EXCLUDED.race_type,
    title = EXCLUDED.title,
    voting_date = EXCLUDED.voting_date,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO people (
    external_id,
    name,
    party,
    position,
    election_year,
    district,
    source_url,
    is_public,
    gender,
    education,
    experience,
    updated_at
)
VALUES (
    'cec-2022-chiayi-city-mayor-rerun-person-5',
    '鄭凱升',
    '無黨籍',
    '嘉義市市長候選人',
    2022,
    '嘉義市',
    'https://eebulletin.cec.gov.tw/111/23%E5%98%89%E7%BE%A9%E5%B8%82/01%E5%B8%82%E9%95%B7/%E5%98%89%E7%BE%A9%E5%B8%82%E7%AC%AC11%E5%B1%86%E5%B8%82%E9%95%B7%E9%87%8D%E8%A1%8C%E9%81%B8%E8%88%89%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
    TRUE,
    'male',
    '明新科技大學電子工程系畢；嘉義高工汽車科畢；玉山國民中學畢；僑平國民小學畢',
    '嘉義市第11屆市長候選人黃紹聰競選總部總幹事；稻江科技暨管理學院學務處課外活動指導組社團輔導人員；南臺科技大學嘉義教學中心行政助理；旺宏電子公司設備高級技術師',
    NOW()
)
ON CONFLICT (external_id) DO UPDATE SET
    name = EXCLUDED.name,
    party = EXCLUDED.party,
    position = EXCLUDED.position,
    election_year = EXCLUDED.election_year,
    district = EXCLUDED.district,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    gender = EXCLUDED.gender,
    education = EXCLUDED.education,
    experience = EXCLUDED.experience,
    updated_at = NOW();

WITH merge_rows (duplicate_external_id, canonical_external_id, reason) AS (
    VALUES
        (
            'votetw-person-0ff0fd9326e05031',
            'cec-2012-person-eccda22bd4a5',
            'Official 2022 election bulletin confirms that the 2012 and 2016 Li Chun-yi candidacies share the same identity and career history.'
        ),
        (
            'votetw-person-b85b256d3a9430aa',
            'votetw-person-8e4df04859b64411',
            'Official 2022 election bulletin confirms the same Chen Tai-shan birth date across the 2018 and 2020 records.'
        ),
        (
            'votetw-person-12401effb224425f',
            'votetw-person-02099657c9bbafc6',
            'Official 2022 election bulletin confirms the same uniquely named candidate and cross-year election history.'
        ),
        (
            'votetw-person-3908ba7765a55be3',
            'votetw-person-02099657c9bbafc6',
            'Official 2022 election bulletin confirms the same uniquely named candidate and cross-year election history.'
        )
)
INSERT INTO person_merge_decisions (
    duplicate_person_id,
    canonical_person_id,
    status,
    confidence_level,
    reason,
    evidence_json,
    reviewed_by,
    reviewed_at
)
SELECT
    duplicate.id,
    canonical.id,
    'verified',
    'A',
    merge_rows.reason,
    jsonb_build_object(
        'version', 'cec-2022-chiayi-mayor-rerun-v1',
        'sourceUrl', 'https://eebulletin.cec.gov.tw/111/23%E5%98%89%E7%BE%A9%E5%B8%82/01%E5%B8%82%E9%95%B7/%E5%98%89%E7%BE%A9%E5%B8%82%E7%AC%AC11%E5%B1%86%E5%B8%82%E9%95%B7%E9%87%8D%E8%A1%8C%E9%81%B8%E8%88%89%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf'
    ),
    'system:cec-official-election',
    NOW()
FROM merge_rows
JOIN people duplicate ON duplicate.external_id = merge_rows.duplicate_external_id
JOIN people canonical ON canonical.external_id = merge_rows.canonical_external_id
WHERE duplicate.id <> canonical.id
  AND NOT EXISTS (
      SELECT 1
      FROM person_merge_decisions existing
      WHERE existing.duplicate_person_id = duplicate.id
        AND existing.canonical_person_id = canonical.id
        AND existing.status = 'verified'
  );

WITH profile_rows (
    candidate_no,
    person_external_id,
    person_name,
    gender,
    birth_date,
    party,
    education,
    experience
) AS (
    VALUES
        (
            '1',
            'votetw-person-050c1cb8f8324450',
            '黃敏惠',
            'female',
            DATE '1959-01-20',
            '中國國民黨',
            '嘉義大學管理碩士；臺灣師範大學國文系；宏仁女中；嘉義國中；垂楊國小',
            '中山女高教師；第三屆國大代表；第四、五、六屆立法委員；第七、八、十屆嘉義市市長；中華民國智障者體育運動協會理事長；救國團總團部指導委員；中國國民黨副主席、代理主席'
        ),
        (
            '2',
            'cec-2012-person-eccda22bd4a5',
            '李俊俋',
            'male',
            DATE '1965-07-06',
            '民主進步黨',
            '美國波士頓學院政治研究所碩士；文化大學政治系學士；嘉義市民族國小',
            '美國喬治華盛頓大學政治研究所博士班結業；嘉義市副市長；考試院銓敘部政務次長；總統府國策顧問兼憲改辦公室主任；第八、九屆立法委員；總統府副秘書長'
        ),
        (
            '3',
            'votetw-person-8e4df04859b64411',
            '陳泰山',
            'male',
            DATE '1949-10-05',
            '無黨籍',
            '淡江大學國際事務與戰略研究所法學碩士畢業；省立屏東農業專科學校三年制獸醫科畢業；省立後壁高中畢業；竹崎初中畢業',
            '經濟部台灣肥料公司化學肥料技術員；陳泰山犬病專科醫院院長；台北市獸醫師公會常務監事；農委會草食動物特約獸醫師；農委會中央畜產會主任獸醫師'
        ),
        (
            '4',
            'votetw-person-02099657c9bbafc6',
            '黃宏成台灣阿成世界偉人財神總統',
            'male',
            DATE '1968-03-20',
            '無黨籍',
            '東吳法律',
            '2014嘉義縣長候選人；2016嘉義市立法委員候選人；2018嘉義市長候選人；2020嘉義市立法委員候選人'
        ),
        (
            '5',
            'cec-2022-chiayi-city-mayor-rerun-person-5',
            '鄭凱升',
            'male',
            DATE '1978-02-25',
            '無黨籍',
            '明新科技大學電子工程系畢；嘉義高工汽車科畢；玉山國民中學畢；僑平國民小學畢',
            '嘉義市第11屆市長候選人黃紹聰競選總部總幹事；稻江科技暨管理學院學務處課外活動指導組社團輔導人員；南臺科技大學嘉義教學中心行政助理；旺宏電子公司設備高級技術師'
        )
)
INSERT INTO source_people (
    source_person_key,
    source_type,
    source_id,
    source_name,
    source_url,
    raw_name,
    normalized_name,
    gender,
    position,
    normalized_role,
    election_year,
    district,
    normalized_region,
    external_person_id,
    external_record_id,
    source_payload,
    confidence_suggestion,
    ingest_batch_key,
    is_public,
    updated_at
)
SELECT
    'cec-2022-chiayi-city-mayor-rerun:' || profile_rows.candidate_no,
    'official_election',
    'cec-2022-chiayi-city-mayor-rerun',
    '中央選舉委員會：嘉義市第11屆市長重行選舉選舉公報',
    'https://eebulletin.cec.gov.tw/111/23%E5%98%89%E7%BE%A9%E5%B8%82/01%E5%B8%82%E9%95%B7/%E5%98%89%E7%BE%A9%E5%B8%82%E7%AC%AC11%E5%B1%86%E5%B8%82%E9%95%B7%E9%87%8D%E8%A1%8C%E9%81%B8%E8%88%89%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
    profile_rows.person_name,
    profile_rows.person_name,
    profile_rows.gender,
    '嘉義市市長候選人',
    'local_chief',
    2022,
    '嘉義市',
    '嘉義市',
    profile_rows.person_external_id,
    'candidate-' || profile_rows.candidate_no,
    jsonb_build_object(
        'electionYear', 2022,
        'votingDate', '2022-12-18',
        'raceTitle', '嘉義市市長選舉',
        'candidateNo', profile_rows.candidate_no,
        'birthDate', profile_rows.birth_date,
        'gender', profile_rows.gender,
        'party', profile_rows.party,
        'education', profile_rows.education,
        'experience', profile_rows.experience
    ),
    'A',
    'cec-2022-chiayi-city-mayor-rerun',
    TRUE,
    NOW()
FROM profile_rows
ON CONFLICT (source_person_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    raw_name = EXCLUDED.raw_name,
    normalized_name = EXCLUDED.normalized_name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    normalized_role = EXCLUDED.normalized_role,
    election_year = EXCLUDED.election_year,
    district = EXCLUDED.district,
    normalized_region = EXCLUDED.normalized_region,
    external_person_id = EXCLUDED.external_person_id,
    external_record_id = EXCLUDED.external_record_id,
    source_payload = EXCLUDED.source_payload,
    confidence_suggestion = EXCLUDED.confidence_suggestion,
    ingest_batch_key = EXCLUDED.ingest_batch_key,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

WITH source_targets (source_person_key, person_external_id) AS (
    VALUES
        ('cec-2022-chiayi-city-mayor-rerun:1', 'votetw-person-050c1cb8f8324450'),
        ('cec-2022-chiayi-city-mayor-rerun:2', 'cec-2012-person-eccda22bd4a5'),
        ('cec-2022-chiayi-city-mayor-rerun:3', 'votetw-person-8e4df04859b64411'),
        ('cec-2022-chiayi-city-mayor-rerun:4', 'votetw-person-02099657c9bbafc6'),
        ('cec-2022-chiayi-city-mayor-rerun:5', 'cec-2022-chiayi-city-mayor-rerun-person-5')
)
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
    source.id,
    target.id,
    'auto_matched',
    100,
    'official_name_election_profile',
    'Official CEC bulletin matched by candidate number, name, election, and verified cross-year identity.',
    jsonb_build_object('version', 'cec-2022-chiayi-mayor-rerun-v1'),
    'system:cec-official-election',
    NOW(),
    NOW()
FROM source_targets
JOIN source_people source ON source.source_person_key = source_targets.source_person_key
JOIN people target ON target.external_id = source_targets.person_external_id
ON CONFLICT (source_person_id, person_id) DO UPDATE SET
    match_status = EXCLUDED.match_status,
    score = EXCLUDED.score,
    match_method = EXCLUDED.match_method,
    match_reason = EXCLUDED.match_reason,
    evidence_json = EXCLUDED.evidence_json,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = NOW();

WITH profile_rows (person_external_id, gender, party, education, experience) AS (
    VALUES
        ('votetw-person-050c1cb8f8324450', 'female', '中國國民黨', '嘉義大學管理碩士；臺灣師範大學國文系；宏仁女中；嘉義國中；垂楊國小', '中山女高教師；第三屆國大代表；第四、五、六屆立法委員；第七、八、十屆嘉義市市長；中華民國智障者體育運動協會理事長；救國團總團部指導委員；中國國民黨副主席、代理主席'),
        ('cec-2012-person-eccda22bd4a5', 'male', '民主進步黨', '美國波士頓學院政治研究所碩士；文化大學政治系學士；嘉義市民族國小', '美國喬治華盛頓大學政治研究所博士班結業；嘉義市副市長；考試院銓敘部政務次長；總統府國策顧問兼憲改辦公室主任；第八、九屆立法委員；總統府副秘書長'),
        ('votetw-person-8e4df04859b64411', 'male', '無黨籍', '淡江大學國際事務與戰略研究所法學碩士畢業；省立屏東農業專科學校三年制獸醫科畢業；省立後壁高中畢業；竹崎初中畢業', '經濟部台灣肥料公司化學肥料技術員；陳泰山犬病專科醫院院長；台北市獸醫師公會常務監事；農委會草食動物特約獸醫師；農委會中央畜產會主任獸醫師'),
        ('votetw-person-02099657c9bbafc6', 'male', '無黨籍', '東吳法律', '2014嘉義縣長候選人；2016嘉義市立法委員候選人；2018嘉義市長候選人；2020嘉義市立法委員候選人'),
        ('cec-2022-chiayi-city-mayor-rerun-person-5', 'male', '無黨籍', '明新科技大學電子工程系畢；嘉義高工汽車科畢；玉山國民中學畢；僑平國民小學畢', '嘉義市第11屆市長候選人黃紹聰競選總部總幹事；稻江科技暨管理學院學務處課外活動指導組社團輔導人員；南臺科技大學嘉義教學中心行政助理；旺宏電子公司設備高級技術師')
)
UPDATE people target
SET
    gender = profile_rows.gender,
    party = profile_rows.party,
    education = profile_rows.education,
    experience = profile_rows.experience,
    source_url = 'https://eebulletin.cec.gov.tw/111/23%E5%98%89%E7%BE%A9%E5%B8%82/01%E5%B8%82%E9%95%B7/%E5%98%89%E7%BE%A9%E5%B8%82%E7%AC%AC11%E5%B1%86%E5%B8%82%E9%95%B7%E9%87%8D%E8%A1%8C%E9%81%B8%E8%88%89%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1.pdf',
    updated_at = NOW()
FROM profile_rows
WHERE target.external_id = profile_rows.person_external_id;

WITH claim_rows (source_person_key, person_external_id, claim_type, claim_value) AS (
    VALUES
        ('cec-2022-chiayi-city-mayor-rerun:1', 'votetw-person-050c1cb8f8324450', 'birth_date', '1959-01-20'),
        ('cec-2022-chiayi-city-mayor-rerun:1', 'votetw-person-050c1cb8f8324450', 'gender', 'female'),
        ('cec-2022-chiayi-city-mayor-rerun:1', 'votetw-person-050c1cb8f8324450', 'education', '嘉義大學管理碩士；臺灣師範大學國文系；宏仁女中；嘉義國中；垂楊國小'),
        ('cec-2022-chiayi-city-mayor-rerun:1', 'votetw-person-050c1cb8f8324450', 'experience', '中山女高教師；第三屆國大代表；第四、五、六屆立法委員；第七、八、十屆嘉義市市長；中華民國智障者體育運動協會理事長；救國團總團部指導委員；中國國民黨副主席、代理主席'),
        ('cec-2022-chiayi-city-mayor-rerun:2', 'cec-2012-person-eccda22bd4a5', 'birth_date', '1965-07-06'),
        ('cec-2022-chiayi-city-mayor-rerun:2', 'cec-2012-person-eccda22bd4a5', 'gender', 'male'),
        ('cec-2022-chiayi-city-mayor-rerun:2', 'cec-2012-person-eccda22bd4a5', 'education', '美國波士頓學院政治研究所碩士；文化大學政治系學士；嘉義市民族國小'),
        ('cec-2022-chiayi-city-mayor-rerun:2', 'cec-2012-person-eccda22bd4a5', 'experience', '美國喬治華盛頓大學政治研究所博士班結業；嘉義市副市長；考試院銓敘部政務次長；總統府國策顧問兼憲改辦公室主任；第八、九屆立法委員；總統府副秘書長'),
        ('cec-2022-chiayi-city-mayor-rerun:3', 'votetw-person-8e4df04859b64411', 'birth_date', '1949-10-05'),
        ('cec-2022-chiayi-city-mayor-rerun:3', 'votetw-person-8e4df04859b64411', 'gender', 'male'),
        ('cec-2022-chiayi-city-mayor-rerun:3', 'votetw-person-8e4df04859b64411', 'education', '淡江大學國際事務與戰略研究所法學碩士畢業；省立屏東農業專科學校三年制獸醫科畢業；省立後壁高中畢業；竹崎初中畢業'),
        ('cec-2022-chiayi-city-mayor-rerun:3', 'votetw-person-8e4df04859b64411', 'experience', '經濟部台灣肥料公司化學肥料技術員；陳泰山犬病專科醫院院長；台北市獸醫師公會常務監事；農委會草食動物特約獸醫師；農委會中央畜產會主任獸醫師'),
        ('cec-2022-chiayi-city-mayor-rerun:4', 'votetw-person-02099657c9bbafc6', 'birth_date', '1968-03-20'),
        ('cec-2022-chiayi-city-mayor-rerun:4', 'votetw-person-02099657c9bbafc6', 'gender', 'male'),
        ('cec-2022-chiayi-city-mayor-rerun:4', 'votetw-person-02099657c9bbafc6', 'education', '東吳法律'),
        ('cec-2022-chiayi-city-mayor-rerun:4', 'votetw-person-02099657c9bbafc6', 'experience', '2014嘉義縣長候選人；2016嘉義市立法委員候選人；2018嘉義市長候選人；2020嘉義市立法委員候選人'),
        ('cec-2022-chiayi-city-mayor-rerun:5', 'cec-2022-chiayi-city-mayor-rerun-person-5', 'birth_date', '1978-02-25'),
        ('cec-2022-chiayi-city-mayor-rerun:5', 'cec-2022-chiayi-city-mayor-rerun-person-5', 'gender', 'male'),
        ('cec-2022-chiayi-city-mayor-rerun:5', 'cec-2022-chiayi-city-mayor-rerun-person-5', 'education', '明新科技大學電子工程系畢；嘉義高工汽車科畢；玉山國民中學畢；僑平國民小學畢'),
        ('cec-2022-chiayi-city-mayor-rerun:5', 'cec-2022-chiayi-city-mayor-rerun-person-5', 'experience', '嘉義市第11屆市長候選人黃紹聰競選總部總幹事；稻江科技暨管理學院學務處課外活動指導組社團輔導人員；南臺科技大學嘉義教學中心行政助理；旺宏電子公司設備高級技術師')
)
INSERT INTO person_claims (
    claim_key,
    person_id,
    source_person_id,
    claim_type,
    claim_value,
    claim_json,
    confidence_level,
    review_status,
    visibility,
    source_name,
    source_url,
    observed_at,
    is_public,
    review_score,
    scoring_version,
    scoring_reasons,
    auto_reviewed_at,
    updated_at
)
SELECT
    claim_rows.source_person_key || ':' || claim_rows.claim_type,
    target.id,
    source.id,
    claim_rows.claim_type,
    claim_rows.claim_value,
    source.source_payload || jsonb_build_object('field', claim_rows.claim_type),
    'A',
    'verified',
    'public',
    source.source_name,
    source.source_url,
    TIMESTAMPTZ '2022-12-18 00:00:00+08',
    TRUE,
    100,
    'cec-official-election-v1',
    jsonb_build_array('Official CEC election bulletin'),
    NOW(),
    NOW()
FROM claim_rows
JOIN source_people source ON source.source_person_key = claim_rows.source_person_key
JOIN people target ON target.external_id = claim_rows.person_external_id
ON CONFLICT (claim_key) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    source_person_id = EXCLUDED.source_person_id,
    claim_value = EXCLUDED.claim_value,
    claim_json = EXCLUDED.claim_json,
    confidence_level = EXCLUDED.confidence_level,
    review_status = EXCLUDED.review_status,
    visibility = EXCLUDED.visibility,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    observed_at = EXCLUDED.observed_at,
    is_public = EXCLUDED.is_public,
    review_score = EXCLUDED.review_score,
    scoring_version = EXCLUDED.scoring_version,
    scoring_reasons = EXCLUDED.scoring_reasons,
    auto_reviewed_at = EXCLUDED.auto_reviewed_at,
    updated_at = NOW();

WITH candidate_rows (
    candidate_no,
    person_external_id,
    party,
    vote_count,
    vote_rate,
    is_elected
) AS (
    VALUES
        ('1', 'votetw-person-050c1cb8f8324450', '中國國民黨', 59874, 63.82::NUMERIC, TRUE),
        ('2', 'cec-2012-person-eccda22bd4a5', '民主進步黨', 32790, 34.95::NUMERIC, FALSE),
        ('3', 'votetw-person-8e4df04859b64411', '無黨籍', 246, 0.26::NUMERIC, FALSE),
        ('4', 'votetw-person-02099657c9bbafc6', '無黨籍', 535, 0.57::NUMERIC, FALSE),
        ('5', 'cec-2022-chiayi-city-mayor-rerun-person-5', '無黨籍', 368, 0.39::NUMERIC, FALSE)
)
INSERT INTO candidates (
    external_id,
    person_id,
    race_id,
    party,
    candidate_no,
    registration_status,
    source_name,
    source_url,
    is_public,
    vote_count,
    vote_rate,
    is_elected,
    is_incumbent,
    candidacy_status,
    election_result,
    status_updated_at,
    updated_at
)
SELECT
    'cec-2022-chiayi-city-mayor-rerun-candidate-' || candidate_rows.candidate_no,
    target.id,
    race.id,
    candidate_rows.party,
    candidate_rows.candidate_no,
    CASE WHEN candidate_rows.is_elected THEN 'elected' ELSE 'not_elected' END,
    '中央選舉委員會：嘉義市第11屆市長重行選舉結果',
    'https://web.cec.gov.tw/central/article/37714',
    TRUE,
    candidate_rows.vote_count,
    candidate_rows.vote_rate,
    candidate_rows.is_elected,
    candidate_rows.candidate_no = '1',
    'qualified',
    CASE WHEN candidate_rows.is_elected THEN 'elected' ELSE 'not_elected' END,
    TIMESTAMPTZ '2022-12-22 00:00:00+08',
    NOW()
FROM candidate_rows
JOIN people target ON target.external_id = candidate_rows.person_external_id
JOIN races race ON race.external_id = 'cec-2022-chiayi-city-mayor-rerun'
ON CONFLICT (external_id) DO UPDATE SET
    person_id = EXCLUDED.person_id,
    race_id = EXCLUDED.race_id,
    party = EXCLUDED.party,
    candidate_no = EXCLUDED.candidate_no,
    registration_status = EXCLUDED.registration_status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    vote_count = EXCLUDED.vote_count,
    vote_rate = EXCLUDED.vote_rate,
    is_elected = EXCLUDED.is_elected,
    is_incumbent = EXCLUDED.is_incumbent,
    candidacy_status = EXCLUDED.candidacy_status,
    election_result = EXCLUDED.election_result,
    status_updated_at = EXCLUDED.status_updated_at,
    updated_at = NOW();

REFRESH MATERIALIZED VIEW public_people_list_cached;
