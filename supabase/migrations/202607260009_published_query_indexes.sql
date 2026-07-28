BEGIN;

ANALYZE published.candidate_facts;
ANALYZE published.person_candidate_summaries;

COMMENT ON INDEX published.candidate_facts_election_idx IS
    'Satisfies selective election candidate reads before any canonical expansion or sort.';

COMMENT ON INDEX published.candidate_facts_race_idx IS
    'Supports fetching candidates only for the selected race.';

COMMENT ON INDEX published.candidate_facts_person_history_idx IS
    'Supports selective person candidacy history ordered by election year.';

COMMIT;
