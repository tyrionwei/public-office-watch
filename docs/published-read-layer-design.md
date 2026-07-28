# Published read layer design

Status: Phase 1 design only. This document does not authorize a production migration, frontend cutover, or privilege revocation.

## Phase 2.1 capacity revision — 2026-07-28

The all-physical relation list below records the original design, but it cannot fit the production project's current 500 MB allocation: the complete local copy occupied 426 MB. The selected no-additional-cost implementation is therefore a compact hybrid boundary:

- `published.candidate_facts` is the narrow physical snapshot for the measured canonical-graph bottleneck
- `published.person_candidate_summaries` and the small home/election/event aggregates are materialized
- `published.candidates` restores repeated source and photo fields through stable-ID joins
- reviewed lower-frequency relations remain security-barrier views in the `published` namespace
- unified search remains a zero-storage view until a larger storage allocation is justified

This revision preserves all lower-level election data and the atomic candidate release while accepting slower pass-through people, search, and race-list reads. The measured storage, plans, and remaining production gate are in [published-read-layer-local-validation-2026-07-26.md](./published-read-layer-local-validation-2026-07-26.md).

## Objective

Create a small, explicit Supabase read boundary for public traffic while retaining the complete election dataset in the private core tables.

The design must:

- keep canonicalization and deduplication out of high-frequency requests
- publish reviewed election geography and races at every administrative level once the shadow performance gates pass
- give the frontend access only to the published schema after cutover
- make a failed promote transaction leave the previous published state intact
- preserve the legacy public views until the published layer has been validated

The production evidence and measured query shapes are recorded in [performance-baseline-2026-07-26.md](./performance-baseline-2026-07-26.md).

## Evidence that drives the design

- `public_candidates` expands and sorts the canonical graph before selective `election_id` or `person_id` filters. Warm production executions took 1.13–1.69 seconds.
- The people index directory query took 27.959 ms. Its separate candidate lookup took 1,608.608 ms, so the list should not perform that second query.
- Election detail returned 20,853 candidate rows and the local client transferred about 20.5 MB for the full election graph.
- Region summaries processed 36,304 rows to return 23; election summaries processed 18,286 rows to return 421.
- The event page processed all 8,875 event rows to return 200 because it requested an exact count.
- The county/city page fetched 1,789 people and applied its final office filter in JavaScript.
- People search performed a sequential scan and `台北` did not match `臺北` data.

These results rule out an index-only response. The expensive canonical views should be evaluated during promote, not during public reads.

## Schema boundary decision

Use a dedicated Postgres schema named `published` and expose it through the Supabase Data API.

At cutover:

1. add `published` to the configured API exposed schemas
2. make the web client query `client.schema('published')`
3. allow only registry-approved published relations in the frontend provider
4. revoke `anon` and `authenticated` reads from the legacy `public_*` views only after parity and rollback checks pass

Do not create compatibility wrappers in the `public` schema. Wrappers would preserve the ambiguous namespace that this work is intended to remove.

The `published` schema is a public product boundary, not a synonym for the current Postgres `public` schema.

## Publication scope

### Performance-gated scope

Publish:

- national, municipality, county, city, township, and village geography used by reviewed public election data
- presidential and vice-presidential races
- legislators and party-list legislators
- municipality and county mayors
- city and county councilors
- township mayors, township representatives, and representative districts
- village chiefs and village geography
- indigenous and special constituencies after their existing enum values are mapped to explicit public product categories
- referendums and recalls associated with a published region or national scope
- election districts required by any published race
- people who hold a published office, have a published candidacy, or have a verified current party-office role, including people associated only with lower-level elections

The allowlist protects fields, review status, and known product categories; it must not exclude otherwise publishable rows solely because their administrative level is lower. New or generic `other` enum values remain private only until they are mapped to an explicit public category, not as a way to reduce row counts.

### Performance gate before cutover

Populate shadow tables with the complete reviewed scope above, including lower-level rows, before running parity and `EXPLAIN ANALYZE`. If the full dataset misses the performance targets, optimize the physical shape, indexes, materialized aggregates, or query contract and measure again. Do not meet the targets by silently excluding lower-level elections. If the targets cannot be met, keep the legacy provider active and bring the measured tradeoff back for an explicit product decision.

## Physical published tables

Published tables contain denormalized display snapshots. They do not have foreign keys back to private core tables and do not expose merge decisions, Auth identifiers, review queues, or raw source payloads. Foreign keys inside the `published` schema are allowed when they protect the published graph.

| Table | Primary key | Required read indexes | Notes |
| --- | --- | --- | --- |
| `published.regions` | `region_id` | unique `slug`; `(region_type, display_order)`; `parent_region_id` | Include all geography required by reviewed public races, including township and village levels. |
| `published.elections` | `election_id` | `(voting_date, election_id)`; `(election_type, status)` | Include an election when it has a reviewed public race or is a reviewed public referendum/recall. |
| `published.races` | `race_id` | `election_id`; `region_id`; `(status, voting_date)`; event sort index | Store `event_key`, `region_key`, category order, region order, and district order at promote time. |
| `published.candidates` | `candidate_id` | `election_id`; `race_id`; `person_id`; `(race_id, candidate_no, person_name)`; `(person_id, election_year DESC, race_id)` | Store the canonical winner row and all display snapshots currently produced by `public_candidates`. |
| `published.people_directory` | `person_id` | directory order | Narrow materialized list surface; full detail and candidacy summary remain available through selective person/candidate reads. |
| `published.companies` | `company_id` | unique business number where present | Only the already-approved company fields used by public relation and search results. |
| `published.parties` | `party_id` | unique slug; normalized name | Preserve existing public party profile fields. |
| `published.person_claims` | `claim_id` | `(person_id, observed_at DESC)` | Verified public claims only; keep the source snapshot fields already approved for display. |
| `published.person_party_affiliations` | `affiliation_id` | `(person_id, is_current, display_order)`; normalized party | Verified public affiliations only. |
| `published.person_party_events` | `event_id` | `(person_id, event_date DESC)` | Approved public timeline rows only. |
| `published.person_identity_sources` | `identity_source_id` | `(person_id, observed_year DESC)` | Only the current approved identity-source projection, never source payloads. |
| `published.relation_details` | `relation_id` | `person_id`; `company_id` | Verified public company relations only. |
| `published.party_finance_summaries` | existing natural key | `(party_id, report_year DESC)` | Copy the approved aggregate, not raw transactions. |
| `published.party_company_contribution_summaries` | existing natural key | `(party_id, report_year DESC)`; `company_id` | Copy reviewed company aggregates only. |

All rows should include `published_at timestamptz` and `source_updated_at timestamptz`. A singleton `published.release_state` records the release ID, promote time, source sync run, schema version, and validated row counts.

### Directory index shape

The initial people directory index should follow the actual ordering:

```text
(list_is_grassroots, list_is_party_only, list_status_order, list_role_order, name, person_id)
```

Add narrower party, role, status, or region indexes only when the shadow-table plans show they are needed. The physical table is small enough that speculative index combinations are not justified.

### Event index shape

The event race endpoint needs one stable ordered index beginning with:

```text
(event_key, sort_category_order, sort_region_order, sort_district_order, region_name, title, race_id)
```

The final migration must verify the intended `NULLS FIRST` behavior against the frontend order before creating this index.

## Materialized views and projections

| Materialized relation | Source | Consumer | Why materialize |
| --- | --- | --- | --- |
| `published.home_ticker` | published elections | Home | Small stable next-event selection. |
| `published.home_region_summary` | published regions/races/elections | Home and region cards | Current view processes 36,304 rows for 23 results. |
| `published.election_race_summaries` | published races | Election index | Precompute race counts and race-type arrays. |
| `published.election_race_facets` | published races | Event filters | Precompute event/election/category/region counts. |
| `published.event_summaries` | published races | Event pagination | Supply total counts without PostgREST `count=exact` over event rows. |
| `published.local_office_people` | published people | County/city page | Apply allowed office and region criteria before transfer. |
| `published.party_officers` | affiliations/people/parties | Party detail | Stable verified current officer projection. |
| `published.region_issue_results` | approved issue aggregates | Region detail | Publish aggregates only; never individual responses. |
| `published.search_results` | published search documents | Global search | Compact normalized result shape; at the current row count a sequential scan is smaller and still meets the local target. |

Materialized views that may later use concurrent refresh need a unique index. Storage-bounded relations using ordinary transactional refresh may instead validate key uniqueness during promote when the extra index would consume the remaining capacity margin.

## Current registry consolidation

The frontend currently allows 25 relations. Cutover should reduce aliases that expose the same expensive graph rather than recreate every legacy name.

| Current relation(s) | Published contract |
| --- | --- |
| `public_people`, `public_people_list`, `public_people_list_cached`, `public_people_directory` | `published.people_directory` for lists; selective `published.people` and candidate reads for detail |
| `public_person_primary_photos` | Embed the approved primary-photo snapshot in people and candidates; remove the direct frontend relation unless a verified consumer remains. |
| `public_person_claims` | `published.person_claims` physical table |
| `public_person_identity_sources` | `published.person_identity_sources` physical table |
| `public_person_party_affiliations` | `published.person_party_affiliations` physical table |
| `public_person_party_events` | `published.person_party_events` physical table |
| `public_regions` | `published.regions` physical table |
| `public_elections` | `published.elections` physical table |
| `public_races`, `public_election_race_list` | `published.races` reviewed view; physical race-list optimization is deferred until refresh capacity is redesigned |
| `public_candidates` | `published.candidates` physical table |
| `public_election_race_summaries` | `published.election_race_summaries` materialized view |
| `public_election_race_facets` | `published.election_race_facets` materialized view |
| `public_home_election_ticker` | `published.home_ticker` materialized view |
| `public_region_election_summary` | `published.home_region_summary` materialized view |
| `public_region_issue_results` | `published.region_issue_results` materialized view |
| `public_companies` | `published.companies` physical table |
| `public_relation_details` | `published.relation_details` physical table |
| `public_parties` | `published.parties` physical table |
| `public_party_officers` | `published.party_officers` materialized view |
| `public_party_finance_summaries` | `published.party_finance_summaries` physical table |
| `public_party_company_contribution_summaries` | `published.party_company_contribution_summaries` physical table |

`published.event_summaries`, `published.local_office_people`, and `published.search_documents` are new contracts that replace client-side counting, filtering, and multi-relation search.

## Search normalization

Store these fields in `published.search_documents`:

- `document_type`
- `document_id`
- `title`
- `subtitle`
- `href`
- `normalized_text`
- `search_vector` if full-text search is retained after testing

`normalized_text` must at minimum:

- normalize Unicode to NFC in the promote process
- map `臺` to `台` for matching while preserving the original display value
- collapse whitespace
- lowercase Latin text

Start with a trigram index on normalized text because the product requires infix matching. Do not add both trigram and full-text indexes until measured search behavior requires both.

## Frontend query contracts after cutover

### Home

- read one ticker row
- read at most the published top-level region summaries
- read upcoming allowed races from the physical race table
- read published party and finance aggregates

No home query may expand core canonical views.

### County/city page

- query `local_office_people` by stable region ID
- return only displayable office rows
- do not fetch a region prefix and filter positions in JavaScript

### Election index and event

- use materialized summaries and facets
- fetch the requested 20 event races, not the current 200-row ten-page prefetch block
- obtain totals from `event_summaries`, not `count=exact`
- retain a deterministic final `race_id` sort key
- retain numbered offset pagination initially, then verify the highest practical page against the published event index before considering keyset pagination

### Election detail

Replace `loadElectionDetail`, which currently downloads the entire election graph, with:

1. election header
2. materialized election summary/facets
3. a 20-row race page for the selected category/region
4. candidates only for a selected race

The legacy all-candidates screen must not be carried unchanged onto the published layer.

### People index

- fetch the requested 20 rows rather than the current 200-row ten-page prefetch block
- keep exact count initially because `published.people_directory` is already inexpensive
- render list fields from `published.people_directory`
- fetch candidates only for the displayed people when the list UI needs candidacy details

### Person detail

- query one physical person row
- query physical candidates by `person_id`
- query physical claims and affiliations by `person_id`

The selective filters must be satisfied before any sort or join.

### Global search

- issue one query to `published.search_results`
- normalize the input with the same `台`/`臺` rule used during promote
- return at most 12 typed result rows

## Promote contract

The current sync script ends by refreshing only `public_people_list_cached`. Replace that final responsibility in a later implementation phase with a service-role-only database function such as `promote_published_release()`.

The function should:

1. acquire a transaction-scoped advisory lock so only one promote runs
2. verify the source sync run is complete
3. clear and repopulate physical published tables in dependency order
4. evaluate canonical and publication-scope logic once during inserts
5. run blocking validation queries before anything becomes visible
6. refresh all published materialized views
7. update `published.release_state`
8. commit atomically

If any insert, validation, or refresh fails, the transaction rolls back. Readers waiting on promote locks then resume against the previous published state.

The core sync itself currently spans many REST writes and cannot share the promote transaction. That is acceptable: core tables remain private, and promote is called only after the complete sync succeeds.

### Initial refresh strategy

Use ordinary `REFRESH MATERIALIZED VIEW` inside the promote transaction. Published inputs are intentionally small, so this gives the simplest atomic behavior. Measure lock duration in shadow before considering concurrent refresh.

Do not increase global `work_mem` as part of promote implementation. The published layer should first eliminate the large recursive sorts that caused the spills.

### Logical rollback tradeoff

The initial design guarantees rollback for failed promotes, not instant rollback after a logically incorrect release has committed. During shadow and cutover, the frontend provider flag remains the rollback path to the legacy views.

A versioned two-generation store would support instant data rollback but would add a release predicate to every relation and double retained rows. Defer it unless shadow operation shows a concrete need before legacy views are removed.

## Permissions

The migration must:

- revoke `CREATE` on schema `published` from `PUBLIC`
- grant schema `USAGE` and relation `SELECT` only to `anon` and `authenticated`
- grant write and promote-function execution only to `service_role`
- revoke direct execution of the promote function from `PUBLIC`, `anon`, and `authenticated`
- set safe default privileges for future published relations
- avoid RLS policies that imply per-user visibility; every published row is public and write protection is grant-based

At final cutover, revoke `anon` and `authenticated` from the legacy `public_*` relations listed in `publicViewRegistry.ts`. Feedback and participation writes remain narrowly scoped RPCs and are not moved into the public read layer.

## Validation gates

### Data safety

- lower-level row counts match the reviewed core source by election, race type, and region level
- zero orphan candidates, races, or published region references
- unique primary and natural keys
- only reviewed public claims, affiliations, relations, and finance aggregates
- no raw payload, private source row, Auth UUID, IP, or review metadata columns

### Parity

- compare row counts by every published election/race type, including township, village, indigenous, and special categories
- compare representative home, region, election, race, people, person, party, and search outputs
- explicitly explain every expected difference caused by field review, product-category mapping, or deduplication
- verify `台` and `臺` return equivalent search matches

### Performance

On warmed shadow data:

- run all performance checks against the complete reviewed scope, including lower-level elections
- key lookups and 20-row pages should execute below 50 ms
- no interactive query should scan or return more than 1,000 rows
- no selective person/election/race query should use temporary blocks
- no detail query should perform thousands of repeated primary-key probes
- home and event totals must come from materialized results

These are design targets, not production SLOs. Browser percentiles are established later with production client samples.

## Staged implementation after approval

1. Migration A: create the unexposed `published` schema, physical tables, indexes, and grants; do not grant frontend access yet.
2. Migration B: add promote population and validation logic; populate shadow data and capture `EXPLAIN ANALYZE` again.
3. Application change: add a published-schema provider behind a separate environment flag and run parity tests.
4. Controlled cutover: expose `published`, enable the new provider, monitor, and keep legacy grants for rollback.
5. Finalize: after the rollback window, revoke frontend reads from legacy `public_*` relations.

The global chat schema and UI are deliberately outside this phase.
