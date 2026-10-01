import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

export async function startPersonClaimFixture() {
  const web = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const out = await mkdtemp(resolve(tmpdir(), 'pow-person-claim-'));
  const server = await createServer({
    configFile: false, envDir: out, root: web, cacheDir: resolve(out, 'cache'),
    plugins: [react()],
    define: {
      'import.meta.env.VITE_PUBLIC_DATA_PROVIDER': JSON.stringify('mock'),
      'import.meta.env.VITE_ENABLE_PUBLISHED_PROVIDER': JSON.stringify('false'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
    },
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  try { await server.listen(); } catch (error) {
    await server.close();
    await rm(out, { recursive: true, force: true });
    throw error;
  }
  return {
    origin: `http://127.0.0.1:${server.httpServer.address().port}`,
    async close() { await server.close(); await rm(out, { recursive: true, force: true }); },
  };
}
