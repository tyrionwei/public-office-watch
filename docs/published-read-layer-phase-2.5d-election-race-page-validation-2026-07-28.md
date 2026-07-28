# Published read layer Phase 2.5D election race page validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Replace the event page's expensive filtered view page plus exact-count pair with one bounded read.
- Preserve the existing 20-row page, exact total, filters, and deterministic order.
- Add no physical table, materialized view, index, or duplicated race data.
- Keep the published schema private and the bridge unregistered.

## Chosen approach

A physical race snapshot or new index was not added because the production-shadow promote estimate has only about 12.2 MiB of headroom. The bounded `published.election_race_page(...)` function instead starts from at most 500 requested election IDs, validates that each belongs to the requested event, and pushes race-type and region filters into the core lookup.

The query materializes only narrow sort keys for matching races. After counting and selecting the requested page, it joins full election, race, and region data for at most 20 rows. This avoids expanding the complete canonical race view twice for the page and exact count.

Server limits are:

- at most 500 unique election IDs;
- at most 32 race types;
- event keys up to 120 characters and region keys up to 100;
- pages 1–10,000;
- page sizes 1–20.

The function is `SECURITY DEFINER` with a fixed search path. Execution is revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role` during this private phase.

## Equivalence

Three representative comparisons against `public_election_race_list` matched both exact totals and ordered page IDs:

| Case | Existing total | Function total | Ordered page |
| --- | ---: | ---: | --- |
| 2018 village chief / New Taipei | 1,030 | 1,030 | exact |
| 2022 village chief / all regions | 7,748 | 7,748 | exact |
| 2022 all race types / all regions | 8,869 | 8,869 | exact |

An exhaustive total comparison covered all 342 existing `(event, race type, region)` groups and found zero mismatches.

## Performance

Local measurements used warm shared buffers and include the exact total plus the 20-row page:

| Case | Existing page + count | New function | Existing buffers | New buffers |
| --- | ---: | ---: | ---: | ---: |
| 2018 village chief / New Taipei | 62.178 ms | 11.986 ms | 112,355 | 25,974 |
| 2022 village chief / all regions | 78.017 ms | 31.063 ms | 114,897 | 41,450 |

The representative region filter is about 5.2 times faster. The largest type across all regions is about 2.5 times faster and removes the duplicated page/count expansion. No temporary-file I/O or persistent storage was added.

## Adapter and boundary verification

The frontend adapter:

- de-duplicates IDs and filters;
- rejects more than 500 election IDs before querying;
- normalizes invalid page sizes to the existing 20-row public contract;
- performs one RPC and fails closed on malformed, oversized, or database-error responses;
- maps directly to the existing `PublicRaceListPage` contract through the private bridge.

Local verification confirmed:

- 27 read-contract tests pass;
- `anon` execute: false;
- `authenticated` execute: false;
- `service_role` execute: true;
- a page size above 20 and a null page are rejected server-side;
- the reviewed exposure allowlist includes the function while `published` remains unexposed.

## Decision and next gate

Phase 2.5D resolves the filtered event/race pagination bottleneck without using scarce database capacity. The function and bridge remain private until the later exposure phase validates production grants, PostgREST schema configuration, runtime fallback, and browser measurements together.

The remaining severe read is the full election detail graph, especially its candidate expansion. It should be measured and split into bounded election core, race summary, and per-race candidate reads before any storage-heavy snapshot is considered.
