import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config.js';

export async function startBirthDateFixture() {
  const fixture = dirname(fileURLToPath(import.meta.url));
  const web = resolve(fixture, '../../..');
  const out = await mkdtemp(resolve(tmpdir(), 'pow-birth-date-'));
  let settings, flags, writes;
  const reset = () => { settings = { birth_date_year_only: false, revision: 0, updated_at: '2026-09-09T00:00:00Z' }; flags = {}; writes = []; };
  reset();
  const modules = {
    'components/AppShell': `import React from 'react';export const AppShell=({children})=>React.createElement('main',{className:'mx-auto max-w-6xl p-4'},children);`,
    'components/PersonFeedbackPanel': `export const PersonFeedbackPanel=()=>null;`,
    'components/PlatformFulfillmentList': `export const PlatformFulfillmentList=()=>null;`,
    'lib/publicDataProviderFactory': `export const refreshConfiguredPublicDataProvider=async()=>{};`,
    'lib/publicData': `export const publicDataProvider={loadPersonProfiles:async()=>{},getPersonProfile:()=>window.__birthdayProfile};`,
    'lib/supabaseEnv': `export const getPublicDataProviderMode=()=> 'published';export const getSupabasePublicEnv=()=>null;`,
    'lib/supabasePublicClient': `const authMode=()=>new URLSearchParams(location.search).get('auth')??'admin';
      const admin={auth:{getSession:async()=>({data:{session:authMode()==='signed-out'?null:{user:{is_anonymous:authMode()==='anonymous'}}},error:null}),signOut:async()=>({error:null})},
        functions:{invoke:async(_name,{body})=>{const response=await fetch('/__birthday/admin',{method:'POST',headers:{'content-type':'application/json','x-fixture-auth':authMode()},body:JSON.stringify(body)});
          return response.ok?{data:await response.json(),error:null}:{data:null,error:{context:response}};}}};
      export const getSupabaseChatAdminClient=()=>admin;
      export const getSupabasePublicClient=()=>({from:()=>({select:()=>({eq:()=>({single:async()=>{
        const response=await fetch('/__birthday/settings');return response.ok?{data:await response.json(),error:null}:{data:null,error:new Error('settings failed')};}})})})});`,
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
      configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__birthday/')) return next();
        const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
        if (req.url === '/__birthday/settings') return send(flags.failPublic ? 503 : 200, settings);
        if (req.headers['x-fixture-auth'] !== 'admin') return send(403, { error: 'PUBLIC_UPDATE_ADMIN_FORBIDDEN' });
        let body = ''; for await (const chunk of req) body += chunk;
        const payload = JSON.parse(body);
        if (payload.action === 'dashboard') return send(200, { adminEmail: 'admin@example.test', events: [], actions: [] });
        if (payload.action === 'display-settings') return send(flags.failAdminLoad ? 503 : 200, { settings });
        if (payload.action === 'set-birth-date-display') {
          writes.push(payload);
          if (flags.saveDelay) await new Promise(resolve => setTimeout(resolve, flags.saveDelay));
          if (flags.failSave === 'before') return send(503, { error: 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR' });
          if (payload.expectedRevision !== settings.revision) return send(409, { error: 'PUBLIC_UPDATE_ADMIN_DISPLAY_CONFLICT' });
          settings = { birth_date_year_only: payload.yearOnly, revision: settings.revision + 1, updated_at: new Date().toISOString() };
          if (flags.failSave === 'after') return send(503, { error: 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR' });
          return send(200, { settings });
        }
        return send(400, { error: 'UNKNOWN_FIXTURE_ACTION' });
      }); },
    }, react()],
    resolve: { alias: Object.fromEntries(['react', 'react-dom', 'react-router-dom'].map(name => [name, resolve(web, 'node_modules', name)])) },
    css: { postcss: { plugins: [tailwindcss({ ...tailwindConfig, content: [resolve(web, 'src/**/*.{ts,tsx}'), resolve(fixture, '*.jsx')] })] } },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom'] },
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [out, fixture, resolve(web, 'src'), resolve(web, 'node_modules')] } },
  });
  try { await server.listen(); } catch (error) { await server.close(); await rm(out, { recursive: true, force: true }); throw error; }
  return { origin: `http://127.0.0.1:${server.httpServer.address().port}`, reset,
    configure: changes => Object.assign(flags, changes),
    setSettings: changes => Object.assign(settings, changes),
    snapshot: () => structuredClone({ settings, writes }),
    close: async () => { await server.close(); await rm(out, { recursive: true, force: true }); },
  };
}
