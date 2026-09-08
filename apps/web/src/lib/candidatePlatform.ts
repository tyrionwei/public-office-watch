import type { PublicPersonClaim } from '../types/publicViews';
import { splitPlatformContent } from './contentItems.ts';

type ElectionContext = {
  candidateId: string | null;
  raceId: string | null;
};

function normalizePlatformItem(value: string) {
  return value
    .normalize('NFC')
    .replace(/[\uE000-\uF8FF]/gu, '')
    .replace(/[。．]\s*[：:]/gu, '：')
    .trim();
}

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
  const contentSplit = claim.claim_json.contentSplit;
  const storedItemsNeedReview = contentSplit !== null
    && typeof contentSplit === 'object'
    && (contentSplit as { reviewStatus?: unknown }).reviewStatus === 'needs_review';
  if (storedItemsNeedReview) return [];

  const storedItems = Array.isArray(claim.claim_json.items)
    ? claim.claim_json.items
      .map((item) => typeof item === 'string' ? normalizePlatformItem(item) : '')
      .filter(Boolean)
    : [];
  if (storedItems.length > 0) return Array.from(new Set(storedItems));

  const platformText = typeof claim.claim_json.platformText === 'string'
    ? claim.claim_json.platformText
    : claim.claim_value;
  return splitPlatformContent(platformText).items.map(normalizePlatformItem).filter(Boolean);
}

export function platformItemsForCandidate(
  claims: PublicPersonClaim[],
  candidateId: string,
  raceId: string,
) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of platformClaimsForCandidate(claims, candidateId, raceId)
    .flatMap(platformItemsForClaim)) {
    const key = item.replace(/\s+/gu, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}
