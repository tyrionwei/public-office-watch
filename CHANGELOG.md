# Changelog

## Unreleased

### Changed

- Assembled the reviewed published adapter and bridge into a complete local-only public data provider.
- Added an explicit development flag, atomic snapshot refresh, retry-safe fallback, and bounded cache updates.
- Added local Supabase schema exposure and exact read-only seed grants without changing production migrations.
- Enabled the published provider for production only behind its explicit feature flag and retained the legacy provider as the rollback path.
- Added a bounded ranked-search RPC so address matches cannot starve visible title matches.

### Verification

- Added provider assembly, local/production environment guard, region resolution, and dual-provider failure injection coverage.
- Passed all 54 read-contract tests and all 7 browser smoke tests with the published provider active against local Supabase.
- Added exact production published grants, public API verification, capacity checks, and rollback-tested production smoke coverage.

## 1.1.2 — 2026-07-28

### Fixed

- Stopped the People index from issuing a redundant candidate-history query for every visible row.
- Distinguished People query failures from valid empty results and added an explicit retry action.
- Made public-view readiness checks fail on query errors instead of reporting a false pass.

### Safety and verification

- Required local browser tests to use a loopback Supabase URL.
- Required Sites production builds and production smoke tests to use a non-local HTTPS Supabase URL.
- Added separate production-route smoke coverage without reusing the local Playwright server.
- Added deployment-environment documentation and regression coverage for the environment guards.

## 1.1.1 — 2026-07-28

### Fixed

- Restored the People index to the indexed materialized read surface.
- Removed the per-row party-only filter that caused the production People request to exceed the statement timeout.
- Added browser coverage requiring the People page to return at least one public profile.

## 1.1.0 — 2026-07-28

### Changed

- Added the private, storage-bounded `published` read layer and atomic promote pipeline.
- Preserved lower-level election data while moving high-frequency reads to compact published surfaces.
- Bounded home, region, election, race, people, profile, local-office, search, and party read contracts.
- Replaced unbounded whole-election detail downloads with bounded event pages and race detail reads.
- Added deterministic ordering, fixed row ceilings, and fail-closed sentinel checks to published adapters.
- Added production query-plan, capacity, parity, and exposure validation documents.
- Updated browser smoke contracts for current English navigation, WebP region artwork, and asynchronous election loading.
- Refreshed compatible locked dependencies without forcing a Vite major upgrade.

### Performance highlights

- Default production people directory: 556.201 ms to 2.010 ms.
- Production search: 382.323 ms to 70.338 ms.
- Largest measured event race page: 78.017 ms to 31.063 ms for the bounded replacement.
- Local-office summary: about 77 ms across two broad pages to 10.663 ms in one bounded read.
- Largest party-officer roster: 15.345 ms to 0.264 ms through the existing published snapshot.
- Removed the legacy candidate query that returned 20,853 rows, transferred about 20.5 MB, and took 1.689 seconds.

### Safety and rollout

- The `published` schema remains private and absent from the PostgREST public schema list.
- No `anon` or `authenticated` grants are enabled for `published`.
- The runtime provider factory does not register or activate the private published adapter.
- Production provider environment values remain unchanged in this release.
- Published-provider exposure and cutover require a separate reviewed release.

### Known non-blocking items

- The existing `SelectedRegionHud.tsx` direct mock-data import warning remains unchanged.
- npm audit still reports development-tool advisories for Vite/ESLint dependencies and a React Router RSC advisory. The deployed site is a static SPA: it does not expose the Vite development server, React Server Components, SSR actions, or server action endpoints. Major toolchain upgrades remain a separate task.
