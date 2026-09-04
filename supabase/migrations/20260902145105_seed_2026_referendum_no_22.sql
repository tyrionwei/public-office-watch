BEGIN;

INSERT INTO public.elections (
    id,
    name,
    year,
    election_type,
    voting_date,
    status,
    source_name,
    source_url,
    is_public,
    external_id
)
VALUES (
    MD5('cec-referendum:event:national-2026-11-28')::UUID,
    '2026 年全國性公民投票',
    2026,
    'referendum',
    DATE '2026-11-28',
    'announced',
    '中央選舉委員會',
    'https://web.cec.gov.tw/central/article/64314',
    TRUE,
    'cec-referendum-national-2026-11-28'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    year = EXCLUDED.year,
    election_type = EXCLUDED.election_type,
    voting_date = EXCLUDED.voting_date,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    external_id = EXCLUDED.external_id,
    updated_at = NOW();

INSERT INTO public.races (
    id,
    election_id,
    region_id,
    race_type,
    title,
    voting_date,
    status,
    source_name,
    source_url,
    is_public,
    external_id
)
VALUES (
    MD5('cec-referendum:race:national-2026-11-28:22')::UUID,
    MD5('cec-referendum:event:national-2026-11-28')::UUID,
    NULL,
    'referendum',
    '全國性公民投票第22案',
    DATE '2026-11-28',
    'announced',
    '中央選舉委員會',
    'https://web.cec.gov.tw/central/article/64314',
    TRUE,
    'cec-referendum-national-2026-11-28-22'
)
ON CONFLICT (id) DO UPDATE SET
    election_id = EXCLUDED.election_id,
    region_id = EXCLUDED.region_id,
    race_type = EXCLUDED.race_type,
    title = EXCLUDED.title,
    voting_date = EXCLUDED.voting_date,
    status = EXCLUDED.status,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    is_public = EXCLUDED.is_public,
    external_id = EXCLUDED.external_id,
    updated_at = NOW();

INSERT INTO public.referendum_questions (
    id,
    race_id,
    referendum_type,
    case_number,
    jurisdiction_name,
    proposal_text,
    result_status,
    eligible_voters,
    total_votes,
    valid_votes,
    invalid_votes,
    turnout_rate,
    approval_rule,
    source_name,
    source_url,
    source_document_url,
    is_public
)
VALUES (
    MD5('cec-referendum:question:national-2026-11-28:22')::UUID,
    MD5('cec-referendum:race:national-2026-11-28:22')::UUID,
    'national',
    22,
    '全國',
    '你是否支持政府使用「核電」振興經濟，以廢除「非核家園」的能源政策？',
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '有效同意票多於不同意票，且達投票權人總額四分之一以上',
    '中央選舉委員會',
    'https://web.cec.gov.tw/central/article/64314',
    'https://web.cec.gov.tw/api/file/3103d916-46db-456e-b261-0707182c4296.pdf',
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    race_id = EXCLUDED.race_id,
    referendum_type = EXCLUDED.referendum_type,
    case_number = EXCLUDED.case_number,
    jurisdiction_name = EXCLUDED.jurisdiction_name,
    proposal_text = EXCLUDED.proposal_text,
    result_status = EXCLUDED.result_status,
    eligible_voters = EXCLUDED.eligible_voters,
    total_votes = EXCLUDED.total_votes,
    valid_votes = EXCLUDED.valid_votes,
    invalid_votes = EXCLUDED.invalid_votes,
    turnout_rate = EXCLUDED.turnout_rate,
    approval_rule = EXCLUDED.approval_rule,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_document_url = EXCLUDED.source_document_url,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO public.referendum_options (
    id,
    question_id,
    option_code,
    label,
    vote_count,
    vote_rate,
    display_order,
    is_public
)
VALUES
    (
        MD5('cec-referendum:option:national-2026-11-28:22:yes')::UUID,
        MD5('cec-referendum:question:national-2026-11-28:22')::UUID,
        'yes',
        '同意',
        NULL,
        NULL,
        1,
        TRUE
    ),
    (
        MD5('cec-referendum:option:national-2026-11-28:22:no')::UUID,
        MD5('cec-referendum:question:national-2026-11-28:22')::UUID,
        'no',
        '不同意',
        NULL,
        NULL,
        2,
        TRUE
    )
ON CONFLICT (id) DO UPDATE SET
    question_id = EXCLUDED.question_id,
    option_code = EXCLUDED.option_code,
    label = EXCLUDED.label,
    vote_count = EXCLUDED.vote_count,
    vote_rate = EXCLUDED.vote_rate,
    display_order = EXCLUDED.display_order,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();

INSERT INTO public.chat_rooms (
    room_key,
    room_type,
    entity_key,
    display_name,
    status,
    display_order
)
VALUES (
    'event:2026:referendum',
    'election_event',
    '2026:referendum',
    '2026 公民投票',
    'active',
    21
)
ON CONFLICT (room_key) DO UPDATE SET
    room_type = EXCLUDED.room_type,
    entity_key = EXCLUDED.entity_key,
    display_name = EXCLUDED.display_name,
    status = EXCLUDED.status,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

INSERT INTO public.chat_room_elections (room_id, election_id)
SELECT
    room.id,
    MD5('cec-referendum:event:national-2026-11-28')::UUID
FROM public.chat_rooms room
WHERE room.room_key = 'event:2026:referendum'
ON CONFLICT (room_id, election_id) DO NOTHING;

REFRESH MATERIALIZED VIEW published.home_ticker;
REFRESH MATERIALIZED VIEW published.election_race_summaries;
REFRESH MATERIALIZED VIEW published.election_race_facets;
REFRESH MATERIALIZED VIEW published.event_summaries;

DO $$
DECLARE
    public_question_count BIGINT;
    public_option_count BIGINT;
    public_summary_count BIGINT;
    chat_mapping_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO public_question_count
    FROM published.referendum_questions question
    WHERE question.question_id = MD5('cec-referendum:question:national-2026-11-28:22')::UUID
      AND question.result_status = 'pending'
      AND question.eligible_voters IS NULL
      AND question.total_votes IS NULL
      AND question.valid_votes IS NULL
      AND question.invalid_votes IS NULL
      AND question.turnout_rate IS NULL;

    SELECT COUNT(*) INTO public_option_count
    FROM published.referendum_options option
    WHERE option.question_id = MD5('cec-referendum:question:national-2026-11-28:22')::UUID
      AND option.vote_count IS NULL
      AND option.vote_rate IS NULL;

    SELECT COALESCE(SUM(summary.race_count), 0) INTO public_summary_count
    FROM published.election_race_summaries summary
    WHERE summary.election_id = MD5('cec-referendum:event:national-2026-11-28')::UUID;

    SELECT COUNT(*) INTO chat_mapping_count
    FROM public.chat_room_elections mapping
    JOIN public.chat_rooms room ON room.id = mapping.room_id
    WHERE room.room_key = 'event:2026:referendum'
      AND mapping.election_id = MD5('cec-referendum:event:national-2026-11-28')::UUID;

    IF public_question_count <> 1
       OR public_option_count <> 2
       OR public_summary_count <> 1
       OR chat_mapping_count <> 1 THEN
        RAISE EXCEPTION
            '2026 referendum no. 22 validation failed: question %, options %, summaries %, chat mappings %',
            public_question_count,
            public_option_count,
            public_summary_count,
            chat_mapping_count;
    END IF;
END;
$$;

COMMIT;
