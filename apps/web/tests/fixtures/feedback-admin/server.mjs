import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config.js';

export async function startFeedbackFixture() {
  const fixture = dirname(fileURLToPath(import.meta.url));
  const web = resolve(fixture, '../../..');
  const out = await mkdtemp(resolve(tmpdir(), 'pow-feedback-'));
  const modules = {
    'lib/supabaseEnv': `export const getSupabasePublicEnv=()=>({url:'http://127.0.0.1:54321',anonKey:'synthetic'});`,
    'components/AppShell': `import React from 'react';export const AppShell=({children})=>React.createElement('main',{className:'mx-auto max-w-6xl p-4'},children);`,
    'lib/supabasePublicClient': `
      const listeners = new Set();
      const makeSession = (id='admin',sid='session-one',version=1) => ({ user: { id, is_anonymous: false }, access_token: 'fixture.'+btoa(JSON.stringify({ sub:id,session_id:sid,iat:version }))+'.fixture' });
      let session = new URLSearchParams(location.search).get('auth') === 'signed-out' ? null : makeSession();
      window.__feedbackAuth = (event='SIGNED_IN',id='admin',sid='session-one',version=1) => { session = event === 'SIGNED_OUT' ? null : makeSession(id,sid,version); for (const listener of listeners) listener(event,session); };
      window.__feedbackSignOut = () => window.__feedbackAuth('SIGNED_OUT');
      const client = {
        auth: {
          getSession: async () => ({ data: { session } }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: listener => { listeners.add(listener); return { data: { subscription: { unsubscribe() { listeners.delete(listener); } } } }; },
        },
        functions: { invoke: async (_name, { body }) => {
          const response = await fetch('/__feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          return response.ok ? { data: await response.json(), error: null } : { data: null, error: { context: response } };
        } },
      };
      export const getSupabaseChatAdminClient = () => client;
    `,

  };
  await writeFile(resolve(out, 'index.html'), `<!doctype html><html><body><div id="root"></div><script type="module" src="/@fs/${fixture}/entry.jsx"></script></body></html>`);
  const server = await createServer({ configFile: false, envDir: out, root: out, cacheDir: resolve(out, 'cache'), publicDir: false,
    plugins: [{ name: 'birthday-isolated-services', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer) return;
        const actual = source.startsWith('.') ? resolve(dirname(importer.split('?')[0]), source) : source;
        for (const name of Object.keys(modules)) {
          const target = resolve(web, 'src', name);
          if ([target, target + '.ts', target + '.tsx'].includes(actual)) return '\0birthday:' + name;
        }
      },
      load(id) { if (id.startsWith('\0birthday:')) return modules[id.slice(10)]; },
    }, react()],
    resolve: { alias: Object.fromEntries(['react', 'react-dom', 'react-router-dom'].map(name => [name, resolve(web, 'node_modules', name)])) },
    css: { postcss: { plugins: [tailwindcss({ ...tailwindConfig, content: [resolve(web, 'src/**/*.{ts,tsx}'), resolve(fixture, '*.jsx')] })] } },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom'] },
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [out, fixture, resolve(web, 'src'), resolve(web, 'node_modules')] } },
  });
  try { await server.listen(); } catch (error) { await server.close(); await rm(out, { recursive: true, force: true }); throw error; }
  return { origin: `http://127.0.0.1:${server.httpServer.address().port}`,
    close: async () => { await server.close(); await rm(out, { recursive: true, force: true }); },
  };
}
