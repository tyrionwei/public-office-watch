# Published read layer provider assembly — 2026-07-28

## Status

Local provider assembly and browser validation are complete. Production schema exposure, frontend grants, environment cutover, and legacy grant revocation are intentionally not included in this change.

## What changed

- Added a complete `PublicDataProvider` assembly backed by the reviewed `PublishedReadAdapter` and `PublishedPublicDataBridge` contracts.
- Added a distinct `VITE_PUBLIC_DATA_PROVIDER=published` mode.
- Restricted that mode to Vite development builds with `VITE_ENABLE_PUBLISHED_PROVIDER=true`.
- Kept snapshot replacement atomic: a failed refresh leaves the last complete snapshot active and can be retried.
- Added bounded cache updates for elections, race pages, race details, people pages, person profiles, local-office summaries, and party data.
- Added region-label resolution learned from the published home snapshot, including `台` / `臺` district variants.
- Exposed `published` only in the local Supabase CLI config.
- Added exact local seed grants for the reviewed relations and read functions. Production migrations continue to revoke all `anon` and `authenticated` access.

## Local validation mode

Use only with the local Supabase URL and local anon key:

```text
VITE_PUBLIC_DATA_PROVIDER=published
VITE_ENABLE_PUBLISHED_PROVIDER=true
```

After changing `supabase/config.toml`, restart the local stack so PostgREST reloads the exposed schema list. A fresh `supabase db reset --local` applies `supabase/seed.sql`; an existing local stack may apply that seed directly to its local database. Never use a service-role key in the browser.

Run:

```text
npm --prefix apps/web run check:local-test-env
npm --prefix apps/web run test:read-contracts
npm --prefix apps/web run lint
npm --prefix apps/web run build
npm --prefix apps/web run check:published-exposure
VITE_PUBLIC_DATA_PROVIDER=published VITE_ENABLE_PUBLISHED_PROVIDER=true npm --prefix apps/web run test:browser
```

## Verified results

- Read-contract tests: 54 passed.
- Published-mode browser smoke: 7 passed.
- TypeScript and production Vite build: passed.
- ESLint: passed.
- Published exposure boundary: passed.
- Existing public-view and public-data boundary checks: passed, with only the pre-existing `SelectedRegionHud.tsx` mock import warning.

The browser suite covered the public shell, horizontal overflow, People results, all county/city highlights, legacy election redirects, People failure/retry behavior, election event grouping, and race navigation while the published provider was active.

## Safety boundary

- `supabase/config.toml` controls the local Supabase stack.
- No migration grants `published` access to `anon` or `authenticated`.
- The production environment validator rejects `VITE_PUBLIC_DATA_PROVIDER=published`.
- The runtime factory additionally requires `import.meta.env.DEV` and the explicit published flag.
- The default environment examples remain on `supabase` or `mock`; published mode is never selected by default.
- Promote remains service-role only and is not granted by the local seed.

## Remaining production cutover

A separate approved release must complete all of the following:

1. Re-check production database size and promote peak headroom.
2. Configure the hosted PostgREST schema allowlist to expose `published`.
3. Apply an exact production grant migration for the reviewed relations and read functions only.
4. Change the production guard so the published provider can run outside `DEV` only behind its explicit flag.
5. Switch the production provider environment value and run route smoke tests.
6. Monitor errors, timeouts, response time, and data parity while retaining the legacy provider flag as rollback.
7. Revoke legacy public-view grants only after the monitoring window succeeds.

The physical race-list surface remains deferred under the current storage limit. The provider continues to use the bounded `election_race_page` function and does not claim an additional race-list storage optimization.
