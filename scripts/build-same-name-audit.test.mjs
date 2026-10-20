import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSameNameAudit } from './build-same-name-audit.mjs';
import { profileBinding } from './lib/official-profile-policy.mjs';

function data() {
  return { people: ['a', 'b', 'c'].map(id => ({ id, name: '合成同名', position: '縣議員', gender: 'male' })),
    canonical: ['a', 'b', 'c'].map(id => ({ person_id: id, canonical_person_id: id })),
    candidates: [], claims: [], decisions: [], holds: [], publicIds: ['a', 'b', 'c'] };
}
test('村里長代表端點排除；高級別紀錄可保留，不能只因同名高級別人物而保留', () => {
  const d = data(); d.people[0].position = '里長'; d.people[1].position = '鄉民代表';
  d.candidates = [{ person_id: 'b', race_type: 'county_councilor', year: 2002 }];
  const a = buildSameNameAudit(d);
  assert.equal(a.summary.pairs, 1);
  assert.deepEqual(a.pairs[0].personIds, ['b', 'c']);
  assert.equal(a.summary.endpointScope.deferred_grassroots_only, 1);
  d.people[0].position = '曾任里長、縣議員';
  assert.equal(buildSameNameAudit(d).summary.pairs, 3);
});
test('全年度與非公開人物都比對；既有合併只算一個端點', () => {
  const d = data(); d.canonical[1].canonical_person_id = 'a'; d.publicIds = ['a'];
  d.candidates = [{ person_id: 'b', year: 1998, race_type: 'county_councilor' }];
  const a = buildSameNameAudit(d);
  assert.equal(a.summary.pairs, 1); assert.equal(a.pairs[0].publicEndpoints, 1);
  assert.equal(a.endpoints.find(e => e.id === 'a').candidates[0].year, 1998);
});
test('暫緩保留比較全集，rejected和archived不被同名或來源覆蓋', () => {
  const d = data(); d.holds = [{ id: 'h', person_id: 'a', released_at: null }];
  d.decisions = [{ id: 'r', duplicate_person_id: 'a', canonical_person_id: 'b', status: 'rejected' },
    { id: 's', duplicate_person_id: 'b', canonical_person_id: 'c', status: 'archived' }];
  const a = buildSameNameAudit(d);
  assert.equal(a.summary.pairs, 3); assert.equal(a.summary.pairsWithActiveHolds, 2);
  assert.equal(a.pairs.find(p => p.pairKey === 'a|b').category, 'existing_rejected');
  assert.equal(a.pairs.find(p => p.pairKey === 'b|c').category, 'existing_archived');
});
test('官方生日和性別相符仍是人工核對，單一姓名或CEC紀錄鍵不是身份證明', () => {
  const d = data(); d.people = d.people.slice(0, 2);
  d.claims = ['a', 'b'].map(person_id => {
    const c = { person_id, claim_type: 'birth_date', claim_value: '1960-02-03', source_url: 'https://example.gov.tw/person', review_status: 'verified' };
    return { ...c, claim_json: { officialProfilePolicy: { version: 'official-profile-v1', eligible: true, identityVerified: true,
      contentVerified: true, datePrecision: 'day', binding: profileBinding(c) } } };
  });
  let a = buildSameNameAudit(d);
  assert.equal(a.pairs[0].category, 'official_birth_gender_match_for_review');
  d.claims[1].claim_json.officialProfilePolicy.eligible = false;
  a = buildSameNameAudit(d); assert.equal(a.pairs[0].category, 'insufficient_identity_evidence');
  d.people.forEach(p => { p.source_url = 'https://data.gov.tw/dataset/13119'; });
  assert.equal(buildSameNameAudit(d).pairs[0].category, 'insufficient_identity_evidence');
});
test('身份衝突優先於共享人物網址', () => {
  const d = data(); d.people.forEach(p => { p.source_url = 'https://example.org/person/1'; });
  d.people[1].gender = 'female';
  const a = buildSameNameAudit(d);
  assert.equal(a.pairs.find(p => p.pairKey === 'a|b').category, 'identity_conflict');
  assert.equal(a.pairs.find(p => p.pairKey === 'a|c').category, 'shared_person_source_for_review');
});
test('相容的部分生日不算衝突，沒有獨立核對的QID不自動認同人', () => {
  const d = data(); d.people = d.people.slice(0, 2);
  d.claims = ['a', 'b'].map((person_id, i) => {
    const c = { person_id, claim_type: 'birth_date', claim_value: i ? '1960' : '1960-02-03',
      source_url: 'https://example.gov.tw/person', review_status: 'verified' };
    return { ...c, claim_json: { officialProfilePolicy: { version: 'official-profile-v1', eligible: true, identityVerified: true,
      contentVerified: true, datePrecision: i ? 'year' : 'day', binding: profileBinding(c) } } };
  });
  d.claims.push(...['a', 'b'].map(person_id => ({ person_id, claim_type: 'external_id', claim_value: 'wikidata:Q123', review_status: 'verified', claim_json: {} })));
  const a = buildSameNameAudit(d);
  assert.equal(a.pairs[0].category, 'insufficient_identity_evidence');
  assert.equal(a.pairs[0].evidence.birthConflict, false);
});
test('原住民族姓名分隔符與Latin大小寫差異納入同名比對，但不直接判同人', () => {
  const d = data(); d.people = d.people.slice(0, 2);
  d.people[0].name = '合成姓名 Iwan．Sigiy'; d.people[1].name = '合成姓名 iwan·sigiy';
  const a = buildSameNameAudit(d);
  assert.equal(a.summary.pairs, 1); assert.equal(a.pairs[0].category, 'insufficient_identity_evidence');
  assert.equal(a.endpoints[0].members[0].name, '合成姓名 Iwan．Sigiy');
});
test('既有合併也檢查內部身份衝突，僅標示疑點不撤銷決策', () => {
  const d = data(); d.canonical[1].canonical_person_id = 'a'; d.people[1].gender = 'female';
  const a = buildSameNameAudit(d);
  assert.equal(a.summary.existingCanonicalConflictSignals, 1);
  assert.equal(a.canonicalIdentityConflicts[0].personId, 'a');
  assert.equal(a.canonicalIdentityConflicts[0].genderConflict, true);
});
