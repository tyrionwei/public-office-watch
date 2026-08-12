# Frontend environment separation

## Local development and browser tests

- Store local-only frontend values in `apps/web/.env.local`.
- `VITE_SUPABASE_URL` must use `localhost`, `127.0.0.1`, or `::1`.
- Use the local Supabase public key, `VITE_PUBLIC_DATA_PROVIDER=published`, and `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- `npm --prefix apps/web run test:browser` runs the local environment guard before Playwright.
- An explicit production environment override causes the local guard to fail.

## Production Cloudflare Pages builds

- Production values are managed by Cloudflare Pages. Do not copy them into `.env.local` or commit them.
- `VITE_SUPABASE_URL` must be a non-local HTTPS URL.
- Frontend credentials must use the public anon key, never a service-role key.
- Use `VITE_PUBLIC_DATA_PROVIDER=published` and `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- Set the Pages root directory to `apps/web`, build command to `npm run check:production-env && npm run build`, and output directory to `dist`.
- A missing environment or a loopback Supabase URL stops the build.
- The `_headers` file in `apps/web/public` is copied into the deployment output.

## Production smoke

Set `PLAYWRIGHT_BASE_URL` to the deployed HTTPS URL and provide the same public production Supabase environment used for the build. Then run:

```bash
npm --prefix apps/web run test:browser:production
```

The production smoke suite does not start a local server. It verifies critical routes, real People and election data, search, the configured Supabase origin, and the absence of Supabase request failures.
