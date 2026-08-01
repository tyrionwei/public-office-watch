BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = '4089dba1-5963-4c12-b4a4-a50ed2754c33'
          AND name = '拔耐．茹妮老王'
    ) OR NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = '2a37533c-9e4c-4ac4-88d1-54c106cc704b'
          AND name = '拔耐．茹妮老王'
    ) THEN
        RAISE EXCEPTION 'Expected split 拔耐．茹妮老王 people were not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN elections election ON election.id = race.election_id
        WHERE candidate.id = '49c0cd61-8cc4-42ca-b850-16323d7d49be'
          AND candidate.person_id = '4089dba1-5963-4c12-b4a4-a50ed2754c33'
          AND candidate.party = '無黨籍'
          AND candidate.candidate_no = '10'
          AND candidate.vote_count IS NULL
          AND candidate.vote_rate IS NULL
          AND election.year = 2010
          AND race.title = '新北市第11選舉區平地原住民議員選舉'
    ) OR NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN elections election ON election.id = race.election_id
        WHERE candidate.person_id = '2a37533c-9e4c-4ac4-88d1-54c106cc704b'
          AND candidate.party = '無黨籍'
          AND election.year = 2014
          AND race.title = '基隆市第8選舉區平地原住民議員選舉'
    ) THEN
        RAISE EXCEPTION 'Expected 2010 and 2014 election history evidence changed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM source_people source
        WHERE source.id = 'f061e127-a623-44df-aaf9-1530ed9862f6'
          AND source.source_person_key = 'cec-historical:cafa78c3622e'
          AND source.raw_name = '拔耐．茹妮老王'
          AND source.election_year = 2010
          AND source.source_payload->>'candidateNo' = '10'
          AND (source.source_payload->>'voteCount')::INTEGER = 177
          AND (source.source_payload->>'voteRate')::NUMERIC = 1.43
    ) OR NOT EXISTS (
        SELECT 1
        FROM person_identity_matches
        WHERE id = '846f8ac6-8a90-4ff4-914a-312269923f53'
          AND source_person_id = 'f061e127-a623-44df-aaf9-1530ed9862f6'
          AND person_id = '2a37533c-9e4c-4ac4-88d1-54c106cc704b'
          AND match_status = 'auto_matched'
    ) OR NOT EXISTS (
        SELECT 1
        FROM person_identity_matches
        WHERE id = 'a8d9018a-e28f-4355-bf5f-51371b02c900'
          AND source_person_id = 'f061e127-a623-44df-aaf9-1530ed9862f6'
          AND person_id = '4089dba1-5963-4c12-b4a4-a50ed2754c33'
          AND match_status = 'auto_matched'
    ) THEN
        RAISE EXCEPTION 'Expected official 2010 source identity evidence changed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_merge_decisions decision
        WHERE decision.status IN ('suggested', 'verified', 'rejected', 'archived')
          AND (
              (decision.duplicate_person_id = '4089dba1-5963-4c12-b4a4-a50ed2754c33'
               AND decision.canonical_person_id = '2a37533c-9e4c-4ac4-88d1-54c106cc704b')
              OR
              (decision.duplicate_person_id = '2a37533c-9e4c-4ac4-88d1-54c106cc704b'
               AND decision.canonical_person_id = '4089dba1-5963-4c12-b4a4-a50ed2754c33')
          )
    ) THEN
        RAISE EXCEPTION 'A terminal or suggested decision already exists for 拔耐．茹妮老王';
    END IF;
END
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
VALUES (
    '4089dba1-5963-4c12-b4a4-a50ed2754c33',
    '2a37533c-9e4c-4ac4-88d1-54c106cc704b',
    'verified',
    'A',
    '拔耐．茹妮老王為罕見完整姓名；2010新北市與2014、2022基隆市紀錄均為無黨籍平地原住民議員候選人，官方及政府履歷亦可連續解釋其新北與基隆經歷。',
    jsonb_build_object(
        'version', 'cross-year-councilor-review-v1',
        'observedDate', '2026-08-01',
        'electionYears', jsonb_build_array(2010, 2014, 2022),
        'party', '無黨籍',
        'districts', jsonb_build_array(
            '2010 新北市平地原住民',
            '2014 基隆市平地原住民',
            '2022 基隆市平地原住民'
        ),
        'official2010Result', jsonb_build_object('votes', 177, 'voteRate', 1.43),
        'official2014Bulletin', 'https://eebulletin.cec.gov.tw/103/%E5%9F%BA%E9%9A%86%E5%B8%82/%E5%B8%82%E8%AD%B0%E5%93%A1/%E5%9F%BA%E9%9A%8618%E5%B1%86%E8%AD%B0%E5%93%A1%E7%AC%AC4%E4%B8%AD%E5%B1%B1%E5%8D%80%E3%80%81%E7%AC%AC8%E5%B9%B3%E5%9C%B0%E5%8E%9F%E4%BD%8F%E6%B0%91.pdf',
        'official2022Bulletin', 'https://bulletin.cec.gov.tw/01%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1/06%E7%B8%A3%E5%B8%82%E8%AD%B0%E5%93%A1/111%E5%B9%B4/20%E5%9F%BA%E9%9A%86%E5%B8%82/%E7%AC%AC7%E9%81%B8%E8%88%89%E5%8D%80/%E5%9F%BA%E9%9A%86%E5%B8%82%E9%81%B8%E8%88%89%E5%85%AC%E5%A0%B1_%E7%AC%AC%E4%B8%83%E9%81%B8%E5%8D%80.pdf',
        'governmentCareerRecord', '基隆市政府仲裁委員名冊記載曾任新北市政府勞工教育中心約聘人員'
    ),
    'codex:official-election-evidence',
    NOW(),
    NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM person_canonical_map canonical
        WHERE canonical.person_id = '4089dba1-5963-4c12-b4a4-a50ed2754c33'
          AND canonical.canonical_person_id = '2a37533c-9e4c-4ac4-88d1-54c106cc704b'
          AND canonical.merge_status = 'verified'
          AND canonical.merge_confidence_level = 'A'
    ) THEN
        RAISE EXCEPTION '拔耐．茹妮老王 canonical merge did not resolve';
    END IF;

    IF (
        SELECT COUNT(DISTINCT canonical.canonical_person_id)
        FROM person_identity_matches match
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE match.source_person_id = 'f061e127-a623-44df-aaf9-1530ed9862f6'
          AND match.match_status = 'auto_matched'
    ) <> 1 THEN
        RAISE EXCEPTION 'Official 2010 source identity still resolves to multiple canonical people';
    END IF;
END
$$;

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

COMMIT;
