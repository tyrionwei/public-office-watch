import type { PublicPersonClaim } from '../types/publicViews';
import { splitPlatformContent } from './contentItems.ts';

type ElectionContext = {
  candidateId: string | null;
  raceId: string | null;
};

function electionContext(claim: PublicPersonClaim): ElectionContext | null {
  const value = claim.claim_json.electionContext;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const context = value as Record<string, unknown>;
  return {
    candidateId: typeof context.candidateId === 'string' ? context.candidateId : null,
    raceId: typeof context.raceId === 'string' ? context.raceId : null,
  };
}

export function platformClaimsForCandidate(
  claims: PublicPersonClaim[],
  candidateId: string,
  raceId: string,
) {
  return claims.filter((claim) => {
    if (claim.claim_type !== 'platform') return false;
    if (claim.candidate_id) return claim.candidate_id === candidateId;
    const context = electionContext(claim);
    if (!context) return false;
    if (context.candidateId) return context.candidateId === candidateId;
    return context.raceId === raceId;
  });
}

export function platformItemsForClaim(claim: PublicPersonClaim) {
  const storedItems = Array.isArray(claim.claim_json.items)
    ? claim.claim_json.items
      .map((item) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    : [];
  if (Array.isArray(claim.claim_json.items)) return Array.from(new Set(storedItems));

  const platformText = typeof claim.claim_json.platformText === 'string'
    ? claim.claim_json.platformText
    : claim.claim_value;
  return splitPlatformContent(platformText).items;
}
