import assert from 'node:assert/strict';
import test from 'node:test';

import { handleParticipationRequest } from '../worker/participation.ts';

type RateLimitResult = { success: boolean };

function testEnvironment(overrides: Record<string, unknown> = {}) {
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
        async limit({ key }: { key: string }): Promise<RateLimitResult> {
          userKeys.push(key);
          return { success: true };
        },
      },
      PARTICIPATION_IP_RATE_LIMITER: {
        async limit({ key }: { key: string }): Promise<RateLimitResult> {
          ipKeys.push(key);
          return { success: true };
        },
      },
      ...overrides,
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

test('Turnstile exchanges a valid token for a thirty-day HttpOnly clearance', async () => {
  const { env } = testEnvironment();
  const requests: Request[] = [];
  const response = await handleParticipationRequest(
    post('/api/participation/challenge', { token: 'turnstile-token' }),
    env,
    async (request) => {
      requests.push(request);
      return Response.json({
        success: true,
        action: 'participation',
        hostname: 'pow4vote.org',
      });
    },
    () => Date.parse('2026-08-27T10:00:00Z'),
  );

  assert.equal(response.status, 204);
  assert.equal(requests[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.match(response.headers.get('set-cookie') ?? '', /pow_participation_clearance=/u);
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/u);
  assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=2592000/u);
});

test('Turnstile test credentials cannot bypass production hostname checks', async () => {
  const { env } = testEnvironment({
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  });
  const response = await handleParticipationRequest(
    post('/api/participation/challenge', { token: 'turnstile-token' }),
    env,
    async () => Response.json({ success: true }),
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('failed Turnstile validation does not issue clearance', async () => {
  const { env } = testEnvironment();
  const response = await handleParticipationRequest(
    post('/api/participation/challenge', { token: 'invalid-token' }),
    env,
    async () => Response.json({ success: false }),
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('writes fail closed without clearance and never reach Supabase', async () => {
  const { env } = testEnvironment();
  let fetchCount = 0;
  const response = await handleParticipationRequest(
    post('/api/participation/submit', {
      action: 'region-issue',
      regionId: '00000000-0000-4000-8000-000000000001',
      issueIds: ['00000000-0000-4000-8000-000000000002'],
    }, { authorization: 'Bearer user-token' }),
    env,
    async () => {
      fetchCount += 1;
      return Response.json({});
    },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'PARTICIPATION_CHALLENGE_REQUIRED' });
  assert.equal(fetchCount, 0);
});

test('a cleared anonymous user is rate limited and proxied with a signed database proof', async () => {
  const { env, userKeys, ipKeys } = testEnvironment();
  const now = () => Date.parse('2026-08-27T10:00:00Z');
  const challenge = await handleParticipationRequest(
    post('/api/participation/challenge', { token: 'turnstile-token' }),
    env,
    async () => Response.json({
      success: true,
      action: 'participation',
      hostname: 'pow4vote.org',
    }),
    now,
  );
  const cookie = (challenge.headers.get('set-cookie') ?? '').split(';', 1)[0];
  const upstream: Request[] = [];
  const response = await handleParticipationRequest(
    post('/api/participation/submit', {
      action: 'person-feedback',
      personId: '00000000-0000-4000-8000-000000000010',
      feedbackKind: 'supplement_request',
      sectionKey: 'basic',
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
      return Response.json({ submissionId: 'saved' });
    },
    now,
  );

  assert.equal(response.status, 200);
  assert.equal(upstream.length, 2);
  const rpcRequest = upstream[1];
  assert.equal(rpcRequest.url, 'https://supabase.example/rest/v1/rpc/submit_person_feedback');
  assert.equal(rpcRequest.headers.get('authorization'), 'Bearer user-token');
  assert.equal(rpcRequest.headers.get('apikey'), 'test-anon-key');
  assert.equal(rpcRequest.headers.get('x-participation-proxy-action'), 'person-feedback');
  assert.match(rpcRequest.headers.get('x-participation-proxy-signature') ?? '', /^[0-9a-f]{64}$/u);
  assert.deepEqual(userKeys, ['person-feedback:00000000-0000-4000-8000-000000000099']);
  assert.equal(ipKeys.length, 1);
  assert.match(ipKeys[0], /^person-feedback:[0-9a-f]{64}$/u);
  assert.equal(ipKeys[0].includes('203.0.113.9'), false);
});

test('user rate limits reject before the database write', async () => {
  const { env } = testEnvironment({
    PARTICIPATION_USER_RATE_LIMITER: {
      async limit() {
        return { success: false };
      },
    },
  });
  const now = () => Date.parse('2026-08-27T10:00:00Z');
  const challenge = await handleParticipationRequest(
    post('/api/participation/challenge', { token: 'turnstile-token' }),
    env,
    async () => Response.json({
      success: true,
      action: 'participation',
      hostname: 'pow4vote.org',
    }),
    now,
  );
  const cookie = (challenge.headers.get('set-cookie') ?? '').split(';', 1)[0];
  let rpcCalls = 0;
  const response = await handleParticipationRequest(
    post('/api/participation/submit', {
      action: 'region-issue',
      regionId: '00000000-0000-4000-8000-000000000001',
      issueIds: ['00000000-0000-4000-8000-000000000002'],
    }, {
      authorization: 'Bearer user-token',
      cookie,
    }),
    env,
    async (request) => {
      if (request.url.endsWith('/auth/v1/user')) {
        return Response.json({
          id: '00000000-0000-4000-8000-000000000099',
          is_anonymous: true,
        });
      }
      rpcCalls += 1;
      return Response.json({});
    },
    now,
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(rpcCalls, 0);
});
