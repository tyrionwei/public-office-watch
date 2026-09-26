import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSeedUsesReviewedGrassrootsImport, isGrassrootsSource } from './grassroots-candidate-policy.mjs';
import { writeSeed, buildProbableIdentityMatchRows } from './sync-real-public-data.mjs';

const higher = () => ({ races: [{ externalId: 'r', raceType: 'county_mayor' }], candidates: [{ raceExternalId: 'r', personExternalId: 'p' }], people: [{ externalId: 'p', name: '測試姓名', position: '縣長' }] });
test('higher-level seed passes and mixed grassroots seed fails before fetch or mutation', async (t) => {
  const seed = higher(); assert.doesNotThrow(() => assertSeedUsesReviewedGrassrootsImport(seed));
  seed.races.push({ external_id: 'g', race_type: 'village_chief' }); seed.candidates.push({ race_external_id: 'g' });
  t.mock.method(globalThis, 'fetch', () => assert.fail('must reject before fetch'));
  await assert.rejects(writeSeed(seed, 'fixture', {}), /Grassroots seed writes require/);
});
test('unknown race and person-only grassroots imports fail closed', () => {
  const seed = higher(); seed.races = [];
  assert.throws(() => assertSeedUsesReviewedGrassrootsImport(seed), /race_type/);
  for (const person of [{ position: '第20屆里長' }, { normalized_role: 'township_representative' }]) {
    assert.throws(() => assertSeedUsesReviewedGrassrootsImport({ people: [person] }), /Grassroots seed writes/);
  }
});
test('grassroots sources emit no identity upsert that could overwrite a manual match', () => {
  for (const clue of [{ normalizedRole: 'village_chief' }, { position: '里長' }, { source_payload: { kind: 'township-representative' } }, { sourcePayload: { race: { race_type: 'village_chief' } } }]) {
    assert.equal(isGrassrootsSource(clue), true);
    const source = { sourcePersonKey: 's', rawName: '測試姓名', gender: 'male', party: '甲', district: '測試縣', ...clue };
    const rows = buildProbableIdentityMatchRows({ sourcePeople: [source] }, new Map([['s', { id: 'source' }]]), [{ id: 'person', name: '測試姓名', gender: 'male', party: '甲', district: '測試縣' }], '2026-09-26', { autoApproveReview: true, identityAutoApproveThreshold: 75 });
    assert.deepEqual(rows, []);
  }
});


test('higher-level source matching keeps the existing automatic review path', () => {
  const source = { sourcePersonKey: 's', rawName: '測試姓名', gender: 'male', party: '甲', district: '測試縣', position: '縣長' };
  const rows = buildProbableIdentityMatchRows({ sourcePeople: [source] }, new Map([['s', { id: 'source' }]]), [{ id: 'person', name: '測試姓名', gender: 'male', party: '甲', district: '測試縣', position: '縣長' }], '2026-09-26', { autoApproveReview: true, identityAutoApproveThreshold: 75 });
  assert.equal(rows.length, 1); assert.equal(rows[0].match_status, 'auto_matched');
});
