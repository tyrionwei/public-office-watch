import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as validators from '../../../supabase/functions/_shared/publicUpdateAdmin.ts';

function fixture({ user = { id: 'actual-admin', is_anonymous: false, app_metadata: { chat_admin: true } }, rpcError = null } = {}) {
  const calls = [];
  let handler;
  const row = { birth_date_year_only: true, revision: 1, updated_at: '2026-09-09T08:00:00Z' };
  const client = {
    from(table) { calls.push({ table }); return { select() { return { eq() { return { single: async () => ({ data: row, error: null }) }; } }; } }; },
    rpc(name, args) { calls.push({ name, args }); return { single: async () => ({ data: row, error: rpcError }) }; },
  };
  const source = readFileSync(new URL('../../../supabase/functions/update-admin/index.ts', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gmu, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText,
    { ...validators, Response, console, Deno: { env: { get: name => name }, serve: value => { handler = value; } },
      createClient(_url, key) {
        if (key === 'SUPABASE_ANON_KEY') return { auth: { getUser: async () => ({ data: { user }, error: null }) } };
        calls.push({ serviceClient: true }); return client;
      } });
  return { calls, async request(payload, authorized = true) {
    return handler(new Request('https://example.test/update-admin', { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer synthetic' } : {}) }, body: JSON.stringify(payload) }));
  } };
}

test('server rejects signed-out, anonymous and non-admin callers before any settings access', async () => {
  for (const user of [null, { id: 'anonymous', is_anonymous: true, app_metadata: { chat_admin: true } },
    { id: 'ordinary', app_metadata: {}, user_metadata: { chat_admin: true } }]) {
    const app = fixture({ user });
    for (const action of ['display-settings', 'set-birth-date-display']) {
      assert.ok([401, 403].includes((await app.request({ action, yearOnly: true, expectedRevision: 0 })).status));
    }
    assert.equal(app.calls.length, 0);
  }
  const app = fixture();
  assert.equal((await app.request({ action: 'display-settings' }, false)).status, 401);
  assert.equal(app.calls.length, 0);
});

test('admin setting calls use authenticated user identity and reject malformed writes', async () => {
  const app = fixture();
  assert.equal((await app.request({ action: 'display-settings' })).status, 200);
  assert.equal((await app.request({ action: 'set-birth-date-display', yearOnly: true, expectedRevision: 0, adminUserId: 'forged' })).status, 200);
  const call = app.calls.find(item => item.name);
  assert.equal(call.name, 'admin_set_birth_date_display');
  assert.deepEqual(JSON.parse(JSON.stringify(call.args)), { p_admin_user_id: 'actual-admin', p_year_only: true, p_expected_revision: 0 });
  assert.equal((await app.request({ action: 'set-birth-date-display', yearOnly: 'true', expectedRevision: 0 })).status, 400);
  assert.equal(app.calls.filter(item => item.name).length, 1);
});

test('stale global settings return conflict without claiming a successful save', async () => {
  const app = fixture({ rpcError: { message: 'PUBLIC_UPDATE_ADMIN_DISPLAY_CONFLICT' } });
  const result = await app.request({ action: 'set-birth-date-display', yearOnly: true, expectedRevision: 0 });
  assert.equal(result.status, 409);
  assert.deepEqual(await result.json(), { error: 'PUBLIC_UPDATE_ADMIN_DISPLAY_CONFLICT' });
  const failed = fixture({ rpcError: { message: 'database unavailable' } });
  const failure = await failed.request({ action: 'set-birth-date-display', yearOnly: true, expectedRevision: 0 });
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR' });
});
