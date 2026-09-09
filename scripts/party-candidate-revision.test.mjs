import assert from 'node:assert/strict';
import test from 'node:test';
import { stagePartyCandidateReview, applyReviewedPartyCandidates, buildReviewTemplate, buildStagingRows, validateReviewFile } from './party-candidate-review.mjs';
import { planHighConfidenceMatches, applyPlan } from './apply-high-confidence-party-candidate-matches.mjs';
import { partyCandidateRevision, selectPartyCandidateSources } from './party-candidate-revision.mjs';
import { fixture, reviewFor, memoryRest, config, at } from './test-support/party-candidate-fixture.mjs';

test('staging preserves reviewed bytes and creates private revisions when reviewed content changes', async t => {
  const db = memoryRest(t), { snapshot, plan } = fixture();
  await stagePartyCandidateReview(config, snapshot, plan, at);
  await applyReviewedPartyCandidates(config, snapshot, plan, reviewFor(snapshot, plan));
  db.tables.candidates[0].is_public = true;
  const before = structuredClone(db.tables);
  await stagePartyCandidateReview(config, snapshot, plan, '2026-09-10T00:00:00Z');
  assert.deepEqual(db.tables, before);
  const oldReview = reviewFor(snapshot, plan);
  plan.matched[0].record.platform = ['更新後的政見'];
  await stagePartyCandidateReview(config, snapshot, plan, at);
  assert.equal(db.tables.source_people.length, 2);
  assert.deepEqual(db.tables.source_people[0], before.source_people[0]);
  assert.deepEqual(db.tables.person_claims[0], before.person_claims[0]);
  assert.deepEqual(db.tables.candidates, before.candidates);
  assert.equal(db.tables.source_people[1].source_payload.requiresManualReview, true);
  assert.equal(db.tables.person_claims[1].review_status, 'pending');
  assert.equal(db.tables.person_claims[1].is_public, false);
  db.resetCalls();
  await assert.rejects(applyReviewedPartyCandidates(config, snapshot, plan, oldReview), /contentRevision/);
  assert.equal(db.calls.length, 0);
  const auto = planHighConfidenceMatches(db.dataset());
  assert.equal(auto.eligible.length, 0);
  assert.ok(auto.blocking.some(row => row.errors.some(error => error.includes('new manual review'))));
  const current = reviewFor(snapshot, plan);
  await applyReviewedPartyCandidates(config, snapshot, plan, current);
  assert.deepEqual(db.tables.candidates, before.candidates);
  assert.equal(db.tables.person_claims[1].review_status, 'verified');
});

test('revision excludes fetch times and identity suggestion order but covers content and source', () => {
  const { snapshot, plan } = fixture();
  const first = buildStagingRows(snapshot, plan, at).sourcePeople[0];
  plan.matched[0].canonicalGroups.reverse();
  assert.equal(buildStagingRows(snapshot, plan, '2030-01-01').sourcePeople[0].source_payload.revision, first.source_payload.revision);
  for (const mutate of [s => { s.raw_name += '改'; }, s => { s.source_url += '?new'; }, s => { s.source_payload.education = []; }, s => { s.source_payload.targetRace.id = 'race-2'; }]) {
    const changed = structuredClone(first); mutate(changed);
    assert.notEqual(partyCandidateRevision(changed.source_payload, changed), first.source_payload.revision);
  }
  const template = buildReviewTemplate(snapshot, { ...plan, matched: Array.from({ length: 25 }, (_, i) => ({ ...plan.matched[0], record: { ...plan.matched[0].record, sourceCandidateKey: 'key-' + i } })) });
  assert.equal(template.decisions.length, 25);
  assert.ok(template.decisions.every(row => /^[a-f0-9]{64}$/.test(row.contentRevision)));
  const missing = reviewFor(snapshot, plan); delete missing.decisions[0].contentRevision;
  assert.throws(() => validateReviewFile(missing, snapshot, plan), /contentRevision/);
});

test('same-content legacy source and claim are reused without changing terminal decisions', async t => {
  const db = memoryRest(t), { snapshot, plan } = fixture();
  const staging = buildStagingRows(snapshot, plan, at), source = staging.sourcePeople[0], claim = staging.claims[0];
  source.id = 'legacy-source'; source.source_person_key = source.source_payload.baseSourcePersonKey; source.source_payload.schemaVersion = 1;
  delete source.source_payload.revision; source.is_public = true;
  claim.id = 'legacy-claim'; claim.claim_key = source.source_payload.baseClaimKey; claim.source_person_id = source.id; claim.review_status = 'rejected'; claim.is_public = false;
  db.tables.source_people.push(source); db.tables.person_claims.push(claim);
  const before = structuredClone(db.tables);
  await stagePartyCandidateReview(config, snapshot, plan, at);
  assert.deepEqual(db.tables, before);
});

test('manual rejection after read causes zero-row CAS and cannot be undone on replay', async t => {
  const db = memoryRest(t), { snapshot, plan } = fixture();
  await stagePartyCandidateReview(config, snapshot, plan, at);
  const review = reviewFor(snapshot, plan);
  db.control.before = (call, tables) => {
    if (call.method === 'PATCH' && call.table === 'person_claims') {
      tables.person_claims[0].review_status = 'rejected';
      tables.person_claims[0].updated_at = '2026-09-09T11:00:00Z';
      db.control.before = null;
    }
  };
  await assert.rejects(applyReviewedPartyCandidates(config, snapshot, plan, review), /changed since review/);
  assert.equal(db.tables.person_claims[0].review_status, 'rejected');
  db.resetCalls();
  await assert.rejects(applyReviewedPartyCandidates(config, snapshot, plan, review), /Terminal claim/);
  assert.equal(db.calls.filter(call => call.method !== 'GET').length, 0);
});

for (const failedTable of ['candidates', 'person_identity_matches', 'person_claims']) {
  test(`auto-match resumes after lost response from ${failedTable} without downgrading completed rows`, async t => {
    const db = memoryRest(t), { snapshot, plan } = fixture();
    await stagePartyCandidateReview(config, snapshot, plan, at);
    let injected = false;
    db.control.after = call => {
      if (!injected && call.table === failedTable && call.method !== 'GET') { injected = true; throw new Error('synthetic response lost after commit'); }
    };
    const first = await applyPlan(config, planHighConfidenceMatches(db.dataset()), at);
    assert.equal(first.incomplete, 1); assert.equal(first.completed, 0);
    db.control.after = null;
    const refreshed = planHighConfidenceMatches(db.dataset());
    assert.equal(refreshed.blocking.length, 0);
    const result = await applyPlan(config, refreshed, at);
    assert.equal(result.incomplete, 0);
    assert.equal(planHighConfidenceMatches(db.dataset()).alreadyConfirmed.length, 1);
    db.tables.candidates[0].is_public = true;
    const complete = structuredClone(db.tables); db.resetCalls();
    const done = await applyPlan(config, planHighConfidenceMatches(db.dataset()), at);
    assert.equal(done.completed, 0); assert.deepEqual(db.tables, complete); assert.equal(db.calls.length, 0);
  });
}

test('auto-match respects manual claim/identity holds and concurrent rejection', async t => {
  const db = memoryRest(t), { snapshot, plan } = fixture();
  await stagePartyCandidateReview(config, snapshot, plan, at);
  for (const status of ['rejected', 'archived', 'needs_more_evidence']) {
    const dataset = db.dataset(); dataset.claims[0].review_status = status;
    assert.equal(planHighConfidenceMatches(dataset).eligible.length, 0);
  }
  const rejected = db.dataset(); rejected.matches[0].match_status = 'rejected_match';
  assert.equal(planHighConfidenceMatches(rejected).eligible.length, 0);
  const held = db.dataset(); held.matches[0].reviewed_at = at;
  assert.equal(planHighConfidenceMatches(held).eligible.length, 0);
  const prepared = planHighConfidenceMatches(db.dataset());
  db.control.before = (call, tables) => {
    if (call.table === 'person_identity_matches' && call.method === 'PATCH') {
      tables.person_identity_matches[0].match_status = 'rejected_match'; tables.person_identity_matches[0].reviewed_at = at;
      db.control.before = null;
    }
  };
  const result = await applyPlan(config, prepared, at);
  assert.equal(result.completed, 0); assert.equal(result.incomplete, 1);
  assert.equal(db.tables.person_identity_matches[0].match_status, 'rejected_match');
  assert.equal(db.tables.person_claims[0].review_status, 'pending');
});

test('multiple revisions require an explicit matching content choice', () => {
  const { snapshot, plan } = fixture();
  const first = buildStagingRows(snapshot, plan).sourcePeople[0];
  plan.matched[0].record.platform = ['變更'];
  const second = buildStagingRows(snapshot, plan).sourcePeople[0];
  assert.equal(selectPartyCandidateSources([first, second]).selected.length, 0);
  const choice = { sourcePersonKey: second.source_person_key, contentRevision: second.source_payload.revision };
  assert.deepEqual(selectPartyCandidateSources([first, second], [choice]).selected, [second]);
  assert.equal(selectPartyCandidateSources([first, second], [{ ...choice, contentRevision: first.source_payload.revision }]).selected.length, 0);
});

test('legacy auto-match blocks different source and claim content', async t => {
  const db = memoryRest(t), { snapshot, plan } = fixture();
  await stagePartyCandidateReview(config, snapshot, plan, at);
  const source = db.tables.source_people[0], claim = db.tables.person_claims[0];
  source.source_person_key = source.source_payload.baseSourcePersonKey;
  source.source_payload.schemaVersion = 1; delete source.source_payload.revision;
  claim.claim_key = source.source_payload.baseClaimKey;
  claim.claim_json = structuredClone(source.source_payload); claim.claim_json.platform = ['內容不相符'];
  const planned = planHighConfidenceMatches(db.dataset());
  assert.equal(planned.eligible.length, 0);
  assert.ok(planned.blocking.some(row => row.errors.some(error => error.includes('content revisions disagree'))));
  db.resetCalls();
  await assert.rejects(applyPlan(config, planned, at), /blocked identity plan/);
  assert.equal(db.calls.length, 0);
});
