import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

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
  if (!value) throw new Error(name + ' is required for the local chat smoke test');
  return value;
}

async function functionErrorDetail(error: unknown) {
  if (
    error
    && typeof error === 'object'
    && 'context' in error
    && error.context instanceof Response
  ) {
    return error.context.text();
  }
  return error instanceof Error ? error.message : String(error);
}

function subscribe(channel: RealtimeChannel) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscription timed out')), 5_000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout);
        reject(new Error('Realtime subscription failed: ' + status));
      }
    });
  });
}

test('local chat creates a profile and sends a message through the Edge Function', {
  skip: process.env.RUN_LOCAL_CHAT_E2E !== '1',
}, async () => {
  const webRoot = resolve(import.meta.dirname, '..');
  const repositoryRoot = resolve(webRoot, '../..');
  const values = parseEnvironment(readFileSync(resolve(webRoot, '.env.local'), 'utf8'));
  const supabaseStatus = parseEnvironment(execFileSync(
    'npx',
    ['supabase', 'status', '-o', 'env'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ));
  const supabaseUrl = requireValue(values, 'VITE_SUPABASE_URL');
  const anonKey = requireValue(values, 'VITE_SUPABASE_ANON_KEY');
  const serviceRoleKey = requireValue(supabaseStatus, 'SERVICE_ROLE_KEY');
  const anonymousClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  let messageId: string | null = null;
  let userId: string | null = null;
  try {
    const signup = await anonymousClient.auth.signInAnonymously();
    assert.ifError(signup.error);
    assert.ok(signup.data.user);
    userId = signup.data.user.id;

    const profile = await anonymousClient.functions.invoke('chat-api', {
      body: {
        action: 'set-profile',
        displayName: 'LocalTest',
        acceptTerms: true,
      },
    });
    if (profile.error) {
      throw new Error('set-profile failed: ' + await functionErrorDetail(profile.error));
    }
    assert.equal(profile.data.profile.current_display_name, 'LocalTest');

    const send = await anonymousClient.functions.invoke('chat-api', {
      body: {
        action: 'send-message',
        body: 'Local chat send verification',
        replyToMessageId: null,
      },
    });
    if (send.error) {
      throw new Error('send-message failed: ' + await functionErrorDetail(send.error));
    }
    messageId = send.data.message.id;
    assert.ok(messageId);
  } finally {
    if (messageId) {
      const securityCleanup = await adminClient
        .from('chat_message_security_logs')
        .delete()
        .eq('message_id', messageId);
      assert.ifError(securityCleanup.error);

      const messageCleanup = await adminClient
        .from('chat_messages')
        .delete()
        .eq('id', messageId);
      assert.ifError(messageCleanup.error);
    }
    if (userId) {
      const userCleanup = await adminClient.auth.admin.deleteUser(userId);
      assert.ifError(userCleanup.error);
    }
  }
});

test('local anonymous viewer receives but cannot send private chat broadcasts', {
  skip: process.env.RUN_LOCAL_CHAT_E2E !== '1',
}, async () => {
  const webRoot = resolve(import.meta.dirname, '..');
  const repositoryRoot = resolve(webRoot, '../..');
  const values = parseEnvironment(readFileSync(resolve(webRoot, '.env.local'), 'utf8'));
  const supabaseStatus = parseEnvironment(execFileSync(
    'npx',
    ['supabase', 'status', '-o', 'env'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ));
  const supabaseUrl = requireValue(values, 'VITE_SUPABASE_URL');
  const anonKey = requireValue(values, 'VITE_SUPABASE_ANON_KEY');
  const serviceRoleKey = requireValue(supabaseStatus, 'SERVICE_ROLE_KEY');
  const viewerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const senderClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const event = 'anonymous_viewer_test_' + Date.now();
  const received = new Promise<unknown>((resolveReceived, rejectReceived) => {
    const timeout = setTimeout(
      () => rejectReceived(new Error('Anonymous viewer did not receive the broadcast')),
      5_000,
    );
    viewerClient
      .channel('global-chat', { config: { private: true, broadcast: { ack: true } } })
      .on('broadcast', { event }, ({ payload }) => {
        clearTimeout(timeout);
        resolveReceived(payload);
      });
  });
  const viewerChannel = viewerClient.getChannels()[0];
  assert.ok(viewerChannel);
  const senderChannel = senderClient.channel('global-chat', {
    config: { private: true, broadcast: { ack: true } },
  });

  try {
    await Promise.all([subscribe(viewerChannel), subscribe(senderChannel)]);
    const session = await viewerClient.auth.getSession();
    assert.ifError(session.error);
    assert.equal(session.data.session, null);

    const senderSend = await senderChannel.send({
      type: 'broadcast',
      event,
      payload: { received: true },
    });
    assert.equal(senderSend, 'ok');
    assert.deepEqual(await received, { received: true });

    const viewerSend = await viewerChannel.send({
      type: 'broadcast',
      event: 'anonymous_viewer_write_attempt',
      payload: { blocked: true },
    }, { timeout: 1_000 });
    assert.notEqual(viewerSend, 'ok');
  } finally {
    await Promise.all([
      viewerClient.removeChannel(viewerChannel),
      senderClient.removeChannel(senderChannel),
    ]);
    viewerClient.realtime.disconnect();
    senderClient.realtime.disconnect();
  }
});
