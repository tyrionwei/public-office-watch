import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/202607290001_chat_foundation.sql', import.meta.url),
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
