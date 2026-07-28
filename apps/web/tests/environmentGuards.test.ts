import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeLocalEnvironment,
  parseEnvironmentFile,
  validateLocalTestEnvironment,
  validateProductionEnvironment,
  validateProductionSmokeEnvironment,
} from '../scripts/environmentGuards.mjs';

const sharedEnvironment = {
  VITE_SUPABASE_ANON_KEY: 'anon-public-key',
  VITE_PUBLIC_DATA_PROVIDER: 'supabase',
  VITE_ENABLE_SUPABASE_PROVIDER: 'true',
  VITE_ENABLE_PUBLISHED_PROVIDER: 'false',
};

function fakeJwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

test('local browser tests require loopback Supabase', () => {
  assert.doesNotThrow(() => validateLocalTestEnvironment({
    ...sharedEnvironment,
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  }));
  assert.throws(
    () => validateLocalTestEnvironment({
      ...sharedEnvironment,
      VITE_SUPABASE_URL: 'https://project.supabase.co',
    }),
    /loopback Supabase URL/,
  );
});

test('local published validation requires its explicit flag', () => {
  const publishedEnvironment = {
    ...sharedEnvironment,
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_PUBLIC_DATA_PROVIDER: 'published',
    VITE_ENABLE_PUBLISHED_PROVIDER: 'true',
  };

  assert.doesNotThrow(() => validateLocalTestEnvironment(publishedEnvironment));
  assert.throws(
    () => validateLocalTestEnvironment({
      ...publishedEnvironment,
      VITE_ENABLE_PUBLISHED_PROVIDER: 'false',
    }),
    /VITE_ENABLE_PUBLISHED_PROVIDER must be true/,
  );
});

test('production builds reject local Supabase and require HTTPS', () => {
  assert.doesNotThrow(() => validateProductionEnvironment({
    ...sharedEnvironment,
    VITE_SUPABASE_URL: 'https://project.supabase.co',
  }));
  assert.throws(
    () => validateProductionEnvironment({
      ...sharedEnvironment,
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    }),
    /non-local HTTPS Supabase URL/,
  );
});

test('production builds allow the published provider only behind its explicit flag', () => {
  const publishedEnvironment = {
    ...sharedEnvironment,
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_PUBLIC_DATA_PROVIDER: 'published',
    VITE_ENABLE_PUBLISHED_PROVIDER: 'true',
  };

  assert.doesNotThrow(() => validateProductionEnvironment(publishedEnvironment));
  assert.throws(
    () => validateProductionEnvironment({
      ...publishedEnvironment,
      VITE_ENABLE_PUBLISHED_PROVIDER: 'false',
    }),
    /VITE_ENABLE_PUBLISHED_PROVIDER must be true/,
  );
});

test('frontend environments reject service-role JWT credentials', () => {
  assert.throws(
    () => validateProductionEnvironment({
      ...sharedEnvironment,
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: fakeJwt({ role: 'service_role' }),
    }),
    /must not use a service role key/,
  );
});

test('production smoke rejects a local site URL', () => {
  assert.throws(
    () => validateProductionSmokeEnvironment({
      ...sharedEnvironment,
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:5173',
    }),
    /non-local HTTPS site URL/,
  );
});

test('local file parsing and explicit environment overrides are deterministic', () => {
  const parsed = parseEnvironmentFile([
    'VITE_SUPABASE_URL=http://127.0.0.1:54321',
    'VITE_PUBLIC_DATA_PROVIDER="supabase"',
  ].join('\n'));
  const merged = mergeLocalEnvironment(parsed, {
    VITE_PUBLIC_DATA_PROVIDER: 'mock',
    VITE_ENABLE_PUBLISHED_PROVIDER: 'false',
  });

  assert.equal(parsed.VITE_PUBLIC_DATA_PROVIDER, 'supabase');
  assert.equal(merged.VITE_PUBLIC_DATA_PROVIDER, 'mock');
  assert.equal(merged.VITE_ENABLE_PUBLISHED_PROVIDER, 'false');
});
