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

const worker = {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status !== 404) {
      return addSecurityHeaders(assetResponse);
    }

    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (request.method !== 'GET' || !acceptsHtml) {
      return addSecurityHeaders(assetResponse);
    }

    const indexUrl = new URL('/index.html', request.url);
    const indexRequest = new Request(indexUrl, request);
    const indexResponse = await env.ASSETS.fetch(indexRequest);
    return addSecurityHeaders(indexResponse);
  },
};

export default worker;
