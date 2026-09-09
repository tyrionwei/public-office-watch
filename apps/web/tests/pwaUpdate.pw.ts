import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { shellAssetPaths, versionPwaShell } from '../build/pwaShellVersion.mjs';

test.use({ serviceWorkers: 'allow' });
let server: Server;
let origin: string;
let root: string;
let servedVersion = 1;
let failure: 'none' | '404' | 'mismatch' = 'none';
let redirectOffline = false;
const versions = new Map<number, Map<string, Buffer>>();

test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'pow-pwa-browser-'));
  const template = await readFile(new URL('../public/service-worker.js', import.meta.url));
  for (const version of [1, 2]) {
    const directory = path.join(root, String(version));
    await mkdir(directory);
    for (const url of shellAssetPaths) {
      await mkdir(path.dirname(path.join(directory, url)), { recursive: true });
      await writeFile(path.join(directory, url), url === '/offline.html'
        ? `<!doctype html><html><head><title>Offline ${version}</title></head><body>OFFLINE VERSION ${version}</body></html>`
        : `fixture ${url} version ${version}`);
    }
    await writeFile(path.join(directory, 'service-worker.js'), template);
    await versionPwaShell(directory);
    const assets = new Map<string, Buffer>();
    for (const url of [...shellAssetPaths, '/service-worker.js']) assets.set(url, await readFile(path.join(directory, url)));
    versions.set(version, assets);
  }
  server = createServer((request, response) => {
    const url = new URL(request.url!, origin);
    let pathname = url.pathname;
    if (redirectOffline && pathname === '/offline.html') {
      response.writeHead(307, { location: '/offline' }); response.end(); return;
    }
    if (pathname === '/offline') pathname = '/offline.html';
    if (pathname === '/' || pathname === '/second') {
      response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      response.end('<!doctype html><html><head><title>PWA fixture</title></head><body>ONLINE<script>navigator.serviceWorker.register("/service-worker.js",{scope:"/",updateViaCache:"none"})</script></body></html>');
      return;
    }
    const fault = servedVersion === 2 && pathname === '/site.webmanifest';
    if (fault && failure === '404') { response.writeHead(404); response.end('Controlled missing'); return; }
    const body = versions.get(fault && failure === 'mismatch' ? 1 : servedVersion)?.get(pathname);
    if (!body) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.html') ? 'text/html' : 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected local test port');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  if (root) await rm(root, { recursive: true, force: true });
});

for (const fault of ['none', '404', 'mismatch', 'redirect'] as const) {
  test(`PWA ${fault} update preserves the active shell and activates a complete recovered version`, async ({ context, page }) => {
    servedVersion = 1; failure = 'none'; redirectOffline = fault === 'redirect';
    await page.goto(origin);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(() => { localStorage.setItem('fixture-voting-region', 'preserved'); return caches.open('unrelated-cache'); });
    const second = await context.newPage(); await second.goto(origin + '/second');
    const oldNames = await page.evaluate(() => caches.keys());
    expect(oldNames.filter(name => name.startsWith('public-office-watch-shell-'))).toHaveLength(1);
    servedVersion = 2; failure = fault === 'redirect' ? 'none' : fault;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      (window as unknown as { updateStates: string[] }).updateStates = [];
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing!;
        installing.addEventListener('statechange', () => (window as unknown as { updateStates: string[] }).updateStates.push(installing.state));
      });
      await registration.update();
    });
    if (fault !== 'none' && fault !== 'redirect') {
      await page.waitForFunction(() => (window as unknown as { updateStates: string[] }).updateStates.includes('redundant'));
      expect(await page.evaluate(() => caches.keys())).toEqual(oldNames);
      await context.setOffline(true);
      await second.goto(origin + '/second');
      await expect(second.locator('body')).toHaveText('OFFLINE VERSION 1');
      await context.setOffline(false);
      failure = 'none';
      await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    }
    await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
    // A waiting update must not take over either open page or serve its cache to the old worker.
    expect(await page.evaluate(() => fetch('/site.webmanifest').then(response => response.text()))).toContain('version 1');
    expect(await second.evaluate(() => fetch('/site.webmanifest').then(response => response.text()))).toContain('version 1');
    await page.close(); await second.close();
    const reopened = await context.newPage();
    await reopened.goto(origin);
    await reopened.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await expect.poll(() => reopened.evaluate(() => fetch('/site.webmanifest').then(response => response.text()))).toContain('version 2');
    for (const url of shellAssetPaths.filter((url: string) => url !== '/offline.html')) {
      expect(await reopened.evaluate(url => fetch(url).then(response => response.text()), url)).toContain('version 2');
    }
    expect(await reopened.evaluate(() => localStorage.getItem('fixture-voting-region'))).toBe('preserved');
    const newNames = await reopened.evaluate(() => caches.keys());
    expect(newNames).toContain('unrelated-cache');
    expect(newNames.filter(name => name.startsWith('public-office-watch-shell-'))).toHaveLength(1);
    expect(newNames).not.toContain(oldNames.find(name => name.startsWith('public-office-watch-shell-')));
    await context.setOffline(true);
    await reopened.goto(origin + '/second');
    await expect(reopened.locator('body')).toHaveText('OFFLINE VERSION 2');
    await context.setOffline(false);
    await reopened.close();
  });
}
