import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

import { handleParticipationRequest } from '../worker/participation.ts';

type EnvMap = Record<string, string>;
type DevRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array | string>;
};
type DevResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: Uint8Array): void;
};

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, ''),
        ];
      }),
  );
}

class LocalRateLimiter {
  private readonly entries = new Map<string, number[]>();

  constructor(private readonly limitCount: number) {}

  async limit({ key }: { key: string }) {
    const cutoff = Date.now() - 60_000;
    const recent = (this.entries.get(key) ?? []).filter((value) => value > cutoff);
    if (recent.length >= this.limitCount) return { success: false };
    recent.push(Date.now());
    this.entries.set(key, recent);
    return { success: true };
  }
}

function requireValue(env: EnvMap, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Local participation proxy requires ${name} in apps/web/.dev.vars.`);
  return value;
}

async function requestBody(request: DevRequest) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function toWebRequest(request: DevRequest, body: Uint8Array) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(','));
    else if (value !== undefined) headers.set(name, value);
  }
  if (!headers.has('cf-connecting-ip') && request.socket.remoteAddress) {
    headers.set('cf-connecting-ip', request.socket.remoteAddress);
  }
  const origin = `http://${headers.get('host') ?? '127.0.0.1:5173'}`;
  return new Request(new URL(request.url ?? '/', origin), {
    method: request.method,
    headers,
    body,
  });
}

async function writeWebResponse(response: Response, target: DevResponse) {
  target.statusCode = response.status;
  response.headers.forEach((value, name) => target.setHeader(name, value));
  target.end(Buffer.from(await response.arrayBuffer()));
}

export function participationDevProxyPlugin(): Plugin {
  const webRoot = path.resolve(__dirname, '..');

  return {
    name: 'participation-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      const values = {
        ...parseEnvFile(path.join(webRoot, '.env.local')),
        ...parseEnvFile(path.join(webRoot, '.dev.vars')),
        ...process.env,
      };
      const env = {
        SUPABASE_URL: requireValue(values, 'SUPABASE_URL'),
        SUPABASE_ANON_KEY: requireValue(values, 'SUPABASE_ANON_KEY'),
        TURNSTILE_SECRET_KEY: requireValue(values, 'TURNSTILE_SECRET_KEY'),
        PARTICIPATION_CLEARANCE_KEY: requireValue(values, 'PARTICIPATION_CLEARANCE_KEY'),
        PARTICIPATION_PROXY_HMAC_KEY: requireValue(values, 'PARTICIPATION_PROXY_HMAC_KEY'),
        PARTICIPATION_IP_HMAC_KEY: requireValue(values, 'PARTICIPATION_IP_HMAC_KEY'),
        PARTICIPATION_USER_RATE_LIMITER: new LocalRateLimiter(12),
        PARTICIPATION_IP_RATE_LIMITER: new LocalRateLimiter(120),
      };
      server.middlewares.use(async (request, response, next) => {
        if (!(request as DevRequest).url?.startsWith('/api/participation/')) {
          next();
          return;
        }
        const body = await requestBody(request as DevRequest);
        const result = await handleParticipationRequest(toWebRequest(request as DevRequest, body), env);
        await writeWebResponse(result, response as DevResponse);
      });
    },
  };
}
