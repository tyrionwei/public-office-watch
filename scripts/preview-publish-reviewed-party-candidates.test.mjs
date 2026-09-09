import { partyCandidateRevision } from './party-candidate-revision.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildProfileClaimRows,
  obsoleteProfileClaims,
  planReviewedPartyCandidatePublication,
  scopeDatasetToParty,
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
        claim_json: { sourceCandidateKey: 'dpp-valid', targetRace: { id: 'race-valid' }, education: ['測試大學', '測試大學'], experience: ['地方服務'], platform: ['改善交通', '增加托育'] },
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
    races: [{ id: 'race-valid', election_id: 'election-valid', is_public: true }],
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

test('scopes publication checks to the selected party', () => {
  const dataset = validDataset();
  dataset.sources.push({
    id: 'source-unrelated-blocker',
    source_person_key: 'party-candidate:tpp-unreviewed',
    raw_name: '未完成他黨候選人',
    party: '台灣民眾黨',
    is_public: false,
    source_payload: { targetRace: { id: 'race-unrelated' } },
  });

  const plan = planReviewedPartyCandidatePublication(
    scopeDatasetToParty(dataset, '民主進步黨'),
    { expectedCount: 1, expectedExcludedCount: 1 },
  );

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.eligible.length, 1);
  assert.equal(plan.excluded.length, 1);
});

test('keeps a source-scoped new person private while awaiting CEC confirmation', () => {
  const dataset = validDataset();
  const source = dataset.sources[1];
  const match = dataset.matches[1];
  const claim = dataset.claims[1];

  source.source_payload.publicationReview = { status: 'awaiting_cec_confirmation' };
  match.person_id = 'person-pending-cec';
  match.match_status = 'auto_matched';
  claim.person_id = 'person-pending-cec';
  claim.review_status = 'needs_more_evidence';
  dataset.candidates.push({
    id: 'candidate-pending-cec',
    external_id: source.source_person_key,
    person_id: 'person-pending-cec',
    race_id: 'race-rejected',
    party: '民主進步黨',
    registration_status: 'unknown',
    candidacy_status: 'potential',
    election_result: 'pending',
    is_public: false,
  });

  const plan = planReviewedPartyCandidatePublication(dataset, {
    expectedCount: 1,
    expectedExcludedCount: 1,
  });

  assert.equal(plan.blocking.length, 0);
  assert.equal(plan.eligible.length, 1);
  assert.equal(plan.excluded[0].reason, 'private identity is awaiting CEC candidacy confirmation');
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
    claim_json: { targetRace: { id: 'race-second' } },
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
  assert.equal(claims[2].candidate_id, 'candidate-valid');
  assert.deepEqual(claims[2].claim_json.electionContext, {
    candidateId: 'candidate-valid',
    raceId: 'race-valid',
    electionId: 'election-valid',
  });
  assert.ok(claims.every((claim) => claim.review_status === 'verified' && claim.visibility === 'public' && claim.is_public));
});

test('publication explicitly selects a reviewed revision and preserves stable candidate/profile keys', () => {
  const dataset = validDataset();
  const previous = dataset.sources[0];
  const next = structuredClone(previous);
  next.id = 'source-next'; next.source_payload.schemaVersion = 2; next.source_payload.platform = ['新版政見'];
  next.source_payload.requiresManualReview = true;
  next.source_payload.revision = partyCandidateRevision(next.source_payload, next);
  next.source_person_key += ':revision:' + next.source_payload.revision;
  dataset.sources.push(next);
  dataset.claims.push({ ...dataset.claims[0], id: 'claim-next', source_person_id: next.id, claim_json: structuredClone(next.source_payload), scoring_version: 'party-candidate-manual-review-v2' });
  dataset.matches.push({ ...dataset.matches[0], id: 'match-next', source_person_id: next.id });
  const options = { expectedCount: 1, expectedExcludedCount: 1 };
  assert.ok(planReviewedPartyCandidatePublication(dataset, options).blocking.length);
  options.revisionSelections = [{ sourcePersonKey: next.source_person_key, contentRevision: next.source_payload.revision }];
  const selected = planReviewedPartyCandidatePublication(dataset, options);
  assert.equal(selected.blocking.length, 0);
  assert.equal(selected.eligible[0].source.id, next.id);
  assert.equal(selected.superseded[0].source.id, previous.id);
  const profiles = buildProfileClaimRows(selected, '2026-09-09');
  assert.equal(profiles.find(row => row.claim_type === 'platform').claim_key, 'party-candidate:dpp-valid:platform');
  assert.equal(profiles.find(row => row.claim_type === 'platform').claim_value, '新版政見');
  dataset.claims.at(-1).review_status = 'pending';
  assert.ok(planReviewedPartyCandidatePublication(dataset, options).blocking.length);
  dataset.claims.at(-1).review_status = 'verified'; dataset.claims.at(-1).claim_json.platform = ['unreviewed mutation'];
  assert.ok(planReviewedPartyCandidatePublication(dataset, options).blocking.length);
});

test('empty reviewed profile fields retire the previous public values instead of preserving stale content', () => {
  const dataset = validDataset();
  dataset.sources[0].source_payload.education = [];
  dataset.claims[0].claim_json.education = [];
  const plan = planReviewedPartyCandidatePublication(dataset, { expectedCount: 1, expectedExcludedCount: 1 });
  const old = { claim_key: 'party-candidate:dpp-valid:education', person_id: 'person-valid', is_public: true };
  assert.deepEqual(obsoleteProfileClaims(plan, [old]), [old]);
  assert.deepEqual(obsoleteProfileClaims(plan, [{ ...old, is_public: false }]), []);
  assert.throws(() => obsoleteProfileClaims(plan, [{ ...old, person_id: 'another-person' }]), /another person/);
});
