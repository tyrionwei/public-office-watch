import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as bodyModule from '../worker/participationBody.ts';
import * as participation from '../worker/participation.ts';

const { readParticipationBody, participationBodyLimit: limit } = bodyModule;
const encoder = new TextEncoder();
function streamRequest(chunks, length) {
  let reads = 0; let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (reads === chunks.length) { controller.close(); return; }
      controller.enqueue(chunks[reads++]);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return {
    request: new Request('https://pow4vote.org/api/participation/challenge', {
      method: 'POST', body, duplex: 'half', headers: {
        origin: 'https://pow4vote.org', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1',
        ...(length === undefined ? {} : { 'content-length': length }),
      },
    }),
    reads: () => reads, cancelled: () => cancelled,
  };
}

for (const length of [undefined, '1', '0', String(limit)]) {
  test(`Worker stops and cancels an oversized stream with Content-Length ${length}`, async () => {
    const input = streamRequest([new Uint8Array(limit), new Uint8Array(1), new Uint8Array(100_000)], length);
    let upstream = 0;
    const response = await participation.handleParticipationRequest(input.request, {}, async () => { upstream++; assert.fail('upstream'); });
    assert.equal(response.status, 413); assert.equal(upstream, 0);
    assert.equal(input.reads(), 2); assert.equal(input.cancelled(), true);
    assert.equal(input.request.body.locked, false);
  });
}

for (const [length, status] of [[String(limit + 1), 413], ['999999999999999999999999999999', 413], ['-1', 400], ['abc', 400], ['12extra', 400], ['1,1', 400]]) {
  test(`Worker rejects declared length ${length} without reading`, async () => {
    const input = streamRequest([encoder.encode('{}')], length);
    await assert.rejects(readParticipationBody(input.request), (error) => error.status === status);
    assert.equal(input.reads(), 0); assert.equal(input.cancelled(), true);
  });
}

test('byte limit includes multibyte UTF-8 and accepts exact limit across split characters', async () => {
  const bytes = encoder.encode(`{"text":"${'中'.repeat(5458)}"}`);
  assert.equal(bytes.length, limit + 1);
  await assert.rejects(readParticipationBody(streamRequest([bytes]).request), (error) => error.status === 413);
  const valid = encoder.encode(`{"text":"${'中'.repeat(5457)}xx"}`);
  assert.equal(valid.length, limit);
  const parts = Array.from(valid, (byte) => Uint8Array.of(byte));
  const text = await readParticipationBody(streamRequest(parts).request);
  assert.equal(JSON.parse(text).text, `${'中'.repeat(5457)}xx`);
});

test('malformed UTF-8, stream errors and invalid JSON remain controlled client errors', async () => {
  await assert.rejects(readParticipationBody(streamRequest([Uint8Array.of(0xff)]).request), (error) => error.status === 400);
  const request = streamRequest([]).request;
  const broken = new Request(request, { body: new ReadableStream({ start(controller) { controller.error(new Error('read failed')); } }), duplex: 'half' });
  await assert.rejects(readParticipationBody(broken), (error) => error.status === 400);
  for (const content of ['', '{', '[]', 'null']) {
    const result = await participation.handleParticipationRequest(streamRequest([encoder.encode(content)]).request, {}, () => assert.fail('upstream'));
    assert.equal(result.status, 400);
  }
});

function devFixture() {
  const env = Object.fromEntries(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TURNSTILE_SECRET_KEY', 'PARTICIPATION_CLEARANCE_KEY', 'PARTICIPATION_PROXY_HMAC_KEY', 'PARTICIPATION_IP_HMAC_KEY'].map((key) => [key, 'fixture-only']));
  const file = new URL('../build/participationDevProxy.ts', import.meta.url).pathname;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, __dirname: path.dirname(file), Buffer, Uint8Array, Headers, Request, Response, URL, console,
    process: { env },
    require(name) {
      if (name === 'node:fs') return { existsSync: () => false };
      if (name === 'node:path') return path;
      if (name.endsWith('/participationBody.ts')) return bodyModule;
      if (name.endsWith('/participation.ts')) return participation;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const routes = [];
  module.exports.participationDevProxyPlugin().configureServer({ middlewares: { use: (route) => routes.push(route) } });
  return { ...module.exports, middleware: routes[0] };
}

for (const length of [undefined, '1', String(limit + 1)]) {
  test(`dev middleware limits buffering before Worker with Content-Length ${length}`, async () => {
    const { middleware } = devFixture(); let reads = 0; let returned = false;
    const request = { method: 'POST', url: '/api/participation/challenge', headers: { ...(length ? { 'content-length': length } : {}) },
      iterator(options) {
        assert.equal(options.destroyOnReturn, false);
        return (async function* () {
          try { reads++; yield new Uint8Array(limit); reads++; yield Uint8Array.of(1); reads++; yield new Uint8Array(100_000); }
          finally { returned = true; }
        })();
      },
    };
    const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = JSON.parse(Buffer.from(value).toString()); } };
    await middleware(request, response, () => assert.fail('next'));
    assert.equal(response.statusCode, 413); assert.equal(response.headers.connection, 'close');
    assert.equal(response.body.error, 'PARTICIPATION_BODY_TOO_LARGE');
    assert.equal(reads, length === String(limit + 1) ? 0 : 2);
    assert.equal(returned, length !== String(limit + 1));
  });
}

test('dev reader accepts exact UTF-8 bytes and middleware catches broken upload', async () => {
  const { requestBody, middleware } = devFixture();
  const bytes = new Uint8Array(limit).fill(32);
  const result = await requestBody({ headers: {}, iterator: () => (async function* () { yield bytes; })() });
  assert.equal(result.length, limit);
  const response = { setHeader() {}, end() {} };
  await middleware({ url: '/api/participation/submit', headers: {}, iterator: () => (async function* () { throw new Error('disconnect'); })() }, response, () => assert.fail('next'));
  assert.equal(response.statusCode, 400);
});
