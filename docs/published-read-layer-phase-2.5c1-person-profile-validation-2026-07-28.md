# Published read layer Phase 2.5C1 person profile validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Prioritize the measured person-candidacy bottleneck without adding database storage.
- Add a private, injectable person-profile read and map it to the existing frontend contract.
- Do not register the bridge, expose the schema, add grants, add database objects, or change production state.

The race-page adapter remains deferred. A no-storage rewrite through the existing security-barrier race view exceeded 64 seconds locally. Direct core-table experiments completed in 10.634–46.126 ms depending on filter breadth, but bypassing the reviewed published boundary is not an acceptable frontend contract. The production-shadow promote estimate still leaves only about 12.2 MiB of headroom, so this phase does not add a physical race surface.

## Bounded contract

A profile request:

- trims and de-duplicates at most four person IDs, matching the current one-person detail and four-person comparison UI;
- reads at most four `published.people` rows;
- accepts at most 100 candidate rows, 400 claim rows, and 100 party-affiliation rows;
- requests one extra sentinel row for each related collection and fails instead of returning silently truncated data;
- does not request exact counts;
- selects explicit columns and applies deterministic ordering.

The local maximums are six candidates, 79 claims, and four party affiliations for one canonical person. The limits leave room for the current four-person comparison while keeping every request bounded.

The bridge reuses the existing profile builder, so candidate history, identity rows, claim backfill, timeline items, party affiliations, and section availability statuses retain the current frontend semantics. `published.candidates` is used instead of reading `candidate_facts` directly: its source and photo joins remain indexed, the complete representative query finishes in 0.220 ms, and fields already shown by the UI are retained.

## Severe-query result

The production baseline for a single person's candidacies through `public_candidates` was 1,129.678 ms, with 99,660 shared-buffer hits and temporary-file activity. It expanded the complete canonical candidate graph before returning six rows.

The new representative candidate query returned the same six-row shape through `published.candidates` in 0.220 ms locally. The plan starts with `candidate_facts_person_history_idx` and performs indexed lookups only for those six candidates. It used 40 shared buffers and no temporary files.

This comparison is between production baseline and local shadow data, so it is not a latency benchmark. The material improvement is the plan shape: the filter is now applied by the physical person-history index before source and photo enrichment.

## Other profile plans

Representative `EXPLAIN (ANALYZE, BUFFERS)` results:

| Query | Rows | Execution time | Shared buffers | Temporary I/O |
| --- | ---: | ---: | ---: | ---: |
| Person core row | 1 | 6.957 ms | 829 | none |
| Candidate history | 6 | 0.220 ms | 40 | none |
| Claims, maximum-cardinality person | 79 | 81.243 ms | 4,648 | 821 reads / 1,446 writes |
| Party affiliations, maximum-cardinality person | 4 | 0.067 ms | 28 | none |

The four reads run concurrently, so the claims query is now the profile database-latency floor. It still expands `person_canonical_map` before applying the canonical person filter.

A direct base-table claims filter is not equivalent: for the representative canonical person it returned 11 rows instead of the published view's 79 because 68 verified claims belong to merged source identities. Replacing the view with that shortcut would silently discard published history, so it was rejected.

The claims relation currently contains 343,520 rows. A physical canonical claim snapshot may be the correct eventual fix, but its heap, indexes, refresh-time duplication, and promote headroom must be measured before it is proposed under the current free-tier capacity constraint.

## Verification

Tests first failed for the missing adapter and bridge methods. The implemented tests cover:

- four-ID normalization and rejection of oversized batches;
- fixed relation and row ceilings;
- sentinel-row truncation failure;
- complete mapping into the existing profile contract;
- preservation of candidate sources, claims, affiliations, identity data, and availability statuses.

The reviewed adapter allowlist now includes `people`, `candidates`, `person_claims`, and `person_party_affiliations`. This does not expose them: `published` remains absent from PostgREST configuration, frontend roles retain no grants, and the bridge remains unregistered.

## Decision and next gate

Commit Phase 2.5C1 as a private candidate-history improvement. Do not cut the complete person page over yet because the claims path still rebuilds the canonical merge graph.

Before person-profile exposure, choose one of these bounded next steps:

1. measure the physical size and promote peak of a compact canonical claim snapshot, proceeding only if the 10 MiB headroom gate remains intact; or
2. retain claims on the legacy path and introduce an explicit partial-profile composition contract, with UI and cache semantics reviewed before activation.

The first option preserves the cleanest published-only frontend boundary, but it must not be implemented until the storage measurement passes.
