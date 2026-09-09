import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { planPlannedLocalRaceReconciliation, withPlannedLocalRaceReconciliation } from './lib/planned-local-race-reconciliation.mjs';

const source = fs.readFileSync(new URL('./sync-real-public-data.mjs', import.meta.url), 'utf8');
const seed = JSON.parse(fs.readFileSync(new URL('../data-sources/real-public-data.seed.json', import.meta.url), 'utf8'));
const districts = JSON.parse(fs.readFileSync(new URL('../data-sources/cec-2026-local-election-districts.json', import.meta.url), 'utf8'));
const calendar = seed.sources.find(row => row.id === 'cec-2026-local-election-calendar');
function slice(start, end) {
  assert.equal(source.split(start).length, 2);
  assert.equal(source.split(end).length, 2);
  return source.slice(source.indexOf(start), source.indexOf(end));
}
const executable = [
  fs.readFileSync(new URL('./normalize-election-district.mjs', import.meta.url), 'utf8').replace('export function', 'function'),
  slice('function mergeByExternalId(', 'function normalizeHistoricalRaceType('),
  slice('const plannedLocalElection =', 'function toCecCountyKey('),
  slice('function toLocalCouncilorRaceType(', 'function classifyHistoricalCecCandidateEntry('),
  slice('function getSource(', 'function normalizeLegalLeadDate('),
  slice('async function hideKnownSamplePublicRows(', 'function buildReport('),
  slice('function buildReport(', 'async function main('),
].join('\n');
const owner = (external_id, overrides = {}) => ({ id: external_id, external_id, election_id: 'planned', race_type: 'county_councilor', is_public: true, source_name: calendar.name, source_url: calendar.url, ...overrides });
const storedRows = [
  owner('planned-2026-local-from-cec-2022-local-councilor-regional-10004-99'),
  owner('planned-2026-local-official-10004-99'),
  owner('manual-councilor'),
  owner('cec-2026-grassroots-fixture', { race_type: 'village_chief' }),
  owner('planned-2026-local-official-10004-98', { source_url: 'https://other.invalid' }),
  owner('planned-2026-local-official-10004-97', { is_public: false }),
  owner('planned-2026-local-official-10004-96', { election_id: 'other' }),
];

async function runWrite(input, complete = false) {
  const patches = [];
  const events = [];
  const tables = new Map();
  let plan;
  const stop = new Error('Stop before unrelated people/finance writes');
  const context = vm.createContext({
    getSupabaseEnv: () => ({ fixtureOnly: true }),
    withPlannedLocalRaceReconciliation,
    summarizeLiveSourceHealth: () => ({ status: 'ok', needsAttention: false }),
    estimatePersonClaimCount: () => 0,
    ...Object.fromEntries(['buildSourcePersonRows', 'buildIdentityMatchRows', 'buildProbableIdentityMatchRows',
      'reconcileHistoricalCecImportedPeople', 'buildPersonClaimRows', 'buildPersonEnrichmentClaimRows',
      'fetchExistingPersonClaimReviewStates', 'preserveReviewedPersonClaimRows', 'buildPersonPartyAffiliationRows',
      'buildEnrichmentPartyAffiliationRows', 'applySkippedWikidataRejections', 'applyExistingWikidataTerminalReviewStates',
      'buildLegalRecordLeadRows', 'supabaseRequest'].map(name => [name, () => []])),
    planPlannedLocalRaceReconciliation: args => { plan = planPlannedLocalRaceReconciliation(args); return plan; },
    supabasePatch: async (_env, table, where, values) => { patches.push({ table, where, values }); return []; },
    upsertOrThrow: async (_env, table, rows) => {
      events.push(`upsert:${table}`);
      const saved = rows.map(row => ({ ...row, id: row.external_id === 'planned-2026-local-public-officials' ? 'planned' : row.external_id }));
      tables.set(table, saved);
      return saved;
    },
    selectAllOrThrow: async (_env, table, columns) => {
      if (table === 'regions') return tables.get(table);
      if (table === 'races' && columns === 'id,external_id,status') { if (!complete) throw stop; return tables.get(table); }
      if (complete && ['people', 'person_identity_matches'].includes(table)) return [];
      if (table === 'races') { events.push('snapshot:races'); return storedRows; }
      throw Error(`Unexpected selection: ${table}`);
    },
  });
  vm.runInContext(executable, context);
  const enriched = context.enrichSeedWithPlannedLocalElections(input, districts);
  const writing = context.writeSeed(enriched.seed, 'fixture', { write: true, recordRun: complete, plannedLocalElections: enriched.plannedLocalElections });
  let report;
  if (complete) report = await writing;
  else await assert.rejects(writing, error => error === stop);
  assert.deepEqual(patches.filter(patch => patch.table === 'races' && patch.where.id), []);
  assert.ok(events.indexOf('snapshot:races') < events.indexOf('upsert:races'));
  return { plan, enriched, rows: tables.get('races'), report, recorded: tables.get('data_sync_runs')?.[0] };
}

for (const mode of ['fallback', 'partial-ok']) {
  test(`actual sync preserves missing owned, manual and grassroots races with ${mode} source`, async () => {
    const input = structuredClone(seed);
    if (mode === 'partial-ok') input.races.push({ externalId: 'cec-2022-local-mayor-10004', electionExternalId: 'cec-2022-local-public-officials', regionExternalId: seed.regions[0].externalId, raceType: 'county_mayor', title: 'fixture', status: 'completed', sourceId: 'cec-election-data' });
    const { plan, enriched, rows } = await runWrite(input);
    assert.equal(enriched.plannedLocalElections.status, mode === 'fallback' ? 'fallback' : 'ok');
    assert.equal(plan.automaticHideCount, 0);
    assert.equal(plan.status, 'review_required');
    assert.equal(plan.missingOwnedExternalIds.length, 2);
    assert.equal(plan.preservedOtherMissingCount, 3);
    assert.equal(plan.coverage, 'not_proven_complete');
    assert.equal(rows.filter(row => row.election_id === 'planned' && row.district_scope).length, 48);
  });
}

test('missing source metadata never attributes ownership; present IDs and other elections are excluded', () => {
  const base = { electionId: 'planned', currentRows: [], storedRows, source: calendar, sourceStatus: 'ok' };
  assert.equal(planPlannedLocalRaceReconciliation({ ...base, source: undefined }).missingOwnedExternalIds.length, 0);
  const result = planPlannedLocalRaceReconciliation({ ...base, currentRows: storedRows });
  assert.equal(result.status, 'preserved');
  assert.equal(result.missingOwnedExternalIds.length, 0);
  assert.equal(result.preservedOtherMissingCount, 0);
  assert.equal(result.automaticHideCount, 0);
});


test('review-required differences propagate to CLI/run report health without masking source failures', () => {
  const reconciliation = planPlannedLocalRaceReconciliation({ electionId: 'planned', currentRows: [], storedRows, source: calendar });
  const healthy = withPlannedLocalRaceReconciliation({ status: 'ok', needsAttention: false }, reconciliation);
  assert.equal(healthy.status, 'degraded');
  assert.equal(healthy.needsAttention, true);
  assert.equal(healthy.plannedLocalRaceReconciliation, reconciliation);
  assert.equal(withPlannedLocalRaceReconciliation({ status: 'failed', needsAttention: true }, reconciliation).status, 'failed');
});

test('manual lookalikes and mismatched race types are preserved without claiming ownership', () => {
  const result = planPlannedLocalRaceReconciliation({ electionId: 'planned', currentRows: [], source: calendar,
    storedRows: [owner('planned-2026-local-from-cec-2022-local-mayor-manual-override', { race_type: 'county_mayor' }),
      owner('planned-2026-local-official-10004-99', { race_type: 'county_mayor' }),
      owner('planned-2026-local-from-cec-2022-local-councilor-plain-indigenous-10004-1')],
  });
  assert.equal(result.missingOwnedCount, 1);
  assert.equal(result.preservedOtherMissingCount, 2);
});


test('actual writeSeed returns exactly the report stored in recordRun, including review attention', async () => {
  const input = { ...structuredClone(seed), people: [], parties: [], candidates: [], companies: [], partyFinanceSummaries: [], partyCompanyContributionSummaries: [] };
  const { report, recorded } = await runWrite(input, true);
  assert.equal(report, recorded.report_json);
  assert.equal(report.status, 'degraded');
  assert.equal(report.needsAttention, true);
  assert.equal(report.plannedLocalRaceReconciliation.status, 'review_required');
  assert.equal(recorded.status, 'ok'); // Write completion; report health is separate.
});
