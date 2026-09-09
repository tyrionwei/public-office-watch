import { buildStagingRows } from '../party-candidate-review.mjs';
export const config = { supabaseUrl: 'http://127.0.0.1:54321', serviceRoleKey: 'synthetic-not-a-secret' };
export const at = '2026-09-09T10:00:00.000Z';
export function fixture() {
  const record = { sourceCandidateKey: 'synthetic-2026-01', personName: '測試人物', candidacyStatus: 'party_nominee', raceType: 'municipality_mayor', regionName: '台北市', districtName: null, nominationAnnouncedAt: '2026-09-01', profileUrl: 'https://example.test/candidate', photoUrl: null, education: ['測試大學'], experience: ['測試經歷'], platform: ['測試政見'], isIncumbent: false };
  const group = { canonicalPersonId: 'person-1', people: [{ id: 'person-1' }], evidence: ['party', 'geography'] };
  const snapshot = { schemaVersion: 1, electionYear: 2026, party: '測試黨', source: { name: '測試官網', url: 'https://example.test/' }, records: [record] };
  const plan = { matched: [{ record, race: { id: 'race-1', title: '測試選舉' }, canonicalGroups: [group], selectedGroup: group, identityResolution: 'high_confidence_match' }], blocking: [] };
  return { snapshot, plan };
}
export function reviewFor(snapshot, plan, overrides = {}) {
  const record = plan.matched[0].record;
  return { schemaVersion: 1, party: snapshot.party, reviewedBy: 'synthetic-reviewer', decisions: [{ sourceCandidateKey: record.sourceCandidateKey, personName: record.personName, contentRevision: buildStagingRows(snapshot, plan).claims[0].claim_json.revision, decision: 'use_existing', personId: 'person-1', reviewedAt: at, ...overrides }] };
}
const clone = value => structuredClone(value);
export function memoryRest(t) {
  const tables = { source_people: [], person_claims: [], person_identity_matches: [], people: [{ id: 'person-1', name: '測試人物', is_public: true }], candidates: [] };
  const calls = []; let counter = 0;
  const control = { before: null, after: null };
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input), table = url.pathname.split('/').pop(), method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const call = { table, method, body: clone(body), url }; calls.push(call);
    await control.before?.(call, tables);
    const rows = tables[table]; if (!rows) throw new Error('Unknown fixture table: ' + table);
    function matches(row) {
      return [...url.searchParams].every(([key, filter]) => {
        if (['select', 'on_conflict', 'order', 'limit', 'offset'].includes(key)) return true;
        if (filter === 'is.null') return row[key] == null;
        if (filter.startsWith('eq.')) {
          const expected = filter.slice(3);
          return typeof row[key] === 'object' && row[key] !== null ? JSON.stringify(row[key]) === expected : String(row[key]) === expected;
        }
        if (filter.startsWith('in.(')) return filter.slice(4, -1).split(',').map(x => x.replace(/^"|"$/g, '')).includes(String(row[key]));
        throw new Error('Unknown fixture filter: ' + filter);
      });
    }
    let result;
    if (method === 'GET') result = rows.filter(matches).slice(Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('offset') ?? 0) + Number(url.searchParams.get('limit') ?? 10000));
    else if (method === 'POST') {
      result = [];
      const conflict = url.searchParams.get('on_conflict')?.split(',');
      for (const row of body) {
        const existing = conflict && rows.find(old => conflict.every(key => old[key] === row[key]));
        if (existing) {
          if (String(init.headers?.prefer).includes('ignore-duplicates')) continue;
          throw new Error('Unsafe fixture merge attempted');
        }
        const added = { id: 'fixture-' + (++counter), updated_at: at, created_at: at, is_public: false,
          ...(table === 'person_identity_matches' ? { reviewed_at: null } : {}),
          ...(table === 'person_claims' ? { person_id: null, candidate_id: null, review_status: 'pending', visibility: 'review_only' } : {}), ...clone(row) };
        rows.push(added); result.push(added);
      }
    } else if (method === 'PATCH') {
      result = rows.filter(matches); for (const row of result) Object.assign(row, clone(body));
    } else throw new Error('Unexpected fixture method: ' + method);
    await control.after?.(call, tables);
    return new Response(JSON.stringify(clone(result)), { status: 200 });
  };
  t.after(() => { globalThis.fetch = original; });
  return { tables, calls, control, resetCalls: () => { calls.length = 0; }, dataset: () => ({ sources: clone(tables.source_people), claims: clone(tables.person_claims), matches: clone(tables.person_identity_matches), candidates: clone(tables.candidates) }) };
}
