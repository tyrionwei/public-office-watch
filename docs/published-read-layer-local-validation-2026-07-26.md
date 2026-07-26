# Published read layer local validation — 2026-07-26

Status: Phase 2 local validation. Nothing in this result authorizes a production migration or frontend cutover.

## Scope

The local Supabase database applied:

- `202607260008_published_promote.sql`
- `202607260009_published_query_indexes.sql`

The promote source is the existing reviewed public-view boundary. All currently public election levels are included; township, village, indigenous, and special categories are not removed to meet performance targets.

## Published snapshot

The second complete promote finished in 14,835 ms and recorded:

| Relation | Rows |
| --- | ---: |
| Regions | 36,090 |
| Elections | 450 |
| Races | 18,286 |
| Lower-level races | 17,276 |
| Candidates | 42,052 |
| People | 30,934 |
| Companies | 336 |
| Parties | 112 |
| Search documents | 67,922 |

Lower-level race counts were:

| Race type | Rows |
| --- | ---: |
| `township_mayor` | 408 |
| `township_representative` | 681 |
| `township_representative_district` | 681 |
| `village_chief` | 15,502 |
| `indigenous` | 4 |

Materialized results contained 22 home regions, 421 election summaries, 716 election facets, 8 event summaries, 11,082 local-office people, 95 party officers, 176 region-issue aggregates, and 67,922 search documents.

## Atomicity and permissions

- Running promote a second time completed successfully and produced a new release ID.
- A transaction-local check constraint forced failure during candidate insertion. The failed promote rolled back in 2,020 ms and preserved the previous release ID and validated row counts.
- `anon` and `authenticated` have no `USAGE` privilege on `published`, no published relation grants, and no execute privilege on `published.promote(UUID)`.
- `service_role` is the only application role granted published writes and promote execution.
- The published schema remains absent from the Supabase API exposed-schema configuration.

## Warm query plans

The repeatable harness is [phase-2-published-explain.sql](./phase-2-published-explain.sql). Representative route IDs are selected outside the measured statements so their discovery cost is not confused with a real route request.

| Query contract | Execution ms | Result rows | Maximum rows in one plan node | Temp read/write blocks |
| --- | ---: | ---: | ---: | ---: |
| Search `台北` | 18.059 | 20 | 459 | 0 / 0 |
| Elections page | 0.321 | 20 | 450 | 0 / 0 |
| Home region summary | 0.267 | 22 | 22 | 0 / 0 |
| People directory page | 0.129 | 20 | 20 | 0 / 0 |
| Election races page | 0.045 | 20 | 20 | 0 / 0 |
| Race candidates page | 0.045 | 20 | 20 | 0 / 0 |
| Person candidacies | 0.039 | 6 | 6 | 0 / 0 |
| Event races page | 0.034 | 20 | 20 | 0 / 0 |
| Home ticker | 0.034 | 1 | 1 | 0 / 0 |
| Local-office people page | 0.029 | 20 | 20 | 0 / 0 |

All local design gates passed:

- every measured query executed below 50 ms
- no measured query returned more than 22 rows
- no plan node processed more than 459 rows
- no measured query used temporary blocks

The broad search contract must order by trigram distance before stable entity/title keys. A GIN-only substring query processed 3,221 matches; the measured GiST distance-order contract reduced the maximum plan-node work to 459 rows.

## Comparison with Phase 0

The plan shape changed from high-frequency canonical graph expansion to bounded reads:

- election candidate/detail paths previously returned up to 20,853 rows and took about 1.69 seconds; the new election and candidate page contracts return 20 rows
- person candidacies previously took about 1.13 seconds; the physical person-history lookup measured 0.039 ms locally
- the county/city path previously transferred 1,789 people and filtered in JavaScript; the region-specific materialized lookup processes 20 rows
- home region summaries previously processed 36,304 rows; the materialized read processes 22 rows
- the event page previously processed 8,875 rows to return 200; cursor-sized published reads process 20 rows

Execution times are not a direct production speedup ratio because Phase 0 was measured on production while Phase 2 was measured against local Supabase. The important validated change is the bounded plan shape, absence of temporary blocks, and removal of request-time canonicalization.

## Findings handled during promote implementation

- Party affiliations and party events contained pre-merge person IDs. Promote maps them to canonical people before enforcing published foreign keys.
- Fifty-five identity sources appeared multiple times because several match records pointed to the same canonical person. Promote deterministically keeps the highest match score, then the latest updated row.

## Remaining gate

Before frontend cutover, apply the migrations to an unexposed production shadow schema, run the same harness against the complete production snapshot, and compare row counts and plans. Keep the legacy provider and grants unchanged until that production shadow validation passes.
