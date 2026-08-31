# Frontend environment separation

## Local development and browser tests

- Store local-only frontend values in `apps/web/.env.local`.
- `VITE_SUPABASE_URL` must use `localhost`, `127.0.0.1`, or `::1`.
- Use the local Supabase public key, `VITE_PUBLIC_DATA_PROVIDER=published`, and `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- `npm --prefix apps/web run dev` and `npm --prefix apps/web run test:browser` run the local environment guard first; invalid or legacy provider modes stop instead of silently showing mock data.
- An explicit production environment override causes the local guard to fail.

## Production Cloudflare Pages builds

- Production values are managed by Cloudflare Pages. Do not copy them into `.env.local` or commit them.
- `VITE_SUPABASE_URL` must be a non-local HTTPS URL.
- Frontend credentials must use the public anon key, never a service-role key.
- Use `VITE_PUBLIC_DATA_PROVIDER=published` and `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- Set the Pages root directory to `apps/web`, build command to `npm run check:production-env && npm run build`, and output directory to `dist`.
- A missing environment or a loopback Supabase URL stops the build.
- The `_headers` file in `apps/web/public` is copied into the deployment output.

## Participation proof v2 deployment order

Deploy the Cloudflare Worker first. It sends both the legacy HMAC header and the
body-bound v2 signature, so the currently deployed database continues to accept
writes. Apply `20260830184447_harden_participation_proxy_proofs.sql` only after
the Worker is live; the migration then requires v2 and consumes each request ID
once. Reversing these two steps temporarily rejects all participation writes.

## Production smoke

Set `PLAYWRIGHT_BASE_URL` to the deployed HTTPS URL and provide the same public production Supabase environment used for the build. Then run:

```bash
npm --prefix apps/web run test:browser:production
```

The production smoke suite does not start a local server. It verifies critical
routes, real People and election data, search, the configured Supabase origin,
CSP/HSTS response headers, the homepage RPC latency threshold, and the absence of
Supabase request failures. Treat any failure as a deployment hold or rollback gate.
