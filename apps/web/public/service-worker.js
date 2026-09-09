const SHELL_MANIFEST = /*__POW_SHELL_MANIFEST__*/ null;
const CACHE_NAME = `public-office-watch-shell-${SHELL_MANIFEST?.version ?? 'unbuilt'}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = SHELL_MANIFEST?.assets.map(asset => asset.url) ?? [];

async function installShell() {
  if (!SHELL_MANIFEST?.assets.length) throw new Error('PWA shell has not been built');
  const responses = await Promise.all(SHELL_MANIFEST.assets.map(async asset => {
    const response = await fetch(asset.url, { cache: 'reload' });
    if (!response.ok) throw new Error('PWA shell asset unavailable');
    const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== asset.sha256) throw new Error('PWA shell asset version mismatch');
    // Asset hosts may redirect /offline.html to /offline. A redirected Response
    // cannot satisfy a navigation with redirect mode "manual", so cache its
    // verified body as a fresh response without the redirect history.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }));
  try {
    const cache = await caches.open(CACHE_NAME);
    for (let index = 0; index < responses.length; index += 1) await cache.put(PRECACHE_URLS[index], responses[index]);
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(installShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('public-office-watch-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.open(CACHE_NAME).then(cache => cache.match(OFFLINE_URL))),
    );
    return;
  }

  if (!PRECACHE_URLS.includes(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(request)).then((cachedResponse) => cachedResponse ?? fetch(request)),
  );
});
