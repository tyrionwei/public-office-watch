import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
function fixture({ user = { id: 'verified-admin', is_anonymous: false, app_metadata: { chat_admin: true } }, rpcError = null } = {}) {
  const calls = []; let handler;
  const source = readFileSync(new URL('../../../supabase/functions/feedback-admin/index.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gmu, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, {
    Response, Deno: { env: { get: name => name }, serve: value => { handler = value; } },
    createClient(_url, key) { if (key === 'SUPABASE_ANON_KEY') return { auth: { getUser: async () => ({ data: { user }, error: null }) } };
      calls.push('service'); return { rpc: async (name, args) => { calls.push({ name, args }); return { data: { ok: true }, error: rpcError }; } }; },
  });
  return { calls, request(payload, auth = true) { return handler(new Request('https://example.test/feedback-admin', { method: 'POST', headers: auth ? { Authorization: 'Bearer synthetic' } : {}, body: typeof payload === 'string' ? payload : JSON.stringify(payload) })); } };
}
test('feedback authorization rejects missing, anonymous and forged metadata before data access', async () => {
  for (const user of [null, { id: 'anon', is_anonymous: true, app_metadata: { chat_admin: true } }, { id: 'user', app_metadata: {}, user_metadata: { chat_admin: true } }]) {
    const app = fixture({ user });
    for (const action of ['dashboard', 'detail', 'save', 'summary']) assert.ok([401,403].includes((await app.request({ action })).status));
    assert.equal(app.calls.length, 0);
  }
  const app = fixture(); assert.equal((await app.request({ action: 'dashboard' }, false)).status, 401); assert.equal(app.calls.length, 0);
});
test('only feedback RPC allowed and verified actor cannot be overridden', async () => {
  const app = fixture();
  for (const body of ['{bad', { action: 'publish' }, { action: 'save', input: [] }]) assert.equal((await app.request(body)).status, 400);
  assert.equal(app.calls.length, 0);
  const response = await app.request({ action: 'save', input: { adminUserId: 'forged' } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(app.calls[1].name, 'admin_feedback'); assert.equal(app.calls[1].args.p_admin_user_id, 'verified-admin');
});
test('conflicts and invalid input are distinguishable without leaking database errors', async () => {
  for (const [error, expectedStatus, expectedCode] of [
    [{ message: 'FEEDBACK_CONFLICT' },409,'FEEDBACK_CONFLICT'],
    [{ message: 'FEEDBACK_REASON_REQUIRED' },400,'FEEDBACK_REASON_REQUIRED'],
    [{ code: '22P02', message: 'invalid UUID with private detail' },400,'FEEDBACK_INVALID'],
    [{ message: 'private connection details' },500,'FEEDBACK_SERVER_ERROR'],
  ]) { const response = await fixture({ rpcError: error }).request({ action: 'save' }); assert.equal(response.status, expectedStatus); assert.deepEqual(await response.json(), { error: expectedCode }); }
});

test('retired local feedback write endpoint returns 410 without touching data', () => {
  const source = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('vite.config.ts', source, ts.ScriptTarget.Latest, true);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments[0]?.text === '/internal-api/review-person-feedback') callback = node.arguments[1].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(callback);
  const outputs = [];
  const handler = vm.runInNewContext(`(${callback})`, { jsonResponse: (_response, status, body) => outputs.push({ status, body }) });
  for (const method of ['POST', 'GET', 'PATCH']) handler({ method, body: { action: 'reject' } }, {});
  assert.equal(outputs.length, 3);
  for (const output of outputs) { assert.equal(output.status, 410); assert.match(output.body.error, /feedback-admin/); }
});

function reconciliation() {
  const source = readFileSync(new URL('../src/lib/feedbackAdmin.ts', import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({}) });
  return exports.reconcileFeedbackDraft;
}
test('conflict preserves remote untouched fields and requires explicit choices for overlapping edits', () => {
  const merge = reconciliation();
  const base = { decision: 'accepted', priority: 'normal', workStatus: 'pending', summary: 'original', note: 'original' };
  const mine = { ...base, note: 'my note' };
  const remote = { ...base, summary: 'new summary', note: 'their note', priority: 'high' };
  const result = merge(base, mine, remote);
  assert.deepEqual(Array.from(result.unresolved), ['note']);
  assert.equal(result.draft.summary, 'new summary'); assert.equal(result.draft.priority, 'high');
  const resolved = merge(base, mine, remote, { note: 'mine' });
  assert.equal(resolved.draft.note, 'my note'); assert.equal(resolved.draft.summary, 'new summary');
  assert.equal(resolved.unresolved.length, 0);
  assert.equal(merge(base, mine, remote, { note: 'latest' }).draft.note, 'their note');
});
test('status decision, priority and progress resolve together to prevent invalid combinations', () => {
  const merge = reconciliation();
  const base = { decision: 'accepted', priority: 'normal', workStatus: 'pending', summary: '', note: '' };
  const mine = { ...base, priority: 'high' };
  const remote = { ...base, decision: 'rejected' };
  assert.deepEqual(Array.from(merge(base, mine, remote).unresolved), ['status']);
  const latest = merge(base, mine, remote, { status: 'latest' }).draft;
  assert.equal(latest.decision, 'rejected'); assert.equal(latest.priority, 'normal');
  const own = merge(base, mine, remote, { status: 'mine' }).draft;
  assert.equal(own.decision, 'accepted'); assert.equal(own.priority, 'high');
  assert.equal(merge(base, mine, mine).unresolved.length, 0);
});
