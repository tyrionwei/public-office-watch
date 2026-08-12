# Cloudflare Pages production enable plan

## Status

- Production deployment is not performed by this document.
- Production must use the reviewed `published` provider. The legacy public-schema provider is retired.
- Development-only review routes remain excluded from production builds.

## Cloudflare Pages build

Configure the Pages project with:

- Root directory: `apps/web`
- Build command: `npm run check:production-env && npm run build`
- Output directory: `dist`
- Production branch: the protected release branch

The production environment may contain only:

  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SITE_URL=https://<production-domain>`
  - `VITE_PUBLIC_DATA_PROVIDER=published`
  - `VITE_ENABLE_PUBLISHED_PROVIDER=true`

Never configure a service-role key, database connection string, or copied `.env.local` in Pages.

## Required checks before release

- `npm test`
- `npm audit` at the repository root and in `apps/web`
- `npm --prefix apps/web run check:production-env`
- `npm --prefix apps/web run check:published-exposure`
- Local Supabase security advisor reports no warnings
- Anonymous reads of legacy `public_*` views and RPCs are rejected
- Raw, staging, review, and service-only objects remain unreadable with the public key
- Production smoke covers home, People, elections, search, chat reads, feedback, and region issues
- Preview deployments are protected with Cloudflare Access
- `/internal/*` is protected with Cloudflare Access and tested with the Supabase magic-link flow
- The generated `_headers` file is present in `dist`

## Rollback

Use Cloudflare Pages deployment rollback to restore the immediately previous verified artifact. Do not switch production back to the legacy provider or publish mock data as a rollback.

After rollback, repeat the production smoke suite. Database security migrations are additive and should remain in place unless a separate reviewed database rollback is prepared.

See `docs/cloudflare-production-security.md` for dashboard settings and residual architecture risks.
