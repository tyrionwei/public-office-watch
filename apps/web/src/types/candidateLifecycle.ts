export type CandidateLifecycleEvent = {
  id: string;
  candidate_id: string;
  event_type: 'party_nomination_announced' | 'candidacy_announced' | 'registration_filed'
    | 'qualification_confirmed' | 'qualification_rejected' | 'withdrawn'
    | 'ballot_number_assigned' | 'official_candidate_list_published' | 'election_result_published';
  occurred_on: string | null;
  source_published_on: string | null;
  source_name: string;
  source_url: string;
  candidate_no: string | null;
};
