import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import ts from 'typescript';

// Execute the actual Vite middleware registration with isolated dependencies.
// No real environment, filesystem mutation, database, or network is reachable.
function fixture() {
  const calls = [];
  const env = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'test-only' };
  const modules = new Map();
  const deny = () => { throw Error('Unexpected filesystem write/read'); };
  function load(file, suffix = '') {
    if (modules.has(file)) return modules.get(file);
    const source = fs.readFileSync(file, 'utf8');
    const code = ts.transpileModule(source + suffix, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(code, {
      module, exports: module.exports, __dirname: path.dirname(file), Buffer, URL, URLSearchParams, console,
      process: { env },
      fetch: async (url, init) => {
        assert.equal(new URL(url).origin, 'http://127.0.0.1:54321');
        assert.equal(init.redirect, 'error');
        calls.push({ url, ...init });
        const claim = { id: 'fixture', person_id: 'fixture-person', claim_type: 'party', claim_value: 'fixture', claim_json: {}, source_name: 'fixture', scoring_reasons: [] };
        return new Response(init.method === 'PATCH' ? '' : JSON.stringify(url.includes('/person_claims?') ? [claim] : []));
      },
      require(specifier) {
        if (specifier === 'node:fs') return { existsSync: () => false, readFileSync: deny, writeFileSync: deny };
        if (specifier === 'node:path') return path;
        if (specifier === 'node:crypto') return crypto;
        if (specifier === 'vite') return { defineConfig: value => value };
        if (specifier === '@vitejs/plugin-react') return () => ({});
        if (specifier.endsWith('/sites-vite-plugin')) return { sites: () => ({}) };
        // Build-only PWA hooks are outside the development middleware under test.
        if (specifier.endsWith('/pwaShellVersion.mjs')) return { pwaShellVersionPlugin: () => ({}) };
        if (specifier.endsWith('/participationDevProxy')) return { participationDevProxyPlugin: () => ({}) };
        if (specifier.startsWith('./build/internal')) return load(path.resolve(path.dirname(file), `${specifier}.ts`));
        throw Error(`Unexpected dependency ${specifier}`);
      },
    }, { filename: file });
    modules.set(file, module.exports);
    return module.exports;
  }
  const config = load(new URL('../vite.config.ts', import.meta.url).pathname, '\nexport { internalReviewApiPlugin };');
  const routes = [];
  const plugin = config.internalReviewApiPlugin();
  assert.equal(plugin.apply, 'serve');
  plugin.configureServer({ middlewares: { use(route, handler) { routes.push({ route, handler }); } } });
  assert.equal(routes[0].route, '/internal-api');
  async function request(endpoint, { method = 'POST', headers = {}, socket = {}, body = '{}', chunks } = {}) {
    const req = new EventEmitter();
    Object.assign(req, { method, headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers }, socket: { remoteAddress: '127.0.0.1', localPort: 5173, ...socket } });
    const response = { statusCode: 0, headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = JSON.parse(value); } };
    let index = 0;
    const pendingHandlers = [];
    const next = () => {
      const entry = routes.slice(index).find(item => endpoint === item.route || endpoint.startsWith(`${item.route}/`));
      if (!entry) { response.statusCode = 404; return; }
      index = routes.indexOf(entry) + 1;
      req.url = endpoint.slice(entry.route.length) || '/';
      const pending = entry.handler(req, response, next);
      pendingHandlers.push(pending);
      return pending;
    };
    const pending = next();
    for (const chunk of chunks ?? [body]) req.emit('data', chunk);
    req.emit('end');
    await pending;
    await Promise.all(pendingHandlers);
    assert.equal(response.headers['cache-control'], 'no-store');
    return response;
  }
  const bootstrap = () => request('/internal-api/session', { headers: { 'x-pow-internal-bootstrap': '1' } });
  return { request, bootstrap, calls, env, routes };
}

test('local session protects every registered admin route before database access', async () => {
  const f = fixture();
  for (const { route } of f.routes.slice(1)) {
    const response = await f.request(route);
    assert.equal(response.statusCode, 401, route);
  }
  assert.equal(f.calls.length, 0);
});

test('locality, Host, Origin, media type, preflight and token failures have no side effects', async () => {
  const f = fixture();
  const session = await f.bootstrap();
  assert.equal(session.statusCode, 200);
  const token = session.body.token;
  const scenarios = [
    [{ socket: { remoteAddress: '192.0.2.1' } }, 403],
    [{ socket: { remoteAddress: undefined } }, 403],
    [{ headers: { host: 'attacker.invalid:5173' } }, 403],
    [{ headers: { host: 'localhost:5174' } }, 403],
    [{ headers: { host: 'localhost:5173@attacker.invalid' } }, 403],
    [{ headers: { origin: 'https://attacker.invalid' } }, 403],
    [{ headers: { origin: 'http://localhost:5174' } }, 403],
    [{ headers: { origin: undefined } }, 403],
    [{ headers: { 'sec-fetch-site': 'cross-site' } }, 403],
    [{ headers: { 'sec-fetch-site': 'same-site' } }, 403],
    [{ headers: { 'content-type': 'text/plain' } }, 415],
    [{ method: 'OPTIONS' }, 405],
    [{ headers: { 'x-pow-internal-token': 'wrong' } }, 401],
    [{ headers: { 'x-pow-internal-token': '界'.repeat(64) } }, 401],
    [{ headers: { 'content-length': String(128 * 1024 + 1) } }, 413],
  ];
  for (const [options, status] of scenarios) {
    const response = await f.request('/internal-api/review-claim', { ...options, headers: { 'x-pow-internal-token': token, ...options.headers }, body: '{"claimId":"fixture","action":"approve"}' });
    assert.equal(response.statusCode, status, JSON.stringify(options));
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
  assert.equal(f.calls.length, 0);
});

test('bootstrap itself rejects cross-origin, missing custom header, GET and malformed bodies', async () => {
  const f = fixture();
  for (const options of [
    {}, { method: 'GET' },
    { headers: { 'x-pow-internal-bootstrap': '1', origin: 'https://attacker.invalid' } },
    { headers: { 'x-pow-internal-bootstrap': '1', origin: undefined } },
    { headers: { 'x-pow-internal-bootstrap': '1' }, body: 'invalid' },
  ]) assert.notEqual((await f.request('/internal-api/session', options)).statusCode, 200);
  assert.equal(f.calls.length, 0);
});

test('bounded JSON rejects chunked oversized, malformed and non-object bodies before writes', async () => {
  const f = fixture();
  const headers = { 'x-pow-internal-token': (await f.bootstrap()).body.token };
  for (const body of ['{', 'null', '[]', '"string"']) {
    assert.equal((await f.request('/internal-api/review-claim', { headers, body })).statusCode, 400);
  }
  assert.equal((await f.request('/internal-api/review-claim', { headers, chunks: Array(40).fill('界'.repeat(4096)) })).statusCode, 413);
  assert.equal(f.calls.length, 0);
});

test('authenticated local approve and reject still reach the intended database writes', async () => {
  const f = fixture();
  const headers = { 'x-pow-internal-token': (await f.bootstrap()).body.token };
  for (const action of ['approve', 'reject']) {
    const response = await f.request('/internal-api/review-claim', { headers, body: JSON.stringify({ claimId: 'fixture', action }) });
    assert.equal(response.statusCode, 200);
    const patch = f.calls.filter(call => call.method === 'PATCH').at(-1);
    assert.equal(JSON.parse(patch.body).review_status, action === 'approve' ? 'verified' : 'rejected');
  }
  assert.equal((await f.request('/internal-api/review-claims', { method: 'GET', headers: { ...headers, origin: undefined } })).statusCode, 200);
});

test('remote, rehearsal and ambiguous database URLs are rejected without sending credentials', async () => {
  const f = fixture();
  const headers = { 'x-pow-internal-token': (await f.bootstrap()).body.token };
  for (const target of ['https://production.supabase.co', 'http://127.0.0.1:55321', 'http://127.0.0.1:54321/path', 'http://user:pass@127.0.0.1:54321', 'http://127.0.0.1:54321?x=y', 'http://127.0.0.1:54321#x']) {
    f.env.SUPABASE_URL = target;
    assert.equal((await f.request('/internal-api/review-claims', { method: 'GET', headers })).statusCode, 500);
  }
  assert.equal(f.calls.length, 0);
});

test('a new Vite instance rejects the previous in-memory session', async () => {
  const first = fixture();
  const second = fixture();
  const token = (await first.bootstrap()).body.token;
  assert.equal((await second.request('/internal-api/review-claims', { method: 'GET', headers: { 'x-pow-internal-token': token } })).statusCode, 401);
  assert.equal(second.calls.length, 0);
});
