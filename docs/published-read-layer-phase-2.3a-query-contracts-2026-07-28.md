# Published read layer Phase 2.3A query contracts — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- This phase changes only local frontend request shapes and shared read-contract constants.
- No production provider toggle, PostgREST schema exposure, database grant, migration, or deployment is included.

## Finding

The people and election-event pages each render 20 rows, but the Supabase provider grouped ten pages into one cache block. A normal page request therefore fetched up to 200 rows before rendering 20.

- People used `peoplePageBlockSize = 10`.
- Event races used `electionRacePageBlockSize = 10`.

This preserved client-side navigation cache at the cost of the payload reduction required by the published read-layer design.

## Implementation

- Both cache blocks now contain one page, so each provider request fetches only the requested page.
- `toPublicPageRange` caps list requests at 20 rows and returns an inclusive PostgREST range.
- People, event races, and global search share limits of 20, 20, and 12 rows respectively.
- The future published-search adapter has one tested normalization contract: NFC, `臺` to `台`, collapsed whitespace, and lowercase Latin text.

The adapter is not connected yet because the production `published` schema intentionally remains private. Phase 2.3B can implement the schema-specific query adapter behind dependency injection without changing the provider factory or browser credentials.

## Verification

`npm run check` passed, including:

- 12 existing data-report tests;
- 3 new read-contract tests;
- ESLint and the production TypeScript/Vite build;
- the public-data boundary check;
- all existing public-view contract checks.

The existing unrelated warning for `SelectedRegionHud.tsx` importing mock data remains unchanged.

## Decision

Keep the current provider and production defaults unchanged. Phase 2.3A removes the known 200-row over-fetch without requiring access to the private shadow schema.

Next, implement and unit-test a `published` people/search adapter that selects explicit columns from `people_directory` and `search_results`. Do not register it in the runtime provider factory until a separate exposure and grant review passes.
