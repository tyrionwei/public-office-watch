import assert from 'node:assert/strict';
import test from 'node:test';
import { matchDeclarationIndex, registrationNamePolicy } from './match-cec-asset-declaration-index.mjs';

const indexUrl = 'https://pdps-dec.cec.gov.tw/release/formal/Page7_01_1.html';
const record = { electionYear: 2026, office: 'municipality_councilor', region: '臺北市', district: '第1選舉區',
  name: '測試甲', indexUrl, documentUrl: 'https://pdps-dec.cec.gov.tw/release/formal/files/123.pdf' };
const registration = { candidateExternalId: 'synthetic-1', subjectType: 'candidate', subjectId: 'candidate-1', raceId: 'race-1',
  official: { county: '臺北市', office: 'councilor', district: '臺北市第1選舉區', name: '測試甲' }, acceptedNames: ['測試甲'] };
const run = (records = [record], registrations = [registration], rejectedExternalIds = []) => matchDeclarationIndex({
  index: { records, sources: [{ url: indexUrl, sha256: 'a'.repeat(64) }], retrievedAt: '2026-10-16T10:00:00Z' },
  registrations, rejectedExternalIds,
});

test('requires region, office and district; same name alone never creates a match', () => {
  for (const official of [
    { ...registration.official, county: '新北市' },
    { ...registration.official, district: '臺北市第2選舉區' },
    { ...registration.official, office: 'mayor' },
  ]) assert.equal(run([record], [{ ...registration, official }]).matched.length, 0);
  assert.equal(run().matched.length, 1);
});

test('keeps name variants and ambiguous matches pending; rejects known qualification failures', () => {
  assert.equal(run([{ ...record, name: '測試申' }]).pending.length, 1);
  assert.equal(run([record], [registration, { ...registration, candidateExternalId: 'synthetic-2' }]).pending[0].reason, 'ambiguous_exact_name');
  assert.equal(run([record], [registration], ['synthetic-1']).excluded.length, 1);
  assert.equal(run([record], [{ ...registration, holdReason: 'official_name_conflict' }]).pending.length, 1);
});

test('a prior unreviewed full-name/short-name proposal stays pending even when the index exactly matches its short name', () => {
  const proposal = registrationNamePolicy({ official: { name: '測試甲 Synthetic Fullname' },
    site: { name: '測試甲' }, method: '完整姓名／中文簡稱候選配對，未據此合併人物' });
  const result = run([record], [{ ...registration, ...proposal }]);
  assert.equal(result.matched.length, 0);
  assert.equal(result.pending[0].reason, 'registration_full_name_identity_unreviewed');
});

test('preserves multiple PDFs and name-only subjects; index hash never claims to be a PDF digest', () => {
  const result = run([record, { ...record, documentUrl: record.documentUrl.replace('123', '124') }],
    [{ ...registration, subjectType: 'registration_name', personId: null }]);
  assert.equal(result.summary.matchedPeople, 1);
  assert.equal(result.summary.matchedDocuments, 2);
  assert.equal(new Set(result.matched.map((m) => m.event.external_id)).size, 2);
  const { event } = result.matched[0];
  assert.equal(event.candidate_id, null);
  assert.equal(event.registration_name_id, 'candidate-1');
  assert.equal(event.event_data.hashTarget, indexUrl);
  assert.equal(event.event_data.amountsReviewed, false);
  assert.equal(event.occurred_on, null);
  assert.equal(event.source_published_on, '2026-10-16');
  assert.throws(() => run([{ ...record, documentUrl: 'https://other.test/123.pdf' }]), /Non-official/);
});
