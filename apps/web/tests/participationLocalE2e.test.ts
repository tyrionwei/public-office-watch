import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { createClient } from '@supabase/supabase-js';

import { handleParticipationRequest } from '../worker/participation.ts';

function parseEnvironment(content: string) {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function requireValue(values: Record<string, string>, name: string) {
  const value = values[name]?.trim();
  if (!value) throw new Error(name + ' is required for the local participation smoke test');
  return value;
}

function localPost(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://127.0.0.1:4173' + path, {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:4173',
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('local public feedback priorities do not create a participant session', {
  skip: process.env.RUN_LOCAL_PARTICIPATION_E2E !== '1',
}, async () => {
  const webRoot = resolve(import.meta.dirname, '..');
  const values = {
    ...parseEnvironment(readFileSync(resolve(webRoot, '.env.local'), 'utf8')),
    ...parseEnvironment(readFileSync(resolve(webRoot, '.dev.vars'), 'utf8')),
  };
  const anonymousClient = createClient(
    requireValue(values, 'SUPABASE_URL'),
    requireValue(values, 'SUPABASE_ANON_KEY'),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const personId = 'd888dcb7-abda-48fd-8cd0-b973e0cf43e0';

  const before = await anonymousClient.auth.getSession();
  assert.ifError(before.error);
  assert.equal(before.data.session, null);

  const priorities = await anonymousClient
    .schema('published')
    .rpc('person_feedback_priorities', { p_person_id: personId });
  assert.ifError(priorities.error);
  assert.ok(Array.isArray(priorities.data));

  const ownSubmissions = await anonymousClient
    .schema('published')
    .rpc('get_person_feedback_own_submissions', { p_person_id: personId });
  assert.ok(ownSubmissions.error);

  const after = await anonymousClient.auth.getSession();
  assert.ifError(after.error);
  assert.equal(after.data.session, null);
});

test('local Worker writes through the signed Supabase participation RPC', {
  skip: process.env.RUN_LOCAL_PARTICIPATION_E2E !== '1',
}, async () => {
  const webRoot = resolve(import.meta.dirname, '..');
  const repositoryRoot = resolve(webRoot, '../..');
  const values = {
    ...parseEnvironment(readFileSync(resolve(webRoot, '.env.local'), 'utf8')),
    ...parseEnvironment(readFileSync(resolve(webRoot, '.dev.vars'), 'utf8')),
  };
  const supabaseStatus = parseEnvironment(execFileSync(
    'npx',
    ['supabase', 'status', '-o', 'env'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ));
  const supabaseUrl = requireValue(values, 'SUPABASE_URL');
  const anonKey = requireValue(values, 'SUPABASE_ANON_KEY');
  const serviceRoleKey = requireValue(supabaseStatus, 'SERVICE_ROLE_KEY');
  const anonymousClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const environment = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: anonKey,
    TURNSTILE_SECRET_KEY: requireValue(values, 'TURNSTILE_SECRET_KEY'),
    PARTICIPATION_CLEARANCE_KEY: requireValue(values, 'PARTICIPATION_CLEARANCE_KEY'),
    PARTICIPATION_PROXY_HMAC_KEY: requireValue(values, 'PARTICIPATION_PROXY_HMAC_KEY'),
    PARTICIPATION_IP_HMAC_KEY: requireValue(values, 'PARTICIPATION_IP_HMAC_KEY'),
    PARTICIPATION_USER_RATE_LIMITER: {
      async limit() {
        return { success: true };
      },
    },
    PARTICIPATION_IP_RATE_LIMITER: {
      async limit() {
        return { success: true };
      },
    },
  };
  let replayRequest: Request | null = null;
  const upstreamFetch = async (request: Request) => {
    if (request.url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      return Response.json({ success: true });
    }
    if (request.url.includes('/rest/v1/rpc/submit_region_issue_response')) {
      replayRequest = request.clone();
    }
    return fetch(request);
  };

  let participantHash: string | null = null;
  let userId: string | null = null;
  let regionId: string | null = null;
  try {
    const signup = await anonymousClient.auth.signInAnonymously();
    assert.ifError(signup.error);
    assert.ok(signup.data.session);
    assert.ok(signup.data.user);
    userId = signup.data.user.id;
    participantHash = createHash('sha256').update(userId).digest('hex');

    const issues = await anonymousClient.schema('published').rpc('region_issue_results', {
      p_region_id: null,
      p_region_name: '臺灣',
    });
    assert.ifError(issues.error);
    const firstIssue = (issues.data as Array<{ issue_id: string; region_id: string }> | null)?.[0];
    assert.ok(firstIssue);
    regionId = firstIssue.region_id;

    const challenge = await handleParticipationRequest(
      localPost('/api/participation/challenge', { token: 'local-smoke-token' }),
      environment,
      upstreamFetch,
    );
    assert.equal(challenge.status, 204);
    const cookie = (challenge.headers.get('set-cookie') ?? '').split(';', 1)[0];
    assert.ok(cookie);

    const response = await handleParticipationRequest(
      localPost('/api/participation/submit', {
        action: 'region-issue',
        regionId,
        issueIds: [firstIssue.issue_id],
      }, {
        authorization: 'Bearer ' + signup.data.session.access_token,
        cookie,
      }),
      environment,
      upstreamFetch,
    );
    assert.equal(response.status, 200, await response.text());

    assert.ok(replayRequest);
    const replay = await fetch(replayRequest.clone());
    assert.equal(replay.status, 403, await replay.text());

    const saved = await adminClient
      .schema('public')
      .from('region_issue_responses')
      .select('selected_issue_ids, verification_method')
      .eq('region_id', regionId)
      .eq('participant_hash', participantHash)
      .single();
    assert.ifError(saved.error);
    assert.deepEqual(saved.data.selected_issue_ids, [firstIssue.issue_id]);
    assert.equal(saved.data.verification_method, 'supabase_anonymous_auth');
  } finally {
    if (participantHash && regionId) {
      const cleanup = await adminClient
        .schema('public')
        .from('region_issue_responses')
        .delete()
        .eq('region_id', regionId)
        .eq('participant_hash', participantHash);
      assert.ifError(cleanup.error);
    }
    if (userId) {
      const cleanup = await adminClient.auth.admin.deleteUser(userId);
      assert.ifError(cleanup.error);
    }
  }
});
