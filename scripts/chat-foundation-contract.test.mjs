import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/202607290001_chat_foundation.sql', import.meta.url),
  'utf8',
);
const serverMigration = readFileSync(
  new URL('../supabase/migrations/202607290002_chat_server_functions.sql', import.meta.url),
  'utf8',
);
const interfaceMigration = readFileSync(
  new URL('../supabase/migrations/202607290003_chat_terms_and_realtime.sql', import.meta.url),
  'utf8',
);
const adminMigration = readFileSync(
  new URL('../supabase/migrations/202607290004_chat_moderation_admin.sql', import.meta.url),
  'utf8',
);
const securityMigration = readFileSync(
  new URL('../supabase/migrations/202607290005_chat_security_retention.sql', import.meta.url),
  'utf8',
);
const adminSearchMigration = readFileSync(
  new URL('../supabase/migrations/202607290006_chat_admin_message_search.sql', import.meta.url),
  'utf8',
);
const nameCooldownMigration = readFileSync(
  new URL('../supabase/migrations/202607290007_chat_profile_name_cooldown.sql', import.meta.url),
  'utf8',
);
const publicFeedbackAndChatRealtimeMigration = readFileSync(
  new URL('../supabase/migrations/20260827170729_split_public_feedback_and_chat_realtime_reads.sql', import.meta.url),
  'utf8',
);
const channelMigration = readFileSync(
  new URL('../supabase/migrations/20260828093717_add_chat_channels.sql', import.meta.url),
  'utf8',
);
const app = readFileSync(
  new URL('../apps/web/src/App.tsx', import.meta.url),
  'utf8',
);
const widget = readFileSync(
  new URL('../apps/web/src/components/GlobalChatWidget.tsx', import.meta.url),
  'utf8',
);
const chatClient = readFileSync(
  new URL('../apps/web/src/lib/globalChat.ts', import.meta.url),
  'utf8',
);
const edgeFunction = readFileSync(
  new URL('../supabase/functions/chat-api/index.ts', import.meta.url),
  'utf8',
);
const adminEdgeFunction = readFileSync(
  new URL('../supabase/functions/chat-admin/index.ts', import.meta.url),
  'utf8',
);
const adminPage = readFileSync(
  new URL('../apps/web/src/pages/InternalChatAdminPage.tsx', import.meta.url),
  'utf8',
);
const adminClient = readFileSync(
  new URL('../apps/web/src/lib/chatAdmin.ts', import.meta.url),
  'utf8',
);

test('chat channels preserve the global lobby and reject cross-room replies', () => {
  assert.match(channelMigration, /room_type IN \('global', 'region', 'election_event'\)/);
  assert.match(channelMigration, /ADD COLUMN room_id UUID NOT NULL DEFAULT/);
  assert.match(channelMigration, /replied\.room_id <> p_room_id/);
  assert.match(channelMigration, /OR message\.room_id = p_room_id/);
  assert.match(channelMigration, /p_room_id = '00000000-0000-4000-8000-000000000001'/);
  assert.match(channelMigration, /CREATE FUNCTION published\.chat_room_directory/);
  assert.match(channelMigration, /'chat-room:' \|\| target_room\.room_key/);
  assert.match(channelMigration, /'chat-room:global'/);
  assert.match(channelMigration, /p_topic_tag IS NULL OR message\.topic_tag = p_topic_tag/);
  assert.match(channelMigration, /'room_display_name', target_room\.display_name/);
  assert.match(channelMigration, /topic_tag IN/);
  assert.doesNotMatch(channelMigration, /person_room|room_type = 'person'/);
});

test('local Supabase explicitly enables anonymous auth for chat development', () => {
  assert.match(config, /^enable_anonymous_sign_ins = true$/m);
});

test('chat is created disabled with the agreed identity and message limits', () => {
  assert.match(migration, /is_enabled BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /public_code ~ '\^\[0-9A-HJKMNP-TV-Z\]\{6\}\$'/);
  assert.match(migration, /CHAR_LENGTH\(current_display_name\) BETWEEN 2 AND 12/);
  assert.match(migration, /CHAR_LENGTH\(body\) BETWEEN 1 AND 50/);
  assert.match(migration, /CHAR_LENGTH\(reply_to_body_snapshot\) BETWEEN 1 AND 20/);
});

test('security logs preserve encrypted and comparable IP records with retention controls', () => {
  assert.match(migration, /ip_hmac TEXT NOT NULL/);
  assert.match(migration, /ip_ciphertext TEXT NOT NULL/);
  assert.match(migration, /INTERVAL '180 days'/);
  assert.match(migration, /legal_hold_until TIMESTAMPTZ/);
});

test('public roles can only read the reviewed chat views', () => {
  for (const table of [
    'chat_settings',
    'chat_profiles',
    'chat_messages',
    'chat_message_security_logs',
  ]) {
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON ${table} FROM PUBLIC, anon, authenticated;`),
    );
    assert.match(
      migration,
      new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`),
    );
  }

  assert.match(migration, /GRANT SELECT ON public_chat_status TO anon, authenticated;/);
  assert.match(migration, /GRANT SELECT ON public_chat_messages TO anon, authenticated;/);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE).* TO (?:anon|authenticated)/);
});

test('chat writes are serialized and enforce server-side abuse controls', () => {
  assert.match(serverMigration, /pg_advisory_xact_lock/);
  assert.match(serverMigration, /INTERVAL '8 seconds'/);
  assert.match(serverMigration, /INTERVAL '5 minutes'/);
  assert.match(serverMigration, /MESSAGE = 'CHAT_DISABLED'/);
  assert.match(serverMigration, /MESSAGE = 'CHAT_COOLDOWN'/);
  assert.match(serverMigration, /MESSAGE = 'CHAT_DUPLICATE'/);
  assert.match(serverMigration, /INSERT INTO chat_message_security_logs/);
});

test('chat write functions are service-only', () => {
  assert.match(serverMigration, /SECURITY DEFINER/g);
  assert.match(serverMigration, /FROM PUBLIC, anon, authenticated;/g);
  assert.match(serverMigration, /TO service_role;/g);
});

test('the edge function authenticates users and keeps IP secrets server-side', () => {
  assert.match(edgeFunction, /authClient\.auth\.getUser\(\)/);
  assert.match(edgeFunction, /authData\.user\.is_anonymous !== true/);
  assert.match(edgeFunction, /getTrustedClientIp\(request\.headers\)/);
  assert.match(edgeFunction, /CHAT_IP_HMAC_KEY/);
  assert.match(edgeFunction, /CHAT_IP_ENCRYPTION_KEY/);
  assert.match(edgeFunction, /p_ip_ciphertext: ipCiphertext/);
  assert.doesNotMatch(edgeFunction, /payload\.ip/);
});

test('terms acceptance is durable, versioned and enforced before writes', () => {
  assert.match(interfaceMigration, /terms_version TEXT NOT NULL DEFAULT '2026-07-29-v1'/);
  assert.match(interfaceMigration, /terms_accepted_at TIMESTAMPTZ/);
  assert.match(interfaceMigration, /MESSAGE = 'CHAT_TERMS_REQUIRED'/);
  assert.match(edgeFunction, /p_accept_terms: payload\.acceptTerms === true/);
  assert.match(edgeFunction, /payload\.action === 'get-profile'/);
});

test('display names can only change every 30 minutes and the server is authoritative', () => {
  assert.match(nameCooldownMigration, /display_name_updated_at TIMESTAMPTZ/);
  assert.match(nameCooldownMigration, /INTERVAL '30 minutes'/);
  assert.match(nameCooldownMigration, /MESSAGE = 'CHAT_NAME_COOLDOWN'/);
  assert.match(nameCooldownMigration, /FOR UPDATE/);
  assert.match(edgeFunction, /CHAT_NAME_COOLDOWN/);
  assert.match(chatClient, /chatNameCooldownMinutes = 30/);
});

test('realtime broadcasts only the public message shape on a private channel', () => {
  assert.match(interfaceMigration, /PERFORM realtime\.send\(/);
  assert.match(interfaceMigration, /'global-chat',\s+TRUE/);
  assert.doesNotMatch(interfaceMigration, /'user_id', NEW\.user_id/);
  assert.match(interfaceMigration, /TO authenticated\s+USING/);
  assert.match(chatClient, /channel\('global-chat', \{ config: \{ private: true \} \}\)/);
  assert.match(chatClient, /removeChannel\(channel\)/);
});

test('anonymous chat viewers can receive but cannot send realtime broadcasts', () => {
  assert.match(
    publicFeedbackAndChatRealtimeMigration,
    /CREATE POLICY "anonymous users can receive global chat broadcasts"[\s\S]+FOR SELECT[\s\S]+TO anon[\s\S]+realtime\.topic\(\)[\s\S]+global-chat/u,
  );
  assert.doesNotMatch(publicFeedbackAndChatRealtimeMigration, /FOR INSERT/u);

  const subscriptionSource = chatClient.match(
    /export async function subscribeToChatMessages[\s\S]+?(?=export async function unsubscribeFromChat)/u,
  )?.[0] ?? '';
  assert.match(subscriptionSource, /getExistingParticipationSession/u);
  assert.doesNotMatch(subscriptionSource, /ensureAnonymousChatSession/u);
});

test('the global widget survives route changes and follows the agreed quiet UI', () => {
  assert.ok(app.indexOf('GlobalChatWidget />') > app.indexOf('/Routes>'));
  assert.match(widget, /aria-label=\{text\.launcher\}/);
  assert.doesNotMatch(widget, /unread|badge|notification/i);
  assert.match(widget, /type="checkbox"/);
  assert.match(widget, /characterCount >= 40/);
  assert.match(widget, /h-\[82dvh\][\s\S]+md:w-\[400px\]/);
  assert.match(widget, /md:hover:opacity-100/);
  assert.match(widget, /md:opacity-60/);
  assert.match(widget, /text\.minimize/);
  assert.match(widget, /aria-label=\{text\.channelPicker\}/);
  assert.match(widget, /aria-label=\{text\.topics\}/);
  assert.match(widget, /message\.room_display_name/);
  assert.match(widget, /realtimeSubscriptionRevisionRef/);
  assert.match(widget, /receiveRealtimeStatus/);
  assert.doesNotMatch(widget, /receiveMessage,\s+setRealtimeStatus/);
  assert.doesNotMatch(widget, /text\.subtitle/);
});

test('history uses a 50-row cursor RPC rather than offset pagination', () => {
  assert.match(interfaceMigration, /\(message\.created_at, message\.id\) < \(p_before_created_at, p_before_id\)/);
  assert.match(interfaceMigration, /COALESCE\(p_limit, 50\)/);
  assert.match(chatClient, /p_before_created_at: before\?\.created_at \?\? null/);
  assert.match(chatClient, /p_topic_tag: topicTag/);
  assert.match(chatClient, /topicTag: ChatTopicTag \| null/);
  assert.match(widget, /sendChatMessage\(targetRoom, selectedTopicTag,/);
  assert.doesNotMatch(widget, /topicLabel:/);
  assert.doesNotMatch(widget, /message\.topic_tag !== selectedTopicTag/);
  assert.doesNotMatch(widget, /loadChatMessages\(activeRoom\.id, selectedTopicTag/);
  assert.match(widget, /chatRecentRoomsStorageKey/);
  assert.match(widget, /recentRooms\.map\(\(room, index\)/);
  assert.match(widget, /index === 0 \? 'sm:block' : 'lg:block'/);
  assert.doesNotMatch(chatClient, /offset/i);
});

test('chat admin writes are server-authorized, narrowly scoped and audited', () => {
  assert.match(adminMigration, /raw_app_meta_data ->> 'chat_admin'/);
  assert.match(adminMigration, /CREATE TABLE chat_moderation_actions/);
  assert.match(adminMigration, /CHAT_ADMIN_FORBIDDEN/);
  assert.match(adminMigration, /GRANT EXECUTE ON FUNCTION admin_set_chat_enabled\(UUID, BOOLEAN\) TO service_role/);
  assert.doesNotMatch(adminMigration, /GRANT .*chat_moderation_actions.* TO (?:anon|authenticated)/);
  assert.match(adminMigration, /p_reason NOT IN \(\s*'bot',\s*'spam'/);
});

test('security records are cleaned in batches while Legal Hold remains service-only and audited', () => {
  assert.match(securityMigration, /CREATE FUNCTION cleanup_expired_chat_security_logs/);
  assert.match(securityMigration, /legal_hold_until IS NULL/);
  assert.match(securityMigration, /FOR UPDATE SKIP LOCKED/);
  assert.match(securityMigration, /'chat-security-log-cleanup'/);
  assert.match(securityMigration, /CREATE FUNCTION admin_set_chat_security_hold/);
  assert.match(securityMigration, /'infinity'::TIMESTAMPTZ/);
  assert.match(securityMigration, /security_hold_applied/);
  assert.match(securityMigration, /GRANT EXECUTE ON FUNCTION admin_set_chat_security_hold\(UUID, UUID, BOOLEAN, TEXT\)\s+TO service_role/);
  assert.doesNotMatch(securityMigration, /TO (?:anon|authenticated);/);
});

test('older admin messages use exact indexed lookup without exposing private security fields', () => {
  assert.match(adminSearchMigration, /idx_chat_messages_admin_public_code_cursor/);
  assert.match(adminSearchMigration, /CREATE FUNCTION admin_search_chat_messages/);
  assert.match(adminSearchMigration, /message\.public_code_snapshot = normalized_query/);
  assert.match(adminSearchMigration, /LIMIT 50/);
  assert.match(adminSearchMigration, /GRANT EXECUTE ON FUNCTION admin_search_chat_messages\(UUID, TEXT\)\s+TO service_role/);
  assert.doesNotMatch(adminSearchMigration, /ip_hmac|ip_ciphertext/);
  assert.match(adminEdgeFunction, /payload\.action === 'search-messages'/);
  assert.match(adminPage, /完整訊息 ID 或 #A7K2F9/);
});

test('chat admin edge function verifies a non-anonymous admin without exposing private identifiers', () => {
  assert.match(adminEdgeFunction, /authClient\.auth\.getUser\(\)/);
  assert.match(adminEdgeFunction, /adminUser\.is_anonymous === true/);
  assert.match(adminEdgeFunction, /adminUser\.app_metadata\?\.chat_admin !== true/);
  assert.doesNotMatch(adminEdgeFunction, /ip_hmac|ip_ciphertext/);
  assert.doesNotMatch(adminEdgeFunction, /userId:/);
});

test('chat admin page uses one-time email login and remains available during public-data failure', () => {
  assert.match(adminClient, /shouldCreateUser: false/);
  assert.match(adminClient, /getSupabaseChatAdminClient/);
  assert.match(app, /isInternalAdminRoute/);
  assert.match(app, /publicDataStatus !== 'ready' && !isInternalAdminRoute/);
  assert.match(adminPage, /立即關閉聊天室/);
  assert.match(adminPage, /一般政治立場或用語爭議不在處理範圍/);
  assert.match(adminPage, /安全紀錄保存/);
  assert.match(adminPage, /設定 Legal Hold/);
});

test('emergency shutdown and message removal are pushed to active private chat clients', () => {
  assert.match(adminMigration, /'message_removed',\s*'global-chat',\s*TRUE/);
  assert.match(adminMigration, /'status_changed',\s*'global-chat',\s*TRUE/);
  assert.match(chatClient, /event: 'message_removed'/);
  assert.match(chatClient, /event: 'status_changed'/);
  assert.match(widget, /setMessages\(\(current\) => current\s*\.map/);
  assert.match(widget, /const currentStatus = await ensureChatStatus\(\)/);
});
