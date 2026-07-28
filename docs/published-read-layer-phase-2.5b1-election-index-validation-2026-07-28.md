# Published read layer Phase 2.5B1 election index validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Add private, injectable reads for the election index and event filter facets.
- Review, but do not approve, the large-event race-page query.
- Do not register the bridge, expose the schema, add grants, add database objects, or change production state.

## Bounded contracts

The election index reads at most 500 elections, ordered newest first with stable name and ID tie-breakers. Only those election IDs are used to fetch race summaries, in batches of at most 200 IDs and at most one summary row per election.

Facet requests:

- trim, de-duplicate, and cap the input at the same 500 election IDs;
- query at most 200 election IDs per request;
- request at most 1,000 facet rows per batch;
- use an exact count and fail instead of silently returning a truncated filter set.

Every request selects explicit columns and uses deterministic ordering. The bridge maps the rows directly into the existing `PublicElectionIndexData` and `PublicElectionRaceFacet[]` contracts.

`published.event_summaries` is not part of the adapter. Its eight rows do not contain the per-election status, type, date, and source metadata required by the current UI, so using it would require either a broader materialized view or a page-contract rewrite without removing the underlying election reads.

## Local query-plan results

The local relations contained:

- 450 elections;
- 421 race summaries;
- 716 race facets;
- 8 event summaries;
- 18,286 races.

Representative `EXPLAIN (ANALYZE, BUFFERS)` results:

| Query | Execution time |
| --- | ---: |
| Election index, 450 returned | 2.395 ms |
| Race summaries, 200-ID batch | 0.301 ms |
| Race facets, 200-ID batch | 0.198 ms |

These queries did not spill to temporary files. The small summary and facet materialized views used bounded in-memory scans and sorts.

## Deferred race-page finding

The representative 2018 local-election page used the largest facet (`village_chief`, `新北市`, 1,030 races):

| Operation | Execution time | Shared buffers |
| --- | ---: | ---: |
| Fetch page 2, 20 rows | 33.878 ms | 56,179 |
| Exact filtered count | 28.300 ms | 56,176 |
| Combined database work | 62.178 ms | 112,355 |

`published.races` remains a security-barrier view over the complex canonical race projection. Filtering by computed `event_key` and `region_key` still walks thousands of race, merge-decision, election, and region rows. This is not an acceptable high-frequency published endpoint even though the returned page is small.

A compact physical event-race row would average about 262 bytes and contain about 4,672 KiB of row payload for the current 18,286 races. Heap overhead, indexes, and refresh-time duplication are additional. The existing production-shadow capacity review leaves only about 12.2 MiB of projected promote-peak headroom and explicitly prohibits another physical race-list surface under the current refresh design.

Therefore Phase 2.5B1 does not implement or bridge `loadElectionRacePage`. Adding a test-backed method around the current view would make an unsafe path appear release-ready.

## Verification

The adapter and bridge tests first failed for the missing index/facet methods, then passed after implementation. The final repository check covers:

- 12 data-report tests;
- 17 read-contract, adapter, and bridge tests;
- ESLint and the production TypeScript/Vite build;
- public-data, published-exposure, and public-view boundary checks.

The existing unrelated `SelectedRegionHud.tsx` direct-mock-import warning remains unchanged.

## Decision and next gate

Commit the election index and facet path as Phase 2.5B1, still private and unregistered. Keep the event race page on the legacy provider.

Before a published race-page adapter can be added, redesign promotion so a compact race-list surface does not violate the 10 MiB peak-headroom gate. Acceptable directions include reclaiming storage from existing shadow surfaces or replacing a duplicating refresh step; purchasing more capacity was already declined. Re-run the large-event page and count plans after that design change.
