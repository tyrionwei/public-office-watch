import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { availableSupportNetworks, supportNetworks, supportBase58Size, validSupportAddress, validateSupportInput, type SupportNetwork } from '../src/config/cryptoSupport.ts';
import { handleParticipationRequest } from '../worker/participation.ts';
const bsc: SupportNetwork = { networkId: 'bsc', networkType: 'evm', displayName: 'BSC', currency: 'USDT', enabled: true, address: `0x${'a'.repeat(40)}`, tokenNote: 'synthetic fixture' };
const tron: SupportNetwork = { ...bsc, networkId: 'tron', networkType: 'tron', address: `T${'A'.repeat(33)}` };
const input = { requestId: '12345678-1234-4123-8123-123456789abc', networkId: 'bsc', receivingAddress: bsc.address, reference: `0x${'b'.repeat(64)}` };
const networks = [bsc, tron];
test('operator-enabled networks have valid addresses; invalid or disabled entries remain hidden', () => {
  assert.equal(availableSupportNetworks().length, 8);
  assert.deepEqual(supportNetworks.map(n => n.networkId), ['ethereum', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'solana', 'tron']);
  assert.ok(supportNetworks.every(n => validSupportAddress(n.networkType, n.address) && n.enabled && n.tokenNote.includes('尚未驗證')));
  assert.equal(availableSupportNetworks([bsc]).length, 1); assert.equal(availableSupportNetworks(networks).length, 2);
  for (const n of [{ ...bsc, enabled: false }, { ...bsc, address: '' }, { ...bsc, address: '0x123' }, { ...bsc, address: `0x${'0'.repeat(40)}` }]) assert.deepEqual(availableSupportNetworks([n]), []);
});
test('unconfirmed token note and other configured receiving addresses fail closed', () => {
  assert.deepEqual(availableSupportNetworks([{ ...bsc, tokenNote: '' }]), []);
  const other = { ...bsc, networkId: 'synthetic-other', address: '0x' + 'c'.repeat(40) };
  assert.equal(validateSupportInput({ ...input, reference: other.address }, [...networks, other]), 'recipient');
});
test('full references, optional empty fields, network-specific case and lengths', () => {
  for (const reference of [input.reference, `0x${'b'.repeat(40)}`, `  ${input.reference}  `]) assert.equal(validateSupportInput({ ...input, reference, nickname: '', message: '' }, networks), null);
  for (const reference of ['', '   ', '12345', `0x${'b'.repeat(39)}`, 'wrong']) assert.equal(validateSupportInput({ ...input, reference }, networks), 'reference');
  assert.equal(validateSupportInput({ ...input, reference: bsc.address.toUpperCase().replace('0X', '0x') }, networks), 'recipient');
  assert.equal(validateSupportInput({ ...input, networkId: 'tron', receivingAddress: tron.address, reference: tron.address }, networks), 'recipient');
  for (const reference of ['C'.repeat(64), `T${'B'.repeat(33)}`]) assert.equal(validateSupportInput({ ...input, networkId: 'tron', receivingAddress: tron.address, reference }, networks), null);
  assert.equal(validateSupportInput({ ...input, networkId: 'tron', receivingAddress: tron.address, reference: `t${'B'.repeat(33)}` }, networks), 'reference');
  assert.equal(validateSupportInput({ ...input, nickname: '字'.repeat(51) }, networks), 'nickname');
  assert.equal(validateSupportInput({ ...input, message: '字'.repeat(2001) }, networks), 'message');
  assert.equal(validateSupportInput({ ...input, message: '<img onerror=alert(1)>' }, networks), null);
  for (const field of ['source', 'public', 'admin', 'amount', 'transferTime']) assert.equal(validateSupportInput({ ...input, [field]: 'forged' }, networks), 'request');
});
function env(allowed = true) { return {
  SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'synthetic-anon', TURNSTILE_SECRET_KEY: 'synthetic', PARTICIPATION_CLEARANCE_KEY: 'synthetic',
  PARTICIPATION_PROXY_HMAC_KEY: 'synthetic-proof', PARTICIPATION_IP_HMAC_KEY: 'synthetic-ip',
  PARTICIPATION_USER_RATE_LIMITER: { limit: async () => ({ success: allowed }) }, PARTICIPATION_IP_RATE_LIMITER: { limit: async () => ({ success: allowed }) },
}; }
function request(body: unknown = input, origin = 'https://site.example') { return new Request('https://site.example/api/participation/support', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1' }, body: JSON.stringify(body) }); }
test('anonymous server signs trusted snapshot and trims fields without auth or chain query', async () => {
  const calls: Request[] = []; const e = env();
  const response = await handleParticipationRequest(request({ ...input, reference: ` ${input.reference} `, nickname: ' ', message: ' 回饋 ' }), e, async r => { calls.push(r); return Response.json({ id: input.requestId }); }, () => 1700000000000, networks);
  assert.equal(response.status, 200); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://db.example/rest/v1/rpc/submit_crypto_support');
  const body = await calls[0].json();
  assert.equal(body.p_receiving_address, bsc.address); assert.equal(body.p_currency, 'USDT');
  assert.equal(body.p_nickname, null); assert.equal(body.p_message, '回饋'); assert.equal(body.p_reference, input.reference);
  const values = Object.values(body).map(v => v === null ? '-1:' : `${Buffer.byteLength(String(v))}:${v}`).join('\n');
  const hash = createHash('sha256').update(values).digest('hex');
  assert.equal(calls[0].headers.get('x-support-signature'), createHmac('sha256', e.PARTICIPATION_PROXY_HMAC_KEY).update(`crypto-support\n1700000000\n${hash}`).digest('hex'));
});
test('disabled config, overwritten fields, origin and rate limits fail before storage', async () => {
  const fetcher = async () => { assert.fail('must not reach database'); return Response.json({}); };
  assert.equal((await handleParticipationRequest(request(), env(), fetcher, Date.now, [])).status, 400);
  assert.equal((await handleParticipationRequest(request({ ...input, receivingAddress: 'forged' }), env(), fetcher, Date.now, networks)).status, 400);
  assert.equal((await handleParticipationRequest(request(input, 'https://attacker.example'), env(), fetcher, Date.now, networks)).status, 403);
  assert.equal((await handleParticipationRequest(request(), env(false), fetcher, Date.now, networks)).status, 429);
});
test('stale page address is rejected rather than recording a different snapshot', async () => {
  assert.equal(validateSupportInput({ ...input, receivingAddress: '0x' + 'c'.repeat(40) }, networks), 'network');
});
test('risk can require existing challenge but normal visitors need none', async () => {
  const req = request(); Object.assign(req, { cf: { botManagement: { score: 1 } } });
  const response = await handleParticipationRequest(req, env(), async () => { throw new Error('must not fetch'); }, Date.now, networks);
  assert.equal(response.status, 403); assert.equal((await response.json()).error, 'PARTICIPATION_CHALLENGE_REQUIRED');
});
test('DB failures and malformed success never expose private rows or claim success', async () => {
  for (const upstream of [Response.json({ message: 'private row' }, { status: 400 }), Response.json({}), Response.json(null)]) {
    const response = await handleParticipationRequest(request(), env(), async () => upstream, Date.now, networks);
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'SUPPORT_UNAVAILABLE' });
  }
  const response = await handleParticipationRequest(request(), env(), async () => Response.json({ message: 'SUPPORT_REQUEST_CONFLICT' }, { status: 400 }), Date.now, networks);
  assert.equal(response.status, 409);
});

// Public format example from Solana getTransaction docs; no RPC is called.
const solanaSignature = '4ReKprwf3WdLHRrzp4ctPWNBsQDPL3VZz3zMmoZfcGJMJCHh5Vq937mPdyxhCbw54wNnA6hZ7KfNpQdpt13yY7A9';
const solana: SupportNetwork = { ...bsc, networkId: 'solana', networkType: 'solana', address: '2'.repeat(44) };
test('Solana formats validate decoded bytes, not just textual length, and preserve case', () => {
  assert.equal(supportBase58Size('1'.repeat(32)), 32);
  assert.equal(supportBase58Size('1'.repeat(64)), 64);
  assert.equal(supportBase58Size('2'.repeat(44)), 32);
  assert.equal(supportBase58Size('2'.repeat(87)), 63);
  assert.equal(supportBase58Size('3'.repeat(87)), 64);
  assert.equal(supportBase58Size('z'.repeat(44)), 33);
  assert.equal(supportBase58Size('z'.repeat(88)), 65);
  for (const value of ['', '0OIl', '2'.repeat(89)]) assert.equal(supportBase58Size(value), null);
  const sample = { ...input, networkId: 'solana', receivingAddress: solana.address };
  for (const reference of ['3'.repeat(44), '3'.repeat(87), solanaSignature]) assert.equal(validateSupportInput({ ...sample, reference }, [solana]), null);
  for (const reference of ['12345', '2'.repeat(87), 'z'.repeat(44), 'z'.repeat(88), '0x' + 'a'.repeat(64)]) assert.equal(validateSupportInput({ ...sample, reference }, [solana]), 'reference');
  assert.equal(validateSupportInput({ ...sample, reference: solana.address }, [solana]), 'recipient');
});
test('Solana submission forwards its complete reference unchanged with trusted network snapshot', async () => {
  const reference = solanaSignature;
  const response = await handleParticipationRequest(request({ ...input, networkId: 'solana', receivingAddress: solana.address, reference }), env(), async r => {
    const body = await r.json();
    assert.equal(body.p_network_id, 'solana'); assert.equal(body.p_network_type, 'solana');
    assert.equal(body.p_reference, reference); assert.equal(body.p_receiving_address, solana.address);
    return Response.json({ id: input.requestId });
  }, Date.now, [solana]);
  assert.equal(response.status, 200);
});
