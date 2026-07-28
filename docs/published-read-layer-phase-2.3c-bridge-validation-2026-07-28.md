# Published read layer Phase 2.3C bridge validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Map the isolated published adapter output into the existing `PublicPersonListPage` and `PublicSearchResult` frontend contracts.
- Validate the bridge with an in-memory injected adapter.
- Do not import the bridge from runtime code or change the provider factory, environment flags, PostgREST exposure, grants, migrations, or production state.

## Mapping decisions

People directory rows retain the published list role, status, current-office, upcoming-candidate, district, and thumbnail snapshots. The bridge adds the labels and nullable fields required by the existing UI.

- Detail-only education, experience, photo provenance, and full-photo fields remain `null`; the list bridge does not add hidden follow-up queries.
- Candidate and merge counts remain zero rather than being inferred from incomplete list data.
- A region resolver can translate a route region ID into trusted district prefixes and a canonical display label.
- Without a resolver, the bridge uses the supplied region value as a narrow, explicit fallback.
- Current rows prefer the published current-office snapshot; candidate rows prefer the published upcoming-candidate snapshot.

Compact search rows map directly to the five existing result types. `document_key` remains the unique UI key, while the compact surface's `href` is preserved. Because migration `202607280001` intentionally omits subtitles to save space, the bridge supplies type-specific static fallback subtitles without another query.

## Verification

The bridge test first failed because the module did not exist, then passed after implementation. `npm run check` completed successfully with:

- 12 existing data-report tests;
- 11 read-contract, adapter, and bridge tests;
- ESLint and the production TypeScript/Vite build;
- the public-data boundary check;
- all existing public-view contract checks.

No runtime source imports the adapter or bridge, and the production build emitted no adapter or bridge chunk. The existing unrelated `SelectedRegionHud.tsx` mock-import warning remains unchanged.

## Decision

The local frontend contract path is ready, but runtime activation remains blocked by design. The next phase must be an explicit exposure review covering PostgREST schema configuration, minimum `anon`/`authenticated` grants, rollback flags, and production smoke tests. Do not silently register the bridge in the existing provider factory.
