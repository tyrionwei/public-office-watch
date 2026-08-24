import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertLocalSupabase,
  buildClaimValue,
  buildStagingRows,
  findForbiddenInputKey,
  fetchPaged,
  normalizeElectionTitle,
  validateReport,
} from './stage-cy-candidate-finance-local.mjs';

const sourceUrl = 'https://ardata.cy.gov.tw/api/v1/Search/download?ElectionArea=%E8%87%BA%E5%8C%97%E5%B8%82';

function financeRecord(candidateName = '蔣萬安') {
  return {
    area: '臺北市',
    candidateName,
    electionName: '111年臺北市市長選舉',
    filingSequence: '首次申報',
    amounts: {
      individualDonations: 51497113,
      businessDonations: 40767551,
      partyDonations: 2000000,
      groupDonations: 760000,
      anonymousDonations: 1585012,
      otherIncome: 26693,
      incomeTotal: 96636369,
      incomeOverThirtyThousand: 89686488,
      cashIncomeTotal: 96561369,
      nonCashIncomeTotal: 75000,
      personnelExpenses: 15067605,
      publicityExpenses: 65052379,
      campaignVehicleRentalExpenses: 1577800,
      campaignOfficeRentalExpenses: 3612402,
      rallyExpenses: 2481080,
      travelExpenses: 508300,
      miscellaneousExpenses: 4657069,
      returnedDonationExpenses: 2672800,
      treasuryPaymentExpenses: 1000000,
      publicRelationsExpenses: 131665,
      expenditureTotal: 96761100,
      expenditureOverThirtyThousand: 94100530,
      cashExpenditureTotal: 96686100,
      nonCashExpenditureTotal: 75000,
      accountBalance: 0,
      balance: -124731,
      cashBalance: -124731,
      nonCashProperty: 0,
    },
    settlementDate: '2022-12-30',
    filingDate: '2023-02-24',
    correctionDate: '2023-03-10',
    sourceUrl,
  };
}

function report(records = [financeRecord()]) {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-24T08:00:00.000Z',
    sourceName: '監察院政治獻金公開查閱平臺',
    sourceUrl: 'https://ardata.cy.gov.tw/home',
    privacyBoundary: 'aggregate only',
    scopeCount: 1,
    recordCount: records.length,
    sources: [{
      area: '臺北市',
      sourceUrl,
      archiveSha256: 'a'.repeat(64),
      summarySha256: 'b'.repeat(64),
      recordCount: records.length,
    }],
    records,
  };
}

const localData = {
  elections: [{ id: 'e1', year: 2022 }],
  races: [{ id: 'r1', election_id: 'e1', title: '臺北市市長選舉' }],
  candidates: [
    { id: 'c1', person_id: 'p1', race_id: 'r1' },
    { id: 'c2', person_id: 'p2', race_id: 'r1' },
  ],
  people: [
    { id: 'p1', name: '蔣萬安' },
    { id: 'p2', name: '陳時中' },
  ],
};

test('accepts only local Supabase writes', () => {
  assert.doesNotThrow(() => assertLocalSupabase('http://127.0.0.1:54321'));
  assert.throws(() => assertLocalSupabase('https://project.supabase.co'), /local-only/u);
});

test('validates the official safe aggregate report and rejects detail keys', () => {
  assert.equal(validateReport(report()).recordCount, 1);
  const unsafe = report();
  unsafe.records[0]['身分證／統一編號'] = 'A123456789';
  assert.equal(findForbiddenInputKey(unsafe), 'records.0.身分證／統一編號');
  assert.throws(() => validateReport(unsafe), /forbidden detail field/u);
});

test('matches one registered candidacy and records coverage gaps', () => {
  const input = report([financeRecord(), financeRecord('未登記人')]);
  input.recordCount = 2;
  input.sources[0].recordCount = 2;
  const staged = buildStagingRows(validateReport(input), localData);

  assert.equal(staged.rows.length, 1);
  assert.equal(staged.unmatched.length, 1);
  assert.equal(staged.ambiguous.length, 0);
  assert.deepEqual(staged.missingFinance.map((entry) => entry.candidateId), ['c2']);
  assert.equal(staged.rows[0].person_id, 'p1');
  assert.equal(staged.rows[0].candidate_id, 'c1');
  assert.equal(staged.rows[0].claim_type, 'finance_summary');
  assert.equal(staged.rows[0].review_status, 'verified');
  assert.equal(staged.rows[0].claim_json.privacyBoundary, 'candidate_aggregate_only_no_donor_payee_or_transaction_details');
  assert.match(staged.rows[0].claim_value, /收入 96,636,369 元；支出 96,761,100 元；餘額 -124,731 元/u);
});

test('does not silently choose between duplicate candidacies', () => {
  const duplicated = {
    ...localData,
    candidates: [...localData.candidates, { id: 'c3', person_id: 'p1', race_id: 'r1' }],
  };
  const staged = buildStagingRows(report(), duplicated);
  assert.equal(staged.rows.length, 0);
  assert.equal(staged.ambiguous.length, 1);
  assert.deepEqual(staged.ambiguous[0].candidateIds, ['c1', 'c3']);
});

test('uses stable id ordering for every paged local REST read', async (context) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    requests.push(url);
    const offset = Number(url.searchParams.get('offset'));
    const rows = offset === 0
      ? Array.from({ length: 100 }, (_, index) => ({ id: String(index + 1) }))
      : [];
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const rows = await fetchPaged({
    supabaseUrl: 'http://127.0.0.1:54321',
    serviceRoleKey: 'local-test-key',
  }, '/rest/v1/people', { select: 'id' }, 'test paged read');

  assert.equal(rows.length, 100);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('order'), 'id.asc');
  assert.equal(requests[1].searchParams.get('offset'), '100');
});

test('normalizes ROC election prefixes without losing the jurisdiction', () => {
  assert.equal(normalizeElectionTitle('111年臺北市市長選舉'), '臺北市市長選舉');
  assert.match(buildClaimValue(financeRecord()), /^2022 臺北市市長/u);
});
