import fs from 'node:fs';
import https from 'node:https';
import tls from 'node:tls';

const twcaIntermediatePath = new URL(
  '../certificates/twca-secure-ssl-2023-g3.pem',
  import.meta.url,
);

const trustedCertificateAuthorities = [
  ...tls.rootCertificates,
  fs.readFileSync(twcaIntermediatePath, 'utf8'),
];

function responseHeaders(rawHeaders) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value != null) {
      headers.set(name, String(value));
    }
  }

  return headers;
}

export function fetchWithTrustedTwcaChain(url, options = {}) {
  const {
    headers = {},
    maxRedirects = 5,
    timeoutMs = 30000,
  } = options;

  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        ca: trustedCertificateAuthorities,
        headers,
        timeout: timeoutMs,
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location &&
          maxRedirects > 0
        ) {
          response.resume();
          resolve(fetchWithTrustedTwcaChain(new URL(response.headers.location, url), {
            ...options,
            maxRedirects: maxRedirects - 1,
          }));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve(new Response(Buffer.concat(chunks), {
            headers: responseHeaders(response.headers),
            status: response.statusCode ?? 500,
            statusText: response.statusMessage,
          }));
        });
      },
    );

    request.on('timeout', () => request.destroy(new Error(`GET ${url} timed out`)));
    request.on('error', reject);
  });
}
