# Changelog

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
