import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createLocalReviewClient, requireLoopbackApiUrl } from './local-review-target.mjs';

test('local review accepts only plain loopback API origins and pins localhost to an IP', () => {
  for (const url of ['http://127.0.0.1:54321', 'https://127.0.0.1:55421/', 'http://[::1]:54321']) assert.ok(requireLoopbackApiUrl(url));
  assert.equal(requireLoopbackApiUrl('http://localhost:54321').origin, 'http://127.0.0.1:54321');
  for (const url of ['https://project.supabase.co', 'http://127.0.0.1.example.test', 'http://localhost.example.test',
    'http://192.168.1.2:54321', 'http://0.0.0.0:54321', 'file:///tmp/db', 'ftp://127.0.0.1', 'not-a-url',
    'http://user:private-marker@127.0.0.1', 'http://127.0.0.1/proxy', 'http://127.0.0.1/?host=remote', 'http://127.0.0.1/#secret']) {
    assert.throws(() => requireLoopbackApiUrl(url), error => /loopback/u.test(error.message) && !error.message.includes(url));
  }
});

test('credentialed transport checks every destination before fetch and preserves exact RPC payload', async () => {
  const calls = [];
  const client = createLocalReviewClient({ supabaseUrl: 'http://localhost:54321', serviceRoleKey: 'test-key',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json({ outcome: 'conflict' }); } });
  for (const url of ['https://remote.example/rest/v1/test', 'http://127.0.0.1:54322/rest/v1/test',
    'http://user:pass@127.0.0.1:54321/rest/v1/test', 'http://127.0.0.1:54321/auth/v1/user']) {
    await assert.rejects(client.requestJson(url), /configured loopback/u);
  }
  assert.equal(calls.length, 0);
  const body = JSON.stringify({ p_expected_claim: { id: 'synthetic-id' }, p_expected_affiliations: [] });
  assert.deepEqual(await client.requestJson(client.urlFor('rpc/auto_approve_person_claim'), { method: 'POST', body, redirect: 'follow' }), { outcome: 'conflict' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, 'http://127.0.0.1:54321');
  assert.equal(calls[0].init.body, body);
  assert.equal(calls[0].init.headers.authorization, 'Bearer test-key');
  assert.equal(calls[0].init.redirect, 'error');
});

test('real fetch refuses a redirect before sending service credentials to a second endpoint', async () => {
  let received = 0;
  const destination = createServer((_req, res) => { received++; res.end('{}'); });
  const source = createServer((_req, res) => { res.writeHead(307, { location: `http://127.0.0.1:${destination.address().port}/rest/v1/leak` }); res.end(); });
  try {
    destination.listen(0, '127.0.0.1'); await once(destination, 'listening');
    source.listen(0, '127.0.0.1'); await once(source, 'listening');
    const client = createLocalReviewClient({ supabaseUrl: `http://127.0.0.1:${source.address().port}`, serviceRoleKey: 'synthetic-key' });
    await assert.rejects(client.requestJson(client.urlFor('rpc/auto_approve_person_claim'), { method: 'POST', body: '{}' }), /fetch failed/u);
    assert.equal(received, 0);
  } finally {
    source.closeAllConnections(); destination.closeAllConnections();
    await Promise.all([new Promise(resolve => source.close(resolve)), new Promise(resolve => destination.close(resolve))]);
  }
});
