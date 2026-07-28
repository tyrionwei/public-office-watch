export type ElectionEventLookupItem = {
  key: string;
  elections: Array<{ election_id: string }>;
};

export function getElectionEventForElection(
  events: ElectionEventLookupItem[],
  electionId: string,
) {
  return events.find((event) => (
    event.elections.some((election) => election.election_id === electionId)
  )) ?? null;
}
