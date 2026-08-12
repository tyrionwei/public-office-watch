BEGIN;

CREATE TABLE public.referendum_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id UUID NOT NULL UNIQUE REFERENCES public.races(id) ON DELETE CASCADE,
    referendum_type TEXT NOT NULL CHECK (referendum_type IN ('national', 'constitutional', 'local')),
    case_number INTEGER NOT NULL CHECK (case_number > 0),
    jurisdiction_name TEXT NOT NULL,
    proposal_text TEXT NOT NULL,
    result_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        result_status IN ('passed', 'not_passed', 'pending', 'cancelled')
    ),
    eligible_voters BIGINT CHECK (eligible_voters IS NULL OR eligible_voters >= 0),
    total_votes BIGINT CHECK (total_votes IS NULL OR total_votes >= 0),
    valid_votes BIGINT CHECK (valid_votes IS NULL OR valid_votes >= 0),
    invalid_votes BIGINT CHECK (invalid_votes IS NULL OR invalid_votes >= 0),
    turnout_rate NUMERIC(7, 4) CHECK (turnout_rate IS NULL OR turnout_rate BETWEEN 0 AND 100),
    approval_rule TEXT,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_document_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.referendum_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.referendum_questions(id) ON DELETE CASCADE,
    option_code TEXT NOT NULL CHECK (option_code IN ('yes', 'no')),
    label TEXT NOT NULL,
    vote_count BIGINT CHECK (vote_count IS NULL OR vote_count >= 0),
    vote_rate NUMERIC(7, 4) CHECK (vote_rate IS NULL OR vote_rate BETWEEN 0 AND 100),
    display_order INTEGER NOT NULL CHECK (display_order > 0),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (question_id, option_code),
    UNIQUE (question_id, display_order)
);

CREATE TABLE public.referendum_region_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.referendum_questions(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES public.regions(id),
    eligible_voters BIGINT CHECK (eligible_voters IS NULL OR eligible_voters >= 0),
    yes_votes BIGINT CHECK (yes_votes IS NULL OR yes_votes >= 0),
    no_votes BIGINT CHECK (no_votes IS NULL OR no_votes >= 0),
    invalid_votes BIGINT CHECK (invalid_votes IS NULL OR invalid_votes >= 0),
    turnout_rate NUMERIC(7, 4) CHECK (turnout_rate IS NULL OR turnout_rate BETWEEN 0 AND 100),
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (question_id, region_id)
);

CREATE INDEX referendum_questions_type_case_idx
    ON public.referendum_questions (referendum_type, case_number);
CREATE INDEX referendum_options_question_order_idx
    ON public.referendum_options (question_id, display_order);
CREATE INDEX referendum_region_results_question_idx
    ON public.referendum_region_results (question_id, region_id);

ALTER TABLE public.referendum_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referendum_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referendum_region_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.referendum_questions,
    public.referendum_options,
    public.referendum_region_results
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
    public.referendum_questions,
    public.referendum_options,
    public.referendum_region_results
TO service_role;

CREATE VIEW published.referendum_questions WITH (security_barrier = true) AS
SELECT
    question.id AS question_id,
    question.race_id,
    race.election_id,
    question.referendum_type,
    question.case_number,
    question.jurisdiction_name,
    question.proposal_text,
    question.result_status,
    question.eligible_voters,
    question.total_votes,
    question.valid_votes,
    question.invalid_votes,
    question.turnout_rate,
    question.approval_rule,
    question.source_name,
    question.source_url,
    question.source_document_url,
    question.updated_at
FROM public.referendum_questions question
JOIN public.races race ON race.id = question.race_id AND race.is_public = TRUE
JOIN public.elections election ON election.id = race.election_id AND election.is_public = TRUE
LEFT JOIN public.regions region ON region.id = race.region_id
WHERE question.is_public = TRUE
  AND (race.region_id IS NULL OR region.is_public = TRUE);

CREATE VIEW published.referendum_options WITH (security_barrier = true) AS
SELECT
    option.id AS option_id,
    option.question_id,
    question.race_id,
    option.option_code,
    option.label,
    option.vote_count,
    option.vote_rate,
    option.display_order,
    option.updated_at
FROM public.referendum_options option
JOIN public.referendum_questions question
  ON question.id = option.question_id
 AND question.is_public = TRUE
JOIN public.races race ON race.id = question.race_id AND race.is_public = TRUE
JOIN public.elections election ON election.id = race.election_id AND election.is_public = TRUE
WHERE option.is_public = TRUE;

CREATE VIEW published.referendum_region_results WITH (security_barrier = true) AS
SELECT
    result.id AS result_id,
    result.question_id,
    question.race_id,
    result.region_id,
    region.name AS region_name,
    region.slug AS region_slug,
    result.eligible_voters,
    result.yes_votes,
    result.no_votes,
    result.invalid_votes,
    result.turnout_rate,
    result.source_name,
    result.source_url,
    result.updated_at
FROM public.referendum_region_results result
JOIN public.referendum_questions question
  ON question.id = result.question_id
 AND question.is_public = TRUE
JOIN public.races race ON race.id = question.race_id AND race.is_public = TRUE
JOIN public.elections election ON election.id = race.election_id AND election.is_public = TRUE
JOIN public.regions region ON region.id = result.region_id AND region.is_public = TRUE
WHERE result.is_public = TRUE;

REVOKE ALL ON TABLE
    published.referendum_questions,
    published.referendum_options,
    published.referendum_region_results
FROM PUBLIC;

GRANT SELECT ON TABLE
    published.referendum_questions,
    published.referendum_options,
    published.referendum_region_results
TO anon, authenticated, service_role;

COMMENT ON TABLE public.referendum_questions IS
    'Reviewed referendum questions attached to referendum races; never represented as person candidates.';
COMMENT ON TABLE public.referendum_options IS
    'The official yes/no ballot choices and aggregate vote totals for a referendum question.';
COMMENT ON TABLE public.referendum_region_results IS
    'Optional official geographic breakdowns for referendum questions.';

COMMIT;
