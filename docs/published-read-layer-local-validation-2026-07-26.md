# Published read layer local validation — 2026-07-28

Status: Phase 2.1 compact-hybrid local validation. Nothing in this result authorizes a frontend cutover. Production deployment remains gated by a fresh capacity check and migration review.

## Why Phase 2.1 replaced the full physical copy

The first complete physical `published` schema occupied 426 MB locally while the production project showed about 416 MB used of a 500 MB allocation. The largest duplicate was `published.person_claims` at 251 MB; lower-level election rows were not the storage problem.

The user selected the no-additional-monthly-cost path. The unpublished migrations `202607260007`–`202607260009` were therefore revised to a compact hybrid boundary:

- snapshot the expensive canonical candidate graph into narrow `published.candidate_facts`
- expose `published.candidates` as a security-barrier view that restores source and photo fields by stable candidate/person IDs
- keep a small materialized person/candidate summary for directory and region reads
- materialize only small home, election, event, party-officer, and issue aggregates
- expose already-reviewed, lower-frequency public projections through security-barrier views
- keep unified search as a zero-storage view instead of a 41 MB trigram materialized view

All election levels remain included. No township, village, indigenous, or special race was excluded to meet the capacity target.

## Upgrade-path validation

The local database was rebuilt to production's currently observed migration boundary, `202607220005`, restored from the existing data-only snapshot, and then upgraded through `202607260001`–`202607260009`.

This matters because a schema-only reset cannot apply `202607260001`: that migration references reviewed people supplied by the production-sized data snapshot rather than the repository seed. With the correct snapshot-first upgrade path, all nine migrations applied successfully.

## Published scope

The promote release recorded:

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

Candidate source URLs and the tested photo/source fields had zero parity mismatches against `public.public_candidates`. `list_is_party_only` also had zero mismatches against `public.public_people_directory`.

## Storage and promote peak

| Physical relation | Total size |
| --- | ---: |
| `candidate_facts` | 22 MB |
| `person_candidate_summaries` | 5.4 MB |
| All other materialized aggregates and release state | less than 1 MB |
| **Complete persistent published layer** | **28 MB / 29,630,464 bytes** |

During a live promote, `pg_database_size()` was sampled every 50 ms:

- minimum: 847,768,723 bytes
- maximum: 877,464,723 bytes
- measured promote peak increase: 29,696,000 bytes

Using the previously observed production size of about 416 MB, the projected future refresh peak is roughly 474 MB. A fresh production check must still pass before deployment; use 420 MB as the maximum pre-deployment database size so at least about 20 MB remains after the measured refresh peak.

`published.promote()` sets `work_mem = '64MB'` only for the function. It does not change the database or API default. The measured complete promote took 1,611.855 ms and reported zero temporary read/write blocks.

## Atomicity and permissions

- A check constraint forced failure at the final release-state insert after candidate replacement and materialized refresh work.
- The failed promote preserved both the prior release ID and all 42,052 candidate rows.
- `anon` and `authenticated` have no `USAGE` on `published`, no relation grants, and no execute privilege on `published.promote(UUID)`.
- The published schema remains absent from the Supabase API exposed-schema configuration.
- Supabase database lint reported no schema errors.

## Warm query plans

The repeatable harness is [phase-2-published-explain.sql](./phase-2-published-explain.sql).

| Query contract | Execution ms | Result rows | Maximum rows in one plan node | Temp read/write blocks |
| --- | ---: | ---: | ---: | ---: |
| People directory page | 247.592 | 20 | 57,808 | 2,306 / 2,308 |
| Search `台北` | 163.795 | 20 | 67,923 | 0 / 0 |
| Election races page | 69.282 | 20 | 8,875 | 0 / 0 |
| Event races page | 65.664 | 20 | 8,875 | 0 / 0 |
| Local-office people page | 5.169 | 20 | 11,107 | 0 / 0 |
| Race candidates page | 3.493 | 20 | 27 | 0 / 0 |
| Elections page | 1.403 | 20 | 891 | 0 / 0 |
| Person candidacies | 1.103 | 6 | 6 | 0 / 0 |
| Home region summary | 0.072 | 22 | 22 | 0 / 0 |
| Home ticker | 0.035 | 1 | 1 | 0 / 0 |

The compact option intentionally does not preserve the earlier all-queries-below-50-ms gate. Its measured tradeoff is:

- the production bottleneck—candidate canonicalization by election, race, or person—is removed from request time
- candidate reads that previously took 1.13–1.69 seconds now use the narrow physical snapshot
- home aggregates and local-office reads remain bounded
- people ordering, unified search, and race-list reads remain pass-through work at about 66–248 ms locally to avoid another 50–100 MB of persistent copies and indexes

Frontend cutover must also reduce the existing 200-row prefetches to 20 rows and stop downloading complete election graphs; a database layer alone cannot fix payload over-fetching.

## Remaining production gate

Before any frontend change:

1. confirm the branch and production project again
2. confirm current production database size is no more than 420 MB
3. review and apply prerequisite migrations `202607260001`–`202607260006`
4. apply the compact `202607260007`–`202607260009` schema without exposing it to the Data API
5. validate row parity, permissions, release metadata, measured storage, and rollback
6. run the same plan harness against production

Keep the legacy provider, exposed schemas, and public grants unchanged until this shadow validation passes.
