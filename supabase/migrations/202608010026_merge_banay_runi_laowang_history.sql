BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-cafa78c3622e')
          AND name = '拔耐．茹妮老王'
    ) OR NOT EXISTS (
        SELECT 1
        FROM people
        WHERE id = (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-plain-indigenous-person-5cb37455a9ee')
          AND name = '拔耐．茹妮老王'
    ) THEN
        RAISE EXCEPTION 'Expected split 拔耐．茹妮老王 people were not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM candidates candidate
        JOIN races race ON race.id = candidate.race_id
        JOIN elections election ON election.id = race.election_id
        WHERE candidate.id = (SELECT id FROM candidates WHERE external_id = 'cec-historical-candidate-512e782c51c85688')
          AND candidate.person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-cafa78c3622e')
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
        WHERE candidate.person_id = (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-plain-indigenous-person-5cb37455a9ee')
          AND candidate.party = '無黨籍'
          AND election.year = 2014
          AND race.title = '基隆市第8選舉區平地原住民議員選舉'
    ) THEN
        RAISE EXCEPTION 'Expected 2010 and 2014 election history evidence changed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM source_people source
        WHERE source.source_person_key = 'cec-historical:cafa78c3622e'
          AND source.raw_name = '拔耐．茹妮老王'
          AND source.election_year = 2010
          AND source.source_payload->>'candidateNo' = '10'
          AND (
              source.source_payload->>'voteCount' IS NULL
              OR (source.source_payload->>'voteCount')::INTEGER = 177
          )
          AND (
              source.source_payload->>'voteRate' IS NULL
              OR (source.source_payload->>'voteRate')::NUMERIC = 1.43
          )
    ) OR NOT EXISTS (
        SELECT 1
        FROM person_identity_matches
        WHERE source_person_id = (SELECT id FROM source_people WHERE source_person_key = 'cec-historical:cafa78c3622e')
          AND person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-cafa78c3622e')
          AND match_status = 'auto_matched'
    ) THEN
        RAISE EXCEPTION 'Expected official 2010 source identity evidence changed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM person_merge_decisions decision
        WHERE decision.status IN ('suggested', 'verified', 'rejected', 'archived')
          AND (
              (decision.duplicate_person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-cafa78c3622e')
               AND decision.canonical_person_id = (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-plain-indigenous-person-5cb37455a9ee'))
              OR
              (decision.duplicate_person_id = (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-plain-indigenous-person-5cb37455a9ee')
               AND decision.canonical_person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-cafa78c3622e'))
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
    (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-cafa78c3622e'),
    (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-plain-indigenous-person-5cb37455a9ee'),
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
        WHERE canonical.person_id = (SELECT id FROM people WHERE external_id = 'cec-historical-unresolved-person-cafa78c3622e')
          AND canonical.canonical_person_id = (SELECT id FROM people WHERE external_id = 'cec-2022-local-councilor-plain-indigenous-person-5cb37455a9ee')
          AND canonical.merge_status = 'verified'
          AND canonical.merge_confidence_level = 'A'
    ) THEN
        RAISE EXCEPTION '拔耐．茹妮老王 canonical merge did not resolve';
    END IF;

    IF (
        SELECT COUNT(DISTINCT canonical.canonical_person_id)
        FROM person_identity_matches match
        JOIN person_canonical_map canonical ON canonical.person_id = match.person_id
        WHERE match.source_person_id = (SELECT id FROM source_people WHERE source_person_key = 'cec-historical:cafa78c3622e')
          AND match.match_status = 'auto_matched'
    ) <> 1 THEN
        RAISE EXCEPTION 'Official 2010 source identity still resolves to multiple canonical people';
    END IF;
END
$$;

REFRESH MATERIALIZED VIEW public.public_people_list_cached;
SELECT published.promote(NULL);

COMMIT;
