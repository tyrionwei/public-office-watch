# Published read layer Phase 2.2 local validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Migration: `202607280001_published_hot_path_surfaces.sql`
- No frontend cutover, PostgREST exposure, or production deployment is included in this phase.
- The migration adds only `published.people_directory` and `published.search_results`; event and election race lists remain on `published.races` for a later phase.

## Rejected prototype

The first prototype materialized people, race, and indexed search surfaces. Its steady published storage increased by about 54 MB, but a sampled promote showed an 86,794,240-byte peak increase because old and new materialized relation files remain until the atomic transaction commits.

Applied to the production baseline, that design would have peaked near 548 MiB and exceeded the Free plan allowance. It was rejected before any production deployment.

## Storage-bounded implementation

The retained implementation uses:

- a narrow people directory with only list display/filter fields and two B-tree indexes;
- a compact search result relation without `subtitle` or a trigram index;
- sequential search over 67,922 compact rows, which is faster and smaller at the current scale than retaining a 12 MB GiST index.

Measured physical sizes:

| Relation | Bytes | Approximate size |
| --- | ---: | ---: |
| `published.people_directory` | 9,150,464 | 8.7 MiB |
| `published.search_results` | 17,317,888 | 16.5 MiB |
| New Phase 2.2 storage | 26,468,352 | 25.2 MiB |
| All physical `published` relations | 56,098,816 | 53.5 MiB |

The sampled local promote peak increased by 53,551,104 bytes. Using the measured production baseline of 431,115,411 bytes:

- projected steady database size: 457,583,763 bytes (about 436.4 MiB);
- projected promote peak: 511,134,867 bytes (about 487.5 MiB);
- projected peak headroom: 13,153,133 bytes (about 12.5 MiB).

Before production deployment, re-read the current database size and repeat this calculation. Do not deploy if the projected peak leaves less than 10 MiB of safety headroom. After deployment, every promote must retain a capacity gate because ordinary data growth can consume the remaining margin.

## Data and access validation

Validated row counts:

| Relation | Rows |
| --- | ---: |
| `published.people` | 30,934 |
| `published.people_directory` | 30,934 |
| `published.search_documents` | 67,922 |
| `published.search_results` | 67,922 |

The release schema version is `202607280001-people-search-surfaces`. Search document keys were also checked for uniqueness.

All of the following remained `false`:

- `anon` and `authenticated` schema usage on `published`;
- `anon` and `authenticated` select on the new people directory;
- `anon` and `authenticated` execute on `published.promote(uuid)`;
- direct `service_role` execute on the renamed internal `published.promote_compact_base(uuid)`.

## Query plans

`docs/phase-2.2-published-explain.sql` produced:

| Query | Local execution ms | Temp read / write blocks | Result |
| --- | ---: | ---: | --- |
| people directory default | 0.137 | 0 / 0 | improved |
| people name search | 15.909 | 0 / 0 | acceptable without another index |
| search `台北` | 24.642 | 0 / 0 | improved |
| event races | 69.133 | 0 / 0 | deferred |
| election races | 73.562 | 0 / 0 | deferred |

The corresponding warm production measurements before Phase 2.2 were 556.201 ms for people directory and 382.323 ms for search. Production race-list measurements remained 149–166 ms and are intentionally not hidden by this phase.

## Promote and migration validation

- `published.promote(NULL)` completed in about 2.2 seconds in the full local dataset with no temporary block spill.
- The promote wrapper refreshes the compact base release first, then the two new surfaces, validates counts and search-key uniqueness, and updates the release schema version in the same transaction.
- Database lint found no schema errors.

A full `supabase db reset` currently fails before this migration at `202607260001`, because that older migration references a production person UUID before the full local data dump is restored. Validation therefore restored `supabase/.temp/local-public-data.sql` after the schema reached `202607220005`, then applied migrations `001`–`010`. This reset limitation predates Phase 2.2 and was not modified here.

## Decision

Keep the frontend on the legacy provider. The people and search surfaces are ready for a separate production-shadow deployment only if the live capacity gate still passes. Race-list optimization remains a separate phase because adding another physical surface would exceed the agreed refresh headroom under the current atomic promote design.
