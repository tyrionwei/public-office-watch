# Published read layer Phase 2.5E election detail routing validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Remove the final route that downloads a complete election, all races, and all candidates.
- Preserve existing `/elections/:electionId` links from the ticker and search.
- Reuse the bounded election-event and race-detail flow.
- Add no database object, duplicated data, index, or production change.

## Decision

Optimizing the old full-detail query would not solve its payload or rendering cost. The largest current election contains 8,875 races and 20,853 candidates, and the existing client measurement was about 20.5 MB. Rendering that complete graph in one page is itself unbounded.

The legacy election URL now performs the existing bounded election-index read, resolves the election to its event, and redirects with `replace` to `/elections/events/:eventKey`. The event page then uses the Phase 2.5D contract:

- exact filtered total;
- 20 races per request;
- cursor-independent deterministic page ordering;
- candidate details loaded only after opening one race.

The obsolete asynchronous `loadElectionDetail` contract and its mock and Supabase implementations were removed so the route cannot accidentally restore the full graph download.

## Coverage and compatibility

Local published relations contain:

| Relation | Rows |
| --- | ---: |
| `published.elections` | 450 |
| `published.election_race_summaries` | 421 |
| `published.event_summaries` | 8 |

All 450 elections fit within the existing 500-row index contract. The JavaScript event-family derivation was compared with the SQL event-key family for current published data and found zero mismatches.

Existing links remain valid:

- election list already links directly to event pages;
- ticker election IDs pass through the compatibility redirect;
- search election IDs pass through the compatibility redirect;
- unknown IDs retain the existing not-found screen;
- index failures retain the existing load-error screen.

A unit contract verifies that multiple election IDs grouped into the same event resolve to the same event key and that unknown IDs fail closed.

## Performance effect

The removed production candidate query took 1,689.330 ms on warm cache, returned 20,853 rows, touched 365,903 shared buffers, and spilled to temporary storage. It ran alongside full race and election queries.

The replacement reuses the published election index measured in Phase 2.5B1:

| Read | Rows | Local execution time |
| --- | ---: | ---: |
| Election index | 450 | 2.395 ms |
| Race summaries, one 200-ID batch | up to 200 | 0.301 ms |
| Event race page, largest type | 20 of 7,748 | 31.063 ms |

A compatibility redirect may cause the event page to request the small index again. This is still bounded and several orders of magnitude smaller than the removed graph. Cache changes are deferred until browser measurements show they are necessary.

## Verification and next gate

Verification requires the read-contract suite, ESLint, production build, data-boundary checks, and a repository search confirming that no page or component calls `loadElectionDetail`.

A local browser check opened the former 2018 aggregate election URL and confirmed:

- the final URL was `/elections/events/2018-2018-11-24-local`;
- the event overview and category filters rendered;
- the first page showed 20 bounded race rows;
- the browser console contained no errors.

With this route removed, no severe unbounded public page query remains in the measured set. The next phase should be the published-provider exposure and cutover review: production migration order, PostgREST schema configuration, grants, fallback behavior, and warmed browser measurements. The current 500-election ceiling must be revisited before the published election count reaches that boundary.
