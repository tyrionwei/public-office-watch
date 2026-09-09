import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { AdminMagicLinkError, adminMagicLinkErrorMessage, sendAdminMagicLink } from '../src/lib/adminMagicLink.ts';

function fixture(error: { code: string; status: number } | null = null, legacy = false) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const client = createClient('https://auth.example.test', 'synthetic-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return Response.json(error ? { [legacy ? 'error_code' : 'code']: error.code, msg: 'Synthetic rejected request' } : {}, {
        status: error?.status ?? 200,
        headers: legacy ? {} : { 'x-supabase-api-version': '2024-01-01' },
      });
    } },
  });
  return { auth: client.auth, calls };
}

test('each retry obtains a fresh CAPTCHA token', async () => {
  const { auth, calls } = fixture();
  let challenges = 0;
  const challenge = async () => `synthetic-token-${++challenges}`;
  await sendAdminMagicLink(auth, 'owner@example.test', 'https://pow.example.test/internal/chat-admin', challenge);
  await sendAdminMagicLink(auth, 'owner@example.test', 'https://pow.example.test/internal/chat-admin', challenge);
  assert.equal(challenges, 2);
  assert.deepEqual(calls.map(call => call.body.gotrue_meta_security), [
    { captcha_token: 'synthetic-token-1' },
    { captcha_token: 'synthetic-token-2' },
  ]);
});

test('legacy CAPTCHA errors remain actionable', async () => {
  const { auth } = fixture({ code: 'captcha_failed', status: 400 }, true);
  await assert.rejects(sendAdminMagicLink(auth, 'owner@example.test', 'https://pow.example.test/internal/chat-admin', async () => 'captcha'), (error: unknown) => error instanceof AdminMagicLinkError && error.code === 'captcha');
});

for (const path of ['/internal/update-admin', '/internal/chat-admin']) {
  test(`magic link for ${path} waits for CAPTCHA and sends it through the actual SDK`, async () => {
    const { auth, calls } = fixture();
    let complete!: (token: string) => void;
    const challenge = new Promise<string>(resolve => { complete = resolve; });
    const pending = sendAdminMagicLink(auth, ' owner@example.test ', 'https://pow.example.test' + path, () => challenge);
    await Promise.resolve();
    assert.equal(calls.length, 0);
    complete('single-use-synthetic-captcha');
    await pending;
    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, '/auth/v1/otp');
    assert.equal(url.searchParams.get('redirect_to'), 'https://pow.example.test' + path);
    assert.equal(calls[0].body.email, 'owner@example.test');
    assert.equal(calls[0].body.create_user, false);
    assert.deepEqual(calls[0].body.gotrue_meta_security, { captcha_token: 'single-use-synthetic-captcha' });
  });
}

test('failed or empty CAPTCHA never sends a magic-link request', async () => {
  for (const challenge of [async () => { throw new Error('Challenge rejected'); }, async () => '   ']) {
    const { auth, calls } = fixture();
    await assert.rejects(sendAdminMagicLink(auth, 'owner@example.test', 'https://pow.example.test/internal/chat-admin', challenge), (error: unknown) => error instanceof AdminMagicLinkError && error.code === 'captcha');
    assert.equal(calls.length, 0);
  }
});

for (const [code, status, expected] of [
  ['captcha_failed', 400, 'captcha'],
  ['over_email_send_rate_limit', 429, 'rate-limit'],
  ['over_request_rate_limit', 429, 'rate-limit'],
  ['unexpected_failure', 500, 'send-failed'],
] as const) {
  test(`maps ${code} to a safe actionable message`, async () => {
    const { auth, calls } = fixture({ code, status });
    await assert.rejects(sendAdminMagicLink(auth, 'owner@example.test', 'https://pow.example.test/internal/chat-admin', async () => 'captcha'), (error: unknown) => {
      assert(error instanceof AdminMagicLinkError);
      assert.equal(error.code, expected);
      assert(!adminMagicLinkErrorMessage(error).includes('登入狀態無效'));
      assert(!adminMagicLinkErrorMessage(error).includes('Synthetic'));
      return true;
    });
    assert.equal(calls.length, 1);
  });
}
