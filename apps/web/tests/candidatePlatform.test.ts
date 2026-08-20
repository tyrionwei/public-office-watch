import assert from 'node:assert/strict';
import test from 'node:test';
import { platformClaimsForCandidate } from '../src/lib/candidatePlatform.ts';
import type { PublicPersonClaim } from '../src/types/publicViews.ts';

function platformClaim(claimId: string, electionContext?: Record<string, string>, candidateId?: string): PublicPersonClaim {
  return {
    claim_id: claimId,
    candidate_id: candidateId,
    person_id: 'person-1',
    claim_type: 'platform',
    claim_value: claimId,
    claim_json: electionContext ? { electionContext } : {},
    confidence_level: 'A',
    review_score: 100,
    source_name: 'test',
    source_url: null,
    observed_at: null,
    updated_at: '2026-08-11T00:00:00Z',
  };
}

test('returns only platform claims linked to the current candidacy or race', () => {
  const claims = [
    platformClaim('candidate-match', { candidateId: 'candidate-1', raceId: 'race-1' }),
    platformClaim('same-race-other-candidate', { candidateId: 'candidate-2', raceId: 'race-1' }),
    platformClaim('race-only-match', { raceId: 'race-1' }),
    platformClaim('other-election', { candidateId: 'candidate-3', raceId: 'race-2' }),
    platformClaim('legacy-unscoped'),
    platformClaim('direct-candidate-match', undefined, 'candidate-1'),
  ];

  assert.deepEqual(
    platformClaimsForCandidate(claims, 'candidate-1', 'race-1').map((claim) => claim.claim_id),
    ['candidate-match', 'race-only-match', 'direct-candidate-match'],
  );
});

test('does not guess the election for legacy unscoped platform claims', () => {
  assert.deepEqual(
    platformClaimsForCandidate([platformClaim('legacy-unscoped')], 'candidate-1', 'race-1'),
    [],
  );
});
