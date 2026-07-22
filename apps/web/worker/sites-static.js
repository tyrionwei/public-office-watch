function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('permissions-policy', 'camera=(), geolocation=(), microphone=()');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isDocumentRoute(request) {
  if (request.method !== 'GET' || !request.headers.get('accept')?.includes('text/html')) {
    return false;
  }

  const pathSegment = new URL(request.url).pathname.split('/').at(-1) ?? '';
  return !pathSegment.includes('.');
}

const worker = {
  async fetch(request, env) {
    if (isDocumentRoute(request)) {
      const indexUrl = new URL('/index.html', request.url);
      const indexRequest = new Request(indexUrl, request);
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      return addSecurityHeaders(indexResponse);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return addSecurityHeaders(assetResponse);
  },
};

export default worker;
