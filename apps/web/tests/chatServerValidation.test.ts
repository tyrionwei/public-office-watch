import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countVisibleCharacters,
  encryptIp,
  generatePublicCode,
  getTrustedClientIp,
  hmacSha256Hex,
  validateDisplayName,
  validateMessageBody,
  validateReplyId,
} from '../../../supabase/functions/_shared/chat.ts';

test('chat message validation enforces the 50-character single-line limit', () => {
  assert.equal(countVisibleCharacters('😀'), 1);
  assert.deepEqual(validateMessageBody('政'.repeat(50)), {
    ok: true,
    value: '政'.repeat(50),
  });
  assert.deepEqual(validateMessageBody('政'.repeat(51)), {
    ok: false,
    code: 'CHAT_INVALID_BODY',
  });
  assert.deepEqual(validateMessageBody('第一行\n第二行'), {
    ok: false,
    code: 'CHAT_INVALID_BODY',
  });
});

test('chat message validation rejects external links and email addresses', () => {
  for (const body of [
    '請看 https://example.com',
    '請看 www.example.tw',
    '請寄到 test@example.org',
  ]) {
    assert.deepEqual(validateMessageBody(body), {
      ok: false,
      code: 'CHAT_EXTERNAL_LINK',
    });
  }

  assert.deepEqual(validateMessageBody('來源是中選會公開資料'), {
    ok: true,
    value: '來源是中選會公開資料',
  });
});

test('display names and replies use the agreed public contract', () => {
  assert.deepEqual(validateDisplayName('  台北人  '), {
    ok: true,
    value: '台北人',
  });
  assert.deepEqual(validateDisplayName('一'), {
    ok: false,
    code: 'CHAT_INVALID_DISPLAY_NAME',
  });
  assert.equal(
    validateReplyId('018f9e79-7399-7fd0-bfca-5aae32014bd9'),
    '018f9e79-7399-7fd0-bfca-5aae32014bd9',
  );
  assert.equal(validateReplyId('not-a-uuid'), undefined);
  assert.equal(validateReplyId(null), null);
  assert.equal(
    generatePublicCode(Uint8Array.from([0, 1, 31, 32, 33, 34])),
    '01Z012',
  );
});

test('IP security helpers use trusted headers, stable HMAC and randomized AES-GCM', async () => {
  const headers = new Headers({
    'x-forwarded-for': '::ffff:203.0.113.5, 10.0.0.1',
  });
  assert.equal(getTrustedClientIp(headers), '203.0.113.5');

  const firstHmac = await hmacSha256Hex('203.0.113.5', 'test-hmac-key');
  const secondHmac = await hmacSha256Hex('203.0.113.5', 'test-hmac-key');
  assert.equal(firstHmac, secondHmac);
  assert.match(firstHmac, /^[0-9a-f]{64}$/u);

  const encryptionKey = btoa('chat-test-key-material-32-bytes!');
  const firstCiphertext = await encryptIp('203.0.113.5', encryptionKey);
  const secondCiphertext = await encryptIp('203.0.113.5', encryptionKey);
  assert.match(firstCiphertext, /^gcm\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  assert.notEqual(firstCiphertext, secondCiphertext);
  assert.equal(firstCiphertext.includes('203.0.113.5'), false);
});
