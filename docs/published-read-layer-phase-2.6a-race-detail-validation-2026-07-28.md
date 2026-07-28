# Published read layer Phase 2.6A race-detail validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Add the missing private published adapter and frontend bridge contract for one race detail page.
- Reuse the existing physical `published.races`, `published.elections`, and `published.candidates` relations.
- Add no relation, materialized view, index, grant, PostgREST schema exposure, provider registration, or production change.

This is a contract-completion step before exposure review, not a production cutover.

## Decision

Race detail is already naturally bounded by one race and its candidate roster. The current largest published roster has 27 candidates, so adding another aggregate object or RPC would duplicate data without solving a measured bottleneck.

The adapter therefore performs:

1. one exact race lookup with `LIMIT 1`;
2. no further query if that race is absent;
3. one exact election lookup with `LIMIT 1`;
4. one candidate lookup ordered by candidate number, person name, and candidate ID;
5. a 100-row hard contract, queried with `LIMIT 101` so overflow fails closed instead of returning silently truncated detail.

The bridge only maps the private adapter result to the existing `PublicRaceDetailData` shape. It does not register the published provider or expose the schema.

## Local measurements

Representative race: `bd52aa3f-1856-4b13-b7d2-4861a9f5d3d6`, the largest current roster (27 candidates).

| Read | Rows | Execution time | Buffers |
| --- | ---: | ---: | --- |
| Race by ID | 1 | 0.239 ms | 19 shared hits |
| Election by ID | 1 | 0.153 ms | 8 shared hits |
| Candidates by race, ordered, `LIMIT 101` | 27 | 2.039 ms | 116 shared hits, 29 reads |

No query used temporary storage. These measurements support direct bounded relation reads for this route.

The repeatable read-only statements are in `docs/phase-2.6a-race-detail-explain.sql`.

## Contract verification

The read-contract tests cover:

- explicit selected columns;
- trimmed race ID input;
- deterministic candidate ordering;
- one-row race and election limits;
- the 101st candidate sentinel failure;
- early exit after a missing race;
- bridge mapping to `{ race, election, candidates }`.

## Exposure and remaining gates

No public role receives access in this phase. `published` remains absent from the configured public schemas, and the production provider remains unchanged.

A whole-site published provider still must not be enabled because these public contracts are not yet represented in the published bridge:

- local-office summary;
- party index and detail;
- party officers;
- party finance and company-contribution reads.

The safer rollout order remains:

1. complete and measure each missing bounded contract privately;
2. update the exact exposure allowlist and preflight assertions;
3. deploy database objects and grants while the existing provider remains active;
4. verify production reads using the service-role/private path;
5. expose only the reviewed surfaces;
6. switch the provider behind a rollbackable environment flag;
7. run warmed browser measurements and rollback on contract or latency regressions.

The next smallest independent contract is the local-office summary. Party pages should be treated as a separate later phase because they combine several data families and deserve their own capacity and parity checks.
