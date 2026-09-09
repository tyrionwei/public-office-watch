import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReviewedOfficialCandidates, buildStagingRows, stageOfficialCandidateReview, validateReviewFile } from './official-candidate-review.mjs';

const config = { supabaseUrl: 'http://127.0.0.1:54321', serviceRoleKey: 'fixture-only' };
function fixture() {
  const snapshot = { electionYear: 2026, candidacyStatus: 'registered', source: {
    name: '測試官方來源', url: 'https://web.cec.gov.tw/example', publishedAt: '2026-09-01', retrievedAt: '2026-09-01T00:00:00Z',
  } };
  const plan = { blocking: [], matched: ['a', 'b'].map((key) => ({
    record: { candidateExternalId: key, personExternalId: `person-${key}`, personName: `測試${key}`, party: '甲', candidateNo: null, candidateNoProvided: false, isIncumbent: false },
    race: { id: 'race', external_id: 'race-external', title: '測試選舉' },
    person: null, candidate: null, identityCandidates: [], raceCandidates: [],
  })) };
  return { snapshot, plan };
}
function rest(t, beforeWrite = () => {}) {
  const db = { source_people: [], person_claims: [], person_identity_matches: [], raw_source_records: [], candidates: [], people: [] };
  const writes = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, config.supabaseUrl);
    const table = url.pathname.split('/').at(-1);
    assert.ok(db[table], table);
    const method = init.method ?? 'GET';
    const selected = () => db[table].filter((row) => [...url.searchParams].every(([key, value]) => {
      if (['select', 'on_conflict'].includes(key)) return true;
      if (value.startsWith('eq.')) return row[key] === value.slice(3);
      if (value.startsWith('in.(')) return JSON.parse(`[${value.slice(4, -1)}]`).includes(row[key]);
      assert.fail(value);
    }));
    if (method === 'GET') return Response.json(selected());
    const body = JSON.parse(init.body);
    beforeWrite(db, table, method, body);
    writes.push({ table, method, body, prefer: init.headers.prefer });
    if (method === 'PATCH') {
      const rows = selected();
      rows.forEach((row) => Object.assign(row, body));
      return Response.json(rows);
    }
    assert.equal(method, 'POST');
    const conflict = url.searchParams.get('on_conflict');
    const returned = [];
    for (const row of body) {
      const old = conflict && db[table].find((item) => item[conflict] === row[conflict]);
      if (old && init.headers.prefer.includes('ignore-duplicates')) continue;
      if (old) { Object.assign(old, row); returned.push(old); }
      else { const saved = { id: `${table}-${db[table].length}`, ...row }; db[table].push(saved); returned.push(saved); }
    }
    return Response.json(returned);
  });
  return { db, writes };
}

for (const status of ['verified', 'rejected', 'archived', 'needs_more_evidence']) {
  test(`restaging retains all ${status} fields for an identical revision`, async (t) => {
    const { snapshot, plan } = fixture(); const { db } = rest(t);
    await stageOfficialCandidateReview(config, snapshot, plan, {});
    Object.assign(db.person_claims[0], { review_status: status, person_id: 'reviewed-person', visibility: 'private', scoring_reasons: [{ reason: 'manual' }] });
    const before = structuredClone(db.person_claims);
    snapshot.source.retrievedAt = '2026-09-08'; snapshot.source.publishedAt = '2026-09-07';
    plan.matched[0].identityCandidates = [{ id: 'new-local-suggestion' }];
    const result = await stageOfficialCandidateReview(config, snapshot, plan, {}, '2026-09-08');
    assert.deepEqual(db.person_claims, before);
    assert.equal(result.stagedClaims, 0); assert.equal(result.preservedClaims, 2);
  });
}

test('changed official content creates a private revision and retains old claim and source evidence', async (t) => {
  const { snapshot, plan } = fixture(); const { db } = rest(t);
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  db.person_claims[0].review_status = 'verified';
  const oldClaim = structuredClone(db.person_claims[0]); const oldSource = structuredClone(db.source_people[0]);
  plan.matched[0].record.party = '乙'; plan.matched[0].record.personName = '測試新名稱';
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  assert.equal(db.person_claims.length, 3); assert.equal(db.source_people.length, 3);
  assert.deepEqual(db.person_claims[0], oldClaim); assert.deepEqual(db.source_people[0], oldSource);
  const latest = db.person_claims[2];
  assert.equal(latest.review_status, 'pending'); assert.equal(latest.is_public, false);
  assert.equal(latest.claim_json.baseClaimKey, oldClaim.claim_json.baseClaimKey);
  assert.notEqual(latest.claim_json.revision, oldClaim.claim_json.revision);
  plan.matched[0].record.party = '甲'; plan.matched[0].record.personName = '測試a';
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  assert.equal(db.person_claims.length, 3); assert.deepEqual(db.person_claims[0], oldClaim);
});

test('legacy identical terminal claims survive without being reopened; legacy changes make a revision', async (t) => {
  const { snapshot, plan } = fixture(); const { db } = rest(t);
  const rows = buildStagingRows(snapshot, plan);
  const source = { id: 'legacy-source', ...rows.sourcePeople[0], source_person_key: 'official-candidate:a' };
  const payload = { ...rows.claims[0].claim_json, schemaVersion: 1 };
  for (const key of ['personName', 'electionYear', 'revision', 'baseClaimKey']) delete payload[key];
  const claim = { id: 'legacy-claim', ...rows.claims[0], claim_key: 'official-candidacy:a', claim_json: payload, source_person_id: source.id, review_status: 'rejected' };
  db.source_people.push(source); db.person_claims.push(claim);
  const before = structuredClone(claim);
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  assert.equal(db.person_claims.length, 2); assert.deepEqual(db.person_claims[0], before);
  snapshot.candidacyStatus = 'withdrawn';
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  assert.equal(db.person_claims.length, 4); assert.deepEqual(db.person_claims[0], before);
  assert.equal(db.source_people[0].source_payload.candidacyStatus, 'registered');
});

test('applying a subset preserves other terminal decisions and skips terminal replays', async (t) => {
  const { snapshot, plan } = fixture(); const { db, writes } = rest(t);
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  db.person_claims[0].review_status = 'verified'; const before = structuredClone(db.person_claims[0]);
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  const review = { reviewedBy: 'fixture-reviewer', decisions: [{ item: plan.matched[1], candidateExternalId: 'b', contentRevision: buildStagingRows(snapshot, plan).claims[1].claim_json.revision, decision: 'reject', reviewedAt: '2026-09-08' }] };
  await applyReviewedOfficialCandidates(config, snapshot, review, () => assert.fail('candidate write'));
  assert.deepEqual(db.person_claims[0], before); assert.equal(db.person_claims[1].review_status, 'rejected');
  const count = writes.length;
  const result = await applyReviewedOfficialCandidates(config, snapshot, review, () => assert.fail('candidate write'));
  assert.equal(result.preservedTerminalClaims, 1); assert.equal(writes.length, count);
  assert.ok(writes.filter((write) => write.table === 'person_claims' && write.method === 'POST').every((write) => write.prefer.includes('ignore-duplicates')));
});

test('revision identity includes number, status, name, race and official source, but not object key order', () => {
  const { snapshot, plan } = fixture();
  const key = () => buildStagingRows(snapshot, plan).claims[0].claim_key;
  const original = key();
  plan.matched[0].race = { title: '測試選舉', external_id: 'race-external', id: 'race' };
  assert.equal(key(), original);
  for (const [object, field, value] of [[plan.matched[0].record, 'candidateNo', 7], [snapshot, 'candidacyStatus', 'withdrawn'], [plan.matched[0].record, 'personName', '另一人'], [plan.matched[0].race, 'id', 'other'], [snapshot.source, 'url', 'https://web.cec.gov.tw/other']]) {
    const old = object[field]; object[field] = value; assert.notEqual(key(), original); object[field] = old;
  }
});

test('review files must bind decisions to the exact official content revision', () => {
  const { snapshot, plan } = fixture();
  const raw = { schemaVersion: 1, reviewedBy: 'tester', decisions: [{ candidateExternalId: 'a', personName: '測試a', decision: 'reject', reviewedAt: '2026-09-08', contentRevision: buildStagingRows(snapshot, plan).claims[0].claim_json.revision }] };
  assert.doesNotThrow(() => validateReviewFile(raw, snapshot, plan));
  assert.throws(() => validateReviewFile({ ...raw, decisions: [{ ...raw.decisions[0], contentRevision: undefined }] }, snapshot, plan), /contentRevision/);
  plan.matched[0].record.party = '乙';
  assert.throws(() => validateReviewFile(raw, snapshot, plan), /contentRevision/);
});

test('review completed between staging read and insert is not overwritten', async (t) => {
  const { snapshot, plan } = fixture(); let concurrentReview = false;
  const { db } = rest(t, (rows, table, method) => {
    if (concurrentReview && table === 'person_claims' && method === 'POST') {
      Object.assign(rows.person_claims[0], { review_status: 'verified', scoring_reasons: [{ reason: 'concurrent reviewer' }] });
    }
  });
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  concurrentReview = true;
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  assert.equal(db.person_claims[0].review_status, 'verified');
  assert.deepEqual(db.person_claims[0].scoring_reasons, [{ reason: 'concurrent reviewer' }]);
});

test('applying a changed reviewed revision updates only that claim and its identity source', async (t) => {
  const { snapshot, plan } = fixture(); const { db } = rest(t);
  plan.matched[0].person = { id: 'person-confirmed' };
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  db.person_claims[0].review_status = 'rejected'; const before = structuredClone(db.person_claims[0]);
  plan.matched[0].record.party = '乙';
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  const item = plan.matched[0];
  const review = { reviewedBy: 'tester', decisions: [{ item, candidateExternalId: 'a', contentRevision: buildStagingRows(snapshot, plan).claims[0].claim_json.revision, decision: 'use_existing', personId: 'person-confirmed', reviewedAt: '2026-09-08' }] };
  const result = await applyReviewedOfficialCandidates(config, snapshot, review, (_snapshot, planned, people) => {
    assert.equal(planned.record.party, '乙');
    return { external_id: 'a', person_id: people.get('person-a').id, is_public: false };
  });
  assert.equal(result.writtenCandidates, 1); assert.deepEqual(db.person_claims[0], before);
  const current = db.person_claims[2];
  assert.equal(current.review_status, 'verified'); assert.equal(current.person_id, 'person-confirmed');
  assert.equal(current.is_public, false);
  assert.ok(db.person_identity_matches.some((match) => match.source_person_id === current.source_person_id && match.reviewed_by === 'tester'));
});
