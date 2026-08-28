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

test('local chat rooms accept a nationwide context without a region UUID', {
  skip: process.env.RUN_LOCAL_CHAT_E2E !== '1',
}, async () => {
  const webRoot = resolve(import.meta.dirname, '..');
  const values = parseEnvironment(readFileSync(resolve(webRoot, '.env.local'), 'utf8'));
  const client = createClient(
    requireValue(values, 'VITE_SUPABASE_URL'),
    requireValue(values, 'VITE_SUPABASE_ANON_KEY'),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );

  const result = await client.schema('published').rpc('chat_rooms', {
    p_region_id: null,
    p_event_key: null,
    p_election_id: null,
  });

  assert.ifError(result.error);
  assert.ok(result.data?.some((room) => room.room_key === 'global'));

  const regionResult = await client
    .schema('published')
    .from('regions')
    .select('region_id,slug')
    .in('region_type', ['municipality', 'county', 'city'])
    .not('slug', 'like', 'historical-%')
    .limit(1)
    .single();
  assert.ifError(regionResult.error);
  assert.ok(regionResult.data?.slug);

  const regionRooms = await client.schema('published').rpc('chat_rooms', {
    p_region_id: regionResult.data.region_id,
    p_event_key: null,
    p_election_id: null,
  });
  assert.ifError(regionRooms.error);
  assert.ok(regionRooms.data?.some((room) => (
    room.room_type === 'region' && room.region_id === regionResult.data.region_id
  )));

  const directory = await client.schema('published').rpc('chat_room_directory');
  assert.ifError(directory.error);
  assert.ok(directory.data?.some((room) => room.room_type === 'region'));
  assert.ok(directory.data?.some((room) => room.room_type === 'election_event'));

  const directoryRooms = directory.data ?? [];
  const electionRooms = directoryRooms.filter((room) => room.room_type === 'election_event');
  assert.equal(
    new Set(electionRooms.map((room) => room.entity_key)).size,
    electionRooms.length,
  );
  assert.ok(electionRooms.every((room) => /^\d{4}:(?:election|referendum)$/u.test(room.entity_key)));
  assert.equal(
    electionRooms.find((room) => room.entity_key === '2022:election')?.display_name,
    '2022 地方公職人員選舉',
  );
  assert.equal(
    electionRooms.find((room) => room.entity_key === '2022:referendum')?.display_name,
    '2022 公民投票',
  );
  assert.ok(!electionRooms.some((room) => /補選|罷免/u.test(room.display_name)));

  const historicalRegions = await client
    .schema('published')
    .from('regions')
    .select('region_id')
    .like('slug', 'historical-%');
  assert.ifError(historicalRegions.error);
  const historicalRegionIds = new Set(
    historicalRegions.data?.map((region) => region.region_id) ?? [],
  );
  assert.ok(!directoryRooms.some((room) => (
    room.room_type === 'region' && historicalRegionIds.has(room.region_id)
  )));

  const orderedRegions = await client
    .schema('published')
    .from('regions')
    .select('region_id')
    .in('region_type', ['municipality', 'county', 'city'])
    .not('slug', 'like', 'historical-%')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
    .order('region_id', { ascending: true });
  assert.ifError(orderedRegions.error);
  assert.deepEqual(
    directoryRooms
      .filter((room) => room.room_type === 'region')
      .map((room) => room.region_id),
    orderedRegions.data?.map((region) => region.region_id),
  );
});

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
        roomId: '00000000-0000-4000-8000-000000000001',
        topicTag: null,
        body: 'Local chat send verification',
        replyToMessageId: null,
      },
    });
    if (send.error) {
      throw new Error('send-message failed: ' + await functionErrorDetail(send.error));
    }
    messageId = send.data.message.id;
    assert.ok(messageId);
    assert.equal(send.data.message.room_id, '00000000-0000-4000-8000-000000000001');
    assert.equal(send.data.message.topic_tag, null);
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

test('global lobby aggregates and filters regional realtime messages', {
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
  const senderClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const viewerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  let messageId: string | null = null;
  let userId: string | null = null;
  const globalRoomId = '00000000-0000-4000-8000-000000000001';
  const directory = await viewerClient.schema('published').rpc('chat_room_directory');
  assert.ifError(directory.error);
  const regionRoom = directory.data?.find((room) => room.room_type === 'region');
  assert.ok(regionRoom);

  const viewerChannel = viewerClient.channel('chat-room:global', {
    config: { private: true },
  });
  let receiveTimeout: ReturnType<typeof setTimeout> | null = null;
  const received = new Promise<unknown>((resolveReceived, rejectReceived) => {
    receiveTimeout = setTimeout(
      () => rejectReceived(new Error('Global lobby did not receive the regional message')),
      5_000,
    );
    viewerChannel.on('broadcast', { event: 'message_created' }, ({ payload }) => {
      if (payload && typeof payload === 'object' && payload.room_id === regionRoom.id) {
        if (receiveTimeout) clearTimeout(receiveTimeout);
        receiveTimeout = null;
        resolveReceived(payload);
      }
    });
  });

  try {
    await subscribe(viewerChannel);
    const signup = await senderClient.auth.signInAnonymously();
    assert.ifError(signup.error);
    assert.ok(signup.data.user);
    userId = signup.data.user.id;

    const profile = await senderClient.functions.invoke('chat-api', {
      body: {
        action: 'set-profile',
        displayName: 'AggTest',
        acceptTerms: true,
      },
    });
    if (profile.error) {
      throw new Error('set-profile failed: ' + await functionErrorDetail(profile.error));
    }

    const send = await senderClient.functions.invoke('chat-api', {
      body: {
        action: 'send-message',
        roomId: regionRoom.id,
        topicTag: 'transport',
        body: 'Regional aggregate verification',
        replyToMessageId: null,
      },
    });
    if (send.error) {
      throw new Error('send-message failed: ' + await functionErrorDetail(send.error));
    }
    messageId = send.data.message.id;
    assert.ok(messageId);

    const realtimeMessage = await received as {
      id?: string;
      room_display_name?: string;
      topic_tag?: string;
    };
    assert.equal(realtimeMessage.id, messageId);
    assert.equal(realtimeMessage.room_display_name, regionRoom.display_name);
    assert.equal(realtimeMessage.topic_tag, 'transport');

    const globalMessages = await viewerClient.schema('published').rpc('chat_messages', {
      p_room_id: globalRoomId,
      p_before_created_at: null,
      p_before_id: null,
      p_limit: 50,
      p_topic_tag: null,
    });
    assert.ifError(globalMessages.error);
    assert.ok(globalMessages.data?.some((message) => (
      message.id === messageId
      && message.room_id === regionRoom.id
      && message.room_display_name === regionRoom.display_name
    )));

    const transportMessages = await viewerClient.schema('published').rpc('chat_messages', {
      p_room_id: globalRoomId,
      p_before_created_at: null,
      p_before_id: null,
      p_limit: 50,
      p_topic_tag: 'transport',
    });
    assert.ifError(transportMessages.error);
    assert.ok(transportMessages.data?.some((message) => message.id === messageId));

    const otherMessages = await viewerClient.schema('published').rpc('chat_messages', {
      p_room_id: globalRoomId,
      p_before_created_at: null,
      p_before_id: null,
      p_limit: 50,
      p_topic_tag: 'other',
    });
    assert.ifError(otherMessages.error);
    assert.ok(!otherMessages.data?.some((message) => message.id === messageId));

    const regionalMessages = await viewerClient.schema('published').rpc('chat_messages', {
      p_room_id: regionRoom.id,
      p_before_created_at: null,
      p_before_id: null,
      p_limit: 50,
      p_topic_tag: null,
    });
    assert.ifError(regionalMessages.error);
    assert.ok(regionalMessages.data?.some((message) => message.id === messageId));
  } finally {
    if (receiveTimeout) clearTimeout(receiveTimeout);
    await viewerClient.removeChannel(viewerChannel);
    viewerClient.realtime.disconnect();
    if (messageId) {
      const securityCleanup = await adminClient
        .from('chat_message_security_logs')
        .delete()
        .eq('message_id', messageId);
      assert.ifError(securityCleanup.error);
      const messageCleanup = await adminClient.from('chat_messages').delete().eq('id', messageId);
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
      .channel('chat-room:global', { config: { private: true, broadcast: { ack: true } } })
      .on('broadcast', { event }, ({ payload }) => {
        clearTimeout(timeout);
        resolveReceived(payload);
      });
  });
  const viewerChannel = viewerClient.getChannels()[0];
  assert.ok(viewerChannel);
  const senderChannel = senderClient.channel('chat-room:global', {
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
