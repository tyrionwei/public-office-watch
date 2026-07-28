# Published read layer Phase 2.6C party-data validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Measure party index, detail, finance, company-contribution, and officer reads.
- Add fixed private adapter limits and bridge contracts only.
- Reuse every existing published relation and the existing promote refresh flow.
- Add no table, view, materialized view, index, grant, schema exposure, provider registration, or production change.

## Capacity decision

The party family is small and is not a current performance bottleneck:

| Relation | Current rows | Contract limit |
| --- | ---: | ---: |
| `published.parties` | 112 | 200 |
| `published.party_finance_summaries` | 10 | 100 |
| `published.party_company_contribution_summaries` | 338 | 1,000 |
| `published.party_officers` | 95 | 200 per party |

The largest company-contribution set contains 128 rows for one party. The largest officer roster contains 44 rows. These sizes do not justify a new aggregate or index.

An initially considered new party-officer view was rejected after inspection showed that `published.party_officers` already exists as a materialized view in the established promote migration. It contains 95 rows, matches the public projection's row count, and is refreshed by `published.promote`.

## Measurements

| Read | Rows | Local execution time |
| --- | ---: | ---: |
| All parties | 112 | 3.164 ms |
| All finance summaries | 10 | 0.093 ms |
| All company-contribution summaries | 338 | 0.696 ms |
| Largest legacy public officer roster | 44 | 15.345 ms |
| Same published officer roster | 44 | 0.264 ms |

No measured query used temporary storage. The published officer snapshot avoids the legacy join across the full affiliation and people data while adding no new storage in this phase.

Repeatable read-only statements are in `docs/phase-2.6c-party-data-explain.sql`.

## Contract

The base party-data adapter reads the three small relations in parallel with:

- explicit narrow columns;
- stable ordering;
- one sentinel row above each hard limit;
- fail-closed overflow behavior.

The officer adapter:

- requires a non-empty party ID;
- returns no rows and performs no request for empty input;
- uses deterministic display-order, person-name, and affiliation-ID ordering;
- enforces a 200-row roster limit with a 201st-row sentinel.

The bridge returns the base dataset in the existing public frontend types and forwards the bounded officer roster without remapping.

## Verification and next gate

The read-contract suite covers all relation names, explicit column sets, limits, the company sentinel, the officer query shape, empty officer input, bridge mapping, and forwarding.

With this phase, the private published adapter and bridge now cover the known public routes:

- home and region pages;
- election index, event pages, and race detail;
- people index, profiles, and local-office summary;
- global search;
- party index, detail, finance, contributions, and officers.

The next phase is not another data optimization. It is a provider assembly and exposure preflight:

1. assemble these reviewed contracts behind a distinct `published` provider mode;
2. keep that mode disabled by default;
3. update the exact relation/function exposure allowlist;
4. verify service-role/private reads and rollback behavior;
5. request a separate decision before changing public grants, PostgREST schemas, or the production environment flag.
