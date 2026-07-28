# Published read layer production shadow validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Source commit: `e74d19e perf: compact published read layer`
- Supabase branch: `main` (`Production`), nano compute
- Deployment scope: migrations `202607260001` through `202607260009`
- No frontend cutover, PostgREST schema exposure, or `anon` / `authenticated` access was enabled.

## Capacity gate and deployment

The production database was `401,034,387` bytes (`382 MB`) before deployment, below the agreed `420 MB` compact-deployment gate. Migrations `001`–`006` increased it to `401,575,059` bytes (`383 MB`). After the compact shadow layer and initial promote, it was `431,115,411` bytes (`411 MB`).

The physical `published` relations use `29,360,128` bytes (`28 MB`). Against the Free plan's 500 MiB database allowance, the measured post-deployment headroom is `93,172,589` bytes (about `88.9 MiB`).

All nine migrations are present in `supabase_migrations.schema_migrations`. Each migration and its history row were applied in the same transaction. A first transfer attempt for migration `003` was rejected because the browser paste path corrupted UTF-8; the transaction rolled back. It was retransmitted only after its SHA-256 matched the Git file exactly, then applied successfully.

## Release validation

- Release ID: `7ec998b5-5d97-4adc-8d97-27a5d75d21f9`
- Schema version: `202607260008-compact-hybrid`
- Published at: `2026-07-28T05:41:02.445813+00:00`

Validated and actual row counts agree:

| Relation | Rows |
| --- | ---: |
| regions | 36,090 |
| elections | 450 |
| races | 18,286 |
| lower-level races | 17,276 |
| candidates / candidate facts | 42,052 |
| people | 30,934 |
| companies | 336 |
| parties | 112 |
| search documents | 67,922 |

Lower-level election data therefore remains in the published snapshot; no village or other lower-level rows were removed for this deployment.

## Access isolation

The following production checks all returned `false`:

- `anon` and `authenticated` schema `USAGE` on `published`
- `anon` and `authenticated` `SELECT` on `published.candidate_facts`
- `anon` and `authenticated` `EXECUTE` on `published.promote(uuid)`

`pgrst.db_schemas` did not include `published`. The shadow layer is not reachable through the public frontend API.

## Production query plans

The existing `docs/phase-2-published-explain.sql` suite was run twice. The second run is the warm-cache acceptance result.

| Query | First run ms | Warm run ms | Warm temp read / write blocks |
| --- | ---: | ---: | ---: |
| people directory | 2,293.874 | 556.201 | 2,736 / 2,741 |
| search `台北` | 438.768 | 382.323 | 328 / 328 |
| election races | 166.529 | 165.923 | 0 / 0 |
| event races | 386.725 | 149.173 | 0 / 0 |
| local office people | 65.169 | 6.418 | 0 / 0 |
| elections | 33.594 | 2.711 | 0 / 0 |
| home region summary | 6.547 | 2.319 | 0 / 0 |
| race candidates | 65.717 | 0.345 | 0 / 0 |
| person candidacies | 13.645 | 0.169 | 0 / 0 |
| home ticker | 1.250 | 0.081 | 0 / 0 |

The warm run had no shared reads for the four remaining slow queries, so the remaining cost is primarily CPU, repeated view expansion, and external sorting rather than cold disk I/O. People directory and search still spill temporary blocks on nano compute.

## Decision and next phase

Do not cut frontend traffic to `published` yet. Phase 2.2 should remain storage-conscious and address only the measured hot paths:

1. Add a narrow, indexed physical list surface for people directory ordering; keep the full person detail view separate.
2. Add a narrow search surface with an index that supports the actual substring and ranking query.
3. Add a narrow race list surface keyed by `event_key` and `election_id`, with the displayed ordering columns in the index.
4. Re-run the same production plan suite and re-check database size plus promote peak before considering schema exposure or frontend cutover.

The target is under 100 ms warm for all list/search routes, with no temporary block spill for people directory and search. Any additional physical layer must keep projected refresh peak below the 500 MiB allowance.

## Phase 2.2 production shadow deployment

Source commit `b7460ac perf: add storage-bounded published hot paths` was deployed to the same production branch as migration `202607280001_published_hot_path_surfaces.sql`. The migration file was transferred only after its 3,841 bytes matched Git SHA-256 `7bc18561f66de2ec390ba93d22bbd866cb6fec8de57524b56a0368a58dfae381`. Its schema changes, initial promote, and migration-history row committed atomically.

Immediately before deployment, the database was still `431,115,411` bytes. The local peak measurement projected `511,134,867` bytes during a future promote, leaving `13,153,133` bytes of headroom; this passed the agreed 10 MiB safety gate.

After deployment:

| Measurement | Bytes | Approximate size |
| --- | ---: | ---: |
| Database | 457,952,403 | 437 MB |
| All physical `published` relations | 56,098,816 | 54 MB |
| `published.people_directory` | 9,150,464 | 8.7 MiB |
| `published.search_results` | 17,317,888 | 16.5 MiB |
| Projected next-promote peak | 511,503,507 | 487.8 MiB |
| Projected next-promote headroom | 12,784,493 | 12.2 MiB |

The remaining next-promote headroom is above the gate but narrow. Every production promote must re-read the live database size and retain at least 10 MiB projected peak headroom. A physical race-list surface must not be added under the current capacity and atomic-refresh design.

Release `d0cf89d4-6167-46fe-8903-3326481ba5c7` was published at `2026-07-28T06:29:13.797429+00:00` with schema version `202607280001-people-search-surfaces`. The people directory matched its 30,934-row source; search results matched all 67,922 source documents with zero duplicate document keys. Migration `202607280001` is present in `supabase_migrations.schema_migrations`.

Access remained private after deployment:

- `anon` and `authenticated` still have no `USAGE` on `published` and no `SELECT` on the new surfaces;
- `PUBLIC` cannot execute `published.promote(uuid)`;
- `service_role` can execute only the wrapper and cannot directly execute `published.promote_compact_base(uuid)`;
- no frontend provider, PostgREST schema exposure, or legacy grant was changed.

The production plan harness completed without temporary block spill:

| Query | Execution ms | Temp read / write blocks | Decision |
| --- | ---: | ---: | --- |
| people directory default | 2.010 | 0 / 0 | accepted |
| people name search | 37.401 | 0 / 0 | accepted |
| search `台北` | 70.338 | 0 / 0 | accepted |
| election races | 168.417 | 0 / 0 | deferred |
| event races | 394.068 | 0 / 0 | deferred |

Compared with the prior warm production plans, the default people directory fell from 556.201 ms to 2.010 ms and search fell from 382.323 ms to 70.338 ms. Both Phase 2.2 targets are below 100 ms and no longer spill. Race-list work remains deliberately deferred; this deployment does not claim an improvement for those paths.

## Updated decision

Keep Phase 2.2 in production shadow. The next phase should design the frontend read adapter and request-shape changes against the private schema locally, including 20-row cursor/page contracts, while leaving production exposure and provider cutover for a separate reviewed phase. Race-list optimization requires a non-duplicating refresh strategy or more database capacity before another physical surface is safe.
