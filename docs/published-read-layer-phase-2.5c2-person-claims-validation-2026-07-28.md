# Published read layer Phase 2.5C2 person claims validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Replace the remaining full canonical-graph claims read with a bounded targeted lookup.
- Add no physical table, materialized view, index, or duplicated data.
- Keep the published schema private and the bridge unregistered.

## Chosen approach

A physical canonical claims snapshot was not built. The current relation contains 343,520 rows, while the production-shadow promote estimate has only about 12.2 MiB of headroom. Measuring a large duplicate before trying an indexed traversal would be unnecessary risk.

`published.person_claims_for(uuid[])` instead starts from at most four canonical IDs and follows `person_merge_decisions` in reverse. Existing indexes on `canonical_person_id` and `person_claims(person_id, claim_type)` keep the work proportional to the requested merge trees and their claims.

The function:

- rejects more than four unique IDs on the server;
- accepts only IDs present in the canonical public people cache;
- follows verified merges to a maximum depth of 20 with a cycle guard;
- returns only verified, public, visible claims for public canonical people;
- applies deterministic ordering and a 401-row sentinel ceiling;
- is `SECURITY DEFINER` with a fixed search path;
- revokes execution from `PUBLIC`, `anon`, and `authenticated`, granting it only to `service_role` during the private phase.

The frontend adapter keeps its 400-row accepted ceiling and fails closed if the function returns the sentinel row. It no longer reads the expensive `published.person_claims` view.

## Equivalence

The reverse traversal was compared exhaustively against the existing view:

| Check | Existing view | Targeted traversal |
| --- | ---: | ---: |
| Total `(claim_id, person_id)` pairs | 343,520 | 343,520 |
| Missing pairs | — | 0 |
| Extra pairs | — | 0 |

The actual bounded function was also tested with the four people having the most claims. Both paths returned 311 pairs, with zero missing and zero extra rows.

A direct `person_claims.person_id = canonical_id` shortcut remains rejected: it returned only 11 of the representative person's 79 claims because it omitted verified merged identities.

## Performance

For the representative maximum-cardinality person:

| Path | Rows | Execution time | Shared buffers | Temporary I/O |
| --- | ---: | ---: | ---: | ---: |
| Existing `published.person_claims` view | 79 | 81.243 ms | 4,648 | 821 reads / 1,446 writes |
| Targeted inline traversal | 79 | 0.445 ms | 175 | none |
| Actual bounded function endpoint | 79 | 3.295 ms | 1,354 | none |

The endpoint is about 24.7 times faster than the old view in this local comparison and removes temporary-file work. PostgreSQL reports the PL/pgSQL function as one opaque function scan, so its buffer count includes function execution overhead; the inline plan confirms that the data path itself uses only targeted indexes.

With the four profile reads still issued concurrently, the representative `published.people` core-row query at 6.957 ms is now slower than claims. The previous full canonical claims expansion is no longer the person-profile latency floor.

## Verification and boundary

The migration was applied successfully to local Supabase. Verification confirmed:

- representative result parity: 79 expected, 79 actual, zero missing or extra;
- highest-cardinality four-person parity: 311 expected, 311 actual, zero missing or extra;
- a five-person request raises the expected server-side exception;
- `anon` execute: false;
- `authenticated` execute: false;
- `service_role` execute: true.

The adapter tests cover RPC arguments, sentinel rejection, and removal of direct claims-view reads. The exposure guard now has separate reviewed allowlists for relations and functions.

## Decision and next gate

Phase 2.5C2 resolves the remaining person-profile canonical-graph bottleneck without consuming meaningful database capacity. The full person-profile bridge remains private until the later exposure phase reviews grants, PostgREST schema configuration, runtime fallback, and production browser measurements together.

The next severe unresolved read is the filtered election race page. Before adding storage, evaluate a similarly bounded parameterized function that pushes event, race-type, and region filters into the core query, preserves exact result semantics, and returns page totals without an unbounded frontend view scan.
