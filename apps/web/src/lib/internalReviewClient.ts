let session: Promise<string> | undefined;

async function getSessionToken() {
  session ??= fetch('/internal-api/session', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-pow-internal-bootstrap': '1' },
    body: '{}',
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok || typeof body.token !== 'string') {
      throw new Error(body.error || '無法建立本機審查連線。');
    }
    return body.token as string;
  }).catch((error: unknown) => {
    session = undefined;
    throw error;
  });
  return session;
}

export async function internalReviewFetch(url: string, init: RequestInit = {}) {
  const send = async () => {
    const token = await getSessionToken();
    const headers = new Headers(init.headers);
    headers.set('x-pow-internal-token', token);
    return fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store', headers });
  };
  try {
    const response = await send();
    // A restarted server rejects the old capability before any route can write.
    if (response.status !== 401) return response;
    session = undefined;
    return await send();
  } catch (error) {
    // Existing review callers consume error responses to clear loading/saving.
    const detail = error instanceof Error ? error.message : '本機審查連線失敗。';
    return new Response(JSON.stringify({
      error: init.method === 'POST' ? `${detail} 請先重新載入資料確認操作結果，再決定是否重試。` : detail,
    }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
}
