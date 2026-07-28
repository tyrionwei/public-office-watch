# Frontend environment separation

## Local development and browser tests

- Store local-only frontend values in `apps/web/.env.local`.
- `VITE_SUPABASE_URL` must use `localhost`, `127.0.0.1`, or `::1`.
- Use the local Supabase anon key, `VITE_PUBLIC_DATA_PROVIDER=supabase`, and `VITE_ENABLE_SUPABASE_PROVIDER=true`.
- `npm --prefix apps/web run test:browser` runs the local environment guard before Playwright.
- An explicit production environment override causes the local guard to fail.

## Production Sites builds

- Production values are managed by Sites. Do not copy them into `.env.local` or commit them.
- `VITE_SUPABASE_URL` must be a non-local HTTPS URL.
- Frontend credentials must use the public anon key, never a service-role key.
- `npm --prefix apps/web run build:sites` validates the production environment before cleaning or building `dist`.
- A missing environment or a loopback Supabase URL stops the build.

## Production smoke

Set `PLAYWRIGHT_BASE_URL` to the deployed HTTPS URL and provide the same public production Supabase environment used for the build. Then run:

```bash
npm --prefix apps/web run test:browser:production
```

The production smoke suite does not start a local server. It verifies critical routes, real People and election data, search, the configured Supabase origin, and the absence of Supabase request failures.
