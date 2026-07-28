# Published read layer Phase 2.6B local-office validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Measure the existing local-office summary read before changing it.
- Add only a bounded private adapter and bridge contract because the existing published directory is sufficient.
- Add no table, materialized view, index, RPC, grant, schema exposure, provider registration, or production change.

## Finding and decision

The legacy path is not a severe database bottleneck, but it is unnecessarily broad. For Taipei it downloads every person whose district starts with the city label, then filters roles and current status in the browser:

| Path | Returned rows | Execution time | Approximate row width |
| --- | ---: | ---: | ---: |
| Legacy page 1 | 1,000 | 24.834 ms | 715 bytes |
| Legacy page 2 | 789 | 52.238 ms | 715 bytes |
| Bounded published replacement | 128 | 10.663 ms | 265 bytes |

The two legacy page plans total about 77 ms of database execution before network transfer and client mapping. The replacement filters to current local-office roles inside the database and needs one request.

The largest current result is 128 rows, so this phase uses the existing `published.people_directory` with a 200-row hard ceiling and a 201st-row sentinel. A new aggregate object or index is not justified at the current size; the replacement still performs a sequential scan but completes in about 11 ms without temporary storage.

## Contract

The adapter:

- selects explicit narrow directory columns;
- accepts only region prefixes supplied by the trusted region resolver;
- de-duplicates and trims prefixes;
- filters `list_status = current`;
- filters roles to chief, deputy, agency head, and councilor;
- orders by role rank, name, and person ID;
- queries `LIMIT 201` and fails closed above 200 rows;
- makes no request when no trusted prefix remains.

The bridge maps those rows to existing frontend person items and reuses the existing local-office summary builder. If the route region cannot be resolved, it returns an empty summary and does not send user-controlled text into a PostgREST `or` filter.

## Parity

For Taipei, role-level counts match between `public.public_people_directory` and `published.people_directory`:

| Role | Public | Published |
| --- | ---: | ---: |
| Local chief | 1 | 1 |
| Local deputy | 3 | 3 |
| Agency head | 68 | 68 |
| Councilor | 56 | 56 |

Repeatable read-only statements are in `docs/phase-2.6b-local-office-explain.sql`.

## Verification and remaining gate

The read-contract tests cover query shape, deterministic ordering, missing prefixes, the 201st-row sentinel, summary mapping, and unresolved-region early exit.

No production provider or public permission changes in this phase. After this contract, the remaining whole-site published-provider gaps are the party data family:

- party index and detail;
- party officers;
- party finance summaries;
- party company-contribution summaries.

These should be measured together but implemented only where a current query is broad or unbounded. Once the necessary party contracts are complete, the next gate is the exact exposure allowlist and rollbackable provider switch—not additional speculative optimization.
