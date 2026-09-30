import type { PublicPersonClaim } from '../types/publicViews.ts';

export const officialProfileClaimTypes = new Set<PublicPersonClaim['claim_type']>([
  'birth_date', 'education', 'experience',
]);

// The published RPC supplies reviewed claims. Require its explicit field-level
// identity and content review marker as well; a source URL alone proves neither.
export function isOfficialProfileClaim(claim: PublicPersonClaim): boolean {
  if (!officialProfileClaimTypes.has(claim.claim_type)) return false;
  const policy = claim.claim_json?.officialProfilePolicy;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
  const review = policy as Record<string, unknown>;
  return review.version === 'official-profile-v1'
    && review.eligible === true
    && review.identityVerified === true
    && review.contentVerified === true
    && (claim.claim_type !== 'birth_date'
      || review.datePrecision === 'day' || review.datePrecision === 'month' || review.datePrecision === 'year');
}

export function officialBirthDateValue(claim: PublicPersonClaim | null): string | null {
  if (!claim || claim.claim_type !== 'birth_date' || !isOfficialProfileClaim(claim)) return null;
  const value = claim.claim_value?.trim();
  if (!value) return null;
  const precision = (claim.claim_json.officialProfilePolicy as Record<string, unknown>).datePrecision;
  if (precision === 'year') return value.match(/^(\d{4})(?=$|[-/.\s年])/u)?.[1] ?? null;
  if (precision === 'month') {
    const month = value.match(/^(\d{4})[-/.](\d{1,2})(?=$|[-/.\s])/u);
    return month && Number(month[2]) >= 1 && Number(month[2]) <= 12
      ? `${month[1]}-${month[2].padStart(2, '0')}` : null;
  }
  return value;
}

export function retainOfficialProfileClaims(claims: PublicPersonClaim[]): PublicPersonClaim[] {
  return claims.filter((claim) => !officialProfileClaimTypes.has(claim.claim_type) || isOfficialProfileClaim(claim));
}
