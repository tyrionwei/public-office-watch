import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config.js';

export async function startCryptoSupportFixture() {
  const fixture = dirname(fileURLToPath(import.meta.url));
  const web = resolve(fixture, '../../..');
  const out = await mkdtemp(resolve(tmpdir(), 'pow-crypto-support-'));
  const modules = {
    'lib/participationSecurity': `export const ensureParticipationClearance=async()=>{window.__cryptoSupportChallenge=(window.__cryptoSupportChallenge||0)+1;};`,
  };
  await writeFile(resolve(out, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/@fs/' + fixture + '/entry.jsx"></script></body></html>');
  const server = await createServer({
    configFile: false, envDir: out, root: out, cacheDir: resolve(out, 'cache'), publicDir: false,
    plugins: [{ name: 'crypto-support-isolated-io', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer) return;
        const actual = source.startsWith('.') ? resolve(dirname(importer.split('?')[0]), source) : source;
        for (const name of Object.keys(modules)) {
          const target = resolve(web, 'src', name);
          if ([target, target + '.ts', target + '.tsx'].includes(actual)) return '\0crypto-support:' + name;
        }
      },
      load(id) { if (id.startsWith('\0crypto-support:')) return modules[id.slice(16)]; },
    }, react()],
    resolve: { alias: { ...Object.fromEntries(['react', 'react-dom', 'react-router-dom'].map(name => [name, resolve(web, 'node_modules', name)])), qrcode: resolve(web, 'node_modules/qrcode/lib/browser.js') } },
    css: { postcss: { plugins: [tailwindcss({ ...tailwindConfig, content: [resolve(web, 'src/**/*.{ts,tsx}'), resolve(fixture, '*.jsx')] })] } },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react-dom/client', 'qrcode'] },
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [out, fixture, resolve(web, 'src'), resolve(web, 'node_modules')] } },
  });
  try { await server.listen(); } catch (error) { await server.close(); await rm(out, { recursive: true, force: true }); throw error; }
  return { origin: `http://127.0.0.1:${server.httpServer.address().port}`,
    close: async () => { await server.close(); await rm(out, { recursive: true, force: true }); },
  };
}
