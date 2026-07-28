const frontendEnvironmentKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_PUBLIC_DATA_PROVIDER',
  'VITE_ENABLE_SUPABASE_PROVIDER',
];

function requireValue(environment, key) {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function parseUrl(value, key) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }
}

function isLoopbackHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function hasServiceRoleCredential(value) {
  const normalizedKey = value.toLowerCase();
  if (normalizedKey.includes('service_role') || normalizedKey.includes('service-role')) {
    return true;
  }

  const segments = value.split('.');
  if (segments.length !== 3) return false;

  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

function validateSharedFrontendEnvironment(environment) {
  if (requireValue(environment, 'VITE_PUBLIC_DATA_PROVIDER') !== 'supabase') {
    throw new Error('VITE_PUBLIC_DATA_PROVIDER must be supabase.');
  }
  if (requireValue(environment, 'VITE_ENABLE_SUPABASE_PROVIDER') !== 'true') {
    throw new Error('VITE_ENABLE_SUPABASE_PROVIDER must be true.');
  }

  const anonKey = requireValue(environment, 'VITE_SUPABASE_ANON_KEY');
  if (hasServiceRoleCredential(anonKey)) {
    throw new Error('Frontend Supabase credentials must not use a service role key.');
  }

  return parseUrl(requireValue(environment, 'VITE_SUPABASE_URL'), 'VITE_SUPABASE_URL');
}

export function validateLocalTestEnvironment(environment) {
  const supabaseUrl = validateSharedFrontendEnvironment(environment);
  if (!isLoopbackHostname(supabaseUrl.hostname)) {
    throw new Error('Local browser tests must use a loopback Supabase URL.');
  }
}

export function validateProductionEnvironment(environment) {
  const supabaseUrl = validateSharedFrontendEnvironment(environment);
  if (supabaseUrl.protocol !== 'https:' || isLoopbackHostname(supabaseUrl.hostname)) {
    throw new Error('Production builds must use a non-local HTTPS Supabase URL.');
  }
}

export function validateProductionSmokeEnvironment(environment) {
  validateProductionEnvironment(environment);
  const baseUrl = parseUrl(requireValue(environment, 'PLAYWRIGHT_BASE_URL'), 'PLAYWRIGHT_BASE_URL');
  if (baseUrl.protocol !== 'https:' || isLoopbackHostname(baseUrl.hostname)) {
    throw new Error('Production smoke tests must use a non-local HTTPS site URL.');
  }
}

export function parseEnvironmentFile(contents) {
  const values = {};
  for (const sourceLine of contents.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function mergeLocalEnvironment(fileEnvironment, processEnvironment) {
  const environment = { ...fileEnvironment };
  for (const key of frontendEnvironmentKeys) {
    if (processEnvironment[key] !== undefined) environment[key] = processEnvironment[key];
  }
  return environment;
}
