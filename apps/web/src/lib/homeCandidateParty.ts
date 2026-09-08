import type { PublicCandidate } from '../types/publicViews';
import { canonicalPartyName } from './partyNames.ts';

export type HomeCandidateRecommendation =
  | { kind: 'party'; party: string }
  | { kind: 'unendorsed' };

type CandidatePartyFields = Pick<PublicCandidate, 'person_party' | 'party'>;

export function getHomeCandidateParty(candidate: CandidatePartyFields) {
  const affiliationParty = canonicalPartyName(candidate.person_party);
  const recommendedParty = canonicalPartyName(candidate.party);

  let recommendation: HomeCandidateRecommendation | null = null;
  if (recommendedParty && recommendedParty !== affiliationParty) {
    recommendation = recommendedParty === '無黨籍'
      ? { kind: 'unendorsed' }
      : { kind: 'party', party: recommendedParty };
  }

  return { affiliationParty, recommendation };
}
