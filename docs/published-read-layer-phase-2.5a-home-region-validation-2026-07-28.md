# Published read layer Phase 2.5A home and region validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Add private, injectable published reads for the home and region page contracts.
- Reuse the existing `home_ticker`, `home_region_summary`, `regions`, and `races` surfaces.
- Do not register the bridge in the runtime provider, expose the schema, add grants, add migrations, or change production state.

## Bounded query contracts

The home read performs four independent requests:

- nearest ticker: 1 row;
- top-level regions: at most 32 rows;
- home region summaries: at most 32 rows;
- active/upcoming races: at most 24 rows.

The region read accepts one normalized region slug and requests:

- target region: at most 1 row;
- target summary: at most 1 row;
- direct child regions: at most 64 rows;
- active/upcoming races for that region: at most 24 rows.

All requests select explicit columns and use deterministic ordering. Empty slugs return without querying. A valid region without a current election summary still maps to a usable frontend fallback instead of hiding lower administrative levels.

## Local query-plan validation

The local published relations contained 1 ticker row, 22 home-region summaries, 36,090 regions, and 18,286 races. The exact adapter query shapes were run with `EXPLAIN (ANALYZE, BUFFERS)`:

| Query | Execution time |
| --- | ---: |
| Home ticker | 0.060 ms |
| Home region summaries | 0.299 ms |
| Home top-level regions | 0.193 ms |
| Home upcoming races | 6.103 ms |
| Region by slug | 0.210 ms |
| Region summary by slug | 0.020 ms |
| Region upcoming races | 0.561 ms |
| Direct child regions | 0.117 ms |

There was no temporary-file spill. Region type, slug, parent, and race-region lookups used existing indexes. The small materialized summaries used sequential scans over 1 or 22 rows, which is appropriate.

The home race read used the existing security-barrier `published.races` view and touched 4,819 shared buffers locally. Its 6.103 ms result does not justify another materialized view yet, but the identical plan must be measured in production before exposure. If production latency or load is unacceptable, the next narrow option is a bounded `home_upcoming_races` materialized view rather than duplicating the full races surface.

## Frontend mapping

The bridge now maps the private rows into the existing `HomePageData` contract and a region-page contract containing:

- the stage region node;
- the election summary and region card;
- direct child stage regions;
- related upcoming races.

The bridge remains absent from the provider factory and production bundle path. Its static data-principle copy explicitly describes the reviewed published boundary.

## Verification

The adapter and bridge tests first failed for the missing methods, then passed after implementation. The repository check completed successfully with:

- 12 data-report tests;
- 14 read-contract, adapter, and bridge tests;
- ESLint and the production TypeScript/Vite build;
- public-data, published-exposure, and public-view boundary checks.

The existing unrelated `SelectedRegionHud.tsx` direct-mock-import warning remains unchanged.

## Decision

Phase 2.5A is ready as an isolated frontend contract. Lower administrative levels remain eligible: they are loaded only through a requested region and bounded direct-child/race queries.

Continue with election/event read contracts before any PostgREST exposure or runtime provider registration. Re-run this phase's SQL against production as part of the eventual exposure gate.
