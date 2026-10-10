import type { PublicPersonClaim } from '../types/publicViews';

// 僅供 published 公開入口的主張使用；親屬的人工核准不更改來源等級或分數。
export function sensitivePublicClaims(claims: PublicPersonClaim[]) {
  return claims.filter((claim) => {
    if (claim.review_score >= 70 && ['A', 'B'].includes(claim.confidence_level)) return true;
    if (claim.claim_type !== 'family_relation') return false;
    const policy = claim.claim_json?.familyPublicationPolicy;
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
    const review = policy as Record<string, unknown>;
    return review.version === 'family-publication-v1'
      && review.decision === 'explicit_user_approved'
      && review.eligible === true;
  });
}
