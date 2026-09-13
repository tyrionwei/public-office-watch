import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDataProgress, readProgressRows, createDataProgressReader, candidateCounty, type ProgressSources } from '../build/internalDataProgress.ts';
const now = new Date('2026-09-12T00:00:00Z');
function fixture(): ProgressSources {
  return {
    profileClaims: { rows: [], error: null },
    people: { error: null, rows: [{ person_id: 'p1', name: '人物一', current_office_label: '立法委員', list_status: 'current', list_role: 'legislator' }, { person_id: 'p2', name: '人物二', list_status: 'candidate' }] },
    candidates: { error: null, rows: [2024, 2026].map(y => ({ candidate_id: `c${y}`, person_id: 'p1', election_year: y, election_result: y === 2024 ? 'elected' : 'pending', source_name: '官方', source_url: 'https://example.org', region_name: '臺北市' })) },
    claims: { error: null, rows: [{ claim_id: 'a', person_id: 'p1', review_status: 'pending', claim_type: 'family_relation' }] }, identities: { error: null, rows: [] },
    pool: { error: null, data: { targets: [{ personId: 'p1' }, { personId: 'p1' }], generatedAt: now.toISOString() } }, state: { error: null, data: { historicalBackfill: {}, attempts: {} } },
    followups: { error: null, data: { items: [{ key: 'linked', personId: 'p1', status: 'open', pendingClaim: { id: 'a' } }, { key: 'unlinked', personId: 'p1', status: 'blocked' }, { key: 'unlinked', personId: 'p1', status: 'blocked' }] } },
    daily: { error: null, data: { generatedAt: now.toISOString(), status: 'ok', scheduledStepCount: 1, steps: [{ status: 'ok', exitCode: 0, finishedAt: now.toISOString() }] } }, weekly: { data: null, error: 'weekly missing' }, review: { data: null, error: 'review missing' },
  };
}
const build = (s = fixture(), p = {}) => buildDataProgress(s, new URLSearchParams(p), now);
test('necessary object-items include candidate profiles but exclude birthdays, IDs and waiting future results', () => {
  const s = build(); assert.deepEqual(s.gap, { missing: 2, total: 9, waiting: 1 });
  assert.equal(s.metrics.filter(m => m.total === null).length, 5);
});
test('current and election views overlap, deduplicating people but retaining election records', () => {
  assert.equal(build(fixture(), { scope: 'current' }).people, 1);
  assert.equal(build(fixture(), { scope: 'current' }).candidates, 2);
  assert.equal(build(fixture(), { scope: 'election' }).people, 1);
  assert.equal(build(fixture(), { scope: 'election' }).candidates, 1);
});
test('partial paging failure discards rows and invalidates dependent scopes', async () => {
  let calls = 0;
  const result = await readProgressRows(async () => { if (calls++) throw Error('failed'); return Array.from({ length: 1000 }, (_, i) => ({ id: `p${i}` })); }, 'people', 'id', 'id');
  assert.equal(result.rows.length, 0); assert.ok(result.error);
  const input = fixture(); input.candidates = result;
  const s = build(input, { scope: 'election' }); assert.equal(s.people, null); assert.equal(s.gap.total, null); assert.equal(s.details.total, 0);
});
test('three successful categories required; first completion and due filters overlap', () => {
  const input = fixture(); input.state.data = { historicalBackfill: { p1: { completedAt: '2026-08-01T00:00:00Z', results: ['family_relation', 'party_affiliation', 'legal_case'].map(category => ({ category, status: 'no_leads' })) } }, attempts: { p1: { attemptedAt: '2026-08-01T00:00:00Z' } } };
  const s = build(input, { section: 'research', state: 'complete' }); assert.equal(s.research.groups[1].total, 1); assert.equal(s.research.groups[1].complete, 1); assert.equal(s.research.groups[1].due, 1); assert.equal(s.details.total, 1);
  input.state.data.historicalBackfill.p1.results.pop(); assert.equal(build(input).research.groups[1].complete, 0);
  input.state = { data: null, error: 'missing' }; assert.equal(build(input).research.groups[1].complete, null);
});
test('linked claims and duplicate lead keys do not inflate backlog', () => {
  const s = build(fixture(), { section: 'backlog', state: 'leads' });
  assert.equal(s.backlog.find(b => b.key === 'leads')?.count, 1); assert.equal(s.backlog.find(b => b.key === 'pending')?.count, 1); assert.equal(s.backlog.find(b => b.key === 'publication')?.count, null); assert.equal(s.details.total, 1);
});
test('nested fallback blocks complete success despite top-level ok', () => {
  const input = fixture(); input.daily.data!.steps[0].result = { source: { status: 'fallback' } };
  assert.equal(build(input).schedules[0].completeAt, null); assert.equal(build(input).schedules[0].passed, 0);
});
test('former candidacy is not former office; unknown identity is not assigned a person scope', () => {
  const input = fixture(); input.identities.rows = [{ source_person_id: 'id' }];
  assert.equal(build(input, { tenure: 'former' }).people, null);
  assert.equal(build(input, { scope: 'current' }).backlog.find(b => b.key === 'identity')?.count, null);
});
test('pagination is stable and unsafe source URLs are removed', () => {
  const input = fixture(); input.claims.rows = Array.from({ length: 31 }, (_, i) => ({ claim_id: `claim${String(i).padStart(2, '0')}`, person_id: 'p1', review_status: 'pending', source_url: 'javascript:alert(1)' }));
  const s = build(input, { section: 'backlog', state: 'pending', page: '2' }); assert.equal(s.details.rows.length, 6); assert.equal(s.details.total, 31); assert.equal(s.details.rows[0].sourceUrl, undefined);
});


test('concurrent requests share a snapshot; filters reuse it and explicit refresh reads again', async () => {
  let reads = 0;
  const reader = createDataProgressReader('/nonexistent-progress-fixture', async () => { reads++; return []; });
  await Promise.all([reader(new URLSearchParams()), reader(new URLSearchParams({ scope: 'current' }))]);
  assert.equal(reads, 6);
  await reader(new URLSearchParams({ page: '2' })); assert.equal(reads, 6);
  await reader(new URLSearchParams({ refresh: '1' })); assert.equal(reads, 12);
});


test('county filter follows election year, historical titles and township parents', () => {
  const input = fixture();
  input.regions = { error: null, rows: [
    { region_id: 'town', name: '板橋區', region_type: 'district', parent_region_id: 'county' },
    { region_id: 'county', name: '新北市', region_type: 'municipality' },
  ] };
  input.candidates.rows = [
    { candidate_id: 'old', person_id: 'p1', election_year: 2005, region_name: '新北市', race_title: '臺北縣縣長選舉' },
    { candidate_id: 'new', person_id: 'p2', election_year: 2026, region_id: 'town', region_name: '板橋區', race_title: '第1選區' },
  ];
  assert.deepEqual(build(input, { year: '2005' }).options.regions, ['臺北縣']);
  assert.deepEqual(build(input, { year: '2026' }).options.regions, ['新北市']);
  assert.equal(build(input, { year: '2026', region: '新北市' }).candidates, 1);
  assert.equal(build(input, { year: '2005', region: '臺北縣' }).candidates, 1);
  assert.deepEqual(build(input).options.regions, ['新北市', '臺北縣']);
  assert.equal(candidateCounty({ election_year: 2009, region_name: '桃園市' }, new Map()), '桃園縣');
  assert.equal(candidateCounty({ election_year: 2014, race_title: '桃園市市長選舉' }, new Map()), '桃園市');
  assert.equal(candidateCounty({ election_year: 2005, region_name: '臺中市', race_title: '臺中縣第1選舉區議員選舉' }, new Map()), '臺中縣');
  assert.equal(candidateCounty({ region_name: '全國' }, new Map()), null);
});


test('published claims fill canonical person profile gaps without master-field mutation', () => {
  const input = fixture();
  input.profileClaims.rows = [
    { claim_id: 'edu', person_id: 'p1', claim_type: 'education', claim_value: '公報學歷' },
    { claim_id: 'exp', person_id: 'p1', claim_type: 'experience', claim_value: '', claim_json: { value: '公報經歷' } },
    { claim_id: 'other', person_id: 'p2', claim_type: 'education', claim_value: '其他人' },
  ];
  const summary = build(input);
  assert.equal(summary.metrics.find(m => m.key === 'people')?.missing, 0);
  assert.equal(summary.details.rows.filter(r => r.id.startsWith('name:p1:')).length, 0);
  assert.equal(input.people.rows[0].education, undefined);
});
test('published profile read failure is unknown, not a false missing or completed count', () => {
  const input = fixture(); input.profileClaims = { rows: [], error: 'profile read failed' };
  const summary = build(input);
  assert.equal(summary.gap.missing, null);
  assert.equal(summary.gap.total, null);
  assert.equal(summary.metrics.find(m => m.key === 'people')?.missing, null);
  assert.equal(summary.details.rows.filter(r => r.id.startsWith('name:p1:')).length, 0);
});
