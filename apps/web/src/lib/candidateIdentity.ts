import type { PublicCandidate } from '../types/publicViews';

export type PersonLinkedCandidate = PublicCandidate & { person_id: string };

/** Name-only candidates remain election records, but cannot enter person-based comparison. */
export function hasCandidatePerson(candidate: PublicCandidate): candidate is PersonLinkedCandidate {
  return typeof candidate.person_id === 'string' && candidate.person_id.length > 0;
}
