# Frontend environment separation

## Local development and browser tests

- Store local-only frontend values in `apps/web/.env.local`.
- `VITE_SUPABASE_URL` must use `localhost`, `127.0.0.1`, or `::1`.
- Use the local Supabase public key, `VITE_PUBLIC_DATA_PROVIDER=published`, and `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- `npm --prefix apps/web run dev` and `npm --prefix apps/web run test:browser` run the local environment guard first; invalid or legacy provider modes stop instead of silently showing mock data.
- An explicit production environment override causes the local guard to fail.

## Production Cloudflare Worker releases

- Production values are stored in the GitHub `production` environment. Do not copy them into `.env.local` or commit them.
- Variables: `VITE_SUPABASE_URL`, `VITE_TURNSTILE_SITE_KEY`, and `SUPABASE_PROJECT_REF`.
- Secrets: `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`.
- Frontend credentials must use the public anon key, never a service-role key.
- The manual `Production Release` workflow only runs from `main`. It checks production migration drift, runs contracts and lint, builds and validates the Worker bundle, deploys it, then runs the production browser and SEO smoke suite.
- The release workflow does not apply migrations. Review and apply pending migrations separately before starting it; any remaining drift blocks deployment.
- The Worker build uses `VITE_PUBLIC_DATA_PROVIDER=published`, `VITE_ENABLE_PUBLISHED_PROVIDER=true`, and `npm run build:cloudflare`.

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
