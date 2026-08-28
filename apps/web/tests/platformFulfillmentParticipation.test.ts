import assert from 'node:assert/strict';
import test from 'node:test';

import { handleParticipationRequest } from '../worker/participation.ts';

function testEnvironment() {
  const userKeys: string[] = [];
  const ipKeys: string[] = [];
  return {
    env: {
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_ANON_KEY: 'test-anon-key',
      TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
      PARTICIPATION_CLEARANCE_KEY: 'test-clearance-key-with-enough-material',
      PARTICIPATION_PROXY_HMAC_KEY: 'test-proxy-key-with-enough-material',
      PARTICIPATION_IP_HMAC_KEY: 'test-ip-key-with-enough-material',
      PARTICIPATION_USER_RATE_LIMITER: {
        async limit({ key }: { key: string }) {
          userKeys.push(key);
          return { success: true };
        },
      },
      PARTICIPATION_IP_RATE_LIMITER: {
        async limit({ key }: { key: string }) {
          ipKeys.push(key);
          return { success: true };
        },
      },
    },
    userKeys,
    ipKeys,
  };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://pow4vote.org${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://pow4vote.org',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.9',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function clearanceCookie(
  env: ReturnType<typeof testEnvironment>['env'],
  now: () => number,
) {
  const response = await handleParticipationRequest(
    post('/api/participation/challenge', { token: 'turnstile-token' }),
    env,
    async () => Response.json({
      success: true,
      action: 'participation',
      hostname: 'pow4vote.org',
    }),
    now,
  );
  assert.equal(response.status, 204);
  return (response.headers.get('set-cookie') ?? '').split(';', 1)[0];
}

test('platform fulfilment votes are validated, item-scoped for user limits, and signed for Supabase', async () => {
  const { env, userKeys, ipKeys } = testEnvironment();
  const now = () => Date.parse('2026-08-28T07:00:00Z');
  const cookie = await clearanceCookie(env, now);
  const claimId = '00000000-0000-4000-8000-000000000010';
  const itemKey = 'a'.repeat(64);
  const upstream: Request[] = [];

  const response = await handleParticipationRequest(
    post('/api/participation/submit', {
      action: 'platform-fulfillment',
      claimId,
      itemKey,
      voteStatus: 'in_progress',
    }, {
      authorization: 'Bearer user-token',
      cookie,
    }),
    env,
    async (request) => {
      upstream.push(request);
      if (request.url.endsWith('/auth/v1/user')) {
        return Response.json({
          id: '00000000-0000-4000-8000-000000000099',
          is_anonymous: true,
        });
      }
      return Response.json({ voteStatus: 'in_progress' });
    },
    now,
  );

  assert.equal(response.status, 200);
  assert.equal(upstream.length, 2);
  const rpcRequest = upstream[1];
  assert.equal(
    rpcRequest.url,
    'https://supabase.example/rest/v1/rpc/submit_platform_fulfillment_vote',
  );
  assert.deepEqual(await rpcRequest.json(), {
    p_claim_id: claimId,
    p_item_key: itemKey,
    p_vote_status: 'in_progress',
  });
  assert.equal(rpcRequest.headers.get('x-participation-proxy-action'), 'platform-fulfillment');
  assert.match(rpcRequest.headers.get('x-participation-proxy-signature') ?? '', /^[0-9a-f]{64}$/u);
  assert.deepEqual(userKeys, [
    `platform-fulfillment:00000000-0000-4000-8000-000000000099:${claimId}:${itemKey}`,
  ]);
  assert.equal(ipKeys.length, 1);
  assert.match(ipKeys[0], /^platform-fulfillment:[0-9a-f]{64}$/u);
  assert.equal(ipKeys[0].includes('203.0.113.9'), false);
});

test('platform fulfilment withdrawals are item-scoped and signed for Supabase', async () => {
  const { env, userKeys, ipKeys } = testEnvironment();
  const now = () => Date.parse('2026-08-28T07:00:00Z');
  const cookie = await clearanceCookie(env, now);
  const claimId = '00000000-0000-4000-8000-000000000010';
  const itemKey = 'a'.repeat(64);
  const upstream: Request[] = [];

  const response = await handleParticipationRequest(
    post('/api/participation/submit', {
      action: 'platform-fulfillment-withdrawal',
      claimId,
      itemKey,
    }, {
      authorization: 'Bearer user-token',
      cookie,
    }),
    env,
    async (request) => {
      upstream.push(request);
      if (request.url.endsWith('/auth/v1/user')) {
        return Response.json({
          id: '00000000-0000-4000-8000-000000000099',
          is_anonymous: true,
        });
      }
      return Response.json({ withdrawn: true });
    },
    now,
  );

  assert.equal(response.status, 200);
  assert.equal(upstream.length, 2);
  const rpcRequest = upstream[1];
  assert.equal(
    rpcRequest.url,
    'https://supabase.example/rest/v1/rpc/withdraw_platform_fulfillment_vote',
  );
  assert.deepEqual(await rpcRequest.json(), {
    p_claim_id: claimId,
    p_item_key: itemKey,
  });
  assert.equal(
    rpcRequest.headers.get('x-participation-proxy-action'),
    'platform-fulfillment-withdrawal',
  );
  assert.match(
    rpcRequest.headers.get('x-participation-proxy-signature') ?? '',
    /^[0-9a-f]{64}$/u,
  );
  assert.deepEqual(userKeys, [
    `platform-fulfillment-withdrawal:00000000-0000-4000-8000-000000000099:${claimId}:${itemKey}`,
  ]);
  assert.equal(ipKeys.length, 1);
  assert.match(ipKeys[0], /^platform-fulfillment-withdrawal:[0-9a-f]{64}$/u);
});

test('platform fulfilment rejects unknown statuses before authentication or database access', async () => {
  const { env } = testEnvironment();
  const now = () => Date.parse('2026-08-28T07:00:00Z');
  const cookie = await clearanceCookie(env, now);
  let upstreamCount = 0;

  const response = await handleParticipationRequest(
    post('/api/participation/submit', {
      action: 'platform-fulfillment',
      claimId: '00000000-0000-4000-8000-000000000010',
      itemKey: 'a'.repeat(64),
      voteStatus: 'definitely_completed',
    }, {
      authorization: 'Bearer user-token',
      cookie,
    }),
    env,
    async () => {
      upstreamCount += 1;
      return Response.json({});
    },
    now,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'PARTICIPATION_INVALID_REQUEST' });
  assert.equal(upstreamCount, 0);
});
