import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260830184447_harden_participation_proxy_proofs.sql', import.meta.url),
  'utf8',
);
const config = readFileSync(
  new URL('../../../supabase/config.toml', import.meta.url),
  'utf8',
);
const headers = readFileSync(
  new URL('../public/_headers', import.meta.url),
  'utf8',
);
const worker = readFileSync(
  new URL('../worker/sites-static.js', import.meta.url),
  'utf8',
);

test('participation proxy proofs are body-bound and single-use', () => {
  assert.match(migration, /CREATE TABLE public\.participation_proxy_nonces/u);
  assert.match(migration, /ON CONFLICT ON CONSTRAINT participation_proxy_nonces_pkey DO NOTHING/u);
  assert.match(migration, /x-participation-proxy-body-sha256/u);
  assert.match(migration, /x-participation-proxy-signature-v2/u);
  assert.match(migration, /participation_proxy_body_sha256/u);
  assert.match(migration, /DROP FUNCTION public\.assert_participation_proxy_request\(TEXT\)/u);
});

test('Supabase Auth baseline requires strong passwords, secure changes, and TOTP', () => {
  assert.match(config, /minimum_password_length = 12/u);
  assert.match(config, /password_requirements = "lower_upper_letters_digits_symbols"/u);
  assert.match(config, /secure_password_change = true/u);
  assert.match(
    config,
    /\[auth\.mfa\.totp\][\s\S]*enroll_enabled = true[\s\S]*verify_enabled = true/u,
  );
});

test('static and Worker responses enforce matching CSP and HSTS baselines', () => {
  for (const source of [headers, worker]) {
    assert.match(source, /default-src 'self'/u);
    assert.match(source, /https:\/\/\*\.supabase\.co/u);
    assert.match(source, /wss:\/\/\*\.supabase\.co/u);
    assert.match(source, /max-age=31536000/u);
  }
});
