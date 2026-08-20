import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLocalSupabase,
  buildStagingRows,
  normalizeAssemblyApprovalStatus,
  normalizeFilingStatus,
  normalizePartyName,
  normalizeRatificationStatus,
  validateReport,
} from './import-moi-party-annual-finance-local.mjs';

function report(overrides = {}) {
  return {
    sourceName: '內政部政黨資訊網－查財報',
    sourceUrl: 'https://party.moi.gov.tw/PartyFinancialChecklist.aspx?n=16101&sms=13073',
    reportYear: 2025,
    recordCount: 1,
    generatedAt: '2026-08-20T00:00:00.000Z',
    records: [{
      partyNumber: 350,
      partyName: '台灣民眾黨',
      filingStatus: '已申報',
      ratificationStatus: '未追認',
      assemblyApprovalStatus: '尚未經黨員（代表）大會通過',
      detailUrl: 'https://party.moi.gov.tw/PartyFinancialChecklistContent.aspx?fs=2366',
      reportPdfUrl: 'https://ws.moi.gov.tw/report.pdf',
    }],
    ...overrides,
  };
}

test('accepts local Supabase only', () => {
  assert.doesNotThrow(() => assertLocalSupabase('http://127.0.0.1:54321'));
  assert.throws(() => assertLocalSupabase('https://project.supabase.co'), /local-only/u);
});

test('normalizes MOI names and filing statuses', () => {
  assert.equal(normalizePartyName('臺灣 民眾黨'), '台灣民眾黨');
  assert.equal(normalizeFilingStatus('已申報'), 'filed');
  assert.equal(normalizeFilingStatus('待補正'), 'correction_required');
  assert.equal(normalizeRatificationStatus('已追認'), 'ratified');
  assert.equal(normalizePartyName('中華統一促進黨（115年8月7日內政部聲請解散）'), '中華統一促進黨');
  assert.equal(normalizeAssemblyApprovalStatus('有'), 'approved');
  assert.equal(normalizeAssemblyApprovalStatus('尚未經黨員（代表）大會通過'), 'not_approved');
});

test('builds public metadata rows only for unique local party matches', () => {
  const result = buildStagingRows(validateReport(report()), [
    { id: 'party-tpp', name: '臺灣民眾黨' },
  ]);
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(result.ambiguous, []);
  assert.deepEqual(result.rows, [{
    party_id: 'party-tpp',
    report_year: 2025,
    filing_status: 'filed',
    ratification_status: 'not_ratified',
    assembly_approval_status: 'not_approved',
    detail_url: 'https://party.moi.gov.tw/PartyFinancialChecklistContent.aspx?fs=2366',
    report_pdf_url: 'https://ws.moi.gov.tw/report.pdf',
    source_name: '內政部政黨資訊網－查財報',
    source_url: 'https://party.moi.gov.tw/PartyFinancialChecklist.aspx?n=16101&sms=13073',
    is_public: true,
    updated_at: '2026-08-20T00:00:00.000Z',
  }]);
});

test('keeps unmatched parties out of public rows', () => {
  const result = buildStagingRows(validateReport(report()), []);
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.unmatched, [{ partyNumber: 350, partyName: '台灣民眾黨' }]);
});

test('rejects non-official report links', () => {
  assert.throws(() => validateReport(report({
    records: [{
      ...report().records[0],
      reportPdfUrl: 'https://example.com/report.pdf',
    }],
  })), /official ws\.moi\.gov\.tw/u);
});
