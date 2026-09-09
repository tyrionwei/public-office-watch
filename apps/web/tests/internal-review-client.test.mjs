import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function client(fetch) {
  const source = fs.readFileSync(new URL('../src/lib/internalReviewClient.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, fetch, Headers, Response, Error });
  return module.exports.internalReviewFetch;
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

test('parallel review requests share the bootstrap and attach an in-memory header capability', async () => {
  const calls = [];
  const request = client(async (url, init) => {
    calls.push({ url, init });
    return json(url.endsWith('/session') ? { token: 'fixture' } : {});
  });
  await Promise.all([request('/internal-api/review-claims'), request('/internal-api/review-person-contexts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })]);
  assert.equal(calls.filter(call => call.url.endsWith('/session')).length, 1);
  for (const { init } of calls.slice(1)) {
    assert.equal(init.headers.get('x-pow-internal-token'), 'fixture');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'same-origin');
  }
  assert.equal(calls.at(-1).init.headers.get('content-type'), 'application/json');
});

test('server restart refreshes once on 401 and preserves a write payload', async () => {
  let sessions = 0;
  const writes = [];
  const request = client(async (url, init) => {
    if (url.endsWith('/session')) return json({ token: `session-${++sessions}` });
    writes.push(init);
    return json({}, writes.length === 1 ? 401 : 200);
  });
  assert.equal((await request('/internal-api/review-claim', { method: 'POST', body: '{"action":"reject"}' })).status, 200);
  assert.equal(sessions, 2);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].body, writes[1].body);
  assert.notEqual(writes[0].headers.get('x-pow-internal-token'), writes[1].headers.get('x-pow-internal-token'));
});

test('a failed bootstrap can recover; network and server errors never retry a write', async () => {
  let bootstraps = 0;
  let writes = 0;
  const request = client(async url => {
    if (url.endsWith('/session')) return ++bootstraps === 1 ? json({ error: 'denied' }, 403) : json({ token: 'fixture' });
    writes++;
    if (writes === 1) throw Error('connection lost');
    return json({}, 500);
  });
  const denied = await request('/internal-api/review-claim');
  assert.equal(denied.status, 503);
  assert.match((await denied.json()).error, /denied/);
  const disconnected = await request('/internal-api/review-claim', { method: 'POST' });
  assert.equal(disconnected.status, 503);
  assert.match((await disconnected.json()).error, /connection lost.*重新載入/);
  assert.equal(writes, 1);
  assert.equal((await request('/internal-api/review-claim')).status, 500);
  assert.equal(writes, 2);
  assert.equal(bootstraps, 2);
});
