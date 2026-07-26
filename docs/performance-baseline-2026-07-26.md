# Public read performance baseline — 2026-07-26

## Scope

This Phase 0 baseline measures the read shapes currently issued by the web provider for:

- home bootstrap
- county/city detail
- election index, event, and detail
- people index and person detail
- global search

No schema, data, permission, or production setting was changed.

The reusable runner is:

```bash
npm --prefix apps/web run measure:public-reads -- --analyze
```

It always uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, refuses an obvious service-role key, performs only public `SELECT` requests, and writes raw output under the Git-ignored `tmp/performance/` directory.

## Environment boundary

The available root and web `.env.local` files both point to `127.0.0.1`. No production Supabase URL is present in the repository or WSL process environment.

Therefore the measurements below are from local Supabase loaded with the current public-size dataset. They are valid for:

- result cardinality
- pagination count
- response payload size
- identifying expensive query shapes

They are not production network or production compute latency numbers.

The raw baseline used for this report is:

```text
tmp/performance/public-read-baseline-2026-07-26T13-30-01.793Z.json
```

## Representative anchors

- region: `臺北市`
- election: `e6ae0952-bf6c-432a-bdf9-a3da946b4078`
- election event: `2022-2022-11-26-local`
- person: `0000c1d0-e734-498b-839e-24dd97fedd7c`
- search input: `台北`

The runner obtains entity IDs from public views instead of relying on private tables.

## Page-level results

| Read path | Concurrent client time | Payload | Key cardinality |
| --- | ---: | ---: | --- |
| Home bootstrap | 68.8 ms | 328,834 B | 236 upcoming races; 338 party/company summaries |
| County/city detail | 96.9 ms | 1,272,966 B | 1,789 people across 2 requests |
| Election index | 76.7 ms | 175,415 B | 450 elections; 421 summaries |
| Election detail | 5,210.0 ms | 20,543,503 B | 7,748 races; 14,021 candidates |
| People index | 950.9 ms | 583,635 B | 200 people of 5,167; 341 candidate rows |
| Person detail | 177.7 ms | 15,856 B | 1 person; 2 candidacies; 16 claims |
| Search | 64.0 ms | 3,071 B | 12 company results for `台北` |
| Election event | 93.9 ms | 127,728 B | 200 races of 8,869 |

Times are one local run and must not be treated as percentiles.

## Findings

### P0 — Election detail downloads an entire large election

The current detail provider loads every race and candidate for an election. The representative election required:

- 8 requests for 7,748 races
- 15 requests for 14,021 candidates
- about 20.5 MB in total
- about 5.21 seconds locally

This is the clearest current bottleneck. A published layer alone will not solve the payload problem if the detail route keeps requesting the complete election graph. Before Phase 1, the product query contract should decide which summary and paginated subsets the page actually needs.

### P0 — People index exact count is expensive

The directory block request took about 951 ms for 200 rows while calculating an exact total of 5,167. The accompanying candidate lookup took about 495 ms for 341 rows, but ran in parallel and therefore did not extend the group beyond the slower directory request.

The first follow-up plans should test the cost of:

- the directory view itself
- `count=exact`
- the three-column ordering
- candidate lookup with 200 person IDs

### P1 — County/city detail over-fetches before client filtering

The local office query returned 1,789 people and about 1.27 MB. The frontend then filters positions in JavaScript. A dedicated published local-office projection or aggregate should apply the office criteria in the database and return only displayable rows.

### P1 — Event pagination is bounded but exact count still matters

The event route returns only the requested 200 rows, but also computes an exact total of 8,869. Its local request was about 94 ms. This should remain in the plan set because count cost may differ on production compute.

### P2 — Home and search were not the local bottlenecks

The home bootstrap completed in about 69 ms locally, with about 329 KB returned. Search completed in about 64 ms for the test input. These still require production plans and repeated samples before being considered healthy.

The `台北` people search returned zero rows while company search returned 12. That is a possible normalization or search-contract issue, not currently a performance conclusion.

## Production EXPLAIN ANALYZE — complete

The PostgREST plan endpoint remained securely disabled (`PGRST107`). All 23 plans were instead captured through Supabase SQL Editor with the measured statements running as `anon`. The export is stored locally as `docs/phase-0-production-explain.json` and is intentionally Git-ignored because plans reveal database structure.

Production anchors:

- region: `臺北市`
- election: `3f885256-664f-4a32-9716-ef0041ea40cc`
- election event: `2018-2018-11-24-local`
- person: `19d1a17e-aa25-4de6-89b9-b4f2204c0a1f`
- search input: `台北`

Every root plan reported zero shared-read blocks, so these are warmed-cache database execution times. They do not include browser, PostgREST serialization, network, or payload-transfer time.

| Read path | Slowest query | Execution | Rows at slowest root | Root buffer / temp activity |
| --- | --- | ---: | ---: | --- |
| Home bootstrap | Region summaries | 326.776 ms | 23 | 36,297 hits |
| County/city detail | Local office people | 452.051 ms | 1,789 | 832 hits |
| Election index | Race summaries | 179.603 ms | 421 | 186,499 hits |
| Election detail | Candidates | 1,689.330 ms | 20,853 | 365,903 hits; 13,066 temp reads; 13,703 temp writes |
| People index | Candidate lookup for 200 people | 1,608.608 ms | 339 | 645,647 hits; 10,211 temp reads; 10,848 temp writes |
| Person detail | Candidacies | 1,129.678 ms | 6 | 99,660 hits; 6,424 temp reads; 7,061 temp writes |
| Search | People search | 181.348 ms | 0 | 832 hits |
| Election event | 200-row page with exact count | 180.694 ms | 200 | 64,023 hits; 646 temp reads; 424 temp writes |

The queries within a page group are often issued concurrently. The maximum execution time is therefore a closer lower bound for page database latency than the sum, while the sum still represents total database work.

### P0 — `public_candidates` expands the canonical graph before selective filters

The three slowest paths all expand the same canonical person/race/election graph:

- election candidates sorted 64,819 intermediate rows and returned 20,853 rows
- the 200-person lookup built 42,052 public candidate rows before returning 339
- a single-person candidacy lookup sorted 64,819 candidate rows and walked 39,833 canonical-person rows before returning 6

The election candidate plan underestimated a 64,819-row sort as 73 rows. It then performed tens of thousands of repeated primary-key probes and spilled external sorts to temporary storage. The issue is not a missing leaf index alone: filters on `election_id` and `person_id` are applied after expensive view expansion and deduplication.

Phase 1 should publish canonical candidate rows into a physical table indexed for `election_id`, `race_id`, and `person_id`. Raising global `work_mem` may hide some spill cost but does not fix the repeated canonical computation or payload size.

### P0 — election detail still over-fetches

The production candidate query itself took 1.689 seconds on warm cache and returned 20,853 rows. The local client baseline also showed about 20.5 MB for the full election graph. The route must request summary and paginated subsets; a physical published table alone must not preserve the current full-download contract.

### P1 — aggregate views recompute full datasets

Several small outputs require large intermediate sets:

- region summaries process 36,304 rows to return 23 in 326.776 ms
- election race summaries process 18,286 rows to return 421 in 179.603 ms
- the event page processes all 8,875 event rows to return 200 because of exact count

These are direct Materialized View candidates. Event totals should be stored separately from the paginated event rows so page reads do not recompute `count=exact`.

### P1 — local-office projection and search need dedicated published shapes

The county/city query sequentially scans `public_people_list_cached`, returns 1,789 rows in 452.051 ms, and leaves the final office-position filter to JavaScript. A published local-office projection should apply region and office criteria before transfer.

People search also sequentially scans the materialized person list and returns no result for `台北` in 181.348 ms. The published search contract should normalize `台`/`臺` consistently; trigram or search-vector indexes should be selected only after that contract is fixed.

### Revised people-index finding

The production directory block with exact count completed in 27.959 ms for 200 rows. The earlier local 950.9 ms group timing should not be attributed to exact count alone. The production bottleneck is the accompanying candidate lookup through `public_candidates` at 1,608.608 ms.

### Production schema drift

Production does not yet have `public_people_directory` from migration `202607260005_major_party_officer_expansion.sql`. The production run therefore measured the deployed pre-migration people-list path through `public_people_list_cached`. Database migrations must precede the matching frontend deployment.

## Remaining production baseline

The required database plan set is complete. Before final cutover, still capture three warmed browser/client samples per page group against the production hostname to measure PostgREST serialization, network time, and payload transfer. This is not required to choose the shadow published-layer architecture because the production plans already identify the dominant database work.

## Phase 1 gate

The production-plan gate is satisfied for shadow-schema design. Phase 1 should proceed in this order:

1. define the reduced election-detail and candidate pagination contract
2. design physical published tables for elections, races, candidates, and people, excluding village-level publication
3. design materialized summaries for home regions, election/race summaries, event totals, and ticker data
4. design dedicated local-office and normalized-search projections
5. define promote synchronization, refresh order, validation, and rollback without cutting frontend reads over yet

Do not deploy the schema, change frontend reads, or tune global database settings as part of the design-only step.
