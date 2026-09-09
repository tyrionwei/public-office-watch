import { randomBytes, timingSafeEqual } from 'node:crypto';

export type InternalRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string; localPort?: number; encrypted?: boolean };
  on(event: 'data', listener: (chunk: Uint8Array | string) => void): void;
  on(event: 'end' | 'aborted', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
};
type InternalResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
export const internalBodyLimit = 128 * 1024;

export class InternalRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function internalErrorStatus(error: unknown) {
  return error instanceof InternalRequestError ? error.status : 500;
}

export function validateInternalSupabaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !loopbackHosts.has(url.hostname) || url.port !== '54321'
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Internal review requires the full local Supabase at http://127.0.0.1:54321.');
  }
  return url.origin;
}

export function readJsonBody(request: InternalRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let done = false;
    const chunks: Uint8Array[] = [];
    const fail = (error: Error) => {
      if (done) return;
      done = true;
      chunks.length = 0;
      reject(error);
    };
    request.on('data', (chunk: Uint8Array | string) => {
      if (done) return;
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > internalBodyLimit) {
        fail(new InternalRequestError(413, 'Request body is too large.'));
        return;
      }
      chunks.push(bytes);
    });
    request.on('end', () => {
      if (done) return;
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('Expected an object.');
        }
        done = true;
        resolve(body);
      } catch {
        fail(new InternalRequestError(400, 'Invalid JSON object.'));
      }
    });
    request.on('error', fail);
    request.on('aborted', () => fail(new InternalRequestError(400, 'Request aborted.')));
    if (Number(request.headers['content-length']) > internalBodyLimit) {
      fail(new InternalRequestError(413, 'Request body is too large.'));
    }
  });
}

// This is a local development capability, not a remotely usable admin login.
// The token exists only for this server instance and is never embedded in assets.
export function createInternalReviewGuard() {
  const token = randomBytes(32).toString('hex');
  return async (request: InternalRequest, response: InternalResponse, next: () => void) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('vary', 'Origin');
    const send = (status: number, body: unknown) => {
      response.statusCode = status;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(body));
    };
    const peer = request.socket.remoteAddress;
    if (!peer || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) {
      send(403, { error: 'Internal review requires a local connection.' });
      return;
    }
    const host = request.headers.host;
    const protocol = 'encrypted' in request.socket && request.socket.encrypted ? 'https:' : 'http:';
    let expectedOrigin: string;
    try {
      const url = new URL(`${protocol}//${host}`);
      if (typeof host !== 'string' || url.host !== host.toLowerCase() || !loopbackHosts.has(url.hostname)
        || Number(url.port || (protocol === 'https:' ? 443 : 80)) !== request.socket.localPort) {
        throw new Error('Invalid host.');
      }
      expectedOrigin = url.origin;
    } catch {
      send(403, { error: 'Internal review requires a loopback host and the server port.' });
      return;
    }
    const origin = request.headers.origin;
    const fetchSite = request.headers['sec-fetch-site'];
    if ((origin !== undefined && origin !== expectedOrigin)
      || (fetchSite !== undefined && fetchSite !== 'same-origin')
      || (request.method === 'POST' && origin !== expectedOrigin)) {
      send(403, { error: 'Internal review requires a same-origin request.' });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      send(405, { error: 'Method not allowed.' });
      return;
    }
    const contentType = request.headers['content-type'];
    if (request.method === 'POST' && (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/i.test(contentType))) {
      send(415, { error: 'Content-Type must be application/json.' });
      return;
    }
    if (Number(request.headers['content-length']) > internalBodyLimit) {
      send(413, { error: 'Request body is too large.' });
      return;
    }
    if ((request.url ?? '').split('?')[0] === '/session') {
      if (request.method !== 'POST' || request.headers['x-pow-internal-bootstrap'] !== '1') {
        send(403, { error: 'Invalid local session request.' });
        return;
      }
      try {
        await readJsonBody(request);
        send(200, { token });
      } catch (error) {
        send(internalErrorStatus(error), { error: error instanceof Error ? error.message : 'Invalid request.' });
      }
      return;
    }
    const supplied = request.headers['x-pow-internal-token'];
    if (typeof supplied !== 'string' || !/^[0-9a-f]{64}$/.test(supplied)
      || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
      send(401, { error: 'A local review session is required.' });
      return;
    }
    next();
  };
}
