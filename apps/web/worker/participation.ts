const participationCookieName = 'pow_participation_clearance';
const participationClearanceSeconds = 30 * 24 * 60 * 60;
const turnstileVerificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const turnstileAlwaysPassTestSecret = '1x0000000000000000000000000000000AA';
const feedbackKinds = new Set(['supplement_request', 'problem_report']);
const fulfillmentStatuses = new Set([
  'fulfilled',
  'in_progress',
  'not_fulfilled',
  'insufficient_information',
]);
const feedbackSections = new Set([
  'basic',
  'candidacies',
  'timeline',
  'affiliations',
  'resume',
  'platform',
  'finance',
  'legal',
  'family',
  'sources',
]);

type ParticipationEnvironment = Pick<
  Env,
  | 'SUPABASE_URL'
  | 'SUPABASE_ANON_KEY'
  | 'TURNSTILE_SECRET_KEY'
  | 'PARTICIPATION_CLEARANCE_KEY'
  | 'PARTICIPATION_PROXY_HMAC_KEY'
  | 'PARTICIPATION_IP_HMAC_KEY'
  | 'PARTICIPATION_USER_RATE_LIMITER'
  | 'PARTICIPATION_IP_RATE_LIMITER'
>;

type Fetcher = (request: Request) => Promise<Response>;
type Now = () => number;

function jsonResponse(status: number, payload: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const value = request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || forwarded;
  if (!value || /[\r\n]/u.test(value)) return null;
  return value.replace(/^::ffff:/iu, '');
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(
    new Uint8Array(bytes),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/iu.test(value) || value.length % 2 !== 0) return null;
  return Uint8Array.from(value.match(/.{2}/gu) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function importHmacKey(secret: string, usage: Array<'sign' | 'verify'>) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage,
  );
}

async function hmacSha256Hex(value: string, secret: string) {
  const key = await importHmacKey(secret, ['sign']);
  return bytesToHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

async function verifyHmac(value: string, signature: string, secret: string) {
  const signatureBytes = hexToBytes(signature);
  if (!signatureBytes) return false;
  const key = await importHmacKey(secret, ['verify']);
  return crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(value));
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const entry of cookie.split(';')) {
    const [key, ...value] = entry.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

async function createClearance(secret: string, now: number) {
  const expiresAt = Math.floor(now / 1000) + participationClearanceSeconds;
  const value = `${expiresAt}.${crypto.randomUUID()}`;
  return `${value}.${await hmacSha256Hex(value, secret)}`;
}

async function hasValidClearance(request: Request, secret: string, now: number) {
  const token = cookieValue(request, participationCookieName);
  if (!token) return false;
  const [expiresAtRaw, nonce, signature, ...rest] = token.split('.');
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (
    rest.length > 0
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= Math.floor(now / 1000)
    || !uuidPattern.test(nonce)
  ) {
    return false;
  }
  return verifyHmac(`${expiresAtRaw}.${nonce}`, signature, secret);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

async function readPayload(request: Request) {
  const length = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(length) && length > 16_384) return null;
  const text = await request.text();
  if (!text || text.length > 16_384) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function validOptionalString(value: unknown, max: number) {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= max);
}

function rpcForPayload(payload: Record<string, unknown>) {
  if (payload.action === 'region-issue') {
    if (
      typeof payload.regionId !== 'string'
      || !uuidPattern.test(payload.regionId)
      || !Array.isArray(payload.issueIds)
      || payload.issueIds.length < 1
      || payload.issueIds.length > 3
      || !payload.issueIds.every((value) => typeof value === 'string' && uuidPattern.test(value))
    ) {
      return null;
    }
    return {
      action: 'region-issue',
      name: 'submit_region_issue_response',
      body: {
        p_region_id: payload.regionId,
        p_issue_ids: payload.issueIds,
      },
    };
  }

  if (payload.action === 'person-feedback') {
    if (
      typeof payload.personId !== 'string'
      || !uuidPattern.test(payload.personId)
      || typeof payload.feedbackKind !== 'string'
      || !feedbackKinds.has(payload.feedbackKind)
      || typeof payload.sectionKey !== 'string'
      || !feedbackSections.has(payload.sectionKey)
      || !validOptionalString(payload.problemType, 32)
      || !validOptionalString(payload.message, 1500)
      || !validOptionalString(payload.evidenceUrl, 2048)
    ) {
      return null;
    }
    return {
      action: 'person-feedback',
      name: 'submit_person_feedback',
      body: {
        p_person_id: payload.personId,
        p_feedback_kind: payload.feedbackKind,
        p_section_key: payload.sectionKey,
        p_problem_type: payload.problemType ?? null,
        p_message: payload.message ?? null,
        p_evidence_url: payload.evidenceUrl ?? null,
      },
    };
  }

  if (payload.action === 'platform-fulfillment') {
    if (
      typeof payload.claimId !== 'string'
      || !uuidPattern.test(payload.claimId)
      || typeof payload.itemKey !== 'string'
      || !/^[0-9a-f]{64}$/u.test(payload.itemKey)
      || typeof payload.voteStatus !== 'string'
      || !fulfillmentStatuses.has(payload.voteStatus)
    ) {
      return null;
    }
    return {
      action: 'platform-fulfillment',
      name: 'submit_platform_fulfillment_vote',
      rateLimitSuffix: `${payload.claimId}:${payload.itemKey}`,
      body: {
        p_claim_id: payload.claimId,
        p_item_key: payload.itemKey,
        p_vote_status: payload.voteStatus,
      },
    };
  }

  if (payload.action === 'platform-fulfillment-withdrawal') {
    if (
      typeof payload.claimId !== 'string'
      || !uuidPattern.test(payload.claimId)
      || typeof payload.itemKey !== 'string'
      || !/^[0-9a-f]{64}$/u.test(payload.itemKey)
    ) {
      return null;
    }
    return {
      action: 'platform-fulfillment-withdrawal',
      name: 'withdraw_platform_fulfillment_vote',
      rateLimitSuffix: `${payload.claimId}:${payload.itemKey}`,
      body: {
        p_claim_id: payload.claimId,
        p_item_key: payload.itemKey,
      },
    };
  }

  return null;
}

async function verifyTurnstile(
  token: string,
  clientIp: string,
  secret: string,
  expectedHostname: string,
  fetcher: Fetcher,
) {
  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: clientIp,
    idempotency_key: crypto.randomUUID(),
  });
  const response = await fetcher(new Request(turnstileVerificationUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  }));
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
  const localTestMode = secret === turnstileAlwaysPassTestSecret
    && (expectedHostname === 'localhost' || expectedHostname === '127.0.0.1');
  const actionMatches = result.action === 'participation'
    || (localTestMode
      && (result.action === 'test' || result.action === undefined));
  const hostnameMatches = result.hostname === expectedHostname
    || localTestMode;
  return result.success === true && actionMatches && hostnameMatches;
}

async function authenticateUser(
  authorization: string,
  env: ParticipationEnvironment,
  fetcher: Fetcher,
) {
  const response = await fetcher(new Request(
    `${env.SUPABASE_URL.replace(/\/$/u, '')}/auth/v1/user`,
    {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        authorization,
      },
    },
  ));
  if (!response.ok) return null;
  const value = await response.json() as { id?: unknown; is_anonymous?: unknown };
  if (typeof value.id !== 'string' || !uuidPattern.test(value.id) || value.is_anonymous !== true) {
    return null;
  }
  return value.id;
}

function hasSevereBotRisk(request: Request) {
  const requestWithCf = request as Request & {
    cf?: { botManagement?: { score?: number; verifiedBot?: boolean } };
  };
  const bot = requestWithCf.cf?.botManagement;
  return bot?.verifiedBot !== true
    && typeof bot?.score === 'number'
    && bot.score <= 5;
}

async function handleChallenge(
  request: Request,
  env: ParticipationEnvironment,
  fetcher: Fetcher,
  now: Now,
) {
  const payload = await readPayload(request);
  const token = payload?.token;
  const clientIp = getClientIp(request);
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048 || !clientIp) {
    return jsonResponse(400, { error: 'PARTICIPATION_INVALID_CHALLENGE' });
  }
  if (!await verifyTurnstile(
    token,
    clientIp,
    env.TURNSTILE_SECRET_KEY,
    new URL(request.url).hostname,
    fetcher,
  )) {
    return jsonResponse(403, { error: 'PARTICIPATION_CHALLENGE_FAILED' });
  }

  const clearance = await createClearance(env.PARTICIPATION_CLEARANCE_KEY, now());
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return new Response(null, {
    status: 204,
    headers: {
      'cache-control': 'no-store',
      'set-cookie': `${participationCookieName}=${clearance}; Path=/api/participation; Max-Age=${participationClearanceSeconds}; HttpOnly; SameSite=Strict${secure}`,
    },
  });
}

async function handleSubmit(
  request: Request,
  env: ParticipationEnvironment,
  fetcher: Fetcher,
  now: Now,
) {
  if (!await hasValidClearance(request, env.PARTICIPATION_CLEARANCE_KEY, now())) {
    return jsonResponse(403, { error: 'PARTICIPATION_CHALLENGE_REQUIRED' });
  }
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'PARTICIPATION_UNAUTHENTICATED' });
  }
  if (hasSevereBotRisk(request)) {
    return jsonResponse(403, { error: 'PARTICIPATION_RISK_REJECTED' });
  }

  const payload = await readPayload(request);
  const rpc = payload ? rpcForPayload(payload) : null;
  if (!rpc) return jsonResponse(400, { error: 'PARTICIPATION_INVALID_REQUEST' });

  const clientIp = getClientIp(request);
  if (!clientIp) return jsonResponse(503, { error: 'PARTICIPATION_CLIENT_IP_UNAVAILABLE' });
  const userId = await authenticateUser(authorization, env, fetcher);
  if (!userId) return jsonResponse(401, { error: 'PARTICIPATION_UNAUTHENTICATED' });

  const ipDigest = await hmacSha256Hex(clientIp, env.PARTICIPATION_IP_HMAC_KEY);
  const userRateLimitKey = 'rateLimitSuffix' in rpc
    ? `${rpc.action}:${userId}:${rpc.rateLimitSuffix}`
    : `${rpc.action}:${userId}`;
  const [userLimit, ipLimit] = await Promise.all([
    env.PARTICIPATION_USER_RATE_LIMITER.limit({ key: userRateLimitKey }),
    env.PARTICIPATION_IP_RATE_LIMITER.limit({ key: `${rpc.action}:${ipDigest}` }),
  ]);
  if (!userLimit.success || !ipLimit.success) {
    return jsonResponse(
      429,
      { error: 'PARTICIPATION_RATE_LIMITED' },
      { 'retry-after': '60' },
    );
  }

  const timestamp = Math.floor(now() / 1000).toString();
  const requestId = crypto.randomUUID();
  const proof = `${userId}\n${rpc.action}\n${timestamp}\n${requestId}`;
  const signature = await hmacSha256Hex(proof, env.PARTICIPATION_PROXY_HMAC_KEY);
  const response = await fetcher(new Request(
    `${env.SUPABASE_URL.replace(/\/$/u, '')}/rest/v1/rpc/${rpc.name}`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        authorization,
        'content-type': 'application/json',
        'x-participation-proxy-action': rpc.action,
        'x-participation-proxy-request-id': requestId,
        'x-participation-proxy-signature': signature,
        'x-participation-proxy-timestamp': timestamp,
      },
      body: JSON.stringify(rpc.body),
    },
  ));
  return new Response(response.body, {
    status: response.status,
    headers: {
      'cache-control': 'no-store',
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}

export async function handleParticipationRequest(
  request: Request,
  env: ParticipationEnvironment,
  fetcher: Fetcher = fetch,
  now: Now = Date.now,
) {
  const path = new URL(request.url).pathname;
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED' });
  }
  if (!sameOrigin(request)) {
    return jsonResponse(403, { error: 'PARTICIPATION_ORIGIN_NOT_ALLOWED' });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse(415, { error: 'PARTICIPATION_UNSUPPORTED_MEDIA_TYPE' });
  }

  try {
    if (path === '/api/participation/challenge') {
      return await handleChallenge(request, env, fetcher, now);
    }
    if (path === '/api/participation/submit') {
      return await handleSubmit(request, env, fetcher, now);
    }
    return jsonResponse(404, { error: 'NOT_FOUND' });
  } catch (error) {
    console.error('participation API failed', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse(500, { error: 'PARTICIPATION_SERVER_ERROR' });
  }
}
