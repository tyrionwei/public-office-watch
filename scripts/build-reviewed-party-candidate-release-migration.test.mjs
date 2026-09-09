import { partyCandidateRevision } from './party-candidate-revision.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLocalSupabase,
  buildMigration,
  buildReleaseDataset,
} from './build-reviewed-party-candidate-release-migration.mjs';

function fixture() {
  const sourceValid = {
    id: 'source-valid', source_person_key: 'party-candidate:dpp-valid', raw_name: '測試候選人',
    party: '民主進步黨', is_public: true, source_payload: { targetRace: { id: 'race-valid' } },
  };
  const sourceRejected = {
    id: 'source-rejected', source_person_key: 'party-candidate:dpp-rejected', raw_name: '排除候選人',
    party: '民主進步黨', is_public: false, source_payload: { targetRace: { id: 'race-rejected' } },
  };
  const candidacyValid = {
    claim_json: structuredClone(sourceValid.source_payload),
    id: 'claim-valid', claim_key: 'party-candidacy:dpp-valid', source_person_id: sourceValid.id,
    person_id: 'person-valid', claim_type: 'candidacy', review_status: 'verified', visibility: 'public',
    is_public: true, source_name: '政黨官網', source_url: 'https://example.test/valid',
  };
  const candidacyRejected = {
    id: 'claim-rejected', claim_key: 'party-candidacy:dpp-rejected', source_person_id: sourceRejected.id,
    person_id: 'person-other', claim_type: 'candidacy', review_status: 'rejected', visibility: 'private',
    is_public: false,
  };
  const profileClaims = ['education', 'experience', 'platform'].map((type) => ({
    id: `claim-${type}`, claim_key: `${sourceValid.source_person_key}:${type}`,
    source_person_id: sourceValid.id, person_id: 'person-valid', claim_type: type,
    review_status: 'verified', visibility: 'public', is_public: true,
    candidate_id: type === 'platform' ? 'candidate-valid' : null,
  }));
  return {
    sources: [sourceValid, sourceRejected],
    matches: [
      { id: 'match-valid', source_person_id: sourceValid.id, person_id: 'person-valid', match_status: 'auto_matched' },
      { id: 'match-rejected', source_person_id: sourceRejected.id, person_id: 'person-other', match_status: 'rejected_match' },
    ],
    claims: [candidacyValid, candidacyRejected, ...profileClaims],
    candidates: [{
      id: 'candidate-valid', external_id: sourceValid.source_person_key, person_id: 'person-valid',
      race_id: 'race-valid', party: '民主進步黨', registration_status: 'unknown',
      candidacy_status: 'party_nominee', election_result: 'pending', is_public: true,
    }],
    canonicalMap: [{ person_id: 'person-valid', canonical_person_id: 'person-valid' }],
    people: [
      { id: 'person-valid', external_id: 'party-candidate-person:dpp-valid', is_public: true },
      { id: 'person-other', external_id: 'existing-person', is_public: true },
    ],
    races: [{ id: 'race-valid', is_public: true }],
  };
}

const fixtureExpected = {
  sources: 2,
  candidates: 1,
  excludedSources: 1,
  newPeople: 1,
  requiredExistingPeople: 1,
  identityMatches: 2,
  candidacyClaims: 2,
  profileClaims: 3,
  profileClaimsByType: { education: 1, experience: 1, platform: 1 },
};

test('refuses to generate a release migration from a production Supabase URL', () => {
  assert.throws(
    () => assertLocalSupabase('https://project.supabase.co'),
    /generation is local-only/,
  );
  assert.doesNotThrow(() => assertLocalSupabase('http://127.0.0.1:54321'));
});

test('builds a guarded release payload with explicit new and prerequisite people', () => {
  const release = buildReleaseDataset(fixture(), { expected: fixtureExpected });
  assert.equal(release.newPeople.length, 1);
  assert.deepEqual(release.requiredExistingPersonIds, ['person-other']);
  assert.equal(release.claims.length, 5);

  const sql = buildMigration(release, fixtureExpected);
  assert.match(sql, /missing % prerequisite people/);
  assert.match(sql, /new-person identifier conflict/);
  assert.match(sql, /Rejected party candidate source still has a candidate row/);
  assert.match(sql, /auto_reviewed_at, candidate_id/);
  assert.doesNotMatch(sql, /published\.promote|REFRESH MATERIALIZED VIEW/);
});

test('continues to recognize legacy internal-review source people', () => {
  const dataset = fixture();
  dataset.people[0].external_id = `internal-review-source-${dataset.sources[0].id}`;
  assert.doesNotThrow(() => buildReleaseDataset(dataset, { expected: fixtureExpected }));
});

test('blocks generation when the reviewed new-person boundary drifts', () => {
  const dataset = fixture();
  dataset.people[0].external_id = 'unexpected-person-id';
  assert.throws(
    () => buildReleaseDataset(dataset, { expected: fixtureExpected }),
    /new people: expected 1, found 0/,
  );
});

test('release selects one reviewed revision while keeping base person/candidate/profile keys and fixed counts', () => {
  const dataset = fixture();
  const previous = structuredClone(dataset.sources[0]);
  const selected = dataset.sources[0];
  selected.id = 'source-new-revision'; selected.source_payload.sourceCandidateKey = 'dpp-valid'; selected.source_payload.schemaVersion = 2;
  selected.source_payload.revision = partyCandidateRevision(selected.source_payload, selected);
  selected.source_person_key += ':revision:' + selected.source_payload.revision;
  for (const claim of dataset.claims.filter(row => row.source_person_id === previous.id)) {
    claim.source_person_id = selected.id;
    if (claim.claim_type === 'candidacy') claim.claim_json = structuredClone(selected.source_payload);
  }
  dataset.matches[0].source_person_id = selected.id;
  dataset.sources.push(previous);
  assert.throws(() => buildReleaseDataset(dataset, { expected: fixtureExpected }), /blocked/);
  const release = buildReleaseDataset(dataset, { expected: fixtureExpected, revisionSelections: [{ sourcePersonKey: selected.source_person_key, contentRevision: selected.source_payload.revision }] });
  assert.equal(release.sources.length, fixtureExpected.sources);
  assert.equal(release.sources.some(row => row.id === previous.id), false);
  assert.deepEqual(release.retiredSources.map(row => row.id), [previous.id]);
  assert.match(buildMigration(release, fixtureExpected), /Superseded party source content changed; retirement blocked/);
  assert.match(buildMigration(release, fixtureExpected), /UPDATE source_people existing SET is_public = FALSE/);
  assert.equal(release.newPeople[0].external_id, 'party-candidate-person:dpp-valid');
  assert.equal(release.candidates[0].external_id, 'party-candidate:dpp-valid');
  assert.equal(release.claims.find(row => row.claim_type === 'platform').claim_key, 'party-candidate:dpp-valid:platform');
  assert.match(buildMigration(release, fixtureExpected), /source_payload->>'sourceCandidateKey'/);
});
