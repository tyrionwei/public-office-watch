# Published read layer Phase 2.3B adapter validation — 2026-07-28

## Scope

- Branch: `codex/published-read-layer-design`
- Add an injectable query adapter for `published.people_directory` and `published.search_results`.
- Keep the adapter unregistered: no provider-factory import, environment toggle, PostgREST exposure, database grant, migration, or deployment.

## Adapter contract

The adapter accepts a minimal PostgREST-compatible client instead of creating or importing a Supabase client. This keeps credentials and runtime selection outside the adapter and allows its query behavior to be verified without exposing the private schema.

People directory reads:

- select only the 18 fields present in migration `202607280001`;
- request an exact count and at most 20 rows;
- retain the existing grassroots and party-only visibility rules;
- support name, party, trusted district-prefix, role, and status filters;
- use deterministic status, role, name, and `person_id` ordering.

Search reads:

- select only the six compact search-result fields;
- apply the shared NFC, `臺` to `台`, whitespace, and lowercase normalization;
- skip database access for queries shorter than two normalized characters;
- return at most 12 rows with deterministic entity, title, and document-key ordering.

Database errors are surfaced to the caller so a future provider integration can use its existing fallback and error-state behavior.

## Verification

The adapter tests first failed because the module did not exist, then passed after implementation. `npm run check` completed successfully with:

- 12 existing data-report tests;
- 8 read-contract and adapter tests;
- ESLint and the production TypeScript/Vite build;
- the public-data boundary check;
- all existing public-view contract checks.

The existing unrelated `SelectedRegionHud.tsx` mock-import warning remains unchanged.

## Decision

Keep the adapter isolated from runtime code. Phase 2.3C should add row-to-frontend mapping and a local-only integration harness using an injected client. Do not register a `published` provider or change production access until a separate exposure and grant review passes.
