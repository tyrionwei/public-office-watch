export function requireLoopbackApiUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Local review requires a valid loopback Supabase URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    // Do not echo a rejected URL: it may contain credentials.
    throw new Error('Local review requires a loopback Supabase origin without credentials, path, query or fragment.');
  }
  // Avoid resolving localhost through user-controlled DNS or hosts configuration.
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url;
}

export function createLocalReviewClient({ supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  const origin = requireLoopbackApiUrl(supabaseUrl).origin;
  if (!serviceRoleKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY for local auto review.');
  return {
    urlFor(resource) {
      const url = new URL(`/rest/v1/${resource}`, origin);
      if (url.origin !== origin || !url.pathname.startsWith('/rest/v1/')) throw new Error('Invalid local review resource.');
      return url;
    },
    async requestJson(value, init = {}) {
      const url = new URL(value);
      if (url.origin !== origin || url.username || url.password || !url.pathname.startsWith('/rest/v1/')) {
        throw new Error('Local review request must stay on the configured loopback REST origin.');
      }
      const response = await fetchImpl(url, {
        ...init,
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(`${init.method ?? 'GET'} ${url.pathname} failed: ${body?.message ?? response.statusText}`);
      }
      return body;
    },
  };
}
