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
  if (!value) throw new Error(name + ' is required for the local fulfilment voting test');
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

test('local presidential ticket shares votes across the elected running mates', {
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
    PARTICIPATION_USER_RATE_LIMITER: { async limit() { return { success: true }; } },
    PARTICIPATION_IP_RATE_LIMITER: { async limit() { return { success: true }; } },
  };
  const upstreamFetch = async (request: Request) => {
    if (request.url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      return Response.json({ success: true });
    }
    return fetch(request);
  };

  const claims = await adminClient
    .schema('public')
    .from('person_claims')
    .select('id, claim_json')
    .eq('claim_type', 'platform')
    .eq('review_status', 'verified')
    .eq('visibility', 'public')
    .eq('is_public', true)
    .limit(5000);
  assert.ifError(claims.error);
  const sharedClaims = (claims.data ?? []).filter((row) => (
    row.claim_json
    && typeof row.claim_json === 'object'
    && (row.claim_json as { presidentialTicket?: { ticketNo?: string } })
      .presidentialTicket?.ticketNo === '2'
    && (row.claim_json as { presidentialTicket?: { sharedPlatform?: boolean } })
      .presidentialTicket?.sharedPlatform === true
    && Array.isArray((row.claim_json as { items?: unknown }).items)
    && ((row.claim_json as { items: unknown[] }).items).length > 0
  ));
  const claim = sharedClaims.find((row) => (
    (row.claim_json as { presidentialTicket?: { candidateRole?: string } })
      .presidentialTicket?.candidateRole === 'president'
  ));
  const peerClaim = sharedClaims.find((row) => (
    (row.claim_json as { presidentialTicket?: { candidateRole?: string } })
      .presidentialTicket?.candidateRole === 'vice_president'
  ));
  assert.equal(sharedClaims.length, 2);
  assert.ok(claim);
  assert.ok(peerClaim);

  let participantHash: string | null = null;
  let userId: string | null = null;
  let itemKey: string | null = null;
  try {
    const signup = await anonymousClient.auth.signInAnonymously();
    assert.ifError(signup.error);
    assert.ok(signup.data.session);
    assert.ok(signup.data.user);
    userId = signup.data.user.id;
    participantHash = createHash('sha256').update(userId).digest('hex');

    const before = await anonymousClient
      .schema('published')
      .rpc('platform_fulfillment_results', { p_claim_id: claim.id });
    assert.ifError(before.error);
    const item = (before.data as Array<{
      item_key: string;
      total_count: number;
      results_announced_on: string;
      voting_opens_on: string;
      voting_is_open: boolean;
    }> | null)?.[0];
    assert.ok(item);
    assert.match(item.results_announced_on, /^202(?:2-12-02|4-01-19)$/u);
    assert.match(item.voting_opens_on, /^202(?:3-12-02|5-01-19)$/u);
    assert.equal(item.voting_is_open, true);
    itemKey = item.item_key;
    const initialTotal = Number(item.total_count);

    const peerBefore = await anonymousClient
      .schema('published')
      .rpc('platform_fulfillment_results', { p_claim_id: peerClaim.id });
    assert.ifError(peerBefore.error);
    assert.equal(peerBefore.data?.length, 12);
    assert.deepEqual(
      peerBefore.data?.map((row) => row.item_key),
      before.data?.map((row) => row.item_key),
    );

    const challenge = await handleParticipationRequest(
      localPost('/api/participation/challenge', { token: 'local-smoke-token' }),
      environment,
      upstreamFetch,
    );
    assert.equal(challenge.status, 204);
    const cookie = (challenge.headers.get('set-cookie') ?? '').split(';', 1)[0];
    assert.ok(cookie);

    for (const voteStatus of ['in_progress', 'fulfilled']) {
      const response = await handleParticipationRequest(
        localPost('/api/participation/submit', {
          action: 'platform-fulfillment',
          claimId: claim.id,
          itemKey,
          voteStatus,
        }, {
          authorization: 'Bearer ' + signup.data.session.access_token,
          cookie,
        }),
        environment,
        upstreamFetch,
      );
      assert.equal(response.status, 200, await response.text());
    }

    const ownVotes = await anonymousClient
      .schema('published')
      .rpc('get_platform_fulfillment_votes', { p_claim_id: peerClaim.id });
    assert.ifError(ownVotes.error);
    assert.deepEqual(ownVotes.data, [{ item_key: itemKey, vote_status: 'fulfilled' }]);

    const after = await anonymousClient
      .schema('published')
      .rpc('platform_fulfillment_results', { p_claim_id: claim.id });
    assert.ifError(after.error);
    const updatedItem = (after.data as Array<{
      item_key: string;
      fulfilled_count: number;
      total_count: number;
    }> | null)?.find((row) => row.item_key === itemKey);
    assert.ok(updatedItem);
    assert.equal(Number(updatedItem.total_count), initialTotal + 1);
    assert.ok(Number(updatedItem.fulfilled_count) >= 1);

    const peerAfter = await anonymousClient
      .schema('published')
      .rpc('platform_fulfillment_results', { p_claim_id: peerClaim.id });
    assert.ifError(peerAfter.error);
    assert.equal(
      Number(peerAfter.data?.find((row) => row.item_key === itemKey)?.total_count),
      initialTotal + 1,
    );

    const withdrawal = await handleParticipationRequest(
      localPost('/api/participation/submit', {
        action: 'platform-fulfillment-withdrawal',
        claimId: peerClaim.id,
        itemKey,
      }, {
        authorization: 'Bearer ' + signup.data.session.access_token,
        cookie,
      }),
      environment,
      upstreamFetch,
    );
    assert.equal(withdrawal.status, 200, await withdrawal.text());

    const votesAfterWithdrawal = await anonymousClient
      .schema('published')
      .rpc('get_platform_fulfillment_votes', { p_claim_id: claim.id });
    assert.ifError(votesAfterWithdrawal.error);
    assert.deepEqual(votesAfterWithdrawal.data, []);

    const aggregateAfterWithdrawal = await anonymousClient
      .schema('published')
      .rpc('platform_fulfillment_results', { p_claim_id: claim.id });
    assert.ifError(aggregateAfterWithdrawal.error);
    const withdrawnItem = (aggregateAfterWithdrawal.data as Array<{
      item_key: string;
      total_count: number;
    }> | null)?.find((row) => row.item_key === itemKey);
    assert.ok(withdrawnItem);
    assert.equal(Number(withdrawnItem.total_count), initialTotal);
  } finally {
    if (participantHash && itemKey) {
      const cleanup = await adminClient
        .schema('public')
        .from('platform_fulfillment_votes')
        .delete()
        .eq('claim_id', claim.id)
        .eq('item_key', itemKey)
        .eq('participant_hash', participantHash);
      assert.ifError(cleanup.error);
    }
    if (userId) {
      const cleanup = await adminClient.auth.admin.deleteUser(userId);
      assert.ifError(cleanup.error);
    }
  }
});
