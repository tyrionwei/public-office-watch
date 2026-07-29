import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildProfileClaimRows,
  planReviewedPartyCandidatePublication,
} from './preview-publish-reviewed-party-candidates.mjs';

function validDataset() {
  return {
    sources: [
      {
        id: 'source-valid',
        source_person_key: 'party-candidate:dpp-valid',
        raw_name: '測試候選人',
        party: '民主進步黨',
        is_public: false,
        source_payload: {
          sourceCandidateKey: 'dpp-valid',
          targetRace: { id: 'race-valid' },
          education: ['測試大學', '測試大學'],
          experience: ['地方服務'],
          platform: ['改善交通', '增加托育'],
        },
      },
      {
        id: 'source-rejected',
        source_person_key: 'party-candidate:dpp-rejected',
        raw_name: '撤回候選人',
        party: '民主進步黨',
        is_public: false,
        source_payload: { targetRace: { id: 'race-rejected' } },
      },
    ],
    matches: [
      {
        id: 'match-valid',
        source_person_id: 'source-valid',
        person_id: 'person-valid',
        match_status: 'auto_matched',
      },
      {
        id: 'match-rejected',
        source_person_id: 'source-rejected',
        person_id: 'person-other',
        match_status: 'rejected_match',
      },
    ],
    claims: [
      {
        id: 'claim-valid',
        source_person_id: 'source-valid',
        person_id: 'person-valid',
        claim_type: 'candidacy',
        review_status: 'verified',
        visibility: 'review_only',
        is_public: false,
        source_name: '政黨官方網站',
        source_url: 'https://example.test/candidate',
        observed_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'claim-rejected',
        source_person_id: 'source-rejected',
        person_id: 'person-other',
        claim_type: 'candidacy',
        review_status: 'rejected',
        visibility: 'private',
        is_public: false,
      },
    ],
    candidates: [
      {
        id: 'candidate-valid',
        external_id: 'party-candidate:dpp-valid',
        person_id: 'person-valid',
        race_id: 'race-valid',
        party: '民主進步黨',
        registration_status: 'unknown',
        candidacy_status: 'party_nominee',
        election_result: 'pending',
        is_public: false,
      },
    ],
    canonicalMap: [{ person_id: 'person-valid', canonical_person_id: 'person-valid' }],
    people: [{ id: 'person-valid', is_public: false }],
    races: [{ id: 'race-valid', is_public: true }],
  };
}

test('plans one reviewed nominee and preserves one rejected source as audit history', () => {
  const plan = planReviewedPartyCandidatePublication(validDataset(), {
    expectedCount: 1,
    expectedExcludedCount: 1,
  });

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.eligible.length, 1);
  assert.equal(plan.excluded.length, 1);
});

test('blocks publication when a nominee incorrectly implies CEC registration', () => {
  const dataset = validDataset();
  dataset.candidates[0].registration_status = 'registered';
  const plan = planReviewedPartyCandidatePublication(dataset, {
    expectedCount: 1,
    expectedExcludedCount: 1,
  });

  assert.ok(plan.blocking.some((item) => item.errors.includes('candidate incorrectly implies election registration')));
});

test('blocks two reviewed candidacies from sharing the same canonical person', () => {
  const dataset = validDataset();
  dataset.sources.splice(1, 0, {
    id: 'source-second',
    source_person_key: 'party-candidate:tpp-second',
    raw_name: '同名誤配',
    party: '台灣民眾黨',
    is_public: false,
    source_payload: { targetRace: { id: 'race-second' } },
  });
  dataset.matches.push({
    id: 'match-second',
    source_person_id: 'source-second',
    person_id: 'person-valid',
    match_status: 'auto_matched',
  });
  dataset.claims.push({
    id: 'claim-second',
    source_person_id: 'source-second',
    person_id: 'person-valid',
    claim_type: 'candidacy',
    review_status: 'verified',
    visibility: 'review_only',
    is_public: false,
  });
  dataset.candidates.push({
    id: 'candidate-second',
    external_id: 'party-candidate:tpp-second',
    person_id: 'person-valid',
    race_id: 'race-second',
    party: '台灣民眾黨',
    registration_status: 'unknown',
    candidacy_status: 'party_nominee',
    election_result: 'pending',
    is_public: false,
  });
  dataset.races.push({ id: 'race-second', is_public: true });

  const plan = planReviewedPartyCandidatePublication(dataset, {
    expectedCount: 2,
    expectedExcludedCount: 1,
  });
  assert.ok(plan.blocking.some((item) => item.errors.includes('same person is linked to 2 reviewed 2026 candidacies')));
});

test('refreshes the public people cache before promoting the published snapshot', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('./preview-publish-reviewed-party-candidates.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(
    source,
    /await refreshPublicPeopleList\(config\);\s+const releaseId = await promotePublishedLayer\(config\);/,
  );
});

test('turns official profile arrays into verified public claims without duplicate items', () => {
  const plan = planReviewedPartyCandidatePublication(validDataset(), {
    expectedCount: 1,
    expectedExcludedCount: 1,
  });
  const claims = buildProfileClaimRows(plan, '2026-07-30T00:00:00.000Z');

  assert.deepEqual(claims.map((claim) => claim.claim_type), ['education', 'experience', 'platform']);
  assert.equal(claims[0].claim_value, '測試大學');
  assert.equal(claims[2].claim_json.platformText, '改善交通；增加托育');
  assert.ok(claims.every((claim) => claim.review_status === 'verified' && claim.visibility === 'public' && claim.is_public));
});
