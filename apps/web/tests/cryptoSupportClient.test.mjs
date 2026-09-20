import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

function client(responses) {
  const calls = []; let challenges = 0;
  const source = readFileSync(new URL('../src/lib/cryptoSupportClient.ts', import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => name.includes('participationSecurity') ? { ensureParticipationClearance: async refresh => { assert.equal(refresh, true); challenges++; } } : { validateSupportInput: () => null },
    fetch: async (url, init) => { calls.push({ url, init }); return responses.shift(); },
  });
  return { submit: exports.submitCryptoSupport, calls, challenges: () => challenges };
}
test('client only retries exact challenge response and keeps the same submission', async () => {
  const id = '12345678-1234-4123-8123-123456789abc';
  const app = client([Response.json({ error: 'PARTICIPATION_CHALLENGE_REQUIRED' }, { status: 403 }), Response.json({ id })]);
  const input = { requestId: id, reference: 'synthetic' };
  const result = await app.submit(input, []);
  assert.equal(result.id, id); assert.equal(app.challenges(), 1); assert.equal(app.calls.length, 2);
  assert.equal(app.calls[0].init.body, app.calls[1].init.body);
  assert.equal(app.calls[0].url, '/api/participation/support');
  assert.equal(app.calls[0].init.headers.authorization, undefined);
});
test('client rejects false success and unrelated failures without challenge loops', async () => {
  for (const response of [Response.json({}), Response.json({ id: '' }), Response.json({ id: 'not-a-record-id' }), Response.json({ error: 'NO' }, { status: 403 }), Response.json({ error: 'SUPPORT_UNAVAILABLE' }, { status: 503 })]) {
    const app = client([response]); await assert.rejects(() => app.submit({}, []));
    assert.equal(app.calls.length, 1); assert.equal(app.challenges(), 0);
  }
});
test('actual generated PNG QR decodes byte-for-byte to each full receiving address', async () => {
  for (const address of ['0x' + 'aB'.repeat(20), 'T' + 'A'.repeat(33), '2'.repeat(44)]) {
    const url = await QRCode.toDataURL(address, { errorCorrectionLevel: 'M', margin: 4, width: 192 });
    const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded?.data, address);
  }
});
