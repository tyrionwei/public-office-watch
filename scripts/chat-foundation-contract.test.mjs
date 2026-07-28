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

test('realtime broadcasts only the public message shape on a private channel', () => {
  assert.match(interfaceMigration, /PERFORM realtime\.send\(/);
  assert.match(interfaceMigration, /'global-chat',\s+TRUE/);
  assert.doesNotMatch(interfaceMigration, /'user_id', NEW\.user_id/);
  assert.match(interfaceMigration, /TO authenticated\s+USING/);
  assert.match(chatClient, /channel\('global-chat', \{ config: \{ private: true \} \}\)/);
  assert.match(chatClient, /removeChannel\(channel\)/);
});

test('the global widget survives route changes and follows the agreed quiet UI', () => {
  assert.match(app, /<AppRoutes[\s\S]+<GlobalChatWidget \/>/);
  assert.match(widget, /aria-label=\{text\.launcher\}/);
  assert.doesNotMatch(widget, /unread|badge|notification/i);
  assert.match(widget, /type="checkbox"/);
  assert.match(widget, /characterCount >= 40/);
  assert.match(widget, /h-\[82dvh\][\s\S]+md:w-\[400px\]/);
});

test('history uses a 50-row cursor RPC rather than offset pagination', () => {
  assert.match(interfaceMigration, /\(message\.created_at, message\.id\) < \(p_before_created_at, p_before_id\)/);
  assert.match(interfaceMigration, /COALESCE\(p_limit, 50\)/);
  assert.match(chatClient, /p_before_created_at: before\?\.created_at \?\? null/);
  assert.doesNotMatch(chatClient, /offset/i);
});
