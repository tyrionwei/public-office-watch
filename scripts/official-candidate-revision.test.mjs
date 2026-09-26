import { candidateWriteRow } from './review-official-candidate-snapshot.mjs';
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
    race: { race_type: 'municipality_mayor', id: 'race', external_id: 'race-external', title: '測試選舉' },
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
  plan.matched[0].race = { race_type: 'municipality_mayor', title: '測試選舉', external_id: 'race-external', id: 'race' };
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


test('grassroots name-only review writes no people or identity matches and retains independent candidate records', async (t) => {
  const { snapshot, plan } = fixture(); const { db, writes } = rest(t);
  for (const item of plan.matched) {
    item.race.race_type = 'village_chief'; item.record.personName = '同名測試';
    item.person = { id: 'same-name-only' }; item.identityCandidates = [{ id: 'same-name-only' }];
    item.raceCandidates = [{ external_id: 'unrelated', person_id: null }];
  }
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  const review = validateReviewFile({ schemaVersion: 1, reviewedBy: 'tester', decisions: plan.matched.map((item, index) => ({
    candidateExternalId: item.record.candidateExternalId, personName: item.record.personName,
    contentRevision: buildStagingRows(snapshot, plan).claims[index].claim_json.revision,
    decision: 'name_only', reviewedAt: '2026-09-08',
  })) }, snapshot, plan);
  const result = await applyReviewedOfficialCandidates(config, snapshot, review, candidateWriteRow);
  assert.equal(result.createdPeople, 0); assert.equal(result.writtenCandidates, 2);
  assert.deepEqual(db.candidates.map(row => [row.external_id, row.person_id, row.candidate_name]), [['a', null, '同名測試'], ['b', null, '同名測試']]);
  assert.equal(db.person_identity_matches.length, 0);
  assert.equal(db.people.length, 0);
  assert.ok(!writes.some(write => ['people', 'person_identity_matches'].includes(write.table)));
  assert.ok(db.person_claims.every(row => row.person_id === null && row.is_public === false && row.review_status === 'verified'));
  assert.deepEqual(db.person_claims.map(row => row.candidate_id), db.candidates.map(row => row.id));
});

test('grassroots identity requires higher-level history and explicit review evidence before writes', async (t) => {
  const { snapshot, plan } = fixture(); const { db, writes } = rest(t); const item = plan.matched[0];
  item.race.race_type = 'township_representative';
  item.person = { id: 'higher-person' }; item.identityCandidates = [item.person];
  item.candidate = { external_id: 'a', person_id: 'higher-person', race_id: 'race', is_public: true };
  item.higherLevelPersonIds = ['higher-person'];
  const decision = { item, candidateExternalId: 'a', contentRevision: buildStagingRows(snapshot, plan).claims[0].claim_json.revision, decision: 'use_existing', personId: 'higher-person', reviewedAt: '2026-09-08' };
  await assert.rejects(applyReviewedOfficialCandidates(config, snapshot, { reviewedBy: 'tester', decisions: [decision] }, candidateWriteRow), /identityEvidence/);
  assert.equal(writes.length, 0);
  await assert.rejects(applyReviewedOfficialCandidates(config, snapshot, { reviewedBy: 'tester', decisions: [{ ...decision, decision: 'name_only' }] }, candidateWriteRow), /cannot clear/);
  await assert.rejects(applyReviewedOfficialCandidates(config, snapshot, { reviewedBy: 'tester', decisions: [{ ...decision, decision: 'create_new' }] }, candidateWriteRow), /identityEvidence/);
  decision.identityEvidence = 'Official biographical record cross-check, not name-only';
  item.higherLevelPersonIds = [];
  await assert.rejects(applyReviewedOfficialCandidates(config, snapshot, { reviewedBy: 'tester', decisions: [decision] }, candidateWriteRow), /higher-level/);
  item.higherLevelPersonIds = ['higher-person'];
  await stageOfficialCandidateReview(config, snapshot, plan, {});
  await applyReviewedOfficialCandidates(config, snapshot, { reviewedBy: 'tester', decisions: [decision] }, candidateWriteRow);
  assert.equal(db.people.length, 0); assert.equal(db.candidates[0].person_id, 'higher-person');
  assert.equal(db.candidates[0].candidate_name, item.record.personName);
  assert.equal(db.person_identity_matches[0].person_id, 'higher-person');
  assert.equal(db.person_identity_matches[0].evidence_json.identityEvidence, decision.identityEvidence);
});


test('name-only registration revisions keep candidate identity while status and name change', async (t) => {
  const { snapshot, plan } = fixture(); const { db } = rest(t);
  plan.matched = [plan.matched[0]]; const item = plan.matched[0];
  item.race.race_type = 'village_chief';
  const applyRevision = async () => {
    await stageOfficialCandidateReview(config, snapshot, plan, {});
    const review = validateReviewFile({ schemaVersion: 1, reviewedBy: 'tester', decisions: [{
      candidateExternalId: item.record.candidateExternalId, personName: item.record.personName,
      contentRevision: buildStagingRows(snapshot, plan).claims[0].claim_json.revision,
      decision: 'name_only', reviewedAt: '2026-09-08',
    }] }, snapshot, plan);
    await applyReviewedOfficialCandidates(config, snapshot, review, candidateWriteRow);
  };
  await applyRevision();
  const candidateId = db.candidates[0].id;
  const registeredClaim = structuredClone(db.person_claims[0]);
  item.candidate = structuredClone(db.candidates[0]); item.raceCandidates = [item.candidate];
  snapshot.candidacyStatus = 'qualified'; item.record.personName = '官方更正姓名';
  await applyRevision();
  assert.equal(db.candidates.length, 1); assert.equal(db.candidates[0].id, candidateId);
  assert.equal(db.candidates[0].person_id, null);
  assert.equal(db.candidates[0].candidate_name, '官方更正姓名');
  assert.equal(db.candidates[0].candidacy_status, 'qualified');
  assert.deepEqual(db.person_claims[0], registeredClaim);
  assert.ok(db.person_claims.every(claim => claim.candidate_id === candidateId));
  assert.equal(db.people.length, 0); assert.equal(db.person_identity_matches.length, 0);
});
