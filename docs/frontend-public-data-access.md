# Frontend Public Data Access

## Current provider

Production and normal local development use the reviewed `published` provider.
`mockPublicDataProvider` remains only as a safe fallback and test fixture when the
published provider is not configured.

Pages and components must read through `publicDataProvider`. Direct Supabase
queries belong in the published adapter layer, not in page components.

## Local configuration

```bash
cp apps/web/.env.example apps/web/.env.local
```

Use only the local URL and anon／publishable key reported by local Supabase:

```text
VITE_PUBLIC_DATA_PROVIDER=published
VITE_ENABLE_PUBLISHED_PROVIDER=true
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local public key>
```

Do not place a service role key, database password or production value in a
frontend environment file.

## Public boundary

The browser may query only the reviewed `published` schema objects used by
`apps/web/src/lib/publishedReadAdapter.ts`. The authoritative allowlist and
shape checks are the adapter, migrations and these commands:

```bash
npm --prefix apps/web run check:data-boundary
npm --prefix apps/web run check:published-exposure
npm --prefix apps/web run check:public-view-contracts
npm --prefix apps/web run test:read-contracts
```

Do not duplicate a static table list in this document; it becomes stale whenever a
reviewed public view is added.

The browser must never read raw sources, staging tables, review queues, unpublished
claims, identity candidates, private monitoring artifacts or service-only objects.
Legacy `public_*` views and RPCs are not a rollback path.

## Production boundary

- Production must use `VITE_PUBLIC_DATA_PROVIDER=published` and the explicit enable flag.
- Only publishable／anon credentials may be exposed to the browser.
- Internal review routes remain unavailable in public builds.
- Administrative routes require their existing Supabase authorization and
  Cloudflare Access defense in depth.
- Missing or failed public reads must use a safe empty state; they must not fall
  back to unpublished data.
